/**
 * Pruebas de la base de datos (supabase/calendar_league.sql) a través de la API,
 * con la clave pública (anon), igual que la app en el navegador.
 *
 * Requiere una base de datos de prueba con schema.sql + calendar_league.sql:
 *   SUPABASE_TEST_URL=http://localhost:54321 node tests/supabase.rpc.test.mjs
 * NO ejecutar contra la base de datos de producción: crea y modifica datos.
 */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL;
if (!URL) {
  console.log('SUPABASE_TEST_URL no está definido: se omiten las pruebas de base de datos.');
  process.exit(0);
}
const db = createClient(URL, process.env.SUPABASE_TEST_ANON_KEY || 'anon');
const rpc = async (fn, args) => {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};
const rpcErr = async (fn, args) => {
  const { error } = await db.rpc(fn, args);
  assert.ok(error, `${fn} debía fallar`);
  return error.message;
};
const ok = (msg) => console.log('✔', msg);
const run = Date.now().toString(36);

// ---------------------------------------------------------------------------
// Datos base: 9 GT de distintos tamaños (las personas se crean por la tabla
// existente people, como hace la app hoy)
// ---------------------------------------------------------------------------
const sizes = { Carnival: 5, Finanzas: 3, GH: 4, 'Logística': 4 };
const people = [];
let n = 0;
for (const [gt, size] of Object.entries(sizes)) {
  for (let i = 0; i < size; i++) {
    n++;
    people.push({ id: `t${run}_${n}`, name: `${gt} ${i + 1}`, document_id: `${run}${n}`, username: `u${run}${n}`,
      email: `u${run}${n}@x.co`, primary_type: 'GT', gt_sub_team: gt, gt_teams: [gt] });
  }
}
people.push({ id: `t${run}_gap`, name: 'Gap 1', document_id: `${run}999`, email: `g${run}@x.co`, primary_type: 'GAP' });
{
  const { error } = await db.from('people').upsert(people);
  assert.ifError(error);
}
const P = (gt, i) => people.find((p) => p.gt_sub_team === gt && p.name === `${gt} ${i}`);

// ---------------------------------------------------------------------------
// 1. Seguridad de tablas
// ---------------------------------------------------------------------------
for (const t of ['person_profiles', 'event_qr_codes', 'event_attendances', 'admin_users', 'app_sessions', 'admin_audit_log', 'qr_scans', 'point_activity_qr']) {
  const { data, error } = await db.from(t).select('*').limit(1);
  assert.ok(error || (data && data.length === 0), `anon no debe leer ${t}`);
}
ok('La clave pública no puede leer tablas privadas (QR, asistencias, sesiones, auditoría)');
{
  const { error } = await db.from('point_movements').insert({ id: 'hack', activity_date: '2027-01-01', target: 'gt', gt: 'GH', points: 999, category: 'manual', activity_name: 'x', registered_by: 'x' });
  assert.ok(error, 'anon no debe insertar puntos');
  const { error: e2 } = await db.from('calendar_events').insert({ id: 'hack', title: 'x', event_date: '2027-01-01', start_time: '10:00', end_time: '11:00', starts_at: new Date().toISOString(), ends_at: new Date().toISOString(), type: 'otro' });
  assert.ok(e2, 'anon no debe crear eventos');
}
ok('La clave pública no puede escribir puntos ni eventos directamente');
assert.match(await rpcErr('_conectados_results', { p_event_id: 'x', p_scoring: {} }), /permission|denied|permiso/i);
ok('Las funciones internas no se pueden llamar desde la API');

