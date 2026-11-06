/**
 * API de Calendario, DÍAS League y Perfil DÍAS.
 *
 * Producción (Supabase configurado): cada acción llama a una función segura de
 * la base de datos (supabase/calendar_league.sql) con la sesión emitida por el
 * servidor. Solo después de que el servidor confirma, se actualiza la pantalla.
 * Si el servidor rechaza la acción, se lanza un ApiError con el motivo.
 *
 * Demo / desarrollo (sin Supabase): misma interfaz, implementada en el navegador
 * (leagueService.local*), para poder probar la app sin base de datos.
 */
import {
  AttendanceState,
  AuditEntry,
  CalendarEvent,
  Challenge,
  ChallengeResult,
  ConectadosClosure,
  ConectadosGtResult,
  ConectadosScoring,
  CurrentUser,
  CustomEventType,
  EventTypeColor,
  IndividualAward,
  Person,
  PersonProfileData,
  PointActivity,
  PointCategory,
  PointMovement,
  ReminderOffset,
} from '../types';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { postgresToPerson } from './supabaseSync';
import { actorName, getCurrentSession, getSessionToken } from './session';
import { BirthdayPerson, bogotaToday, parseBirthDate } from '../../supabase/functions/_shared/birthdays';
import { newId, randomToken } from './syncedCollection';
import {
  calendarEvents,
  customEventTypes,
  eventFromRow,
  localSaveCalendarEvent,
  localSaveReminder,
  reminderFromRow,
  reminderPreferences,
  personPrimaryGt,
} from './calendarService';
import {
  activityClaims,
  activityFromRow,
  attendanceFromRow,
  audit,
  challengeFromRow,
  challenges,
  CheckinResult,
  ClaimResult,
  closureFromRow,
  conectadosClosures,
  eventAttendances,
  getClosure,
  leagueSettings,
  localActivityQrs,
  localAddPoints,
  localAudit,
  localCheckin,
  localClaimActivity,
  localCloseAttendance,
  localCorrectPoints,
  localEnsureProfile,
  localEventQrs,
  localPreview,
  localProfiles,
  localQr,
  localRegisterChallengeResults,
  localReopenAttendance,
  localSaveChallenge,
  localSetAttendance,
  localVoidPoints,
  LocalError,
  movementFromRow,
  pointActivities,
  pointMovements,
} from './leagueService';

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

const remote = () => isSupabaseConfigured();

/** "QR_INVALIDO: Este código…" → { code, message } */
function parseServerError(raw: string): ApiError {
  const m = /^([A-Z_]+): (.*)$/s.exec(raw || '');
  if (m) return new ApiError(m[2], m[1]);
  if (/fetch|network|Failed to fetch/i.test(raw)) return new ApiError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.', 'RED');
  if (/does not exist|Could not find the function/i.test(raw))
    return new ApiError('La base de datos no tiene instaladas las funciones de DÍAS League. Ejecuta supabase/calendar_league.sql.', 'SIN_SQL');
  return new ApiError(raw || 'Ocurrió un error inesperado.');
}

async function call<T = any>(fn: string, args: Record<string, unknown> = {}, withSession = true): Promise<T> {
  const client = getSupabase();
  if (!client) throw new ApiError('Supabase no está configurado.');
  const token = getSessionToken();
  if (withSession && !token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 'SESION_INVALIDA');
  const { data, error } = await client.rpc(fn, withSession ? { p_session: token, ...args } : args);
  if (error) throw parseServerError(error.message);
  return data as T;
}

/** En modo local, los errores de validación también son ApiError. */
function local<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e instanceof LocalError ? new ApiError(e.message) : e);
  }
}

const requireAdminLocal = () => {
  const s = getCurrentSession();
  if (s?.role !== 'admin') throw new LocalError('Esta acción es solo para administradores.');
  return actorName();
};
const requireStaffLocal = () => {
  const s = getCurrentSession();
  if (s?.role !== 'staff' || !s.staffData) throw new LocalError('Inicia sesión con tu usuario de integrante para hacer esto.');
  return s.staffData;
};

// Hash SHA-256 de la contraseña de administrador para el modo sin servidor (demo).
// En producción la contraseña se valida en la base de datos (bcrypt) y no está en la app.
const LOCAL_ADMIN_HASH = 'ccfab4b8d87f79da43ddb8a99388b07195dc7b075ca935469c3d40a5b1e83f96';
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type QrInfo = { token: string; enabled: boolean };
export type PersonScan = { access: 'admin' | 'limitado'; person: Person | { id: string; name: string; gt?: string }; photoUrl?: string };

