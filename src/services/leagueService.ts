import * as XLSX from 'xlsx';
import {
  AttendanceState,
  ATTENDANCE_STATE_LABELS,
  AuditEntry,
  CalendarEvent,
  Challenge,
  ChallengeResult,
  ConectadosClosure,
  ConectadosGtResult,
  ConectadosScoring,
  EventAttendance,
  IndividualAward,
  LEAGUE_GTS,
  LeagueSettings,
  Person,
  PersonProfileData,
  PointActivity,
  PointActivityClaim,
  PointCategory,
  PointMovement,
  POINT_CATEGORY_LABELS,
} from '../types';
import { createSyncedCollection, newId, randomToken } from './syncedCollection';
import { getCurrentSession } from './session';
import { isPersonInAudience, normalizeAudience, personPrimaryGt, privateRead, todayIso, calendarEvents } from './calendarService';
import { computeLeagueRanking, GtRankingRow, LeagueRanking, RankingConfig, RankingSnapshot } from './leagueRanking';

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
  fromRow: (r) => ({
    id: 'default',
    defaultConectadosScoring: { ...DEFAULT_CONECTADOS_SCORING, ...(r.default_conectados_scoring || {}) },
    rankingConfig: r.ranking_config ?? undefined,
    updatedAt: r.updated_at,
  }),
});

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
/** Filas del ranking que llegan del servidor (los números de Postgres pueden venir como texto). */
export function rankingRowsFromServer(rows: any[]): GtRankingRow[] {
  return (rows || []).map((r) => ({
    gt: r.gt,
    position: num(r.position),
    score: num(r.score),
    members: num(r.members),
    totalPoints: num(r.totalPoints),
    avgPoints: num(r.avgPoints),
    pointsScore: num(r.pointsScore),
    participation: num(r.participation),
    participationScore: num(r.participationScore),
    activitiesCounted: num(r.activitiesCounted),
  }));
}

/** Historial del ranking: un registro por día (automático) y cortes con nombre. */
export const rankingHistory = createSyncedCollection<RankingSnapshot>({
  storageKey: 'dias_eafit_ranking_history',
  table: 'league_ranking_history',
  fromRow: (r) => ({
    id: r.id,
    kind: r.kind,
    date: String(r.snapshot_date).slice(0, 10),
    label: r.label ?? undefined,
    rows: rankingRowsFromServer(r.rows),
    createdBy: r.created_by ?? undefined,
    updatedAt: r.updated_at,
  }),
});

export function attendanceFromRow(r: any): EventAttendance {
  return {
    id: r.id,
    eventId: r.event_id,
    personId: r.person_id,
    status: r.status,
    source: r.source || 'manual',
    checkedInAt: r.checked_in_at ?? undefined,
    observation: r.observation ?? undefined,
    excuseReason: r.excuse_reason ?? undefined,
    excuseEvidenceUrl: r.excuse_evidence_url ?? undefined,
    excuseApprovedBy: r.excuse_approved_by ?? undefined,
    excuseApprovedAt: r.excuse_approved_at ?? undefined,
    updatedBy: r.updated_by ?? undefined,
    updatedAt: r.updated_at,
  };
}

/** Asistencias: privadas. El admin ve todas; el integrante solo las suyas. */
export const eventAttendances = createSyncedCollection<EventAttendance>({
  storageKey: 'dias_eafit_event_attendances',
  table: 'event_attendances',
  fromRow: attendanceFromRow,
  loader: async () => {
    const s = getCurrentSession();
    if (s?.role === 'admin') return privateRead('admin_list_event_attendance', { p_event_id: null }, 'admin');
    if (s?.role === 'staff') return privateRead('my_attendance', {}, 'staff');
    return [];
  },
});

export function closureFromRow(r: any): ConectadosClosure {
  return {
    id: r.id,
    eventId: r.event_id,
    scoring: r.scoring ?? undefined,
    results: (r.results || []).map((x: any) => ({ ...x, percentage: Number(x.percentage), points: Number(x.points) })),
    status: r.status,
    closedAt: r.closed_at,
    closedBy: r.closed_by,
    reopenedAt: r.reopened_at ?? undefined,
    reopenedBy: r.reopened_by ?? undefined,
    reopenReason: r.reopen_reason ?? undefined,
    updatedAt: r.updated_at,
  };
}