// ---------------------------------------------------------------------------
// 2. Login en el servidor
// ---------------------------------------------------------------------------
assert.match(await rpcErr('login_admin', { p_username: 'DIAS2026', p_password: 'mala' }), /CREDENCIALES/);
const admin = await rpc('login_admin', { p_username: 'DIAS2026', p_password: '2580DIAS' });
assert.ok(admin.token && admin.role === 'admin');
const A = admin.token;
const f1 = P('Finanzas', 1);
assert.match(await rpcErr('login_staff', { p_login: f1.username, p_password: '000' }), /CREDENCIALES/);
const staff = await rpc('login_staff', { p_login: f1.username, p_password: f1.document_id });
assert.equal(staff.person.id, f1.id);
const S = staff.token;
const c1 = P('Carnival', 1);
const staffC = (await rpc('login_staff', { p_login: c1.document_id, p_password: c1.document_id })).token;
ok('Login de administrador y de integrante validados en el servidor');
assert.match(await rpcErr('admin_add_points', { p_session: S, p_target: 'gt', p_gt: 'Finanzas', p_person_id: null, p_points: 50, p_category: 'manual', p_activity: 'x', p_reason: 'x' }), /SIN_PERMISO/);
assert.match(await rpcErr('admin_add_points', { p_session: 'inventado', p_target: 'gt', p_gt: 'Finanzas', p_person_id: null, p_points: 50, p_category: 'manual', p_activity: 'x', p_reason: 'x' }), /SESION_INVALIDA/);
ok('Un integrante o una sesión inventada no pueden asignar puntos (15)');

// ---------------------------------------------------------------------------
// 3. Perfil DÍAS y QR personal (1, 2)
// ---------------------------------------------------------------------------
const myProfile = await rpc('my_profile', { p_session: S });
assert.ok(myProfile.qr_token.length >= 32, 'QR no predecible');
assert.ok(!myProfile.qr_token.includes(f1.document_id), 'el QR no contiene la cédula');
const adminProfile = await rpc('admin_get_profile', { p_session: A, p_person_id: f1.id });
assert.equal(adminProfile.qr_token, myProfile.qr_token, 'QR permanente');
const scanAdmin = await rpc('resolve_person_qr', { p_session: A, p_qr: myProfile.qr_token });
assert.equal(scanAdmin.access, 'admin');
assert.equal(scanAdmin.person.document_id, f1.document_id);
const scanStaff = await rpc('resolve_person_qr', { p_session: staffC, p_qr: myProfile.qr_token });
assert.equal(scanStaff.access, 'limitado');
assert.equal(scanStaff.person.document_id, undefined, 'otro integrante no ve la cédula');
assert.match(await rpcErr('resolve_person_qr', { p_session: A, p_qr: 'falso' }), /QR_INVALIDO/);
ok('Cada integrante tiene perfil y QR único, permanente y sin cédula; el escaneo respeta permisos (1, 2)');

// ---------------------------------------------------------------------------
// 4. Puntos manuales y corrección con valor anterior y nuevo (3)
// ---------------------------------------------------------------------------
const m1 = await rpc('admin_add_points', { p_session: A, p_target: 'person', p_gt: null, p_person_id: f1.id, p_points: 10, p_category: 'manual', p_activity: 'Apoyo inducción', p_reason: 'Ayudó en la inducción', p_observation: 'Muy puntual', p_evidence: 'https://drive/x', p_date: '2027-02-10' });
assert.equal(m1.gt, 'Finanzas');
const corr = await rpc('admin_correct_points', { p_session: A, p_movement_id: m1.id, p_new_points: 15, p_reason: 'Eran 15' });
assert.equal(Number(corr.valor_anterior), 10);
assert.equal(Number(corr.valor_nuevo), 15);
{
  const { data } = await db.from('point_movements').select('*').eq('person_id', f1.id);
  const vig = data.filter((m) => !m.voided);
  assert.equal(vig.length, 1);
  assert.equal(Number(vig[0].points), 15);
  assert.equal(Number(vig[0].previous_points), 10);
  assert.equal(data.find((m) => m.id === m1.id).voided, true);
}
const { error: delErr } = await db.from('point_movements').delete().eq('id', m1.id);
const { data: still } = await db.from('point_movements').select('id').eq('id', m1.id);
assert.ok(delErr || still.length === 1, 'no se puede borrar un movimiento');
ok('Asignar y corregir puntos deja valor anterior, nuevo, motivo y responsable; nada se borra (3)');