export const api = {
  isRemote: remote,

  // --------------------------------------------------------------------------
  // Sesión
  // --------------------------------------------------------------------------
  async loginAdmin(username: string, password: string): Promise<CurrentUser> {
    if (remote()) {
      const r = await call('login_admin', { p_username: username, p_password: password }, false);
      return {
        role: 'admin',
        sessionToken: r.token,
        sessionExpiresAt: r.expires_at,
        adminData: { id: 'admin', username: r.username, name: r.name, role: 'admin' },
      };
    }
    const u = username.trim().toUpperCase();
    if ((u === 'DIAS2026' || u === 'DIAS') && (await sha256(password.trim())) === LOCAL_ADMIN_HASH) {
      return { role: 'admin', sessionToken: 'local-' + newId('s'), adminData: { id: 'admin_master', username: u, name: 'Dirección General DÍAS EAFIT', role: 'admin' } };
    }
    throw new ApiError('Usuario o contraseña de administrador incorrectos.');
  },

  /** Solo en producción: el servidor busca a la persona y valida la cédula. */
  async loginStaffRemote(login: string, password: string): Promise<CurrentUser> {
    const r = await call('login_staff', { p_login: login, p_password: password }, false);
    return { role: 'staff', sessionToken: r.token, sessionExpiresAt: r.expires_at, staffData: postgresToPerson(r.person) };
  },

  async validateSession(): Promise<boolean> {
    if (!remote()) return true;
    try {
      await call('session_info');
      return true;
    } catch (e) {
      return !(e instanceof ApiError && e.code === 'SESION_INVALIDA');
    }
  },

  async logout(): Promise<void> {
    if (remote() && getSessionToken()) await call('logout').catch(() => undefined);
    eventAttendances.clear();
    reminderPreferences.clear();
  },

  // --------------------------------------------------------------------------
  // Calendario
  // --------------------------------------------------------------------------
  async saveEvent(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<CalendarEvent> {
    if (remote()) {
      const ev = eventFromRow(await call('admin_save_calendar_event', { p_event: data }));
      calendarEvents.applyFromServer([ev]);
      return ev;
    }
    return local(() => {
      const admin = requireAdminLocal();
      const ev = localSaveCalendarEvent(data, admin);
      audit(admin, data.id ? 'editar_evento' : 'crear_evento', 'calendar_events', ev.id, null, ev);
      return ev;
    });
  },

  async setEventStatus(ev: CalendarEvent, status: CalendarEvent['status']): Promise<CalendarEvent> {
    return api.saveEvent({ ...ev, status });
  },

  async deleteEvent(id: string): Promise<void> {
    if (remote()) {
      await call('admin_delete_calendar_event', { p_event_id: id });
      calendarEvents.remove(id);
      return;
    }
    return local(() => {
      const admin = requireAdminLocal();
      if (conectadosClosures.get(id)) throw new LocalError('Este evento tiene una asistencia cerrada o con historial: cancélalo en lugar de eliminarlo.');
      calendarEvents.remove(id);
      audit(admin, 'eliminar_evento', 'calendar_events', id, null, null);
    });
  },

  async saveEventType(id: string | undefined, name: string, color: EventTypeColor): Promise<CustomEventType> {
    if (remote()) {
      const r = await call('admin_save_event_type', { p_id: id ?? null, p_name: name, p_color: color });
      const t = { id: r.id, name: r.name, color: r.color, createdBy: r.created_by, createdAt: r.created_at };
      customEventTypes.applyFromServer([t]);
      return t;
    }
    return local(() => {
      const admin = requireAdminLocal();
      if (!name.trim()) throw new LocalError('Escribe el nombre del tipo.');
      const t: CustomEventType = { id: id ?? newId('tipo'), name: name.trim(), color, createdBy: admin, createdAt: new Date().toISOString() };
      customEventTypes.upsert(t);
      return t;
    });
  },

  async deleteEventType(id: string): Promise<void> {
    if (remote()) {
      await call('admin_delete_event_type', { p_id: id });
      customEventTypes.remove(id);
      return;
    }
    return local(() => {
      requireAdminLocal();
      if (calendarEvents.getAll().some((e) => e.type === id)) throw new LocalError('Hay eventos con este tipo. Cámbialos de tipo antes de eliminarlo.');
      customEventTypes.remove(id);
    });
  },

  async eventQr(eventId: string, action: 'ver' | 'habilitar' | 'cerrar' | 'renovar' = 'ver'): Promise<QrInfo> {
    if (remote()) {
      const r = await call('admin_event_qr', { p_event_id: eventId, p_action: action });
      return { token: r.token, enabled: r.enabled };
    }
    return local(() => {
      const admin = requireAdminLocal();
      const ev = calendarEvents.get(eventId);
      if (!ev?.attendanceEnabled) throw new LocalError('Activa el control de asistencia por QR en el evento primero.');
      const q = localQr(localEventQrs, eventId, action);
      if (action !== 'ver') audit(admin, `${action}_qr_evento`, 'event_qr_codes', eventId, null, null);
      return { token: q.token, enabled: q.enabled };
    });
  },

  /** El integrante registra su propia asistencia escaneando el QR del evento. */
  async checkin(token: string): Promise<CheckinResult> {
    if (remote()) {
      const r = await call('checkin_event', { p_token: token });
      void eventAttendances.pull();
      return { result: r.result, eventTitle: r.event_title, status: r.status, checkedInAt: r.checked_in_at };
    }
    return local(() => localCheckin(token, requireStaffLocal()));
  },

  async saveReminder(eventId: string, enabled: boolean, offsets: ReminderOffset[]): Promise<void> {
    if (remote()) {
      const r = await call('save_my_reminder', { p_event_id: eventId, p_enabled: enabled, p_offsets: offsets });
      reminderPreferences.applyFromServer([reminderFromRow(r)]);
      return;
    }
    return local(() => {
      localSaveReminder(eventId, requireStaffLocal().id, enabled, offsets);
    });
  },

  async savePushSubscription(sub: { id: string; endpoint: string; p256dh: string; auth: string; userAgent: string }) {
    if (!remote()) return;
    await call('save_my_push_subscription', {
      p_id: sub.id,
      p_endpoint: sub.endpoint,
      p_p256dh: sub.p256dh,
      p_auth: sub.auth,
      p_user_agent: sub.userAgent,
    });
  },

  // --------------------------------------------------------------------------
  // Asistencia
  // --------------------------------------------------------------------------
  async refreshAttendance(): Promise<void> {
    await eventAttendances.pull();
  },

  async setAttendance(
    eventId: string,
    personIds: string[],
    status: AttendanceState,
    extra: { observation?: string; excuseReason?: string; evidenceUrl?: string } = {}
  ): Promise<void> {
    if (personIds.length === 0) return;
    if (remote()) {
      const rows = await call<any[]>('admin_set_attendance', {
        p_event_id: eventId,
        p_person_ids: personIds,
        p_status: status,
        p_observation: extra.observation ?? null,
        p_excuse_reason: extra.excuseReason ?? null,
        p_evidence_url: extra.evidenceUrl ?? null,
      });
      eventAttendances.applyFromServer(rows.map(attendanceFromRow));
      return;
    }
    return local(() => {
      localSetAttendance(eventId, personIds, status, requireAdminLocal(), extra);
    });
  },

  async previewAttendance(ev: CalendarEvent, people: Person[]): Promise<{ scoring: ConectadosScoring; results: ConectadosGtResult[] }> {
    if (remote()) {
      const r = await call('admin_preview_attendance', { p_event_id: ev.id });
      return { scoring: r.scoring, results: (r.results || []).map((x: any) => ({ ...x, percentage: Number(x.percentage), points: Number(x.points), denominator: Number(x.denominator) })) };
    }
    return local(() => localPreview(ev, people));
  },

  async closeAttendance(ev: CalendarEvent, people: Person[]): Promise<ConectadosClosure> {
    if (remote()) {
      const c = closureFromRow(await call('admin_close_attendance', { p_event_id: ev.id }));
      conectadosClosures.applyFromServer([c]);
      await Promise.all([pointMovements.pull(), eventAttendances.pull()]);
      return c;
    }
    return local(() => localCloseAttendance(ev, people, requireAdminLocal()));
  },

  async reopenAttendance(eventId: string, reason: string): Promise<void> {
    if (remote()) {
      const c = closureFromRow(await call('admin_reopen_attendance', { p_event_id: eventId, p_reason: reason }));
      conectadosClosures.applyFromServer([c]);
      await pointMovements.pull();
      return;
    }
    return local(() => {
      localReopenAttendance(eventId, requireAdminLocal(), reason);
    });
  },

  isClosed: (eventId: string) => !!getClosure(eventId),

  // --------------------------------------------------------------------------
  // DÍAS POINTS
  // --------------------------------------------------------------------------
  async addPoints(data: {
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
  }): Promise<PointMovement> {
    if (remote()) {
      const m = movementFromRow(
        await call('admin_add_points', {
          p_target: data.target,
          p_gt: data.gt ?? null,
          p_person_id: data.person?.id ?? null,
          p_points: data.points,
          p_category: data.category ?? 'manual',
          p_activity: data.activityName,
          p_reason: data.reason,
          p_observation: data.observation ?? null,
          p_evidence: data.evidenceUrl ?? null,
          p_date: data.date,
        })
      );
      pointMovements.applyFromServer([m]);
      return m;
    }
    return local(() => localAddPoints({ ...data, admin: requireAdminLocal() }));
  },

  async correctPoints(id: string, newPoints: number, reason: string): Promise<void> {
    if (remote()) {
      await call('admin_correct_points', { p_movement_id: id, p_new_points: newPoints, p_reason: reason });
      await pointMovements.pull();
      return;
    }
    return local(() => {
      localCorrectPoints(id, newPoints, reason, requireAdminLocal());
    });
  },

  async voidPoints(id: string, reason: string): Promise<void> {
    if (remote()) {
      pointMovements.applyFromServer([movementFromRow(await call('admin_void_points', { p_movement_id: id, p_reason: reason }))]);
      return;
    }
    return local(() => {
      localVoidPoints(id, reason, requireAdminLocal());
    });
  },

  async saveChallenge(data: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'results' | 'individualAwards'> & { id?: string }): Promise<Challenge> {
    if (remote()) {
      const c = challengeFromRow(await call('admin_save_challenge', { p_challenge: data }));
      challenges.applyFromServer([c]);
      return c;
    }
    return local(() => localSaveChallenge(data, requireAdminLocal()));
  },

  async registerChallengeResults(challengeId: string, results: ChallengeResult[], awards: IndividualAward[], people: Person[], date: string): Promise<void> {
    if (remote()) {
      challenges.applyFromServer([
        challengeFromRow(await call('admin_register_challenge_results', { p_challenge_id: challengeId, p_results: results, p_awards: awards, p_date: date })),
      ]);
      await pointMovements.pull();
      return;
    }
    return local(() => {
      localRegisterChallengeResults(challengeId, results, awards, people, requireAdminLocal(), date);
    });
  },

  async saveDefaultScoring(scoring: ConectadosScoring): Promise<void> {
    if (remote()) {
      await call('admin_save_league_settings', { p_scoring: scoring });
      await leagueSettings.pull();
      return;
    }
    return local(() => {
      const admin = requireAdminLocal();
      leagueSettings.upsert({ id: 'default', defaultConectadosScoring: scoring, updatedAt: new Date().toISOString() });
      audit(admin, 'configuracion_liga', 'league_settings', 'default', null, scoring);
    });
  },

  // --------------------------------------------------------------------------
  // Actividades con DÍAS POINTS por QR
  // --------------------------------------------------------------------------
  async saveActivity(data: Omit<PointActivity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<PointActivity> {
    if (remote()) {
      const a = activityFromRow(await call('admin_save_point_activity', { p_activity: data }));
      pointActivities.applyFromServer([a]);
      return a;
    }
    return local(() => {
      const admin = requireAdminLocal();
      if (!data.name.trim()) throw new LocalError('Escribe el nombre de la actividad.');
      if (!data.individualPoints && !data.gtPoints) throw new LocalError('Define cuántos DÍAS POINTS entrega la actividad.');
      const existing = data.id ? pointActivities.get(data.id) : undefined;
      const t = new Date().toISOString();
      const a: PointActivity = { ...data, id: existing?.id ?? newId('act'), createdBy: existing?.createdBy ?? admin, createdAt: existing?.createdAt ?? t, updatedAt: t };
      pointActivities.upsert(a);
      localQr(localActivityQrs, a.id, 'ver');
      audit(admin, 'guardar_actividad_puntos', 'point_activities', a.id, existing ?? null, a);
      return a;
    });
  },

  async activityQr(activityId: string, action: 'ver' | 'habilitar' | 'cerrar' | 'renovar' = 'ver'): Promise<QrInfo> {
    if (remote()) {
      const r = await call('admin_activity_qr', { p_activity_id: activityId, p_action: action });
      return { token: r.token, enabled: r.enabled };
    }
    return local(() => {
      requireAdminLocal();
      const q = localQr(localActivityQrs, activityId, action);
      return { token: q.token, enabled: q.enabled };
    });
  },

  /** El integrante escanea el QR de la actividad. */
  async claimActivityQr(token: string): Promise<ClaimResult> {
    if (remote()) {
      const r = await call('claim_activity_qr', { p_token: token });
      await Promise.all([pointMovements.pull(), activityClaims.pull()]);
      return r;
    }
    return local(() => {
      const p = requireStaffLocal();
      const q = localActivityQrs.getAll().find((x) => x.token === token);
      if (!q) throw new LocalError('Este código QR no es válido o fue renovado.');
      const a = pointActivities.get(q.id);
      if (!a || !q.enabled || a.mechanism === 'qr_personal') throw new LocalError('Este QR no está habilitado para registrar participación.');
      return localClaimActivity(a, p, 'qr_actividad', p.name);
    });
  },

  /** El administrador registra la participación escaneando el QR personal (o eligiendo a la persona). */
  async awardActivity(activityId: string, by: { personQr?: string; personId?: string }, people: Person[]): Promise<ClaimResult> {
    if (remote()) {
      const r = await call('admin_award_activity', { p_activity_id: activityId, p_person_qr: by.personQr ?? null, p_person_id: by.personId ?? null });
      await Promise.all([pointMovements.pull(), activityClaims.pull()]);
      return r;
    }
    return local(() => {
      const admin = requireAdminLocal();
      const a = pointActivities.get(activityId);
      if (!a) throw new LocalError('Actividad no encontrada.');
      let personId = by.personId;
      if (by.personQr) {
        if (a.mechanism === 'qr_actividad') throw new LocalError('Esta actividad solo registra con el QR de la actividad.');
        personId = localProfiles.getAll().find((x) => x.qrToken === by.personQr)?.personId;
        if (!personId) throw new LocalError('Este código QR no corresponde a ningún integrante.');
      }
      const p = people.find((x) => x.id === personId);
      if (!p) throw new LocalError('Integrante no encontrado.');
      return localClaimActivity(a, p, by.personQr ? 'qr_personal' : 'manual', admin);
    });
  },

  // --------------------------------------------------------------------------
  // Perfil DÍAS y QR personal
  // --------------------------------------------------------------------------
  async myProfile(): Promise<PersonProfileData> {
    if (remote()) {
      const r = await call('my_profile');
      return { personId: r.person_id, qrToken: r.qr_token, photoUrl: r.photo_url ?? undefined };
    }
    return local(() => localEnsureProfile(requireStaffLocal().id));
  },

  async adminProfile(personId: string): Promise<PersonProfileData> {
    if (remote()) {
      const r = await call('admin_get_profile', { p_person_id: personId });
      return {
        personId: r.person_id,
        qrToken: r.qr_token,
        photoUrl: r.photo_url ?? undefined,
        qrRenewedAt: r.qr_renewed_at ?? undefined,
        birthDate: r.birth_date ?? undefined,
      };
    }
    return local(() => {
      requireAdminLocal();
      return localEnsureProfile(personId);
    });
  },

  // --------------------------------------------------------------------------
  // Cumpleaños (solo administración: la fecha de nacimiento es privada)
  // --------------------------------------------------------------------------
  async setBirthDate(personId: string, birthDate: string | null): Promise<void> {
    if (birthDate && !parseBirthDate(birthDate, bogotaToday())) throw new ApiError('La fecha de nacimiento no es válida.');
    if (remote()) {
      await call('admin_set_birth_date', { p_person_id: personId, p_birth_date: birthDate || null });
      return;
    }
    return local(() => {
      const admin = requireAdminLocal();
      const pr = localEnsureProfile(personId);
      const next = { ...pr, id: personId, birthDate: birthDate || undefined };
      localProfiles.upsert(next);
      audit(admin, 'actualizar_fecha_nacimiento', 'person_profiles', personId, { birthDate: pr.birthDate ?? null }, { birthDate: birthDate || null });
    });
  },

  /** Carga masiva (Excel). Devuelve cuántas se guardaron. */
  async setBirthDates(items: { personId: string; birthDate: string }[]): Promise<{ saved: number; skipped: string[] }> {
    const valid = items.filter((i) => parseBirthDate(i.birthDate, bogotaToday()));
    if (remote()) {
      const r = await call('admin_set_birth_dates', { p_items: valid.map((i) => ({ person_id: i.personId, birth_date: i.birthDate })) });
      return { saved: r.saved, skipped: r.skipped ?? [] };
    }
    return local(() => {
      const admin = requireAdminLocal();
      valid.forEach((i) => {
        const pr = localEnsureProfile(i.personId);
        if (pr.birthDate === i.birthDate) return;
        localProfiles.upsert({ ...pr, id: i.personId, birthDate: i.birthDate });
        audit(admin, 'actualizar_fecha_nacimiento', 'person_profiles', i.personId, { birthDate: pr.birthDate ?? null }, { birthDate: i.birthDate });
      });
      return { saved: valid.length, skipped: [] };
    });
  },

  async listBirthdays(people: Person[]): Promise<BirthdayPerson[]> {
    if (remote()) {
      const rows: any[] = await call('admin_list_birthdays');
      return rows.map((r) => ({ personId: r.person_id, name: r.name, gt: r.gt ?? null, birthDate: r.birth_date }));
    }
    return local(() => {
      requireAdminLocal();
      return localProfiles
        .getAll()
        .filter((pr) => pr.birthDate)
        .flatMap((pr) => {
          const p = people.find((x) => x.id === pr.personId);
          return p ? [{ personId: p.id, name: p.name, gt: personPrimaryGt(p) ?? null, birthDate: pr.birthDate! }] : [];
        });
    });
  },

  async saveAdminPushSubscription(sub: { id: string; endpoint: string; p256dh: string; auth: string; userAgent: string }) {
    if (!remote()) return;
    await call('save_admin_push_subscription', {
      p_id: sub.id,
      p_endpoint: sub.endpoint,
      p_p256dh: sub.p256dh,
      p_auth: sub.auth,
      p_user_agent: sub.userAgent,
    });
  },

  async updateProfile(personId: string, photoUrl: string, renewQr = false): Promise<PersonProfileData> {
    if (remote()) {
      const r = await call('admin_update_profile', { p_person_id: personId, p_photo_url: photoUrl, p_renew_qr: renewQr });
      return { personId: r.person_id, qrToken: r.qr_token, photoUrl: r.photo_url ?? undefined, qrRenewedAt: r.qr_renewed_at ?? undefined };
    }
    return local(() => {
      const admin = requireAdminLocal();
      const pr = localEnsureProfile(personId);
      const next = {
        ...pr,
        id: personId,
        photoUrl: photoUrl.trim() || undefined,
        ...(renewQr ? { qrToken: randomToken(), qrRenewedAt: new Date().toISOString() } : {}),
      };
      localProfiles.upsert(next);
      audit(admin, renewQr ? 'renovar_qr_personal' : 'actualizar_perfil', 'person_profiles', personId, pr, next);
      return next;
    });
  },

  async resolvePersonQr(qr: string, people: Person[]): Promise<PersonScan> {
    if (remote()) {
      const r = await call('resolve_person_qr', { p_qr: qr });
      return { access: r.access, person: r.access === 'admin' ? postgresToPerson(r.person) : r.person, photoUrl: r.photo_url ?? undefined };
    }
    return local(() => {
      const s = getCurrentSession();
      if (!s) throw new LocalError('Inicia sesión para escanear códigos.');
      const pr = localProfiles.getAll().find((x) => x.qrToken === qr);
      const p = pr && people.find((x) => x.id === pr.personId);
      if (!p) throw new LocalError('Este código QR no corresponde a ningún integrante.');
      if (s.role === 'admin') return { access: 'admin' as const, person: p, photoUrl: pr?.photoUrl };
      return { access: 'limitado' as const, person: { id: p.id, name: p.name, gt: p.gtSubTeam }, photoUrl: pr?.photoUrl };
    });
  },

  async listAudit(entityId?: string): Promise<AuditEntry[]> {
    if (remote()) {
      const rows = await call<any[]>('admin_list_audit', { p_entity_id: entityId ?? null, p_limit: 200 });
      return rows.map((r) => ({
        id: r.id,
        at: r.at,
        adminName: r.admin_name,
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id ?? undefined,
        before: r.before_data,
        after: r.after_data,
        reason: r.reason ?? undefined,
      }));
    }
    return local(() => {
      requireAdminLocal();
      return localAudit
        .getAll()
        .filter((a) => !entityId || a.entityId === entityId)
        .sort((a, b) => b.at.localeCompare(a.at));
    });
  },
};

/** Mensaje legible para mostrar al usuario */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Ocurrió un error inesperado.';
}