export const conectadosClosures = createSyncedCollection<ConectadosClosure>({
  storageKey: 'dias_eafit_conectados_closures',
  table: 'conectados_closures',
  fromRow: closureFromRow,
});

export function challengeFromRow(r: any): Challenge {
  return {
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
  };
}

export const challenges = createSyncedCollection<Challenge>({
  storageKey: 'dias_eafit_challenges',
  table: 'league_challenges',
  fromRow: challengeFromRow,
});

export function movementFromRow(r: any): PointMovement {
  return {
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
    observation: r.observation ?? undefined,
    evidenceUrl: r.evidence_url ?? undefined,
    correctsId: r.corrects_id ?? undefined,
    previousPoints: r.previous_points != null ? Number(r.previous_points) : undefined,
    newPoints: r.new_points != null ? Number(r.new_points) : undefined,
    registeredBy: r.registered_by,
    createdAt: r.created_at,
    voided: !!r.voided,
    voidedAt: r.voided_at ?? undefined,
    voidedBy: r.voided_by ?? undefined,
    voidReason: r.void_reason ?? undefined,
  };
}

export const pointMovements = createSyncedCollection<PointMovement>({
  storageKey: 'dias_eafit_point_movements',
  table: 'point_movements',
  fromRow: movementFromRow,
});

export function activityFromRow(r: any): PointActivity {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    challengeId: r.challenge_id ?? undefined,
    individualPoints: Number(r.individual_points),
    gtPoints: Number(r.gt_points),
    eligibility: normalizeAudience(r.eligibility),
    mechanism: r.mechanism,
    status: r.status,
    date: r.activity_date,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const pointActivities = createSyncedCollection<PointActivity>({
  storageKey: 'dias_eafit_point_activities',
  table: 'point_activities',
  fromRow: activityFromRow,
});

export const activityClaims = createSyncedCollection<PointActivityClaim>({
  storageKey: 'dias_eafit_point_activity_claims',
  table: 'point_activity_claims',
  fromRow: (r) => ({
    id: r.id,
    activityId: r.activity_id,
    personId: r.person_id,
    source: r.source,
    registeredBy: r.registered_by,
    claimedAt: r.claimed_at,
  }),
});

// --- Solo modo local (en producción estos datos son privados del servidor) ---
interface LocalQr {
  id: string; // eventId / activityId
  token: string;
  enabled: boolean;
  renewedAt: string;
}
export const localProfiles = createSyncedCollection<PersonProfileData & { id: string }>({
  storageKey: 'dias_eafit_person_profiles',
  table: 'person_profiles',
  fromRow: (r) => r,
});
export const localEventQrs = createSyncedCollection<LocalQr>({ storageKey: 'dias_eafit_event_qr', table: 'event_qr_codes', fromRow: (r) => r });
export const localActivityQrs = createSyncedCollection<LocalQr>({ storageKey: 'dias_eafit_activity_qr', table: 'point_activity_qr', fromRow: (r) => r });
export const localAudit = createSyncedCollection<AuditEntry & { id: string }>({ storageKey: 'dias_eafit_audit_log', table: 'admin_audit_log', fromRow: (r) => r });

export function getDefaultScoring(): ConectadosScoring {
  return leagueSettings.get('default')?.defaultConectadosScoring ?? DEFAULT_CONECTADOS_SCORING;
}

// ============================================================================
// Cálculos (funciones puras, idénticas a las del servidor)
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
 * % de asistencia y DÍAS POINTS de cada GT para un CONECTADOS.
 *
 *   % = asistencia efectiva / integrantes habilitados × 100
 *   puntos = puntos máximos × % / 100
 *
 * - "No habilitado" no cuenta en el denominador.
 * - Llegó tarde suma `lateWeight` (1 = completa).
 * - Excusa válida según `excuseMode`: 'excluir' (sale del total: no penaliza),
 *   'asistencia' (cuenta como llegó) o 'ausencia' (cuenta como no asistió).
 * - PENDIENTE cuenta como no asistió en el cálculo (al cerrar, pasa a NO ASISTIÓ).
 */
export function computeConectadosResults(
  scoring: ConectadosScoring,
  gts: string[],
  people: Person[],
  statusOf: (personId: string) => AttendanceState | undefined,
  /** Solo cuentan los invitados (por defecto, todos los integrantes del GT) */
  audience?: CalendarEvent['audience']
): ConectadosGtResult[] {
  return gts.map((gt) => {
    const c = { llego: 0, llego_tarde: 0, excusa: 0, no_asistio: 0, pendiente: 0 };
    let enabled = 0;
    gtMembers(people, gt).forEach((p) => {
      if (audience && !isPersonInAudience(p, audience)) return;
      const st = statusOf(p.id) ?? 'pendiente';
      if (st === 'no_aplica') return;
      enabled++;
      c[st]++;
    });
    let denominator = enabled;
    let effective = c.llego + c.llego_tarde * scoring.lateWeight;
    if (scoring.excuseMode === 'excluir') denominator -= c.excusa;
    else if (scoring.excuseMode === 'asistencia') effective += c.excusa;
    const percentage = denominator > 0 ? round2((effective / denominator) * 100) : 0;
    return {
      gt,
      enabled,
      attended: c.llego,
      late: c.llego_tarde,
      excused: c.excusa,
      absent: c.no_asistio + c.pendiente,
      pending: c.pendiente,
      denominator,
      effectiveAttendance: round2(effective),
      percentage,
      points: round2((scoring.maxGtPoints * percentage) / 100),
    };
  });
}

export function individualPointsFor(scoring: ConectadosScoring, status: AttendanceState): number {
  if (status === 'llego') return scoring.individualPoints.asistio;
  if (status === 'llego_tarde') return scoring.individualPoints.tarde;
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
      retos: sum((m) => m.category === 'reto' || m.category === 'actividad'),
      conectados: sum((m) => m.category === 'conectados'),
      otros: sum((m) => m.category === 'manual' || m.category === 'correccion'),
      evolution,
    };
  });
  rows.sort((a, b) => b.total - a.total || a.gt.localeCompare(b.gt));
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
  /** Retos y actividades en los que recibió puntos */
  challengesCompleted: number;
  /** Conectados con asistencia (llegó o llegó tarde) que dieron puntos */
  attendances: number;
  movements: PointMovement[];
}

