/**
 * Ranking equitativo de la DÍAS LEAGUE (inspirado en el ranking de Mi OE).
 *
 * El puntaje final de cada GT (sobre 100) combina dos dimensiones, 50 % cada una:
 *
 *  1. Promedio de DÍAS POINTS por integrante = puntos acumulados ÷ integrantes
 *     activos del GT (los que tienen cero puntos también cuentan).
 *  2. Participación ajustada = promedio, entre las actividades que cuentan para
 *     el ranking, del % de integrantes del GT que participó en cada una
 *     (participantes ÷ integrantes habilitados). Al ser un porcentaje, un GT
 *     grande no gana solo por tener más gente.
 *
 * Cada dimensión se lleva a una escala de 0 a 100 tomando como 100 el mejor
 * resultado entre los nueve GT. Puntaje final = 50 % × escala 1 + 50 % × escala 2.
 *
 * ESTA FUNCIÓN ES IDÉNTICA A `public._league_ranking()` en
 * supabase/calendar_league.sql (la prueba de base de datos compara ambas).
 */
import { CalendarEvent, ConectadosClosure, LEAGUE_GTS, Person, PointActivity, PointActivityClaim, PointMovement } from '../types';

export type PointsBase = 'todos' | 'individuales';

export interface RankingConfig {
  /** Tipos de evento del calendario cuya asistencia cuenta como participación */
  countedTypes: string[];
  /** ¿Cuentan las actividades de DÍAS POINTS por QR? */
  includeQrActivities: boolean;
  /** Eventos o actividades puntuales que NO cuentan (aunque su tipo cuente) */
  excludedIds: string[];
  /**
   * Qué puntos entran al promedio:
   * - 'todos': los de cada integrante + los entregados al GT completo
   * - 'individuales': solo los de cada integrante
   */
  pointsBase: PointsBase;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  countedTypes: ['conectados', 'expectadias', 'decoracion', 'reto', 'capacitacion', 'otro'],
  includeQrActivities: true,
  excludedIds: [],
  pointsBase: 'todos',
};

export const RANKING_WEIGHTS = { points: 0.5, participation: 0.5 } as const;

export function normalizeRankingConfig(c?: Partial<RankingConfig> | null): RankingConfig {
  return {
    countedTypes: Array.isArray(c?.countedTypes) ? c!.countedTypes : DEFAULT_RANKING_CONFIG.countedTypes,
    includeQrActivities: typeof c?.includeQrActivities === 'boolean' ? c.includeQrActivities : DEFAULT_RANKING_CONFIG.includeQrActivities,
    excludedIds: Array.isArray(c?.excludedIds) ? c!.excludedIds : [],
    pointsBase: c?.pointsBase === 'individuales' ? 'individuales' : 'todos',
  };
}

/** Redondeo a 2 decimales, mitad hacia arriba, igual que `round(x, 2)` de Postgres (sin errores de coma flotante). */
const r2 = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

/** GT de la liga al que pertenece una persona (igual que `_person_primary_gt`). */
export function rankingGtOf(p: Person): string | undefined {
  if (p.primaryType === 'MESA') return undefined;
  const gt = p.gtSubTeam || p.gtTeams?.[0];
  return gt && (LEAGUE_GTS as string[]).includes(gt) ? gt : undefined;
}

export interface ParticipationEntry {
  gt: string;
  /** Integrantes habilitados (la base del %) */
  eligible: number;
  /** Participación efectiva (llegadas, con la regla de tarde/excusa del evento; o escaneos) */
  participated: number;
  /** % de participación del GT en esa actividad */
  rate: number;
}

export interface RankingActivity {
  id: string;
  kind: 'evento' | 'actividad_qr';
  name: string;
  /** Tipo de evento, o 'actividad_qr' */
  type: string;
  date: string;
  byGt: ParticipationEntry[];
}

export interface GtRankingRow {
  gt: string;
  position: number;
  /** Puntaje final sobre 100 */
  score: number;
  members: number;
  totalPoints: number;
  avgPoints: number;
  /** Promedio llevado a 0–100 (100 = mejor GT) */
  pointsScore: number;
  /** % de participación promedio */
  participation: number;
  /** Participación llevada a 0–100 (100 = mejor GT) */
  participationScore: number;
  /** Actividades en las que el GT tenía integrantes habilitados */
  activitiesCounted: number;
}

export interface LeagueRanking {
  rows: GtRankingRow[];
  activities: RankingActivity[];
}

export interface RankingInput {
  people: Person[];
  movements: PointMovement[];
  events: CalendarEvent[];
  closures: ConectadosClosure[];
  activities: PointActivity[];
  claims: PointActivityClaim[];
  /** Coincide con `isPersonInAudience` / `_in_audience` */
  inAudience: (p: Person, a: PointActivity['eligibility']) => boolean;
  config?: Partial<RankingConfig> | null;
  /** Hoy en Bogotá, AAAA-MM-DD */
  today: string;
}

