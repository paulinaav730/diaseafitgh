-- ==============================================================================
-- DÍAS EAFIT 2027 — CALENDARIO + DÍAS LEAGUE (DÍAS POINTS)
-- Ejecutar en Supabase → SQL Editor (después de schema.sql).
-- Sigue las mismas políticas abiertas (anon) que el resto de tablas de la app.
-- ==============================================================================

-- 1. Eventos del calendario
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TEXT NOT NULL,           -- 'HH:mm' hora de Colombia
    end_time TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,     -- inicio absoluto (lo usa la función de recordatorios)
    location TEXT,
    type TEXT NOT NULL CHECK (type IN ('conectados','reunion_gt','reunion_general','reto','capacitacion','institucional','otro')),
    audience JSONB NOT NULL DEFAULT '{"all": true, "gtTeams": [], "includeGap": false, "includeMesa": false, "personIds": []}',
    status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','cancelado')),
    scoring JSONB,                      -- reglas de puntos (solo CONECTADOS)
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events (event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_starts ON public.calendar_events (starts_at);

-- 2. Preferencias de recordatorio por persona y evento
CREATE TABLE IF NOT EXISTS public.calendar_reminders (
    id TEXT PRIMARY KEY,                -- '<event_id>__<person_id>'
    event_id TEXT NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    offsets INTEGER[] NOT NULL DEFAULT '{}',   -- minutos antes: 1440, 60, 15
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_person ON public.calendar_reminders (person_id);

-- 3. Suscripciones push del navegador (una por dispositivo)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id TEXT PRIMARY KEY,                -- hash del endpoint
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_person ON public.push_subscriptions (person_id);

-- 4. Registro de recordatorios ya enviados (evita duplicados)
CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
    id TEXT PRIMARY KEY,                -- '<event_id>__<person_id>__<offset>'
    sent_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Asistencia a eventos (CONECTADOS)
CREATE TABLE IF NOT EXISTS public.event_attendances (
    id TEXT PRIMARY KEY,                -- '<event_id>__<person_id>'
    event_id TEXT NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('asistio','tarde','excusa','ausente','no_aplica')),
    excuse_reason TEXT,
    registered_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_attendances_event ON public.event_attendances (event_id);

-- 6. Cierre de CONECTADOS: resultados congelados por GT (denominador histórico)
CREATE TABLE IF NOT EXISTS public.conectados_closures (
    id TEXT PRIMARY KEY,                -- = event_id
    event_id TEXT NOT NULL REFERENCES public.calendar_events(id) ON DELETE RESTRICT,
    scoring JSONB NOT NULL,
    results JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('cerrado','reabierto')),
    closed_at TIMESTAMPTZ NOT NULL,
    closed_by TEXT NOT NULL,
    reopened_at TIMESTAMPTZ,
    reopened_by TEXT,
    reopen_reason TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. Retos entre GT
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

-- 8. Libro de DÍAS POINTS (nunca se borra: se anula con trazabilidad)
CREATE TABLE IF NOT EXISTS public.point_movements (
    id TEXT PRIMARY KEY,
    activity_date DATE NOT NULL,
    target TEXT NOT NULL CHECK (target IN ('gt','person')),
    gt TEXT,
    person_id TEXT REFERENCES public.people(id) ON DELETE SET NULL,
    points NUMERIC(10,2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('reto','conectados','manual','correccion')),
    source_type TEXT,
    source_id TEXT,
    activity_name TEXT NOT NULL,
    reason TEXT,
    evidence_url TEXT,
    registered_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    voided BOOLEAN NOT NULL DEFAULT false,
    voided_at TIMESTAMPTZ,
    voided_by TEXT,
    void_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_point_movements_gt ON public.point_movements (gt);
CREATE INDEX IF NOT EXISTS idx_point_movements_person ON public.point_movements (person_id);
CREATE INDEX IF NOT EXISTS idx_point_movements_source ON public.point_movements (source_type, source_id);

-- Impide borrar movimientos: solo se pueden anular (UPDATE voided = true)
CREATE OR REPLACE FUNCTION public.prevent_point_movement_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los movimientos de DÍAS POINTS no se borran: anúlelos dejando el motivo.';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_point_movements_no_delete ON public.point_movements;
CREATE TRIGGER trg_point_movements_no_delete BEFORE DELETE ON public.point_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_point_movement_delete();

-- 9. Configuración de la liga (valores por defecto de CONECTADOS)
CREATE TABLE IF NOT EXISTS public.league_settings (
    id TEXT PRIMARY KEY,
    default_conectados_scoring JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- RLS: mismo esquema abierto que el resto de la app
-- ------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['calendar_events','calendar_reminders','push_subscriptions','event_attendances',
                           'conectados_closures','league_challenges','point_movements','league_settings']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados y anon" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
-- reminder_deliveries solo la usa la función del servidor (service role): sin políticas para anon.
ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;

-- Tiempo real para que el ranking y el calendario se actualicen solos
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_attendances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conectados_closures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.point_movements;

-- ------------------------------------------------------------------------------
-- Recordatorios con la app cerrada: ejecutar la función cada 5 minutos.
-- Requiere las extensiones pg_cron y pg_net (Database → Extensions) y haber
-- desplegado la función send-reminders. Reemplace <PROJECT_REF> y <SERVICE_ROLE_KEY>.
-- ------------------------------------------------------------------------------
-- SELECT cron.schedule(
--   'dias-send-reminders',
--   '*/5 * * * *',
--   $$ SELECT net.http_post(
--        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
--        headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--        body := '{}'::jsonb
--      ); $$
-- );
