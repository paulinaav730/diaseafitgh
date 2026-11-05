import * as XLSX from 'xlsx';
import {
  CalendarEvent,
  Challenge,
  ChallengeResult,
  ConectadosClosure,
  ConectadosGtResult,
  ConectadosScoring,
  ConectadosStatus,
  CONECTADOS_STATUS_LABELS,
  EventAttendance,
  IndividualAward,
  LEAGUE_GTS,
  LeagueSettings,
  Person,
  PointCategory,
  PointMovement,
  POINT_CATEGORY_LABELS,
} from '../types';
import { createSyncedCollection, newId } from './syncedCollection';
import { personPrimaryGt, todayIso } from './calendarService';

// ============================================================================
// Colecciones
// ============================================================================

export const DEFAULT_CONECTADOS_SCORING: ConectadosScoring = {
  maxGtPoints: 20,
  individualPoints: { asistio: 5, tarde: 3, excusa: 0 },
  lateWeight: 1,
  excuseMode: 'excluir',
};

export const leagueSettings = createSyncedCollection<LeagueSettings>({
  storageKey: 'dias_eafit_league_settings',
  table: 'league_settings',
  toRow: (s) => ({ id: s.id, default_conectados_scoring: s.defaultConectadosScoring, updated_at: s.updatedAt }),
  fromRow: (r) => ({
    id: 'default',
    defaultConectadosScoring: { ...DEFAULT_CONECTADOS_SCORING, ...(r.default_conectados_scoring || {}) },
    updatedAt: r.updated_at,
  }),
});

export const eventAttendances = createSyncedCollection<EventAttendance>({
  storageKey: 'dias_eafit_event_attendances',
  table: 'event_attendances',
  toRow: (a) => ({
    id: a.id,
    event_id: a.eventId,
    person_id: a.personId,
    status: a.status,
    excuse_reason: a.excuseReason ?? null,
    registered_by: a.registeredBy ?? null,
    updated_at: a.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id,
    eventId: r.event_id,
    personId: r.person_id,
    status: r.status,
    excuseReason: r.excuse_reason ?? undefined,
    registeredBy: r.registered_by ?? undefined,
    updatedAt: r.updated_at,
  }),
});

export const conectadosClosures = createSyncedCollection<ConectadosClosure>({
  storageKey: 'dias_eafit_conectados_closures',
  table: 'conectados_closures',
  toRow: (c) => ({
    id: c.id,
    event_id: c.eventId,
    scoring: c.scoring,
    results: c.results,
    status: c.status,
    closed_at: c.closedAt,
    closed_by: c.closedBy,
    reopened_at: c.reopenedAt ?? null,
    reopened_by: c.reopenedBy ?? null,
    reopen_reason: c.reopenReason ?? null,
    updated_at: c.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id,
    eventId: r.event_id,
    scoring: r.scoring,
    results: r.results || [],
    status: r.status,
    closedAt: r.closed_at,
    closedBy: r.closed_by,
    reopenedAt: r.reopened_at ?? undefined,
    reopenedBy: r.reopened_by ?? undefined,
    reopenReason: r.reopen_reason ?? undefined,
    updatedAt: r.updated_at,
  }),
});

export const challenges = createSyncedCollection<Challenge>({
  storageKey: 'dias_eafit_challenges',
  table: 'league_challenges',
  toRow: (c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    rules: c.rules ?? null,
    start_date: c.startDate,
    end_date: c.endDate,
    gt_teams: c.gtTeams,
    placements: c.placements,
    status: c.status,
    evidences: c.evidences,
    results: c.results,
    individual_awards: c.individualAwards,
    results_registered_at: c.resultsRegisteredAt ?? null,
    results_registered_by: c.resultsRegisteredBy ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    rules: r.rules ?? undefined,
    startDate: r.start_date,
    endDate: r.end_date,
    gtTeams: r.gt_teams || [],
    placements: r.placements || [],
    status: r.status,
    evidences: r.evidences || [],
    results: r.results || [],
    individualAwards: r.individual_awards || [],
    resultsRegisteredAt: r.results_registered_at ?? undefined,
    resultsRegisteredBy: r.results_registered_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),
});

