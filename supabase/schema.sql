-- ==============================================================================
-- DÍAS EAFIT 2026 — SUPABASE POSTGRESQL SCHEMA
-- Sistema de Asignación y Operaciones para Eventos
-- ==============================================================================

-- Habilitar extensión pgcrypto para UUIDs si es necesario
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: PEOPLE (Personal del evento: GT, GAP, MESA)
CREATE TABLE IF NOT EXISTS public.people (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    full_name TEXT,
    document_id TEXT NOT NULL,
    username TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    institutional_email TEXT,
    epik_id TEXT,
    external_excel_id TEXT,
    start_time_excel TEXT,
    end_time_excel TEXT,
    primary_type TEXT NOT NULL CHECK (primary_type IN ('GT', 'GAP', 'MESA')),
    gt_teams TEXT[] DEFAULT '{}',
    gt_sub_team TEXT,
    functions TEXT[] DEFAULT '{}',
    role_title TEXT DEFAULT 'Staff',
    shirt_size TEXT DEFAULT 'M',
    dietary_restrictions TEXT DEFAULT 'Ninguna',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de búsqueda para personas
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_document_id ON public.people (document_id);
CREATE INDEX IF NOT EXISTS idx_people_email ON public.people (email);
CREATE INDEX IF NOT EXISTS idx_people_institutional_email ON public.people (institutional_email);
CREATE INDEX IF NOT EXISTS idx_people_epik_id ON public.people (epik_id);
CREATE INDEX IF NOT EXISTS idx_people_primary_type ON public.people (primary_type);

-- 2. TABLA: APP_EVENTS (Eventos de la semana: The Show, The Zone, Carnival, The Challenge, The Games)
CREATE TABLE IF NOT EXISTS public.app_events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    day_id TEXT NOT NULL,
    day_name TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    is_carnival BOOLEAN DEFAULT false,
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA: SHIFTS (Turnos configurables del sistema)
CREATE TABLE IF NOT EXISTS public.shifts (
    id TEXT PRIMARY KEY,
    event_id TEXT REFERENCES public.app_events(id) ON DELETE CASCADE,
    day_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('GT', 'GAP', 'MESA')),
    gt_sub_team TEXT,
    start_time TEXT NOT NULL, -- Formato '06:00' (24h)
    end_time TEXT NOT NULL,   -- Formato '08:00' (24h)
    label TEXT NOT NULL,      -- Formato '6:00 AM – 8:00 AM'
    capacity INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    has_bases BOOLEAN DEFAULT false,
    base_ids TEXT[] DEFAULT '{}',
    specific_functions TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shifts_day_id ON public.shifts (day_id);
CREATE INDEX IF NOT EXISTS idx_shifts_event_id ON public.shifts (event_id);

-- 4. TABLA: BASES (Bases físicas y estaciones)
CREATE TABLE IF NOT EXISTS public.bases (
    id TEXT PRIMARY KEY,
    event_id TEXT REFERENCES public.app_events(id) ON DELETE CASCADE,
    day_id TEXT NOT NULL,
    name TEXT NOT NULL,
    base_number TEXT,
    physical_location TEXT,
    category TEXT,
    description TEXT,
    color TEXT DEFAULT '#B83A24',
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bases_day_id ON public.bases (day_id);

-- 5. TABLA: GROUP_FUNCTIONS (Catálogo de funciones operativas)
CREATE TABLE IF NOT EXISTS public.group_functions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('GT', 'GAP', 'MESA')),
    gt_sub_team TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLA: AVAILABILITIES (Disponibilidad reportada por el personal o importada por Excel Maestro)
CREATE TABLE IF NOT EXISTS public.availabilities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    day_id TEXT NOT NULL,
    shift_ids TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_person_day_avail UNIQUE (person_id, day_id)
);

CREATE INDEX IF NOT EXISTS idx_availabilities_person ON public.availabilities (person_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_day ON public.availabilities (day_id);

-- 7. TABLA: ASSIGNMENTS (Asignaciones oficiales generadas por coordinadores)
CREATE TABLE IF NOT EXISTS public.assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    day_id TEXT NOT NULL,
    shift_id TEXT NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    base_id TEXT,
    function_id TEXT,
    station TEXT,
    notes TEXT,
    assigned_by TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_person_shift_assignment UNIQUE (person_id, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_person ON public.assignments (person_id);
CREATE INDEX IF NOT EXISTS idx_assignments_day ON public.assignments (day_id);
CREATE INDEX IF NOT EXISTS idx_assignments_shift ON public.assignments (shift_id);
CREATE INDEX IF NOT EXISTS idx_assignments_base ON public.assignments (base_id);

-- 8. TABLA: ATTENDANCES (Control de asistencia y puntualidad)
CREATE TABLE IF NOT EXISTS public.attendances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    day_id TEXT NOT NULL,
    shift_id TEXT NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'asistio', 'tarde', 'inasistencia', 'retiro_antes')),
    check_in_time TIMESTAMPTZ,
    notes TEXT,
    registered_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_person_shift_attendance UNIQUE (person_id, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_attendances_person ON public.attendances (person_id);
CREATE INDEX IF NOT EXISTS idx_attendances_day ON public.attendances (day_id);

-- 9. TABLA: SHIFT_REQUIREMENTS (Requerimientos de cupos por turno/base)
CREATE TABLE IF NOT EXISTS public.shift_requirements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    day_id TEXT NOT NULL,
    shift_id TEXT NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    group_type TEXT NOT NULL CHECK (group_type IN ('GT', 'GAP', 'MESA')),
    gt_sub_team TEXT,
    base_number TEXT,
    capacity INTEGER NOT NULL DEFAULT 1,
    specific_functions TEXT[] DEFAULT '{}',
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_requirements ENABLE ROW LEVEL SECURITY;

-- Permite lectura y escritura a clientes con clave anon y autenticados
CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.people FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.app_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.bases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.group_functions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.availabilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.attendances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a usuarios autenticados y anon" ON public.shift_requirements FOR ALL USING (true) WITH CHECK (true);

-- Habilitar replicación en tiempo real en Supabase para las tablas principales
ALTER PUBLICATION supabase_realtime ADD TABLE public.people;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.availabilities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendances;
