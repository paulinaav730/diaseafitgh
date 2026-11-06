-- ==============================================================================
-- DÍAS EAFIT 2027 — CALENDARIO · DÍAS LEAGUE · PERFIL DÍAS · QR DE ASISTENCIA
-- Ejecutar en Supabase → SQL Editor (después de schema.sql). Se puede volver a
-- ejecutar: usa IF NOT EXISTS / CREATE OR REPLACE.
--
-- MODELO DE SEGURIDAD
--  * El navegador solo tiene la clave pública (anon). Por eso NINGUNA tabla de
--    este archivo acepta escrituras directas: todo cambio pasa por funciones
--    (RPC) que validan una sesión emitida por el servidor.
--  * Las sesiones se crean con login_admin / login_staff. La contraseña del
--    administrador se guarda cifrada (bcrypt) en la base de datos, no en la app.
--  * Los códigos QR (personales, de eventos y de actividades) son tokens
--    aleatorios de 192 bits guardados en tablas que la clave pública NO puede
--    leer. No contienen cédula ni datos personales.
--  * Asistencias, excusas, recordatorios, escaneos y auditoría solo se leen con
--    funciones que verifican la sesión.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. Autenticación: administradores, sesiones e intentos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.app_sessions (
    token_hash TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin','staff')),
    person_id TEXT REFERENCES public.people(id) ON DELETE CASCADE,
    admin_id TEXT REFERENCES public.admin_users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.login_attempts (
    id BIGSERIAL PRIMARY KEY,
    login TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_login ON public.login_attempts (login, attempted_at);

-- Administrador inicial (mismas credenciales que usaba la app). Cámbielas con:
--   UPDATE admin_users SET password_hash = crypt('NUEVA', gen_salt('bf')) WHERE username = 'DIAS2026';
INSERT INTO public.admin_users (username, display_name, password_hash) VALUES
  ('DIAS2026', 'Dirección General DÍAS EAFIT', crypt('2580DIAS', gen_salt('bf'))),
  ('DIAS', 'Dirección General DÍAS EAFIT', crypt('2580DIAS', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Perfil DÍAS (vinculado a people, sin duplicar personas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.person_profiles (
    person_id TEXT PRIMARY KEY REFERENCES public.people(id) ON DELETE CASCADE,
    qr_token TEXT NOT NULL UNIQUE,
    photo_url TEXT,
    qr_renewed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. Calendario
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_event_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'tinta',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TEXT NOT NULL,           -- 'HH:mm' hora de Colombia
    end_time TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    location TEXT,
    type TEXT NOT NULL,                 -- tipo predefinido o de calendar_event_types
    training_mode TEXT CHECK (training_mode IN ('invitacion','abierta')),
    audience JSONB NOT NULL DEFAULT '{"all": true, "gtTeams": [], "includeGap": false, "includeMesa": false, "personIds": []}',
    status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','cancelado')),
    scoring JSONB,                      -- reglas de DÍAS POINTS (CONECTADOS)
    attendance_enabled BOOLEAN NOT NULL DEFAULT false,
    checkin_opens_minutes INTEGER NOT NULL DEFAULT 30,  -- minutos antes del inicio
    late_after_minutes INTEGER NOT NULL DEFAULT 15,     -- tolerancia para "llegó"
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_starts ON public.calendar_events (starts_at);

-- QR de asistencia: uno por evento, renovable. No legible con la clave pública.
CREATE TABLE IF NOT EXISTS public.event_qr_codes (
    event_id TEXT PRIMARY KEY REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    renewed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS public.calendar_reminders (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    offsets INTEGER[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
    id TEXT PRIMARY KEY,
    sent_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. Asistencia a eventos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_attendances (
    id TEXT PRIMARY KEY,                -- '<event_id>__<person_id>' → evita duplicados
    event_id TEXT NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pendiente','llego','llego_tarde','excusa','no_asistio','no_aplica')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('qr','manual')),
    checked_in_at TIMESTAMPTZ,          -- hora exacta del escaneo
    observation TEXT,
    excuse_reason TEXT,
    excuse_evidence_url TEXT,
    excuse_approved_by TEXT,
    excuse_approved_at TIMESTAMPTZ,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (event_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_event_attendances_event ON public.event_attendances (event_id);

-- Cierre: resultados congelados (denominador histórico por GT)
CREATE TABLE IF NOT EXISTS public.conectados_closures (
    id TEXT PRIMARY KEY,                -- = event_id
    event_id TEXT NOT NULL REFERENCES public.calendar_events(id) ON DELETE RESTRICT,
    scoring JSONB,
    results JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL CHECK (status IN ('cerrado','reabierto')),
    closed_at TIMESTAMPTZ NOT NULL,
    closed_by TEXT NOT NULL,
    reopened_at TIMESTAMPTZ,
    reopened_by TEXT,
    reopen_reason TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 5. DÍAS LEAGUE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.league_challenges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rules TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    gt_teams TEXT[] NOT NULL DEFAULT '{}',
    placements JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL CHECK (status IN ('pendiente','activo','finalizado','cancelado')),
    evidences JSONB NOT NULL DEFAULT '[]',
    results JSONB NOT NULL DEFAULT '[]',
    individual_awards JSONB NOT NULL DEFAULT '[]',
    results_registered_at TIMESTAMPTZ,
    results_registered_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Actividades que entregan DÍAS POINTS por QR
CREATE TABLE IF NOT EXISTS public.point_activities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    challenge_id TEXT REFERENCES public.league_challenges(id) ON DELETE SET NULL,
    individual_points NUMERIC(10,2) NOT NULL DEFAULT 0,   -- a cada participante
    gt_points NUMERIC(10,2) NOT NULL DEFAULT 0,           -- al GT del participante, por participante
    eligibility JSONB NOT NULL DEFAULT '{"all": true, "gtTeams": [], "includeGap": false, "includeMesa": false, "personIds": []}',
    mechanism TEXT NOT NULL DEFAULT 'ambos' CHECK (mechanism IN ('qr_actividad','qr_personal','ambos')),
    status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','cerrada')),
    activity_date DATE NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.point_activity_qr (
    activity_id TEXT PRIMARY KEY REFERENCES public.point_activities(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    renewed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.point_activity_claims (
    id TEXT PRIMARY KEY,                -- '<activity_id>__<person_id>' → una vez por persona
    activity_id TEXT NOT NULL REFERENCES public.point_activities(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('qr_actividad','qr_personal','manual')),
    registered_by TEXT NOT NULL,
    claimed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (activity_id, person_id)
);

-- Libro de DÍAS POINTS: nunca se borra; se anula o se corrige con trazabilidad
CREATE TABLE IF NOT EXISTS public.point_movements (
    id TEXT PRIMARY KEY,
    activity_date DATE NOT NULL,
    target TEXT NOT NULL CHECK (target IN ('gt','person')),
    gt TEXT,
    person_id TEXT REFERENCES public.people(id) ON DELETE SET NULL,
    points NUMERIC(10,2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('reto','conectados','actividad','manual','correccion')),
    source_type TEXT,
    source_id TEXT,
    activity_name TEXT NOT NULL,
    reason TEXT,
    observation TEXT,
    evidence_url TEXT,
    corrects_id TEXT REFERENCES public.point_movements(id),
    previous_points NUMERIC(10,2),
    new_points NUMERIC(10,2),
    registered_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    voided BOOLEAN NOT NULL DEFAULT false,
    voided_at TIMESTAMPTZ,
    voided_by TEXT,
    void_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_point_movements_source ON public.point_movements (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_point_movements_person ON public.point_movements (person_id);

CREATE OR REPLACE FUNCTION public.prevent_point_movement_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los movimientos de DÍAS POINTS no se borran: anúlelos dejando el motivo.';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_point_movements_no_delete ON public.point_movements;
CREATE TRIGGER trg_point_movements_no_delete BEFORE DELETE ON public.point_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_point_movement_delete();

CREATE TABLE IF NOT EXISTS public.league_settings (
    id TEXT PRIMARY KEY,
    default_conectados_scoring JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 6. Registro de escaneos y auditoría administrativa
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_scans (
    id BIGSERIAL PRIMARY KEY,
    scanned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('evento','actividad','persona')),
    target_id TEXT,
    scanner_role TEXT,
    scanner_name TEXT,
    scanner_person_id TEXT,
    scanned_person_id TEXT,
    result TEXT NOT NULL,
    detail TEXT
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    at TIMESTAMPTZ DEFAULT now() NOT NULL,
    admin_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    before_data JSONB,
    after_data JSONB,
    reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON public.admin_audit_log (entity, entity_id);

-- ==============================================================================
-- RLS: lectura pública solo de lo que no es sensible; ninguna escritura directa
-- ==============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  -- Lectura pública (ranking, calendario, retos, actividades): sin datos personales sensibles
  FOREACH t IN ARRAY ARRAY['calendar_events','calendar_event_types','conectados_closures','league_challenges',
                           'point_movements','league_settings','point_activities','point_activity_claims']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Lectura publica" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados y anon" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Lectura publica" ON public.%I FOR SELECT USING (true)', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
  END LOOP;
  -- Privadas: solo accesibles mediante funciones con sesión
  FOREACH t IN ARRAY ARRAY['admin_users','app_sessions','login_attempts','person_profiles','event_qr_codes',
                           'calendar_reminders','push_subscriptions','reminder_deliveries','event_attendances',
                           'point_activity_qr','qr_scans','admin_audit_log']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados y anon" ON public.%I', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ==============================================================================
-- FUNCIONES INTERNAS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public._new_token() RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public, pg_temp AS $$
  SELECT translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
$$;

CREATE OR REPLACE FUNCTION public._hash(p TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT encode(digest(coalesce(p, ''), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public._fail(p_code TEXT, p_message TEXT) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = p_code || ': ' || p_message;
END;
$$;

CREATE OR REPLACE FUNCTION public._session(p_session TEXT) RETURNS public.app_sessions
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions;
BEGIN
  SELECT * INTO s FROM app_sessions
   WHERE token_hash = _hash(p_session) AND NOT revoked AND expires_at > now();
  IF NOT FOUND THEN PERFORM _fail('SESION_INVALIDA', 'Tu sesión expiró. Vuelve a iniciar sesión.'); END IF;
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public._require_admin(p_session TEXT) RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _session(p_session);
BEGIN
  IF s.role <> 'admin' THEN PERFORM _fail('SIN_PERMISO', 'Esta acción es solo para administradores.'); END IF;
  RETURN s.display_name;
END;
$$;

CREATE OR REPLACE FUNCTION public._require_staff(p_session TEXT) RETURNS public.app_sessions
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _session(p_session);
BEGIN
  IF s.role <> 'staff' OR s.person_id IS NULL THEN
    PERFORM _fail('SIN_PERMISO', 'Inicia sesión con tu usuario de integrante para hacer esto.');
  END IF;
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public._audit(p_admin TEXT, p_action TEXT, p_entity TEXT, p_id TEXT,
  p_before JSONB, p_after JSONB, p_reason TEXT DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO admin_audit_log (admin_name, action, entity, entity_id, before_data, after_data, reason)
  VALUES (p_admin, p_action, p_entity, p_id, p_before, p_after, p_reason);
$$;

CREATE OR REPLACE FUNCTION public._person_primary_gt(p public.people) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p.primary_type = 'MESA' THEN NULL ELSE coalesce(p.gt_sub_team, p.gt_teams[1]) END;
$$;

CREATE OR REPLACE FUNCTION public._in_audience(p public.people, a JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((a->>'all')::boolean, false)
      OR coalesce(a->'personIds', '[]'::jsonb) ? p.id
      OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(a->'gtTeams', '[]'::jsonb)) g
                  WHERE g = p.gt_sub_team OR g = ANY(coalesce(p.gt_teams, '{}')))
      OR (coalesce((a->>'includeGap')::boolean, false) AND (p.primary_type = 'GAP' OR coalesce(p.notes, '') LIKE '%[DUAL_GAP%'))
      OR (coalesce((a->>'includeMesa')::boolean, false) AND p.primary_type = 'MESA');
$$;

-- QR personal: se crea automáticamente para cada integrante (nuevo o existente)
CREATE OR REPLACE FUNCTION public._ensure_profile(p_person_id TEXT) RETURNS public.person_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE pr public.person_profiles;
BEGIN
  INSERT INTO person_profiles (person_id, qr_token) VALUES (p_person_id, _new_token())
  ON CONFLICT (person_id) DO NOTHING;
  SELECT * INTO pr FROM person_profiles WHERE person_id = p_person_id;
  RETURN pr;
END;
$$;

CREATE OR REPLACE FUNCTION public._people_profile_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM _ensure_profile(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_people_profile ON public.people;
CREATE TRIGGER trg_people_profile AFTER INSERT ON public.people
  FOR EACH ROW EXECUTE FUNCTION public._people_profile_trigger();
INSERT INTO public.person_profiles (person_id, qr_token)
  SELECT id, public._new_token() FROM public.people ON CONFLICT (person_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public._log_scan(p_kind TEXT, p_target TEXT, s public.app_sessions,
  p_scanned_person TEXT, p_result TEXT, p_detail TEXT DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO qr_scans (kind, target_id, scanner_role, scanner_name, scanner_person_id, scanned_person_id, result, detail)
  VALUES (p_kind, p_target, s.role, s.display_name, s.person_id, p_scanned_person, p_result, p_detail);
$$;

CREATE OR REPLACE FUNCTION public._movement_id() RETURNS TEXT
LANGUAGE sql VOLATILE AS $$ SELECT 'pts_' || replace(gen_random_uuid()::text, '-', ''); $$;

-- ==============================================================================
-- LOGIN
-- ==============================================================================
CREATE OR REPLACE FUNCTION public._check_rate(p_login TEXT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (SELECT count(*) FROM login_attempts
       WHERE login = lower(p_login) AND NOT success AND attempted_at > now() - interval '15 minutes') >= 10 THEN
    PERFORM _fail('DEMASIADOS_INTENTOS', 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.login_admin(p_username TEXT, p_password TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.admin_users; tok TEXT := _new_token(); exp TIMESTAMPTZ := now() + interval '12 hours';
BEGIN
  PERFORM _check_rate('admin:' || p_username);
  SELECT * INTO a FROM admin_users WHERE upper(username) = upper(trim(p_username));
  IF NOT FOUND OR a.password_hash <> crypt(trim(p_password), a.password_hash) THEN
    INSERT INTO login_attempts (login, success) VALUES (lower('admin:' || p_username), false);
    PERFORM _fail('CREDENCIALES', 'Usuario o contraseña de administrador incorrectos.');
  END IF;
  INSERT INTO login_attempts (login, success) VALUES (lower('admin:' || p_username), true);
  INSERT INTO app_sessions (token_hash, role, admin_id, display_name, expires_at)
  VALUES (_hash(tok), 'admin', a.id, a.display_name, exp);
  RETURN jsonb_build_object('token', tok, 'role', 'admin', 'name', a.display_name, 'username', a.username, 'expires_at', exp);
END;
$$;

-- Misma lógica de búsqueda que usaba la app: usuario, cédula, correos, EPIK, nombre.
CREATE OR REPLACE FUNCTION public.login_staff(p_login TEXT, p_password TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  q TEXT := lower(trim(p_login));
  q_noat TEXT := ltrim(lower(trim(p_login)), '@');
  q_doc TEXT := regexp_replace(trim(p_login), '\D', '', 'g');
  pass_doc TEXT := regexp_replace(trim(p_password), '\D', '', 'g');
  p public.people; tok TEXT := _new_token(); exp TIMESTAMPTZ := now() + interval '30 days';
BEGIN
  PERFORM _check_rate('staff:' || q);
  SELECT * INTO p FROM people pe WHERE
       (q_doc <> '' AND regexp_replace(pe.document_id, '\D', '', 'g') = q_doc)
    OR lower(pe.document_id) = q
    OR (pe.username IS NOT NULL AND ltrim(lower(pe.username), '@') = q_noat)
    OR (pe.epik_id IS NOT NULL AND lower(pe.epik_id) IN (q, q_noat))
    OR (pe.institutional_email IS NOT NULL AND (lower(pe.institutional_email) = q OR split_part(lower(pe.institutional_email), '@', 1) = q_noat))
    OR (pe.email IS NOT NULL AND (lower(pe.email) = q OR split_part(lower(pe.email), '@', 1) = q_noat))
    OR (pe.external_excel_id IS NOT NULL AND lower(pe.external_excel_id) = q)
    OR (length(q) >= 4 AND (lower(pe.name) = q OR lower(coalesce(pe.full_name, '')) = q))
  ORDER BY pe.created_at LIMIT 1;
  IF NOT FOUND OR NOT (
       (pass_doc <> '' AND regexp_replace(p.document_id, '\D', '', 'g') = pass_doc)
       OR lower(trim(p_password)) = lower(trim(p.document_id))) THEN
    INSERT INTO login_attempts (login, success) VALUES ('staff:' || q, false);
    PERFORM _fail('CREDENCIALES', 'Usuario o contraseña (cédula) incorrectos.');
  END IF;
  INSERT INTO login_attempts (login, success) VALUES ('staff:' || q, true);
  INSERT INTO app_sessions (token_hash, role, person_id, display_name, expires_at)
  VALUES (_hash(tok), 'staff', p.id, p.name, exp);
  PERFORM _ensure_profile(p.id);
  RETURN jsonb_build_object('token', tok, 'role', 'staff', 'name', p.name, 'person', to_jsonb(p), 'expires_at', exp);
END;
$$;

CREATE OR REPLACE FUNCTION public.session_info(p_session TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _session(p_session);
BEGIN
  RETURN jsonb_build_object('role', s.role, 'name', s.display_name, 'person_id', s.person_id, 'expires_at', s.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.logout(p_session TEXT) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE app_sessions SET revoked = true WHERE token_hash = _hash(p_session) RETURNING true;
$$;

-- ==============================================================================
-- PERFIL DÍAS Y QR PERSONAL
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.my_profile(p_session TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _require_staff(p_session); pr public.person_profiles;
BEGIN
  pr := _ensure_profile(s.person_id);
  RETURN jsonb_build_object('person_id', s.person_id, 'qr_token', pr.qr_token, 'photo_url', pr.photo_url);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_profile(p_session TEXT, p_person_id TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE pr public.person_profiles;
BEGIN
  PERFORM _require_admin(p_session);
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = p_person_id) THEN PERFORM _fail('NO_ENCONTRADO', 'Integrante no encontrado.'); END IF;
  pr := _ensure_profile(p_person_id);
  RETURN jsonb_build_object('person_id', p_person_id, 'qr_token', pr.qr_token, 'photo_url', pr.photo_url, 'qr_renewed_at', pr.qr_renewed_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_profile(p_session TEXT, p_person_id TEXT, p_photo_url TEXT, p_renew_qr BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); before public.person_profiles := _ensure_profile(p_person_id); after public.person_profiles;
BEGIN
  UPDATE person_profiles SET photo_url = nullif(trim(p_photo_url), ''),
         qr_token = CASE WHEN p_renew_qr THEN _new_token() ELSE qr_token END,
         qr_renewed_at = CASE WHEN p_renew_qr THEN now() ELSE qr_renewed_at END,
         updated_at = now()
   WHERE person_id = p_person_id RETURNING * INTO after;
  PERFORM _audit(adm, CASE WHEN p_renew_qr THEN 'renovar_qr_personal' ELSE 'actualizar_perfil' END, 'person_profiles', p_person_id,
                 jsonb_build_object('photo_url', before.photo_url), jsonb_build_object('photo_url', after.photo_url, 'qr_renovado', p_renew_qr));
  RETURN jsonb_build_object('person_id', p_person_id, 'qr_token', after.qr_token, 'photo_url', after.photo_url, 'qr_renewed_at', after.qr_renewed_at);
END;
$$;

-- Escaneo de un QR personal: el administrador ve el perfil; un integrante solo ve nombre y GT.
CREATE OR REPLACE FUNCTION public.resolve_person_qr(p_session TEXT, p_qr TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _session(p_session); pr public.person_profiles; p public.people;
BEGIN
  SELECT * INTO pr FROM person_profiles WHERE qr_token = p_qr;
  IF NOT FOUND THEN
    PERFORM _log_scan('persona', NULL, s, NULL, 'qr_invalido');
    PERFORM _fail('QR_INVALIDO', 'Este código QR no corresponde a ningún integrante.');
  END IF;
  SELECT * INTO p FROM people WHERE id = pr.person_id;
  PERFORM _log_scan('persona', pr.person_id, s, pr.person_id, 'identificado');
  IF s.role = 'admin' THEN
    RETURN jsonb_build_object('access', 'admin', 'person', to_jsonb(p), 'photo_url', pr.photo_url);
  END IF;
  RETURN jsonb_build_object('access', 'limitado', 'person', jsonb_build_object('id', p.id, 'name', p.name, 'gt', _person_primary_gt(p)), 'photo_url', pr.photo_url);
END;
$$;

-- ==============================================================================
-- CALENDARIO (administración)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_save_calendar_event(p_session TEXT, p_event JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); before JSONB; r public.calendar_events;
  v_id TEXT := coalesce(nullif(p_event->>'id', ''), 'evt_' || replace(gen_random_uuid()::text, '-', ''));
  v_date DATE := (p_event->>'date')::date; v_start TEXT := p_event->>'startTime'; v_end TEXT := p_event->>'endTime';
BEGIN
  IF coalesce(trim(p_event->>'title'), '') = '' THEN PERFORM _fail('DATOS', 'Escribe el nombre del evento.'); END IF;
  IF v_end <= v_start THEN PERFORM _fail('DATOS', 'La hora de finalización debe ser posterior a la de inicio.'); END IF;
  SELECT to_jsonb(e) INTO before FROM calendar_events e WHERE id = v_id;
  INSERT INTO calendar_events AS e (id, title, description, event_date, start_time, end_time, starts_at, ends_at, location, type,
      training_mode, audience, status, scoring, attendance_enabled, checkin_opens_minutes, late_after_minutes, created_by, created_at, updated_at)
  VALUES (v_id, trim(p_event->>'title'), nullif(p_event->>'description', ''), v_date, v_start, v_end,
      (v_date + v_start::time) AT TIME ZONE 'America/Bogota', (v_date + v_end::time) AT TIME ZONE 'America/Bogota',
      nullif(p_event->>'location', ''), p_event->>'type', nullif(p_event->>'trainingMode', ''),
      coalesce(p_event->'audience', '{"all": true}'::jsonb), coalesce(nullif(p_event->>'status', ''), 'activo'),
      CASE WHEN jsonb_typeof(p_event->'scoring') = 'object' THEN p_event->'scoring' END,
      coalesce((p_event->>'attendanceEnabled')::boolean, false),
      coalesce((p_event->>'checkinOpensMinutes')::int, 30), coalesce((p_event->>'lateAfterMinutes')::int, 15),
      adm, now(), now())
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, event_date = EXCLUDED.event_date,
      start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
      location = EXCLUDED.location, type = EXCLUDED.type, training_mode = EXCLUDED.training_mode, audience = EXCLUDED.audience,
      status = EXCLUDED.status, scoring = EXCLUDED.scoring, attendance_enabled = EXCLUDED.attendance_enabled,
      checkin_opens_minutes = EXCLUDED.checkin_opens_minutes, late_after_minutes = EXCLUDED.late_after_minutes, updated_at = now()
  RETURNING * INTO r;
  PERFORM _audit(adm, CASE WHEN before IS NULL THEN 'crear_evento' ELSE 'editar_evento' END, 'calendar_events', v_id, before, to_jsonb(r));
  RETURN to_jsonb(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_calendar_event(p_session TEXT, p_event_id TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); before JSONB;
BEGIN
  IF EXISTS (SELECT 1 FROM conectados_closures WHERE event_id = p_event_id) THEN
    PERFORM _fail('BLOQUEADO', 'Este evento tiene una asistencia cerrada o con historial: cancélalo en lugar de eliminarlo.');
  END IF;
  SELECT to_jsonb(e) INTO before FROM calendar_events e WHERE id = p_event_id;
  DELETE FROM calendar_events WHERE id = p_event_id;
  PERFORM _audit(adm, 'eliminar_evento', 'calendar_events', p_event_id, before, NULL);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_event_type(p_session TEXT, p_id TEXT, p_name TEXT, p_color TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); r public.calendar_event_types;
BEGIN
  IF coalesce(trim(p_name), '') = '' THEN PERFORM _fail('DATOS', 'Escribe el nombre del tipo.'); END IF;
  INSERT INTO calendar_event_types (id, name, color, created_by)
  VALUES (coalesce(nullif(p_id, ''), 'tipo_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), trim(p_name), coalesce(p_color, 'tinta'), adm)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color
  RETURNING * INTO r;
  PERFORM _audit(adm, 'guardar_tipo_evento', 'calendar_event_types', r.id, NULL, to_jsonb(r));
  RETURN to_jsonb(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_event_type(p_session TEXT, p_id TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session);
BEGIN
  IF EXISTS (SELECT 1 FROM calendar_events WHERE type = p_id) THEN
    PERFORM _fail('BLOQUEADO', 'Hay eventos con este tipo. Cámbialos de tipo antes de eliminarlo.');
  END IF;
  DELETE FROM calendar_event_types WHERE id = p_id;
  PERFORM _audit(adm, 'eliminar_tipo_evento', 'calendar_event_types', p_id, NULL, NULL);
  RETURN true;
END;
$$;

-- QR de asistencia del evento (habilitar, cerrar o renovar)
CREATE OR REPLACE FUNCTION public.admin_event_qr(p_session TEXT, p_event_id TEXT, p_action TEXT DEFAULT 'ver') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); q public.event_qr_codes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM calendar_events WHERE id = p_event_id AND attendance_enabled) THEN
    PERFORM _fail('DATOS', 'Activa el control de asistencia por QR en el evento primero.');
  END IF;
  INSERT INTO event_qr_codes (event_id, token, updated_by) VALUES (p_event_id, _new_token(), adm)
  ON CONFLICT (event_id) DO NOTHING;
  IF p_action IN ('habilitar', 'cerrar', 'renovar') THEN
    UPDATE event_qr_codes SET
      enabled = CASE WHEN p_action = 'cerrar' THEN false ELSE true END,
      token = CASE WHEN p_action = 'renovar' THEN _new_token() ELSE token END,
      renewed_at = CASE WHEN p_action = 'renovar' THEN now() ELSE renewed_at END,
      updated_by = adm
    WHERE event_id = p_event_id;
    PERFORM _audit(adm, p_action || '_qr_evento', 'event_qr_codes', p_event_id, NULL, NULL);
  END IF;
  SELECT * INTO q FROM event_qr_codes WHERE event_id = p_event_id;
  RETURN jsonb_build_object('event_id', q.event_id, 'token', q.token, 'enabled', q.enabled, 'renewed_at', q.renewed_at);
END;
$$;

-- ==============================================================================
-- ASISTENCIA
-- ==============================================================================
CREATE OR REPLACE FUNCTION public._attendance_locked(p_event_id TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.conectados_closures WHERE event_id = p_event_id AND status = 'cerrado');
$$;

-- El integrante escanea el QR del evento con su sesión iniciada.
CREATE OR REPLACE FUNCTION public.checkin_event(p_session TEXT, p_token TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _require_staff(p_session); q public.event_qr_codes; e public.calendar_events;
  p public.people; a public.event_attendances; v_status TEXT; v_id TEXT;
BEGIN
  SELECT * INTO q FROM event_qr_codes WHERE token = p_token;
  IF NOT FOUND THEN
    PERFORM _log_scan('evento', NULL, s, s.person_id, 'qr_invalido');
    PERFORM _fail('QR_INVALIDO', 'Este código QR no es válido o fue renovado. Pide el código actual.');
  END IF;
  SELECT * INTO e FROM calendar_events WHERE id = q.event_id;
  v_id := e.id || '__' || s.person_id;
  -- Doble escaneo: no duplica
  SELECT * INTO a FROM event_attendances WHERE id = v_id;
  IF FOUND AND a.status IN ('llego', 'llego_tarde') THEN
    PERFORM _log_scan('evento', e.id, s, s.person_id, 'ya_registrada');
    RETURN jsonb_build_object('result', 'ya_registrada', 'event_title', e.title, 'status', a.status, 'checked_in_at', a.checked_in_at);
  END IF;
  IF NOT q.enabled OR NOT e.attendance_enabled THEN
    PERFORM _log_scan('evento', e.id, s, s.person_id, 'qr_cerrado');
    PERFORM _fail('QR_CERRADO', 'El registro de asistencia de este evento está cerrado.');
  END IF;
  IF e.status <> 'activo' THEN PERFORM _fail('EVENTO_CANCELADO', 'Este evento fue cancelado.'); END IF;
  IF _attendance_locked(e.id) THEN PERFORM _fail('ASISTENCIA_CERRADA', 'La asistencia de este evento ya fue cerrada.'); END IF;
  IF now() < e.starts_at - make_interval(mins => e.checkin_opens_minutes) OR now() > e.ends_at THEN
    PERFORM _log_scan('evento', e.id, s, s.person_id, 'fuera_de_horario');
    PERFORM _fail('FUERA_DE_HORARIO', format('El registro abre %s minutos antes del inicio y cierra al terminar el evento.', e.checkin_opens_minutes));
  END IF;
  SELECT * INTO p FROM people WHERE id = s.person_id;
  IF NOT _in_audience(p, e.audience) THEN
    PERFORM _log_scan('evento', e.id, s, s.person_id, 'no_invitado');
    PERFORM _fail('NO_INVITADO', 'No estás en la lista de invitados de este evento.');
  END IF;
  IF a.id IS NOT NULL AND a.status IN ('excusa', 'no_aplica') THEN
    PERFORM _log_scan('evento', e.id, s, s.person_id, 'bloqueado_' || a.status);
    PERFORM _fail('YA_GESTIONADO', 'Tu asistencia ya fue gestionada por el administrador. Consúltale si hay un error.');
  END IF;
  v_status := CASE WHEN now() > e.starts_at + make_interval(mins => e.late_after_minutes) THEN 'llego_tarde' ELSE 'llego' END;
  INSERT INTO event_attendances (id, event_id, person_id, status, source, checked_in_at, updated_by, updated_at)
  VALUES (v_id, e.id, s.person_id, v_status, 'qr', now(), s.display_name, now())
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, source = 'qr', checked_in_at = EXCLUDED.checked_in_at,
      updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING * INTO a;
  PERFORM _log_scan('evento', e.id, s, s.person_id, 'registrada', v_status);
  RETURN jsonb_build_object('result', 'registrada', 'event_title', e.title, 'status', a.status, 'checked_in_at', a.checked_in_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_attendance(p_session TEXT, p_event_id TEXT, p_person_ids TEXT[], p_status TEXT,
  p_observation TEXT DEFAULT NULL, p_excuse_reason TEXT DEFAULT NULL, p_evidence_url TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); pid TEXT; before JSONB; r public.event_attendances; out JSONB := '[]';
BEGIN
  IF _attendance_locked(p_event_id) THEN PERFORM _fail('ASISTENCIA_CERRADA', 'La asistencia está cerrada. Reábrela para corregirla.'); END IF;
  IF p_status NOT IN ('pendiente','llego','llego_tarde','excusa','no_asistio','no_aplica') THEN PERFORM _fail('DATOS', 'Estado no válido.'); END IF;
  FOREACH pid IN ARRAY p_person_ids LOOP
    SELECT to_jsonb(x) INTO before FROM event_attendances x WHERE id = p_event_id || '__' || pid;
    INSERT INTO event_attendances AS x (id, event_id, person_id, status, source, checked_in_at, observation,
        excuse_reason, excuse_evidence_url, excuse_approved_by, excuse_approved_at, updated_by, updated_at)
    VALUES (p_event_id || '__' || pid, p_event_id, pid, p_status, 'manual',
        CASE WHEN p_status IN ('llego','llego_tarde') THEN now() END, nullif(p_observation, ''),
        CASE WHEN p_status = 'excusa' THEN nullif(p_excuse_reason, '') END,
        CASE WHEN p_status = 'excusa' THEN nullif(p_evidence_url, '') END,
        CASE WHEN p_status = 'excusa' THEN adm END, CASE WHEN p_status = 'excusa' THEN now() END, adm, now())
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        -- Se conserva la hora del QR si se corrige "llegó" ↔ "llegó tarde"
        checked_in_at = CASE WHEN EXCLUDED.status IN ('llego','llego_tarde') THEN coalesce(x.checked_in_at, now()) ELSE x.checked_in_at END,
        source = CASE WHEN x.source = 'qr' AND EXCLUDED.status IN ('llego','llego_tarde') THEN 'qr' ELSE 'manual' END,
        observation = coalesce(EXCLUDED.observation, x.observation),
        excuse_reason = EXCLUDED.excuse_reason, excuse_evidence_url = EXCLUDED.excuse_evidence_url,
        excuse_approved_by = EXCLUDED.excuse_approved_by, excuse_approved_at = EXCLUDED.excuse_approved_at,
        updated_by = adm, updated_at = now()
    RETURNING * INTO r;
    PERFORM _audit(adm, 'asistencia', 'event_attendances', r.id, before, to_jsonb(r));
    out := out || to_jsonb(r);
  END LOOP;
  RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_event_attendance(p_session TEXT, p_event_id TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM _require_admin(p_session);
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM event_attendances a WHERE event_id = p_event_id OR p_event_id IS NULL), '[]');
END;
$$;

CREATE OR REPLACE FUNCTION public.my_attendance(p_session TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _require_staff(p_session);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM event_attendances a WHERE person_id = s.person_id), '[]');
END;
$$;

-- Cálculo de un CONECTADOS (mismo cálculo que la app; se puede revisar antes de cerrar)
CREATE OR REPLACE FUNCTION public._conectados_results(p_event_id TEXT, p_scoring JSONB) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE e public.calendar_events; gts TEXT[] := ARRAY['Generales','Finanzas','GH','Mercadeo','RRPP','Logística','Seguridad','Carnival','The Games'];
  g TEXT; c_ok INT; c_late INT; c_exc INT; c_abs INT; c_pend INT; enabled INT; den NUMERIC; eff NUMERIC; pct NUMERIC; out JSONB := '[]';
  late_w NUMERIC := coalesce((p_scoring->>'lateWeight')::numeric, 1); mode TEXT := coalesce(p_scoring->>'excuseMode', 'excluir');
  maxp NUMERIC := coalesce((p_scoring->>'maxGtPoints')::numeric, 0);
BEGIN
  SELECT * INTO e FROM calendar_events WHERE id = p_event_id;
  IF NOT coalesce((e.audience->>'all')::boolean, false) AND jsonb_array_length(coalesce(e.audience->'gtTeams', '[]')) > 0 THEN
    SELECT array_agg(x) INTO gts FROM unnest(gts) x WHERE e.audience->'gtTeams' ? x;
  END IF;
  FOREACH g IN ARRAY coalesce(gts, '{}') LOOP
    SELECT count(*) FILTER (WHERE st = 'llego'), count(*) FILTER (WHERE st = 'llego_tarde'), count(*) FILTER (WHERE st = 'excusa'),
           count(*) FILTER (WHERE st = 'no_asistio'), count(*) FILTER (WHERE st = 'pendiente'), count(*) FILTER (WHERE st <> 'no_aplica')
      INTO c_ok, c_late, c_exc, c_abs, c_pend, enabled
      FROM (SELECT coalesce(a.status, 'pendiente') st FROM people p
              LEFT JOIN event_attendances a ON a.event_id = p_event_id AND a.person_id = p.id
             WHERE _person_primary_gt(p) = g) t;
    den := enabled;
    eff := c_ok + c_late * late_w;
    IF mode = 'excluir' THEN den := den - c_exc; ELSIF mode = 'asistencia' THEN eff := eff + c_exc; END IF;
    pct := CASE WHEN den > 0 THEN round(eff / den * 100, 2) ELSE 0 END;
    out := out || jsonb_build_object('gt', g, 'enabled', enabled, 'attended', c_ok, 'late', c_late, 'excused', c_exc,
       'absent', c_abs + c_pend, 'pending', c_pend, 'denominator', den, 'effectiveAttendance', round(eff, 2),
       'percentage', pct, 'points', round(maxp * pct / 100, 2));
  END LOOP;
  RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_preview_attendance(p_session TEXT, p_event_id TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE e public.calendar_events; sc JSONB;
BEGIN
  PERFORM _require_admin(p_session);
  SELECT * INTO e FROM calendar_events WHERE id = p_event_id;
  sc := coalesce(e.scoring, (SELECT default_conectados_scoring FROM league_settings WHERE id = 'default'),
                 '{"maxGtPoints":20,"individualPoints":{"asistio":5,"tarde":3,"excusa":0},"lateWeight":1,"excuseMode":"excluir"}');
  RETURN jsonb_build_object('scoring', sc, 'results', CASE WHEN e.type = 'conectados' THEN _conectados_results(p_event_id, sc) ELSE '[]' END);
END;
$$;

-- CERRAR ASISTENCIA: pendientes → no asistió, congela resultados y entrega DÍAS POINTS (CONECTADOS)
CREATE OR REPLACE FUNCTION public.admin_close_attendance(p_session TEXT, p_event_id TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); e public.calendar_events; sc JSONB; res JSONB := '[]'; r JSONB; c public.conectados_closures;
  rec RECORD; ip NUMERIC;
BEGIN
  SELECT * INTO e FROM calendar_events WHERE id = p_event_id;
  IF NOT FOUND THEN PERFORM _fail('NO_ENCONTRADO', 'Evento no encontrado.'); END IF;
  IF _attendance_locked(p_event_id) THEN PERFORM _fail('ASISTENCIA_CERRADA', 'La asistencia ya está cerrada.'); END IF;
  -- Los invitados sin registro quedan como NO ASISTIÓ (solo ahora, al cerrar)
  INSERT INTO event_attendances (id, event_id, person_id, status, source, updated_by, updated_at, observation)
  SELECT e.id || '__' || p2.id, e.id, p2.id, 'no_asistio', 'manual', adm, now(), 'Sin registro al cerrar la asistencia'
    FROM people p2 WHERE _in_audience(p2, e.audience)
  ON CONFLICT (id) DO NOTHING;
  UPDATE event_attendances SET status = 'no_asistio', updated_by = adm, updated_at = now(),
         observation = coalesce(observation, 'Pendiente al cerrar la asistencia')
   WHERE event_id = e.id AND status = 'pendiente';

  sc := coalesce(e.scoring, (SELECT default_conectados_scoring FROM league_settings WHERE id = 'default'),
                 '{"maxGtPoints":20,"individualPoints":{"asistio":5,"tarde":3,"excusa":0},"lateWeight":1,"excuseMode":"excluir"}');
  IF e.type = 'conectados' THEN
    res := _conectados_results(e.id, sc);
    FOR r IN SELECT * FROM jsonb_array_elements(res) LOOP
      IF (r->>'points')::numeric > 0 THEN
        INSERT INTO point_movements (id, activity_date, target, gt, points, category, source_type, source_id, activity_name, reason, registered_by)
        VALUES (_movement_id(), e.event_date, 'gt', r->>'gt', (r->>'points')::numeric, 'conectados', 'conectados', e.id, e.title,
                format('Asistencia %s%% (%s/%s) × %s pts máx.', r->>'percentage', r->>'effectiveAttendance', r->>'denominator', sc->>'maxGtPoints'), adm);
      END IF;
    END LOOP;
    FOR rec IN SELECT pp.id, _person_primary_gt(pp) AS gt, a.status FROM people pp
                 JOIN event_attendances a ON a.person_id = pp.id AND a.event_id = e.id
                WHERE _person_primary_gt(pp) IS NOT NULL LOOP
      ip := CASE rec.status WHEN 'llego' THEN (sc->'individualPoints'->>'asistio')::numeric
                            WHEN 'llego_tarde' THEN (sc->'individualPoints'->>'tarde')::numeric
                            WHEN 'excusa' THEN (sc->'individualPoints'->>'excusa')::numeric ELSE 0 END;
      IF coalesce(ip, 0) > 0 THEN
        INSERT INTO point_movements (id, activity_date, target, gt, person_id, points, category, source_type, source_id, activity_name, reason, registered_by)
        VALUES (_movement_id(), e.event_date, 'person', rec.gt, rec.id, ip, 'conectados', 'conectados', e.id, e.title,
                CASE rec.status WHEN 'llego' THEN 'Llegó' WHEN 'llego_tarde' THEN 'Llegó tarde' ELSE 'Excusa válida' END, adm);
      END IF;
    END LOOP;
  END IF;
  INSERT INTO conectados_closures (id, event_id, scoring, results, status, closed_at, closed_by, updated_at)
  VALUES (e.id, e.id, sc, res, 'cerrado', now(), adm, now())
  ON CONFLICT (id) DO UPDATE SET scoring = EXCLUDED.scoring, results = EXCLUDED.results, status = 'cerrado',
      closed_at = now(), closed_by = adm, updated_at = now()
  RETURNING * INTO c;
  UPDATE event_qr_codes SET enabled = false, updated_by = adm WHERE event_id = e.id;
  PERFORM _audit(adm, 'cerrar_asistencia', 'conectados_closures', e.id, NULL, to_jsonb(c));
  RETURN to_jsonb(c);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reopen_attendance(p_session TEXT, p_event_id TEXT, p_reason TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); c public.conectados_closures;
BEGIN
  IF coalesce(trim(p_reason), '') = '' THEN PERFORM _fail('DATOS', 'Escribe el motivo de la reapertura.'); END IF;
  UPDATE point_movements SET voided = true, voided_at = now(), voided_by = adm, void_reason = 'Reapertura de asistencia: ' || p_reason
   WHERE source_type = 'conectados' AND source_id = p_event_id AND NOT voided;
  UPDATE conectados_closures SET status = 'reabierto', reopened_at = now(), reopened_by = adm, reopen_reason = p_reason, updated_at = now()
   WHERE event_id = p_event_id RETURNING * INTO c;
  PERFORM _audit(adm, 'reabrir_asistencia', 'conectados_closures', p_event_id, NULL, to_jsonb(c), p_reason);
  RETURN to_jsonb(c);
END;
$$;

-- ==============================================================================
-- DÍAS POINTS: manuales, correcciones y anulaciones
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_add_points(p_session TEXT, p_target TEXT, p_gt TEXT, p_person_id TEXT, p_points NUMERIC,
  p_category TEXT, p_activity TEXT, p_reason TEXT, p_observation TEXT DEFAULT NULL, p_evidence TEXT DEFAULT NULL,
  p_date DATE DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); m public.point_movements; v_gt TEXT := p_gt; p public.people;
BEGIN
  IF coalesce(p_points, 0) = 0 THEN PERFORM _fail('DATOS', 'Los puntos deben ser distintos de cero.'); END IF;
  IF coalesce(trim(p_reason), '') = '' THEN PERFORM _fail('DATOS', 'El motivo es obligatorio.'); END IF;
  IF p_target = 'person' THEN
    SELECT * INTO p FROM people WHERE id = p_person_id;
    IF NOT FOUND THEN PERFORM _fail('NO_ENCONTRADO', 'Integrante no encontrado.'); END IF;
    v_gt := _person_primary_gt(p);
  ELSIF p_target <> 'gt' OR coalesce(p_gt, '') = '' THEN PERFORM _fail('DATOS', 'Elige el GT o la persona.');
  END IF;
  INSERT INTO point_movements (id, activity_date, target, gt, person_id, points, category, source_type, activity_name, reason, observation, evidence_url, registered_by)
  VALUES (_movement_id(), coalesce(p_date, (now() AT TIME ZONE 'America/Bogota')::date), p_target, v_gt,
          CASE WHEN p_target = 'person' THEN p_person_id END, round(p_points, 2),
          CASE WHEN p_category IN ('manual','correccion') THEN p_category ELSE 'manual' END, 'manual',
          coalesce(nullif(trim(p_activity), ''), 'Asignación manual'), trim(p_reason), nullif(p_observation, ''), nullif(p_evidence, ''), adm)
  RETURNING * INTO m;
  PERFORM _audit(adm, 'asignar_puntos', 'point_movements', m.id, NULL, to_jsonb(m), p_reason);
  RETURN to_jsonb(m);
END;
$$;

-- Corregir: anula el original y crea uno nuevo con valor anterior → nuevo
CREATE OR REPLACE FUNCTION public.admin_correct_points(p_session TEXT, p_movement_id TEXT, p_new_points NUMERIC, p_reason TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); o public.point_movements; n public.point_movements;
BEGIN
  IF coalesce(trim(p_reason), '') = '' THEN PERFORM _fail('DATOS', 'El motivo de la corrección es obligatorio.'); END IF;
  SELECT * INTO o FROM point_movements WHERE id = p_movement_id FOR UPDATE;
  IF NOT FOUND OR o.voided THEN PERFORM _fail('NO_ENCONTRADO', 'El movimiento no existe o ya fue anulado.'); END IF;
  UPDATE point_movements SET voided = true, voided_at = now(), voided_by = adm,
         void_reason = format('Corregido de %s a %s: %s', o.points, round(p_new_points, 2), p_reason)
   WHERE id = o.id;
  IF coalesce(p_new_points, 0) <> 0 THEN
    INSERT INTO point_movements (id, activity_date, target, gt, person_id, points, category, source_type, source_id, activity_name,
        reason, observation, evidence_url, corrects_id, previous_points, new_points, registered_by)
    VALUES (_movement_id(), o.activity_date, o.target, o.gt, o.person_id, round(p_new_points, 2), o.category, o.source_type, o.source_id,
        o.activity_name, p_reason, o.observation, o.evidence_url, o.id, o.points, round(p_new_points, 2), adm)
    RETURNING * INTO n;
  END IF;
  PERFORM _audit(adm, 'corregir_puntos', 'point_movements', o.id, to_jsonb(o), to_jsonb(n), p_reason);
  RETURN jsonb_build_object('original', o.id, 'nuevo', to_jsonb(n), 'valor_anterior', o.points, 'valor_nuevo', round(p_new_points, 2));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_void_points(p_session TEXT, p_movement_id TEXT, p_reason TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); o public.point_movements; n public.point_movements;
BEGIN
  IF coalesce(trim(p_reason), '') = '' THEN PERFORM _fail('DATOS', 'El motivo de la anulación es obligatorio.'); END IF;
  SELECT * INTO o FROM point_movements WHERE id = p_movement_id;
  IF NOT FOUND OR o.voided THEN PERFORM _fail('NO_ENCONTRADO', 'El movimiento no existe o ya fue anulado.'); END IF;
  UPDATE point_movements SET voided = true, voided_at = now(), voided_by = adm, void_reason = p_reason WHERE id = o.id RETURNING * INTO n;
  PERFORM _audit(adm, 'anular_puntos', 'point_movements', o.id, to_jsonb(o), to_jsonb(n), p_reason);
  RETURN to_jsonb(n);
END;
$$;

-- ==============================================================================
-- RETOS Y CONFIGURACIÓN
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_save_challenge(p_session TEXT, p_challenge JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); r public.league_challenges;
  v_id TEXT := coalesce(nullif(p_challenge->>'id', ''), 'reto_' || replace(gen_random_uuid()::text, '-', ''));
BEGIN
  IF coalesce(trim(p_challenge->>'name'), '') = '' THEN PERFORM _fail('DATOS', 'Escribe el nombre del reto.'); END IF;
  INSERT INTO league_challenges AS c (id, name, description, rules, start_date, end_date, gt_teams, placements, status, evidences)
  VALUES (v_id, trim(p_challenge->>'name'), nullif(p_challenge->>'description', ''), nullif(p_challenge->>'rules', ''),
          (p_challenge->>'startDate')::date, (p_challenge->>'endDate')::date,
          ARRAY(SELECT jsonb_array_elements_text(coalesce(p_challenge->'gtTeams', '[]'))),
          coalesce(p_challenge->'placements', '[]'), coalesce(nullif(p_challenge->>'status', ''), 'pendiente'),
          coalesce(p_challenge->'evidences', '[]'))
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, rules = EXCLUDED.rules,
     start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, gt_teams = EXCLUDED.gt_teams, placements = EXCLUDED.placements,
     status = EXCLUDED.status, evidences = EXCLUDED.evidences, updated_at = now()
  RETURNING * INTO r;
  PERFORM _audit(adm, 'guardar_reto', 'league_challenges', r.id, NULL, to_jsonb(r));
  RETURN to_jsonb(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_register_challenge_results(p_session TEXT, p_challenge_id TEXT, p_results JSONB,
  p_awards JSONB, p_date DATE) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); c public.league_challenges; x JSONB; p public.people;
BEGIN
  SELECT * INTO c FROM league_challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM _fail('NO_ENCONTRADO', 'Reto no encontrado.'); END IF;
  UPDATE point_movements SET voided = true, voided_at = now(), voided_by = adm, void_reason = 'Resultados del reto corregidos'
   WHERE source_type = 'reto' AND source_id = c.id AND NOT voided;
  FOR x IN SELECT * FROM jsonb_array_elements(coalesce(p_results, '[]')) LOOP
    IF coalesce((x->>'points')::numeric, 0) <> 0 THEN
      INSERT INTO point_movements (id, activity_date, target, gt, points, category, source_type, source_id, activity_name, reason, evidence_url, registered_by)
      VALUES (_movement_id(), p_date, 'gt', x->>'gt', (x->>'points')::numeric, 'reto', 'reto', c.id, c.name,
              CASE WHEN x->>'position' IS NOT NULL THEN 'Puesto ' || (x->>'position') ELSE 'Puntos del reto' END,
              c.evidences->0->>'url', adm);
    END IF;
  END LOOP;
  FOR x IN SELECT * FROM jsonb_array_elements(coalesce(p_awards, '[]')) LOOP
    SELECT * INTO p FROM people WHERE id = x->>'personId';
    IF FOUND AND coalesce((x->>'points')::numeric, 0) <> 0 THEN
      INSERT INTO point_movements (id, activity_date, target, gt, person_id, points, category, source_type, source_id, activity_name, reason, registered_by)
      VALUES (_movement_id(), p_date, 'person', _person_primary_gt(p), p.id, (x->>'points')::numeric, 'reto', 'reto', c.id, c.name,
              coalesce(nullif(x->>'reason', ''), 'Reconocimiento individual'), adm);
    END IF;
  END LOOP;
  UPDATE league_challenges SET results = coalesce(p_results, '[]'), individual_awards = coalesce(p_awards, '[]'), status = 'finalizado',
         results_registered_at = now(), results_registered_by = adm, updated_at = now()
   WHERE id = c.id RETURNING * INTO c;
  PERFORM _audit(adm, 'resultados_reto', 'league_challenges', c.id, NULL, to_jsonb(c));
  RETURN to_jsonb(c);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_league_settings(p_session TEXT, p_scoring JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); before JSONB; r public.league_settings;
BEGIN
  SELECT default_conectados_scoring INTO before FROM league_settings WHERE id = 'default';
  INSERT INTO league_settings (id, default_conectados_scoring, updated_at) VALUES ('default', p_scoring, now())
  ON CONFLICT (id) DO UPDATE SET default_conectados_scoring = EXCLUDED.default_conectados_scoring, updated_at = now()
  RETURNING * INTO r;
  PERFORM _audit(adm, 'configuracion_liga', 'league_settings', 'default', before, p_scoring);
  RETURN to_jsonb(r);
END;
$$;

-- ==============================================================================
-- DÍAS POINTS POR QR (actividades)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_save_point_activity(p_session TEXT, p_activity JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); r public.point_activities;
  v_id TEXT := coalesce(nullif(p_activity->>'id', ''), 'act_' || replace(gen_random_uuid()::text, '-', ''));
BEGIN
  IF coalesce(trim(p_activity->>'name'), '') = '' THEN PERFORM _fail('DATOS', 'Escribe el nombre de la actividad.'); END IF;
  IF coalesce((p_activity->>'individualPoints')::numeric, 0) = 0 AND coalesce((p_activity->>'gtPoints')::numeric, 0) = 0 THEN
    PERFORM _fail('DATOS', 'Define cuántos DÍAS POINTS entrega la actividad.');
  END IF;
  INSERT INTO point_activities AS a (id, name, description, challenge_id, individual_points, gt_points, eligibility, mechanism, status, activity_date, created_by)
  VALUES (v_id, trim(p_activity->>'name'), nullif(p_activity->>'description', ''), nullif(p_activity->>'challengeId', ''),
          coalesce((p_activity->>'individualPoints')::numeric, 0), coalesce((p_activity->>'gtPoints')::numeric, 0),
          coalesce(p_activity->'eligibility', '{"all": true}'), coalesce(nullif(p_activity->>'mechanism', ''), 'ambos'),
          coalesce(nullif(p_activity->>'status', ''), 'activa'), coalesce((p_activity->>'date')::date, (now() AT TIME ZONE 'America/Bogota')::date), adm)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, challenge_id = EXCLUDED.challenge_id,
     individual_points = EXCLUDED.individual_points, gt_points = EXCLUDED.gt_points, eligibility = EXCLUDED.eligibility,
     mechanism = EXCLUDED.mechanism, status = EXCLUDED.status, activity_date = EXCLUDED.activity_date, updated_at = now()
  RETURNING * INTO r;
  INSERT INTO point_activity_qr (activity_id, token) VALUES (r.id, _new_token()) ON CONFLICT (activity_id) DO NOTHING;
  PERFORM _audit(adm, 'guardar_actividad_puntos', 'point_activities', r.id, NULL, to_jsonb(r));
  RETURN to_jsonb(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_activity_qr(p_session TEXT, p_activity_id TEXT, p_action TEXT DEFAULT 'ver') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE adm TEXT := _require_admin(p_session); q public.point_activity_qr;
BEGIN
  INSERT INTO point_activity_qr (activity_id, token) VALUES (p_activity_id, _new_token()) ON CONFLICT (activity_id) DO NOTHING;
  IF p_action IN ('habilitar', 'cerrar', 'renovar') THEN
    UPDATE point_activity_qr SET enabled = (p_action <> 'cerrar'),
           token = CASE WHEN p_action = 'renovar' THEN _new_token() ELSE token END,
           renewed_at = CASE WHEN p_action = 'renovar' THEN now() ELSE renewed_at END
     WHERE activity_id = p_activity_id;
    PERFORM _audit(adm, p_action || '_qr_actividad', 'point_activity_qr', p_activity_id, NULL, NULL);
  END IF;
  SELECT * INTO q FROM point_activity_qr WHERE activity_id = p_activity_id;
  RETURN jsonb_build_object('activity_id', q.activity_id, 'token', q.token, 'enabled', q.enabled);
END;
$$;

CREATE OR REPLACE FUNCTION public._claim_activity(a public.point_activities, p public.people, p_source TEXT, p_by TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id TEXT := a.id || '__' || p.id; v_gt TEXT := _person_primary_gt(p); pts JSONB := '[]';
BEGIN
  IF a.status <> 'activa' THEN PERFORM _fail('ACTIVIDAD_CERRADA', 'Esta actividad ya no entrega DÍAS POINTS.'); END IF;
  IF NOT _in_audience(p, a.eligibility) THEN PERFORM _fail('NO_ELEGIBLE', p.name || ' no cumple las condiciones de esta actividad.'); END IF;
  IF EXISTS (SELECT 1 FROM point_activity_claims WHERE id = v_id) THEN
    RETURN jsonb_build_object('result', 'ya_registrada', 'activity', a.name, 'person', p.name);
  END IF;
  INSERT INTO point_activity_claims (id, activity_id, person_id, source, registered_by) VALUES (v_id, a.id, p.id, p_source, p_by);
  IF a.individual_points <> 0 THEN
    INSERT INTO point_movements (id, activity_date, target, gt, person_id, points, category, source_type, source_id, activity_name, reason, registered_by)
    VALUES (_movement_id(), a.activity_date, 'person', v_gt, p.id, a.individual_points, 'actividad', 'actividad', a.id, a.name, 'Participación (QR)', p_by);
    pts := pts || jsonb_build_object('target', 'person', 'points', a.individual_points);
  END IF;
  IF a.gt_points <> 0 AND v_gt IS NOT NULL THEN
    INSERT INTO point_movements (id, activity_date, target, gt, person_id, points, category, source_type, source_id, activity_name, reason, registered_by)
    VALUES (_movement_id(), a.activity_date, 'gt', v_gt, p.id, a.gt_points, 'actividad', 'actividad', a.id, a.name, 'Participación de ' || p.name || ' (QR)', p_by);
    pts := pts || jsonb_build_object('target', 'gt', 'gt', v_gt, 'points', a.gt_points);
  END IF;
  RETURN jsonb_build_object('result', 'registrada', 'activity', a.name, 'person', p.name, 'points', pts);
END;
$$;

-- El integrante escanea el QR de la actividad
CREATE OR REPLACE FUNCTION public.claim_activity_qr(p_session TEXT, p_token TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _require_staff(p_session); q public.point_activity_qr; a public.point_activities; p public.people; r JSONB;
BEGIN
  SELECT * INTO q FROM point_activity_qr WHERE token = p_token;
  IF NOT FOUND THEN PERFORM _log_scan('actividad', NULL, s, s.person_id, 'qr_invalido');
    PERFORM _fail('QR_INVALIDO', 'Este código QR no es válido o fue renovado.'); END IF;
  SELECT * INTO a FROM point_activities WHERE id = q.activity_id;
  IF NOT q.enabled OR a.mechanism = 'qr_personal' THEN PERFORM _log_scan('actividad', a.id, s, s.person_id, 'qr_cerrado');
    PERFORM _fail('QR_CERRADO', 'Este QR no está habilitado para registrar participación.'); END IF;
  SELECT * INTO p FROM people WHERE id = s.person_id;
  r := _claim_activity(a, p, 'qr_actividad', s.display_name);
  PERFORM _log_scan('actividad', a.id, s, p.id, r->>'result');
  RETURN r;
END;
$$;

-- El administrador escanea el QR personal del integrante (o lo registra a mano)
CREATE OR REPLACE FUNCTION public.admin_award_activity(p_session TEXT, p_activity_id TEXT, p_person_qr TEXT DEFAULT NULL, p_person_id TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _session(p_session); a public.point_activities; p public.people; v_pid TEXT := p_person_id; r JSONB;
BEGIN
  PERFORM _require_admin(p_session);
  SELECT * INTO a FROM point_activities WHERE id = p_activity_id;
  IF NOT FOUND THEN PERFORM _fail('NO_ENCONTRADO', 'Actividad no encontrada.'); END IF;
  IF p_person_qr IS NOT NULL THEN
    IF a.mechanism = 'qr_actividad' THEN PERFORM _fail('DATOS', 'Esta actividad solo registra con el QR de la actividad.'); END IF;
    SELECT person_id INTO v_pid FROM person_profiles WHERE qr_token = p_person_qr;
    IF v_pid IS NULL THEN PERFORM _log_scan('persona', a.id, s, NULL, 'qr_invalido');
      PERFORM _fail('QR_INVALIDO', 'Este código QR no corresponde a ningún integrante.'); END IF;
  END IF;
  SELECT * INTO p FROM people WHERE id = v_pid;
  IF NOT FOUND THEN PERFORM _fail('NO_ENCONTRADO', 'Integrante no encontrado.'); END IF;
  r := _claim_activity(a, p, CASE WHEN p_person_qr IS NOT NULL THEN 'qr_personal' ELSE 'manual' END, s.display_name);
  PERFORM _log_scan('persona', a.id, s, p.id, r->>'result');
  RETURN r;
END;
$$;

-- ==============================================================================
-- RECORDATORIOS, PUSH Y AUDITORÍA
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.save_my_reminder(p_session TEXT, p_event_id TEXT, p_enabled BOOLEAN, p_offsets INTEGER[]) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _require_staff(p_session); r public.calendar_reminders;
BEGIN
  INSERT INTO calendar_reminders (id, event_id, person_id, enabled, offsets, updated_at)
  VALUES (p_event_id || '__' || s.person_id, p_event_id, s.person_id, p_enabled,
          ARRAY(SELECT DISTINCT o FROM unnest(coalesce(p_offsets, '{}')) o WHERE o IN (1440, 60, 15) ORDER BY o DESC), now())
  ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, offsets = EXCLUDED.offsets, updated_at = now()
  RETURNING * INTO r;
  RETURN to_jsonb(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.my_reminders(p_session TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _require_staff(p_session);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM calendar_reminders r WHERE person_id = s.person_id), '[]');
END;
$$;

CREATE OR REPLACE FUNCTION public.save_my_push_subscription(p_session TEXT, p_id TEXT, p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_user_agent TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.app_sessions := _require_staff(p_session);
BEGIN
  INSERT INTO push_subscriptions (id, person_id, endpoint, p256dh, auth, user_agent, updated_at)
  VALUES (p_id, s.person_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 250), now())
  ON CONFLICT (id) DO UPDATE SET person_id = EXCLUDED.person_id, endpoint = EXCLUDED.endpoint, p256dh = EXCLUDED.p256dh,
     auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent, updated_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_audit(p_session TEXT, p_entity_id TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 200) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM _require_admin(p_session);
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.at DESC) FROM
           (SELECT * FROM admin_audit_log WHERE p_entity_id IS NULL OR entity_id = p_entity_id ORDER BY at DESC LIMIT p_limit) l), '[]');
END;
$$;

-- Funciones internas: no invocables desde la API pública
REVOKE EXECUTE ON FUNCTION public._new_token(), public._hash(TEXT), public._session(TEXT), public._require_admin(TEXT),
  public._require_staff(TEXT), public._ensure_profile(TEXT), public._conectados_results(TEXT, JSONB), public._check_rate(TEXT),
  public._claim_activity(public.point_activities, public.people, TEXT, TEXT), public._movement_id(),
  public._audit(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT),
  public._log_scan(TEXT, TEXT, public.app_sessions, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- Tiempo real (el ranking y el calendario se actualizan solos)
-- ------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['calendar_events','calendar_event_types','conectados_closures','league_challenges',
                           'point_movements','point_activities','point_activity_claims']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- Recordatorios con la app cerrada: ejecutar la función cada 5 minutos.
-- Requiere pg_cron y pg_net (Database → Extensions) y la función send-reminders.
-- ------------------------------------------------------------------------------
-- SELECT cron.schedule('dias-send-reminders', '*/5 * * * *', $$ SELECT net.http_post(
--   url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--   body := '{}'::jsonb); $$);