export const pointMovements = createSyncedCollection<PointMovement>({
  storageKey: 'dias_eafit_point_movements',
  table: 'point_movements',
  toRow: (m) => ({
    id: m.id,
    activity_date: m.date,
    target: m.target,
    gt: m.gt ?? null,
    person_id: m.personId ?? null,
    points: m.points,
    category: m.category,
    source_type: m.sourceType ?? null,
    source_id: m.sourceId ?? null,
    activity_name: m.activityName,
    reason: m.reason ?? null,
    evidence_url: m.evidenceUrl ?? null,
    registered_by: m.registeredBy,
    created_at: m.createdAt,
    voided: !!m.voided,
    voided_at: m.voidedAt ?? null,
    voided_by: m.voidedBy ?? null,
    void_reason: m.voidReason ?? null,
  }),
  fromRow: (r) => ({
    id: r.id,
    date: r.activity_date,
    target: r.target,
    gt: r.gt ?? undefined,
    personId: r.person_id ?? undefined,
    points: Number(r.points),
    category: r.category,
    sourceType: r.source_type ?? undefined,
    sourceId: r.source_id ?? undefined,
    activityName: r.activity_name,
    reason: r.reason ?? undefined,
    evidenceUrl: r.evidence_url ?? undefined,
    registeredBy: r.registered_by,
    createdAt: r.created_at,
    voided: !!r.voided,
    voidedAt: r.voided_at ?? undefined,
    voidedBy: r.voided_by ?? undefined,
    voidReason: r.void_reason ?? undefined,
  }),
});

export function getDefaultScoring(): ConectadosScoring {
  return leagueSettings.get('default')?.defaultConectadosScoring ?? DEFAULT_CONECTADOS_SCORING;
}

export function saveDefaultScoring(scoring: ConectadosScoring) {
  leagueSettings.upsert({ id: 'default', defaultConectadosScoring: scoring, updatedAt: new Date().toISOString() });
}

// ============================================================================
// Cálculos (funciones puras: fáciles de probar)
// ============================================================================

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Integrantes activos de un GT (por GT principal). */
export function gtMembers(people: Person[], gt: string): Person[] {
  return people.filter((p) => p.isActive !== false && personPrimaryGt(p) === gt);
}

/** GT que participan en un CONECTADOS según sus destinatarios. */
export function conectadosGts(ev: CalendarEvent): string[] {
  const a = ev.audience;
  if (a.all || a.gtTeams.length === 0) return [...LEAGUE_GTS];
  return LEAGUE_GTS.filter((g) => a.gtTeams.includes(g));
}

/**
 * Calcula el % de asistencia y los DÍAS POINTS de cada GT para un CONECTADOS.
 *
 *   % = asistencia efectiva / denominador × 100
 *   puntos = puntos máximos × % / 100
 *
 * - Denominador: integrantes activos y habilitados del GT (los marcados como
 *   "No habilitado" no cuentan).
 * - Llegada tarde: suma `lateWeight` (1 = cuenta completa).
 * - Excusa válida según `excuseMode`:
 *     'excluir'    → no suma ni resta: sale del denominador (no penaliza).
 *     'asistencia' → cuenta como si hubiera asistido.
 *     'ausencia'   → cuenta como inasistencia.
 * - Quien no tenga registro se cuenta como "No asistió".
 */
export function computeConectadosResults(
  scoring: ConectadosScoring,
  gts: string[],
  people: Person[],
  statusOf: (personId: string) => ConectadosStatus | undefined
): ConectadosGtResult[] {
  return gts.map((gt) => {
    const counts = { asistio: 0, tarde: 0, excusa: 0, ausente: 0 };
    let enabled = 0;
    gtMembers(people, gt).forEach((p) => {
      const st = statusOf(p.id) ?? 'ausente';
      if (st === 'no_aplica') return;
      enabled++;
      counts[st]++;
    });
    let denominator = enabled;
    let effective = counts.asistio + counts.tarde * scoring.lateWeight;
    if (scoring.excuseMode === 'excluir') denominator -= counts.excusa;
    else if (scoring.excuseMode === 'asistencia') effective += counts.excusa;
    const percentage = denominator > 0 ? round2((effective / denominator) * 100) : 0;
    return {
      gt,
      enabled,
      attended: counts.asistio,
      late: counts.tarde,
      excused: counts.excusa,
      absent: counts.ausente,
      denominator,
      effectiveAttendance: round2(effective),
      percentage,
      points: round2((scoring.maxGtPoints * percentage) / 100),
    };
  });
}

export function individualPointsFor(scoring: ConectadosScoring, status: ConectadosStatus): number {
  if (status === 'asistio') return scoring.individualPoints.asistio;
  if (status === 'tarde') return scoring.individualPoints.tarde;
  if (status === 'excusa') return scoring.individualPoints.excusa;
  return 0;
}