export function computePersonStandings(
  movements: PointMovement[],
  people: Person[],
  opts: { gt?: string; from?: string; to?: string } = {}
): PersonStanding[] {
  const moves = activeMovements(movements).filter(
    (m) => m.target === 'person' && m.personId && (!opts.from || m.date >= opts.from) && (!opts.to || m.date <= opts.to)
  );
  const byPerson = new Map<string, PointMovement[]>();
  moves.forEach((m) => byPerson.set(m.personId!, [...(byPerson.get(m.personId!) || []), m]));
  const rows: PersonStanding[] = [];
  byPerson.forEach((ms, personId) => {
    const person = people.find((p) => p.id === personId);
    const gt = (person && personPrimaryGt(person)) || ms[ms.length - 1]?.gt;
    if (opts.gt && gt !== opts.gt) return;
    const sources = (f: (m: PointMovement) => boolean) => new Set(ms.filter(f).map((m) => m.sourceId || m.activityName)).size;
    rows.push({
      personId,
      name: person?.name || 'Persona eliminada',
      gt,
      position: 0,
      total: round2(ms.reduce((a, m) => a + m.points, 0)),
      activities: sources(() => true),
      challengesCompleted: sources((m) => m.category === 'reto' || m.category === 'actividad'),
      attendances: sources((m) => m.category === 'conectados'),
      movements: [...ms].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    });
  });
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  rows.forEach((r, i) => {
    r.position = i > 0 && r.total === rows[i - 1].total ? rows[i - 1].position : i + 1;
  });
  return rows;
}

export function getClosure(eventId: string): ConectadosClosure | undefined {
  const c = conectadosClosures.get(eventId);
  return c && c.status === 'cerrado' ? c : undefined;
}

// ============================================================================
// Implementación LOCAL (demo / desarrollo sin Supabase).
// Replica las reglas de supabase/calendar_league.sql. En producción todo esto
// lo hace el servidor: el navegador no puede escribir puntos ni asistencias.
// ============================================================================