// ---------------------------------------------------------------------------
// 5. Actividad con DÍAS POINTS por QR (4)
// ---------------------------------------------------------------------------
const act = await rpc('admin_save_point_activity', { p_session: A, p_activity: { name: 'Rally fotográfico', individualPoints: 5, gtPoints: 2, eligibility: { all: false, gtTeams: ['Finanzas', 'Carnival'], personIds: [] }, mechanism: 'ambos', date: '2027-02-11' } });
const actQr = await rpc('admin_activity_qr', { p_session: A, p_activity_id: act.id });
const cl1 = await rpc('claim_activity_qr', { p_session: S, p_token: actQr.token });
assert.equal(cl1.result, 'registrada');
const cl2 = await rpc('claim_activity_qr', { p_session: S, p_token: actQr.token });
assert.equal(cl2.result, 'ya_registrada');
const viaPersonal = await rpc('admin_award_activity', { p_session: A, p_activity_id: act.id, p_person_qr: (await rpc('admin_get_profile', { p_session: A, p_person_id: c1.id })).qr_token });
assert.equal(viaPersonal.result, 'registrada');
const gh1 = P('GH', 1);
assert.match(await rpcErr('admin_award_activity', { p_session: A, p_activity_id: act.id, p_person_id: gh1.id }), /NO_ELEGIBLE/);
{
  const { data } = await db.from('point_movements').select('*').eq('source_id', act.id);
  assert.equal(data.filter((m) => m.target === 'person').length, 2);
  assert.equal(data.filter((m) => m.target === 'gt').reduce((a, m) => a + Number(m.points), 0), 4);
}
ok('Actividad por QR: el integrante escanea o el admin escanea su QR personal, sin duplicar y respetando elegibilidad (4)');

// ---------------------------------------------------------------------------
// 6. CONECTADOS con QR de asistencia (5-12)
// ---------------------------------------------------------------------------
const now = new Date();
const bog = new Date(now.getTime() - 5 * 3600e3);
const hhmm = (d) => d.toISOString().slice(11, 16);
const evStart = new Date(bog.getTime() - 20 * 60e3); // empezó hace 20 min
// Termina en 1 hora, pero sin pasar de las 23:59 (los eventos no cruzan la medianoche)
const evEnd = new Date(Math.min(bog.getTime() + 60 * 60e3, Date.parse(bog.toISOString().slice(0, 10) + 'T23:59:00Z')));
const ev = await rpc('admin_save_calendar_event', { p_session: A, p_event: {
  title: `Conectados prueba ${run}`, date: evStart.toISOString().slice(0, 10), startTime: hhmm(evStart), endTime: hhmm(evEnd),
  type: 'conectados', audience: { all: true }, attendanceEnabled: true, lateAfterMinutes: 30, checkinOpensMinutes: 30,
  scoring: { maxGtPoints: 20, individualPoints: { asistio: 5, tarde: 3, excusa: 0 }, lateWeight: 1, excuseMode: 'excluir' } } });
const evQr = await rpc('admin_event_qr', { p_session: A, p_event_id: ev.id, p_action: 'habilitar' });
assert.ok(evQr.token.length >= 32 && evQr.token !== actQr.token);
ok('El evento genera su propio QR (5)');

const ci = await rpc('checkin_event', { p_session: S, p_token: evQr.token });
assert.equal(ci.result, 'registrada');
assert.equal(ci.status, 'llego');
assert.ok(ci.checked_in_at);
const ci2 = await rpc('checkin_event', { p_session: S, p_token: evQr.token });
assert.equal(ci2.result, 'ya_registrada');
assert.match(await rpcErr('checkin_event', { p_session: A, p_token: evQr.token }), /SIN_PERMISO/);
ok('Escanear con sesión registra la asistencia con hora exacta; el segundo escaneo no duplica (6, 7)');

let list = await rpc('admin_list_event_attendance', { p_session: A, p_event_id: ev.id });
assert.equal(list.length, 1, 'solo existe el registro del QR: el resto sigue PENDIENTE');
const preview1 = await rpc('admin_preview_attendance', { p_session: A, p_event_id: ev.id });
const carnivalPrev = preview1.results.find((r) => r.gt === 'Carnival');
assert.equal(carnivalPrev.pending, 5);
ok('Quien no ha escaneado aparece como PENDIENTE, no como ausente (8)');

// Renovar el QR invalida el anterior
const evQr2 = await rpc('admin_event_qr', { p_session: A, p_event_id: ev.id, p_action: 'renovar' });
assert.match(await rpcErr('checkin_event', { p_session: staffC, p_token: evQr.token }), /QR_INVALIDO/);
await rpc('checkin_event', { p_session: staffC, p_token: evQr2.token });
ok('Renovar el QR invalida el anterior');