export interface GtStanding {
  gt: string;
  position: number;
  total: number;
  retos: number;
  conectados: number;
  otros: number;
  /** Puntos acumulados por fecha, para la gráfica de evolución */
  evolution: { date: string; total: number }[];
}

const activeMovements = (ms: PointMovement[]) => ms.filter((m) => !m.voided);

export function computeGtStandings(movements: PointMovement[], gts: string[] = LEAGUE_GTS): GtStanding[] {
  const gtMoves = activeMovements(movements).filter((m) => m.target === 'gt' && m.gt);
  const dates = [...new Set(gtMoves.map((m) => m.date))].sort();
  const rows = gts.map((gt) => {
    const mine = gtMoves.filter((m) => m.gt === gt);
    const sum = (f: (m: PointMovement) => boolean) => round2(mine.filter(f).reduce((a, m) => a + m.points, 0));
    let acc = 0;
    const evolution = dates.map((date) => {
      acc += mine.filter((m) => m.date === date).reduce((a, m) => a + m.points, 0);
      return { date, total: round2(acc) };
    });
    return {
      gt,
      position: 0,
      total: sum(() => true),
      retos: sum((m) => m.category === 'reto'),
      conectados: sum((m) => m.category === 'conectados'),
      otros: sum((m) => m.category === 'manual' || m.category === 'correccion'),
      evolution,
    };
  });
  rows.sort((a, b) => b.total - a.total || a.gt.localeCompare(b.gt));
  // Empates comparten puesto (1, 1, 3…)
  rows.forEach((r, i) => {
    r.position = i > 0 && r.total === rows[i - 1].total ? rows[i - 1].position : i + 1;
  });
  return rows;
}

export interface PersonStanding {
  personId: string;
  name: string;
  gt?: string;
  position: number;
  total: number;
  activities: number;
  movements: PointMovement[];
}

export function computePersonStandings(
  movements: PointMovement[],
  people: Person[],
  opts: { gt?: string; from?: string; to?: string } = {}
): PersonStanding[] {
  const moves = activeMovements(movements).filter(
    (m) =>
      m.target === 'person' &&
      m.personId &&
      (!opts.from || m.date >= opts.from) &&
      (!opts.to || m.date <= opts.to)
  );
  const byPerson = new Map<string, PointMovement[]>();
  moves.forEach((m) => byPerson.set(m.personId!, [...(byPerson.get(m.personId!) || []), m]));
  const rows: PersonStanding[] = [];
  byPerson.forEach((ms, personId) => {
    const person = people.find((p) => p.id === personId);
    const gt = (person && personPrimaryGt(person)) || ms[ms.length - 1]?.gt;
    if (opts.gt && gt !== opts.gt) return;
    rows.push({
      personId,
      name: person?.name || 'Persona eliminada',
      gt,
      position: 0,
      total: round2(ms.reduce((a, m) => a + m.points, 0)),
      activities: new Set(ms.map((m) => m.sourceId || m.activityName)).size,
      movements: [...ms].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    });
  });
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  rows.forEach((r, i) => {
    r.position = i > 0 && r.total === rows[i - 1].total ? rows[i - 1].position : i + 1;
  });
  return rows;
}

// ============================================================================
// Acciones
// ============================================================================

function movement(data: Omit<PointMovement, 'id' | 'createdAt'>): PointMovement {
  return { ...data, points: round2(data.points), id: newId('pts'), createdAt: new Date().toISOString() };
}

export function setEventAttendance(
  eventId: string,
  personId: string,
  status: ConectadosStatus,
  author: string,
  excuseReason?: string
) {
  eventAttendances.upsert({
    id: `${eventId}__${personId}`,
    eventId,
    personId,
    status,
    excuseReason: status === 'excusa' ? excuseReason : undefined,
    registeredBy: author,
    updatedAt: new Date().toISOString(),
  });
}

export function setEventAttendanceBulk(eventId: string, personIds: string[], status: ConectadosStatus, author: string) {
  const now = new Date().toISOString();
  eventAttendances.upsertMany(
    personIds.map((personId) => ({
      id: `${eventId}__${personId}`,
      eventId,
      personId,
      status,
      registeredBy: author,
      updatedAt: now,
    }))
  );
}

export function getClosure(eventId: string): ConectadosClosure | undefined {
  const c = conectadosClosures.get(eventId);
  return c && c.status === 'cerrado' ? c : undefined;
}