export class LocalError extends Error {}
const fail = (msg: string): never => {
  throw new LocalError(msg);
};

const now = () => new Date().toISOString();

export function audit(admin: string, action: string, entity: string, entityId: string | undefined, before: unknown, after: unknown, reason?: string) {
  localAudit.upsert({ id: newId('aud'), at: now(), adminName: admin, action, entity, entityId, before, after, reason });
}

function movement(data: Omit<PointMovement, 'id' | 'createdAt'>): PointMovement {
  return { ...data, points: round2(data.points), id: newId('pts'), createdAt: now() };
}

export function localEnsureProfile(personId: string): PersonProfileData {
  const existing = localProfiles.get(personId);
  if (existing) return existing;
  const pr = { id: personId, personId, qrToken: randomToken() };
  localProfiles.upsert(pr);
  return pr;
}

export function localQr(store: typeof localEventQrs, id: string, action: 'ver' | 'habilitar' | 'cerrar' | 'renovar') {
  let q = store.get(id) ?? { id, token: randomToken(), enabled: true, renewedAt: now() };
  if (action === 'habilitar') q = { ...q, enabled: true };
  if (action === 'cerrar') q = { ...q, enabled: false };
  if (action === 'renovar') q = { ...q, token: randomToken(), enabled: true, renewedAt: now() };
  store.upsert(q);
  return q;
}

export function localSetAttendance(
  eventId: string,
  personIds: string[],
  status: AttendanceState,
  admin: string,
  extra: { observation?: string; excuseReason?: string; evidenceUrl?: string } = {}
): EventAttendance[] {
  if (getClosure(eventId)) fail('La asistencia está cerrada. Reábrela para corregirla.');
  const out: EventAttendance[] = [];
  personIds.forEach((personId) => {
    const id = `${eventId}__${personId}`;
    const prev = eventAttendances.get(id);
    const arrived = status === 'llego' || status === 'llego_tarde';
    const rec: EventAttendance = {
      id,
      eventId,
      personId,
      status,
      source: prev?.source === 'qr' && arrived ? 'qr' : 'manual',
      checkedInAt: arrived ? prev?.checkedInAt ?? now() : prev?.checkedInAt,
      observation: extra.observation || prev?.observation,
      excuseReason: status === 'excusa' ? extra.excuseReason : undefined,
      excuseEvidenceUrl: status === 'excusa' ? extra.evidenceUrl : undefined,
      excuseApprovedBy: status === 'excusa' ? admin : undefined,
      excuseApprovedAt: status === 'excusa' ? now() : undefined,
      updatedBy: admin,
      updatedAt: now(),
    };
    audit(admin, 'asistencia', 'event_attendances', id, prev, rec);
    out.push(rec);
  });
  eventAttendances.upsertMany(out);
  return out;
}

export type CheckinResult = { result: 'registrada' | 'ya_registrada'; eventTitle: string; status: AttendanceState; checkedInAt?: string };

export function localCheckin(token: string, person: Person): CheckinResult {
  const q = localEventQrs.getAll().find((x) => x.token === token);
  if (!q) return fail('Este código QR no es válido o fue renovado. Pide el código actual.');
  const e = calendarEvents.get(q.id);
  if (!e) return fail('Evento no encontrado.');
  const id = `${e.id}__${person.id}`;
  const prev = eventAttendances.get(id);
  if (prev && (prev.status === 'llego' || prev.status === 'llego_tarde')) {
    return { result: 'ya_registrada', eventTitle: e.title, status: prev.status, checkedInAt: prev.checkedInAt };
  }
  if (!q.enabled || !e.attendanceEnabled) fail('El registro de asistencia de este evento está cerrado.');
  if (e.status !== 'activo') fail('Este evento fue cancelado.');
  if (getClosure(e.id)) fail('La asistencia de este evento ya fue cerrada.');
  if (!isPersonInAudience(person, e.audience)) fail('No estás en la lista de invitados de este evento.');
  if (prev && (prev.status === 'excusa' || prev.status === 'no_aplica'))
    fail('Tu asistencia ya fue gestionada por el administrador. Consúltale si hay un error.');
  // Sin límite de horario: el QR registra mientras la administración no lo cierre.
  // Escanear cuenta como "llegó"; "llegó tarde" se marca a mano.
  const status: AttendanceState = 'llego';
  const rec: EventAttendance = { id, eventId: e.id, personId: person.id, status, source: 'qr', checkedInAt: now(), updatedBy: person.name, updatedAt: now() };
  eventAttendances.upsert(rec);
  return { result: 'registrada', eventTitle: e.title, status, checkedInAt: rec.checkedInAt };
}