// Marcaciones del admin: Carnival 4 llegaron (1 por QR) + 1 no asistió → 80%
const carn = people.filter((p) => p.gt_sub_team === 'Carnival');
await rpc('admin_set_attendance', { p_session: A, p_event_id: ev.id, p_person_ids: carn.slice(1, 4).map((p) => p.id), p_status: 'llego' });
await rpc('admin_set_attendance', { p_session: A, p_event_id: ev.id, p_person_ids: [carn[4].id], p_status: 'no_asistio', p_observation: 'Sin excusa' });
// Finanzas: los 3 llegaron (1 por QR)
const fin = people.filter((p) => p.gt_sub_team === 'Finanzas');
await rpc('admin_set_attendance', { p_session: A, p_event_id: ev.id, p_person_ids: fin.slice(1).map((p) => p.id), p_status: 'llego' });
// GH: 3 llegaron, 1 excusa válida → 100% (excusa no penaliza)
const gh = people.filter((p) => p.gt_sub_team === 'GH');
await rpc('admin_set_attendance', { p_session: A, p_event_id: ev.id, p_person_ids: gh.slice(0, 3).map((p) => p.id), p_status: 'llego' });
const exc = await rpc('admin_set_attendance', { p_session: A, p_event_id: ev.id, p_person_ids: [gh[3].id], p_status: 'excusa', p_observation: 'Excusa aprobada', p_excuse_reason: 'Parcial', p_evidence_url: 'https://drive/excusa.pdf' });
assert.equal(exc[0].excuse_approved_by, admin.name);
assert.ok(exc[0].excuse_approved_at);
// Logística: 2 llegaron, 1 tarde, 1 sin registrar (quedará NO ASISTIÓ al cerrar) → 75%
const log = people.filter((p) => p.gt_sub_team === 'Logística');
await rpc('admin_set_attendance', { p_session: A, p_event_id: ev.id, p_person_ids: log.slice(0, 2).map((p) => p.id), p_status: 'llego' });
await rpc('admin_set_attendance', { p_session: A, p_event_id: ev.id, p_person_ids: [log[2].id], p_status: 'llego_tarde' });
ok('Excusa válida guardada con motivo, evidencia, aprobador y fecha (10)');

const preview = await rpc('admin_preview_attendance', { p_session: A, p_event_id: ev.id });
const by = Object.fromEntries(preview.results.map((r) => [r.gt, r]));
assert.equal(Number(by.Carnival.percentage), 80);
assert.equal(Number(by.Finanzas.percentage), 100);
assert.equal(Number(by.GH.percentage), 100);
assert.equal(Number(by['Logística'].percentage), 75);
ok('El administrador revisa el cálculo antes de confirmar (Carnival 80%, Finanzas 100%, GH 100%, Logística 75%) (11)');

const closure = await rpc('admin_close_attendance', { p_session: A, p_event_id: ev.id });
assert.equal(closure.status, 'cerrado');
list = await rpc('admin_list_event_attendance', { p_session: A, p_event_id: ev.id });
assert.equal(list.find((a) => a.person_id === log[3].id).status, 'no_asistio');
assert.equal(list.filter((a) => a.status === 'pendiente').length, 0);
ok('Al cerrar, solo entonces los pendientes pasan a NO ASISTIÓ (9)');
{
  const { data } = await db.from('point_movements').select('*').eq('source_id', ev.id);
  const gtPts = Object.fromEntries(data.filter((m) => m.target === 'gt').map((m) => [m.gt, Number(m.points)]));
  assert.deepEqual(gtPts, { Carnival: 16, Finanzas: 20, GH: 20, 'Logística': 15 });
  const indiv = data.filter((m) => m.target === 'person');
  assert.equal(indiv.find((m) => m.person_id === log[2].id).points * 1, 3, 'llegó tarde: 3 pts');
  assert.equal(indiv.find((m) => m.person_id === f1.id).points * 1, 5, 'llegó: 5 pts');
  assert.ok(!indiv.find((m) => m.person_id === gh[3].id), 'excusa: 0 pts');
}
ok('DÍAS POINTS del GT e individuales asignados correctamente (12)');
assert.equal((await rpc('checkin_event', { p_session: S, p_token: evQr2.token })).result, 'ya_registrada');
{
  const late = await rpc('login_staff', { p_login: log[3].document_id, p_password: log[3].document_id });
  assert.match(await rpcErr('checkin_event', { p_session: late.token, p_token: evQr2.token }), /QR_CERRADO|ASISTENCIA_CERRADA/);
}
assert.match(await rpcErr('admin_set_attendance', { p_session: A, p_event_id: ev.id, p_person_ids: [log[3].id], p_status: 'llego' }), /ASISTENCIA_CERRADA/);
ok('Con la asistencia cerrada no se puede modificar sin reabrir');