/** Actividades que cuentan para la participación y el % de cada GT en cada una. */
export function rankingActivities(input: RankingInput): RankingActivity[] {
  const cfg = normalizeRankingConfig(input.config);
  const excluded = new Set(cfg.excludedIds);
  const types = new Set(cfg.countedTypes);
  const gts = LEAGUE_GTS as string[];
  const out: RankingActivity[] = [];

  // 1. Eventos del calendario con la asistencia CERRADA (resultado congelado por GT)
  const evById = new Map(input.events.map((e) => [e.id, e]));
  input.closures
    .filter((c) => c.status === 'cerrado')
    .forEach((c) => {
      const e = evById.get(c.eventId);
      if (!e || e.status !== 'activo' || !types.has(e.type) || excluded.has(e.id)) return;
      const byGt = (c.results || [])
        .filter((r) => gts.includes(r.gt) && r.denominator > 0)
        .map((r) => ({ gt: r.gt, eligible: r.denominator, participated: r.effectiveAttendance, rate: r.percentage }));
      if (byGt.length) out.push({ id: e.id, kind: 'evento', name: e.title, type: e.type, date: e.date, byGt });
    });

  // 2. Actividades de DÍAS POINTS por QR, ya terminadas (cerradas o de días anteriores)
  if (cfg.includeQrActivities) {
    const claimed = new Set(input.claims.map((c) => `${c.activityId}__${c.personId}`));
    input.activities
      .filter((a) => !excluded.has(a.id) && (a.status === 'cerrada' || a.date < input.today))
      .forEach((a) => {
        const byGt: ParticipationEntry[] = [];
        gts.forEach((gt) => {
          const eligible = input.people.filter((p) => rankingGtOf(p) === gt && input.inAudience(p, a.eligibility));
          if (eligible.length === 0) return;
          const participated = eligible.filter((p) => claimed.has(`${a.id}__${p.id}`)).length;
          byGt.push({ gt, eligible: eligible.length, participated, rate: r2((participated / eligible.length) * 100) });
        });
        if (byGt.length) out.push({ id: a.id, kind: 'actividad_qr', name: a.name, type: 'actividad_qr', date: a.date, byGt });
      });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

export function computeLeagueRanking(input: RankingInput): LeagueRanking {
  const cfg = normalizeRankingConfig(input.config);
  const gts = LEAGUE_GTS as string[];
  const activities = rankingActivities(input);
  const live = input.movements.filter((m) => !m.voided);
  const gtOfPerson = new Map(input.people.map((p) => [p.id, rankingGtOf(p)]));

  const base = gts.map((gt) => {
    const members = input.people.filter((p) => rankingGtOf(p) === gt).length;
    const individual = live
      .filter((m) => m.target === 'person' && m.personId && gtOfPerson.get(m.personId) === gt)
      .reduce((a, m) => a + m.points, 0);
    const team = cfg.pointsBase === 'todos' ? live.filter((m) => m.target === 'gt' && m.gt === gt).reduce((a, m) => a + m.points, 0) : 0;
    const totalPoints = r2(individual + team);
    const avgPoints = members > 0 ? r2(totalPoints / members) : 0;
    const rates = activities.flatMap((act) => act.byGt.filter((x) => x.gt === gt).map((x) => x.rate));
    const participation = rates.length ? r2(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
    return { gt, members, totalPoints, avgPoints, participation, activitiesCounted: rates.length };
  });

  const maxAvg = Math.max(0, ...base.map((b) => b.avgPoints));
  const maxPart = Math.max(0, ...base.map((b) => b.participation));
  const rows: GtRankingRow[] = base.map((b) => {
    const pointsScore = maxAvg > 0 ? r2((Math.max(0, b.avgPoints) / maxAvg) * 100) : 0;
    const participationScore = maxPart > 0 ? r2((b.participation / maxPart) * 100) : 0;
    const score = r2(RANKING_WEIGHTS.points * pointsScore + RANKING_WEIGHTS.participation * participationScore);
    return { ...b, position: 0, score, pointsScore, participationScore };
  });
  rows.sort((a, b) => b.score - a.score || b.avgPoints - a.avgPoints || b.participation - a.participation || gts.indexOf(a.gt) - gts.indexOf(b.gt));
  rows.forEach((r, i) => {
    r.position = i > 0 && r.score === rows[i - 1].score ? rows[i - 1].position : i + 1;
  });
  return { rows, activities };
}

/** Corte del historial (diario automático o guardado a mano por la administración). */
export interface RankingSnapshot {
  id: string;
  kind: 'diario' | 'corte';
  date: string;
  label?: string;
  rows: GtRankingRow[];
  createdBy?: string;
  updatedAt: string;
}