export function localPreview(ev: CalendarEvent, people: Person[]) {
  const scoring = ev.scoring ?? getDefaultScoring();
  const map = new Map(eventAttendances.getAll().filter((a) => a.eventId === ev.id).map((a) => [a.personId, a.status] as const));
  // En los Conectados da los DÍAS POINTS; en los demás tipos solo el % de participación de cada GT
  // (lo usa el ranking de la liga), sin puntos.
  const sc = ev.type === 'conectados' ? scoring : { ...scoring, maxGtPoints: 0 };
  return { scoring, results: computeConectadosResults(sc, conectadosGts(ev), people, (id) => map.get(id), ev.audience) };
}

export function localCloseAttendance(ev: CalendarEvent, people: Person[], admin: string): ConectadosClosure {
  if (getClosure(ev.id)) fail('La asistencia ya está cerrada.');
  // Solo al cerrar: invitados sin registro o pendientes → NO ASISTIÓ
  const pend: EventAttendance[] = [];
  people
    .filter((p) => p.isActive !== false && isPersonInAudience(p, ev.audience))
    .forEach((p) => {
      const id = `${ev.id}__${p.id}`;
      const prev = eventAttendances.get(id);
      if (!prev || prev.status === 'pendiente') {
        pend.push({
          id,
          eventId: ev.id,
          personId: p.id,
          status: 'no_asistio',
          source: 'manual',
          observation: prev?.observation ?? (prev ? 'Pendiente al cerrar la asistencia' : 'Sin registro al cerrar la asistencia'),
          updatedBy: admin,
          updatedAt: now(),
        });
      }
    });
  eventAttendances.upsertMany(pend);

  const { scoring, results } = localPreview(ev, people);
  const finalResults = results.map(({ pending, ...r }) => r);
  if (ev.type === 'conectados') {
    const base = { date: ev.date, category: 'conectados' as PointCategory, sourceType: 'conectados' as const, sourceId: ev.id, activityName: ev.title, registeredBy: admin };
    const moves: PointMovement[] = finalResults
      .filter((r) => r.points > 0)
      .map((r) =>
        movement({ ...base, target: 'gt', gt: r.gt, points: r.points, reason: `Asistencia ${r.percentage}% (${r.effectiveAttendance}/${r.denominator}) × ${scoring.maxGtPoints} pts máx.` })
      );
    const map = new Map(eventAttendances.getAll().filter((a) => a.eventId === ev.id).map((a) => [a.personId, a.status] as const));
    people.forEach((p) => {
      const gt = personPrimaryGt(p);
      const st = map.get(p.id);
      if (!gt || !st) return;
      const pts = individualPointsFor(scoring, st);
      if (pts > 0) moves.push(movement({ ...base, target: 'person', personId: p.id, gt, points: pts, reason: ATTENDANCE_STATE_LABELS[st] }));
    });
    pointMovements.upsertMany(moves);
  }
  const closure: ConectadosClosure = { id: ev.id, eventId: ev.id, scoring, results: finalResults, status: 'cerrado', closedAt: now(), closedBy: admin, updatedAt: now() };
  conectadosClosures.upsert(closure);
  const q = localEventQrs.get(ev.id);
  if (q) localEventQrs.upsert({ ...q, enabled: false });
  audit(admin, 'cerrar_asistencia', 'conectados_closures', ev.id, null, closure);
  return closure;
}

function voidBySource(sourceType: string, sourceId: string, admin: string, reason: string) {
  const t = now();
  pointMovements.upsertMany(
    pointMovements
      .getAll()
      .filter((m) => m.sourceType === sourceType && m.sourceId === sourceId && !m.voided)
      .map((m) => ({ ...m, voided: true, voidedAt: t, voidedBy: admin, voidReason: reason }))
  );
}