/** Cierra la asistencia de un CONECTADOS: congela los resultados y registra los DÍAS POINTS. */
export function closeConectados(ev: CalendarEvent, people: Person[], author: string): ConectadosClosure {
  if (getClosure(ev.id)) throw new Error('Este CONECTADOS ya está cerrado.');
  const scoring = ev.scoring ?? getDefaultScoring();
  const statusMap = new Map(
    eventAttendances
      .getAll()
      .filter((a) => a.eventId === ev.id)
      .map((a) => [a.personId, a.status] as const)
  );
  const gts = conectadosGts(ev);
  const results = computeConectadosResults(scoring, gts, people, (id) => statusMap.get(id));

  const base = {
    date: ev.date,
    category: 'conectados' as PointCategory,
    sourceType: 'conectados' as const,
    sourceId: ev.id,
    activityName: ev.title,
    registeredBy: author,
  };
  const moves: PointMovement[] = [];
  results
    .filter((r) => r.points > 0)
    .forEach((r) =>
      moves.push(
        movement({
          ...base,
          target: 'gt',
          gt: r.gt,
          points: r.points,
          reason: `Asistencia ${r.percentage}% (${r.effectiveAttendance}/${r.denominator}) × ${scoring.maxGtPoints} pts máx.`,
        })
      )
    );
  gts.forEach((gt) =>
    gtMembers(people, gt).forEach((p) => {
      const st = statusMap.get(p.id) ?? 'ausente';
      const pts = individualPointsFor(scoring, st);
      if (pts > 0) {
        moves.push(
          movement({ ...base, target: 'person', personId: p.id, gt, points: pts, reason: CONECTADOS_STATUS_LABELS[st] })
        );
      }
    })
  );
  pointMovements.upsertMany(moves);

  const now = new Date().toISOString();
  const closure: ConectadosClosure = {
    id: ev.id,
    eventId: ev.id,
    scoring,
    results,
    status: 'cerrado',
    closedAt: now,
    closedBy: author,
    updatedAt: now,
  };
  conectadosClosures.upsert(closure);
  return closure;
}

/** Reabre un CONECTADOS cerrado: anula (no borra) los puntos que había generado. */
export function reopenConectados(eventId: string, author: string, reason: string) {
  const c = conectadosClosures.get(eventId);
  if (!c) return;
  voidMovementsBySource('conectados', eventId, author, `Reapertura de asistencia: ${reason}`);
  const now = new Date().toISOString();
  conectadosClosures.upsert({ ...c, status: 'reabierto', reopenedAt: now, reopenedBy: author, reopenReason: reason, updatedAt: now });
}

function voidMovementsBySource(sourceType: 'conectados' | 'reto', sourceId: string, author: string, reason: string) {
  const now = new Date().toISOString();
  const toVoid = pointMovements
    .getAll()
    .filter((m) => m.sourceType === sourceType && m.sourceId === sourceId && !m.voided);
  pointMovements.upsertMany(toVoid.map((m) => ({ ...m, voided: true, voidedAt: now, voidedBy: author, voidReason: reason })));
}