// Denominador congelado: cambiar el GT de alguien no altera el resultado histórico
await db.from('people').update({ gt_sub_team: 'Finanzas', gt_teams: ['Finanzas'] }).eq('id', carn[4].id);
const { data: frozen } = await db.from('conectados_closures').select('*').eq('id', ev.id);
assert.equal(frozen[0].results.find((r) => r.gt === 'Carnival').enabled, 5);
ok('El resultado cerrado no cambia si después cambia la composición del GT');

// Reabrir anula los puntos (quedan en historial)
await rpc('admin_reopen_attendance', { p_session: A, p_event_id: ev.id, p_reason: 'Prueba de reapertura' });
{
  const { data } = await db.from('point_movements').select('*').eq('source_id', ev.id);
  assert.ok(data.length > 0 && data.every((m) => m.voided));
}
await rpc('admin_close_attendance', { p_session: A, p_event_id: ev.id });
ok('Reabrir anula con trazabilidad y se puede volver a cerrar');

// Fuera de horario
const past = await rpc('admin_save_calendar_event', { p_session: A, p_event: { title: 'Pasado', date: '2020-01-01', startTime: '10:00', endTime: '11:00', type: 'conectados', audience: { all: true }, attendanceEnabled: true } });
const pastQr = await rpc('admin_event_qr', { p_session: A, p_event_id: past.id, p_action: 'habilitar' });
assert.match(await rpcErr('checkin_event', { p_session: S, p_token: pastQr.token }), /FUERA_DE_HORARIO/);
await rpc('admin_event_qr', { p_session: A, p_event_id: past.id, p_action: 'cerrar' });
assert.match(await rpcErr('checkin_event', { p_session: S, p_token: pastQr.token }), /QR_CERRADO/);
ok('Valida horario permitido y QR cerrado');

// ---------------------------------------------------------------------------
// 7. Ranking (13) y persistencia (14)
// ---------------------------------------------------------------------------
{
  const { data } = await db.from('point_movements').select('*').eq('voided', false);
  const totals = {};
  data.filter((m) => m.target === 'gt').forEach((m) => (totals[m.gt] = (totals[m.gt] || 0) + Number(m.points)));
  assert.ok(totals.Finanzas >= 20 + 2);
}
const audit = await rpc('admin_list_audit', { p_session: A });
assert.ok(audit.some((x) => x.action === 'corregir_puntos' && x.before_data && x.after_data));
assert.ok(audit.some((x) => x.action === 'renovar_qr_evento'));
ok('El ranking se alimenta de los movimientos guardados; la auditoría registra cada cambio administrativo (13, 14)');

// Recordatorios (solo propios)
const rem = await rpc('save_my_reminder', { p_session: S, p_event_id: ev.id, p_enabled: true, p_offsets: [15, 60, 999] });
assert.deepEqual(rem.offsets, [60, 15]);
const mine = await rpc('my_reminders', { p_session: S });
assert.equal(mine.length, 1);
ok('Recordatorios guardados en la base de datos, solo del propio integrante');