export function localReopenAttendance(eventId: string, admin: string, reason: string) {
  if (!reason.trim()) fail('Escribe el motivo de la reapertura.');
  const c = conectadosClosures.get(eventId);
  if (!c) return fail('No hay cierre para reabrir.');
  voidBySource('conectados', eventId, admin, `Reapertura de asistencia: ${reason}`);
  const next = { ...c, status: 'reabierto' as const, reopenedAt: now(), reopenedBy: admin, reopenReason: reason, updatedAt: now() };
  conectadosClosures.upsert(next);
  audit(admin, 'reabrir_asistencia', 'conectados_closures', eventId, null, next, reason);
  return next;
}

export function localAddPoints(data: {
  target: 'gt' | 'person';
  gt?: string;
  person?: Person;
  points: number;
  activityName: string;
  reason: string;
  observation?: string;
  date: string;
  evidenceUrl?: string;
  category?: PointCategory;
  admin: string;
}): PointMovement {
  if (!data.points) fail('Los puntos deben ser distintos de cero.');
  if (!data.reason.trim()) fail('El motivo es obligatorio.');
  const m = movement({
    date: data.date,
    target: data.target,
    gt: data.target === 'gt' ? data.gt : data.person ? personPrimaryGt(data.person) : undefined,
    personId: data.target === 'person' ? data.person?.id : undefined,
    points: data.points,
    category: data.category === 'correccion' ? 'correccion' : 'manual',
    sourceType: 'manual',
    activityName: data.activityName || 'Asignación manual',
    reason: data.reason,
    observation: data.observation || undefined,
    evidenceUrl: data.evidenceUrl || undefined,
    registeredBy: data.admin,
  });
  pointMovements.upsert(m);
  audit(data.admin, 'asignar_puntos', 'point_movements', m.id, null, m, data.reason);
  return m;
}

export function localCorrectPoints(id: string, newPoints: number, reason: string, admin: string) {
  if (!reason.trim()) fail('El motivo de la corrección es obligatorio.');
  const o = pointMovements.get(id);
  if (!o || o.voided) return fail('El movimiento no existe o ya fue anulado.');
  const voided = { ...o, voided: true, voidedAt: now(), voidedBy: admin, voidReason: `Corregido de ${o.points} a ${round2(newPoints)}: ${reason}` };
  const items: PointMovement[] = [voided];
  let n: PointMovement | undefined;
  if (newPoints) {
    n = movement({ ...o, voided: false, voidedAt: undefined, voidedBy: undefined, voidReason: undefined, points: newPoints, reason, correctsId: o.id, previousPoints: o.points, newPoints: round2(newPoints), registeredBy: admin });
    items.push(n);
  }
  pointMovements.upsertMany(items);
  audit(admin, 'corregir_puntos', 'point_movements', o.id, o, n ?? null, reason);
  return { original: o, nuevo: n };
}

export function localVoidPoints(id: string, reason: string, admin: string) {
  if (!reason.trim()) fail('El motivo de la anulación es obligatorio.');
  const o = pointMovements.get(id);
  if (!o || o.voided) return fail('El movimiento no existe o ya fue anulado.');
  const n = { ...o, voided: true, voidedAt: now(), voidedBy: admin, voidReason: reason };
  pointMovements.upsert(n);
  audit(admin, 'anular_puntos', 'point_movements', o.id, o, n, reason);
  return n;
}

export function localSaveChallenge(data: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'results' | 'individualAwards'> & { id?: string }, admin: string): Challenge {
  if (!data.name.trim()) fail('Escribe el nombre del reto.');
  const existing = data.id ? challenges.get(data.id) : undefined;
  const c: Challenge = { results: [], individualAwards: [], ...existing, ...data, id: existing?.id ?? newId('reto'), createdAt: existing?.createdAt ?? now(), updatedAt: now() };
  challenges.upsert(c);
  audit(admin, 'guardar_reto', 'league_challenges', c.id, existing ?? null, c);
  return c;
}