export function saveChallenge(
  data: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'results' | 'individualAwards'> & { id?: string }
): Challenge {
  const now = new Date().toISOString();
  const existing = data.id ? challenges.get(data.id) : undefined;
  const c: Challenge = {
    results: [],
    individualAwards: [],
    ...existing,
    ...data,
    id: existing?.id ?? newId('reto'),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  challenges.upsert(c);
  return c;
}

/**
 * Registra (o corrige) los resultados de un reto. Si ya tenía resultados,
 * los puntos anteriores se anulan con trazabilidad y se registran los nuevos.
 */
export function registerChallengeResults(
  challengeId: string,
  results: ChallengeResult[],
  awards: IndividualAward[],
  people: Person[],
  author: string,
  activityDate: string = todayIso()
) {
  const c = challenges.get(challengeId);
  if (!c) throw new Error('Reto no encontrado');
  if (c.resultsRegisteredAt) {
    voidMovementsBySource('reto', c.id, author, 'Resultados del reto corregidos');
  }
  const base = {
    date: activityDate,
    category: 'reto' as PointCategory,
    sourceType: 'reto' as const,
    sourceId: c.id,
    activityName: c.name,
    registeredBy: author,
    evidenceUrl: c.evidences[0]?.url,
  };
  const moves: PointMovement[] = [
    ...results
      .filter((r) => r.points !== 0)
      .map((r) =>
        movement({
          ...base,
          target: 'gt',
          gt: r.gt,
          points: r.points,
          reason: r.position ? `Puesto ${r.position}` : 'Puntos del reto',
        })
      ),
    ...awards
      .filter((a) => a.points !== 0)
      .map((a) => {
        const p = people.find((x) => x.id === a.personId);
        return movement({
          ...base,
          target: 'person',
          personId: a.personId,
          gt: p ? personPrimaryGt(p) : undefined,
          points: a.points,
          reason: a.reason || 'Reconocimiento individual',
        });
      }),
  ];
  pointMovements.upsertMany(moves);
  const now = new Date().toISOString();
  challenges.upsert({
    ...c,
    results,
    individualAwards: awards,
    status: 'finalizado',
    resultsRegisteredAt: now,
    resultsRegisteredBy: author,
    updatedAt: now,
  });
}

export function addManualMovement(data: {
  target: 'gt' | 'person';
  gt?: string;
  person?: Person;
  points: number;
  activityName: string;
  reason: string;
  date: string;
  evidenceUrl?: string;
  category?: PointCategory;
  author: string;
}): PointMovement {
  const m = movement({
    date: data.date,
    target: data.target,
    gt: data.target === 'gt' ? data.gt : data.person ? personPrimaryGt(data.person) : undefined,
    personId: data.target === 'person' ? data.person?.id : undefined,
    points: data.points,
    category: data.category ?? 'manual',
    sourceType: 'manual',
    activityName: data.activityName,
    reason: data.reason,
    evidenceUrl: data.evidenceUrl || undefined,
    registeredBy: data.author,
  });
  pointMovements.upsert(m);
  return m;
}

/** Anula un movimiento (queda en el historial marcado como anulado). */
export function voidMovement(id: string, author: string, reason: string) {
  const m = pointMovements.get(id);
  if (!m || m.voided) return;
  pointMovements.upsert({ ...m, voided: true, voidedAt: new Date().toISOString(), voidedBy: author, voidReason: reason });
}

// ============================================================================
// Exportar reportes
// ============================================================================

export function exportLeagueReport(people: Person[], events: CalendarEvent[]) {
  const moves = pointMovements.getAll();
  const wb = XLSX.utils.book_new();

  const gtRows = computeGtStandings(moves).map((s) => ({
    Puesto: s.position,
    GT: s.gt,
    'Total DÍAS POINTS': s.total,
    Retos: s.retos,
    Conectados: s.conectados,
    Otros: s.otros,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gtRows), 'Ranking GT');

  const personRows = computePersonStandings(moves, people).map((s) => ({
    Puesto: s.position,
    Nombre: s.name,
    GT: s.gt || '',
    'Total DÍAS POINTS': s.total,
    Actividades: s.activities,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(personRows), 'Ranking individual');

  const name = (id?: string) => (id ? people.find((p) => p.id === id)?.name || id : '');
  const moveRows = [...moves]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({
      Fecha: m.date,
      Actividad: m.activityName,
      Tipo: POINT_CATEGORY_LABELS[m.category],
      Destino: m.target === 'gt' ? 'GT' : 'Persona',
      GT: m.gt || '',
      Persona: name(m.personId),
      Puntos: m.points,
      Motivo: m.reason || '',
      Evidencia: m.evidenceUrl || '',
      'Registrado por': m.registeredBy,
      'Registrado el': m.createdAt,
      Estado: m.voided ? 'ANULADO' : 'Vigente',
      'Anulado por': m.voidedBy || '',
      'Motivo anulación': m.voidReason || '',
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(moveRows), 'Movimientos');

  const closureRows: Record<string, unknown>[] = [];
  conectadosClosures
    .getAll()
    .filter((c) => c.status === 'cerrado')
    .forEach((c) => {
      const ev = events.find((e) => e.id === c.eventId);
      c.results.forEach((r) =>
        closureRows.push({
          Conectados: ev?.title || c.eventId,
          Fecha: ev?.date || '',
          GT: r.gt,
          Habilitados: r.enabled,
          Asistieron: r.attended,
          Tarde: r.late,
          Excusas: r.excused,
          'No asistieron': r.absent,
          'Denominador usado': r.denominator,
          '% Asistencia': r.percentage,
          'Puntos máx.': c.scoring.maxGtPoints,
          'DÍAS POINTS': r.points,
        })
      );
    });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(closureRows), 'Conectados');

  XLSX.writeFile(wb, `DIAS_LEAGUE_${todayIso()}.xlsx`);
}