// Cumpleaños: la fecha de nacimiento es privada (solo administración)
{
  const target = people[0];
  assert.match(await rpcErr('admin_set_birth_date', { p_session: S, p_person_id: target.id, p_birth_date: '2003-11-06' }), /SIN_PERMISO/);
  assert.match(await rpcErr('admin_list_birthdays', { p_session: S }), /SIN_PERMISO/);
  assert.match(await rpcErr('admin_list_birthdays', { p_session: 'inventado' }), /SESION_INVALIDA/);
  ok('Un integrante no puede ver ni cambiar fechas de nacimiento');

  assert.match(await rpcErr('admin_set_birth_date', { p_session: A, p_person_id: target.id, p_birth_date: '2999-01-01' }), /FECHA_INVALIDA/);
  await rpc('admin_set_birth_date', { p_session: A, p_person_id: target.id, p_birth_date: '2003-11-06' });
  const list = await rpc('admin_list_birthdays', { p_session: A });
  const mineB = list.filter((b) => b.person_id === target.id);
  assert.equal(mineB.length, 1);
  assert.equal(mineB[0].birth_date, '2003-11-06');
  assert.equal(mineB[0].gt, target.gt_sub_team);
  assert.ok(!list.some((b) => b.person_id === people[1].id), 'sin fecha registrada no aparece');
  const prof = await rpc('admin_get_profile', { p_session: A, p_person_id: target.id });
  assert.equal(prof.birth_date, '2003-11-06');
  ok('La administración guarda la fecha en el perfil existente y ve el cumpleaños; sin fecha no aparece nada');

  // Se guarda en el mismo perfil: no se duplican registros
  await rpc('admin_set_birth_date', { p_session: A, p_person_id: target.id, p_birth_date: '2003-11-07' });
  assert.equal((await rpc('admin_list_birthdays', { p_session: A })).filter((b) => b.person_id === target.id).length, 1);
  const { data: anonRead, error: anonErr } = await db.from('person_profiles').select('birth_date').limit(1);
  assert.ok(anonErr || anonRead.length === 0, 'anon no debe leer fechas de nacimiento');
  const { data: peopleCols } = await db.from('people').select('*').eq('id', target.id);
  assert.ok(!('birth_date' in (peopleCols?.[0] || {})), 'la fecha no está en la tabla pública people');
  ok('La fecha no se puede leer con la clave pública y no se duplica el registro');

  const auditB = await rpc('admin_list_audit', { p_session: A, p_entity_id: target.id });
  assert.ok(auditB.some((x) => x.action === 'actualizar_fecha_nacimiento'));
  ok('El cambio de fecha queda en la auditoría');

  // Carga masiva (Excel)
  assert.match(await rpcErr('admin_set_birth_dates', { p_session: S, p_items: [] }), /SIN_PERMISO/);
  const bulk = await rpc('admin_set_birth_dates', {
    p_session: A,
    p_items: [
      { person_id: people[1].id, birth_date: '1999-05-20' },
      { person_id: people[2].id, birth_date: '2001-12-31' },
      { person_id: 'no-existe', birth_date: '2000-01-01' },
      { person_id: people[3].id, birth_date: '2999-01-01' },
    ],
  });
  assert.equal(bulk.saved, 2);
  assert.deepEqual(bulk.skipped, ['no-existe', people[3].id]);
  const afterBulk = await rpc('admin_list_birthdays', { p_session: A });
  assert.equal(afterBulk.find((b) => b.person_id === people[1].id).birth_date, '1999-05-20');
  assert.ok(!afterBulk.some((b) => b.person_id === 'no-existe' || b.person_id === people[3].id));
  const { count: ghost } = await db.from('people').select('id', { count: 'exact', head: true }).eq('id', 'no-existe');
  assert.ok(!ghost, 'no crea personas');
  ok('Carga masiva: guarda todas las fechas válidas de una vez, ignora personas inexistentes y fechas futuras, no crea integrantes');

  // Notificaciones push de la administradora
  assert.match(await rpcErr('save_admin_push_subscription', { p_session: S, p_id: 'x', p_endpoint: 'https://push/x', p_p256dh: 'k', p_auth: 'a', p_user_agent: 't' }), /SIN_PERMISO/);
  assert.equal(await rpc('save_admin_push_subscription', { p_session: A, p_id: `adm_${run}`, p_endpoint: 'https://push/a', p_p256dh: 'k', p_auth: 'a', p_user_agent: 't' }), true);
  const { data: subsRead, error: subsErr } = await db.from('admin_push_subscriptions').select('*').limit(1);
  assert.ok(subsErr || subsRead.length === 0, 'anon no debe leer suscripciones');
  ok('Solo la administración registra su dispositivo para recibir los recordatorios de cumpleaños');

  // El perfil propio del integrante no expone la fecha
  const own = await rpc('my_profile', { p_session: S });
  assert.ok(!('birth_date' in own));
  ok('El perfil que ve el integrante no muestra fecha de nacimiento ni edad');
}

await rpc('logout', { p_session: S });
assert.match(await rpcErr('my_profile', { p_session: S }), /SESION_INVALIDA/);
ok('Cerrar sesión invalida el token');
console.log('\nTodas las pruebas de base de datos pasaron.');