export function localRegisterChallengeResults(challengeId: string, results: ChallengeResult[], awards: IndividualAward[], people: Person[], admin: string, date: string) {
  const c = challenges.get(challengeId);
  if (!c) return fail('Reto no encontrado.');
  voidBySource('reto', c.id, admin, 'Resultados del reto corregidos');
  const base = { date, category: 'reto' as PointCategory, sourceType: 'reto' as const, sourceId: c.id, activityName: c.name, registeredBy: admin, evidenceUrl: c.evidences[0]?.url };
  pointMovements.upsertMany([
    ...results.filter((r) => r.points).map((r) => movement({ ...base, target: 'gt', gt: r.gt, points: r.points, reason: r.position ? `Puesto ${r.position}` : 'Puntos del reto' })),
    ...awards
      .filter((a) => a.points)
      .map((a) => {
        const p = people.find((x) => x.id === a.personId);
        return movement({ ...base, target: 'person', personId: a.personId, gt: p ? personPrimaryGt(p) : undefined, points: a.points, reason: a.reason || 'Reconocimiento individual' });
      }),
  ]);
  const next = { ...c, results, individualAwards: awards, status: 'finalizado' as const, resultsRegisteredAt: now(), resultsRegisteredBy: admin, updatedAt: now() };
  challenges.upsert(next);
  audit(admin, 'resultados_reto', 'league_challenges', c.id, c, next);
  return next;
}

export type ClaimResult = { result: 'registrada' | 'ya_registrada'; activity: string; person: string; points?: { target: string; gt?: string; points: number }[] };

export function localClaimActivity(a: PointActivity, p: Person, source: PointActivityClaim['source'], by: string): ClaimResult {
  if (a.status !== 'activa') fail('Esta actividad ya no entrega DÍAS POINTS.');
  if (!isPersonInAudience(p, a.eligibility)) fail(`${p.name} no cumple las condiciones de esta actividad.`);
  const id = `${a.id}__${p.id}`;
  if (activityClaims.get(id)) return { result: 'ya_registrada', activity: a.name, person: p.name };
  activityClaims.upsert({ id, activityId: a.id, personId: p.id, source, registeredBy: by, claimedAt: now() });
  const gt = personPrimaryGt(p);
  const base = { date: a.date, category: 'actividad' as PointCategory, sourceType: 'actividad' as const, sourceId: a.id, activityName: a.name, registeredBy: by };
  const moves: PointMovement[] = [];
  const pts: { target: string; gt?: string; points: number }[] = [];
  if (a.individualPoints) {
    moves.push(movement({ ...base, target: 'person', personId: p.id, gt, points: a.individualPoints, reason: 'Participación (QR)' }));
    pts.push({ target: 'person', points: a.individualPoints });
  }
  if (a.gtPoints && gt) {
    moves.push(movement({ ...base, target: 'gt', gt, personId: p.id, points: a.gtPoints, reason: `Participación de ${p.name} (QR)` }));
    pts.push({ target: 'gt', gt, points: a.gtPoints });
  }
  pointMovements.upsertMany(moves);
  return { result: 'registrada', activity: a.name, person: p.name, points: pts };
}

// ----------------------------------------------------------------------------
// Ranking equitativo (modo local). En Supabase lo calcula `league_ranking()`.
// ----------------------------------------------------------------------------
export function localComputeRanking(people: Person[]): LeagueRanking {
  return computeLeagueRanking({
    people,
    movements: pointMovements.getAll(),
    events: calendarEvents.getAll(),
    closures: conectadosClosures.getAll(),
    activities: pointActivities.getAll(),
    claims: activityClaims.getAll(),
    inAudience: isPersonInAudience,
    config: leagueSettings.get('default')?.rankingConfig,
    today: todayIso(),
  });
}

export function localSaveRankingConfig(config: RankingConfig, admin: string) {
  const cur = leagueSettings.get('default');
  leagueSettings.upsert({
    id: 'default',
    defaultConectadosScoring: cur?.defaultConectadosScoring ?? DEFAULT_CONECTADOS_SCORING,
    rankingConfig: config,
    updatedAt: now(),
  });
  audit(admin, 'configuracion_ranking', 'league_settings', 'default', cur?.rankingConfig ?? null, config);
}

/** Igual que el servidor: un registro por día que se actualiza cuando cambia el ranking. */
export function localSaveDailyRanking(rows: GtRankingRow[]) {
  const date = todayIso();
  const id = `diario-${date}`;
  const prev = rankingHistory.get(id);
  if (prev && JSON.stringify(prev.rows) === JSON.stringify(rows)) return;
  rankingHistory.upsert({ id, kind: 'diario', date, rows, updatedAt: now() });
}

export function localSaveRankingCut(label: string, rows: GtRankingRow[], admin: string): RankingSnapshot {
  if (!label.trim()) fail('Ponle un nombre al corte.');
  const snap: RankingSnapshot = { id: `corte-${Date.now()}`, kind: 'corte', date: todayIso(), label: label.trim(), rows, createdBy: admin, updatedAt: now() };
  rankingHistory.upsert(snap);
  audit(admin, 'guardar_corte_ranking', 'league_ranking_history', snap.id, null, snap);
  return snap;
}

export function localDeleteRankingCut(id: string, admin: string) {
  const snap = rankingHistory.get(id);
  if (!snap || snap.kind !== 'corte') fail('Solo se pueden borrar los cortes guardados a mano.');
  rankingHistory.remove(id);
  audit(admin, 'borrar_corte_ranking', 'league_ranking_history', id, snap, null);
}

// ============================================================================
// Exportar reportes
// ============================================================================

export function exportLeagueReport(people: Person[], events: CalendarEvent[], ranking: GtRankingRow[]) {
  const moves = pointMovements.getAll();
  const wb = XLSX.utils.book_new();
  const gtRows = ranking.map((s) => ({
    Puesto: s.position,
    GT: s.gt,
    'Puntaje final (sobre 100)': s.score,
    Integrantes: s.members,
    'DÍAS POINTS acumulados': s.totalPoints,
    'Promedio por integrante': s.avgPoints,
    'Promedio (escala 0-100)': s.pointsScore,
    'Participación (%)': s.participation,
    'Participación (escala 0-100)': s.participationScore,
    'Actividades que cuentan': s.activitiesCounted,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gtRows), 'Ranking GT');

  const personRows = computePersonStandings(moves, people).map((s) => ({
    Puesto: s.position,
    Nombre: s.name,
    GT: s.gt || '',
    'Total DÍAS POINTS': s.total,
    'Retos completados': s.challengesCompleted,
    Asistencias: s.attendances,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(personRows), 'Ranking individual');

  const name = (id?: string) => (id ? people.find((p) => p.id === id)?.name || id : '');
  const moveRows = [...moves]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({
      Fecha: m.date,
      Actividad: m.activityName,
      Tipo: POINT_CATEGORY_LABELS[m.category] ?? m.category,
      Destino: m.target === 'gt' ? 'GT' : 'Persona',
      GT: m.gt || '',
      Persona: name(m.personId),
      Puntos: m.points,
      'Valor anterior': m.previousPoints ?? '',
      Motivo: m.reason || '',
      Observación: m.observation || '',
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
          Evento: ev?.title || c.eventId,
          Fecha: ev?.date || '',
          GT: r.gt,
          Habilitados: r.enabled,
          Llegaron: r.attended,
          'Llegaron tarde': r.late,
          Excusas: r.excused,
          'No asistieron': r.absent,
          'Base usada': r.denominator,
          '% Asistencia': r.percentage,
          'Puntos máx.': c.scoring?.maxGtPoints ?? '',
          'DÍAS POINTS': r.points,
        })
      );
    });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(closureRows), 'Conectados');

  const attRows = eventAttendances.getAll().map((a) => {
    const ev = events.find((e) => e.id === a.eventId);
    const p = people.find((x) => x.id === a.personId);
    return {
      Evento: ev?.title || a.eventId,
      Fecha: ev?.date || '',
      Integrante: p?.name || a.personId,
      GT: (p && personPrimaryGt(p)) || '',
      Estado: ATTENDANCE_STATE_LABELS[a.status],
      'Hora de registro': a.checkedInAt ? new Date(a.checkedInAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '',
      Origen: a.source === 'qr' ? 'QR' : 'Manual',
      Observación: a.observation || '',
      'Motivo excusa': a.excuseReason || '',
      'Aprobada por': a.excuseApprovedBy || '',
      Evidencia: a.excuseEvidenceUrl || '',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attRows), 'Asistencias');

  XLSX.writeFile(wb, `DIAS_LEAGUE_${todayIso()}.xlsx`);
}
