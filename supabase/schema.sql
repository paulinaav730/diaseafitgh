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

-- ==============================================================================
-- SEMILLA DE DATOS INICIALES (5 EVENTOS Y 21 TURNOS OFICIALES)
-- ==============================================================================

-- 1. Insertar Eventos Oficiales de la Semana
INSERT INTO public.app_events (id, name, day_id, day_name, description, notes, is_active, is_carnival, order_num) VALUES
('the-show', 'THE SHOW', 'lunes', 'Lunes', 'Apertura y gran inauguración de Días EAFIT. Coordinación y soporte con equipo GRUPO DE TRABAJO (GT).', '5 turnos programados para GRUPO DE TRABAJO (GT).', true, false, 1),
('the-zone', 'THE ZONE', 'martes', 'Martes', 'Zona de interacción, actividades interactivas en campus con equipo GRUPO DE TRABAJO (GT).', '4 turnos programados para GRUPO DE TRABAJO (GT).', true, false, 2),
('carnival', 'CARNIVAL', 'miercoles', 'Miércoles', 'Día de actividades simultáneas. Estructura diferenciada: GRUPO DE TRABAJO (GT) con 5 turnos y GRUPO DE APOYO (GAP) con 3 turnos en 30 bases físicas únicas.', 'CARNIVAL GT: 5 turnos. CARNIVAL GAP: 3 turnos con 30 bases físicas.', true, true, 3),
('the-challenge', 'THE CHALLENGE & THE GAMES', 'jueves', 'Jueves', 'Mañana: The Challenge (GRUPO DE TRABAJO). Tarde: The Games con 15 bases físicas GRUPO DE APOYO (GAP).', 'Turno T1: The Challenge (GT). Turno T2: The Games con 15 bases físicas GAP.', true, false, 4),
('the-games', 'THE GAMES', 'viernes', 'Viernes', 'Gran final de competencias. Equipo GRUPO DE TRABAJO (GT) todo el día y 15 bases físicas GRUPO DE APOYO (GAP).', 'GAP opera en 15 bases físicas. GT da soporte de 6:00 AM a 9:30 PM.', true, false, 5)
ON CONFLICT (id) DO NOTHING;

-- 2. Insertar Turnos Oficiales de la Semana (21 Turnos)
INSERT INTO public.shifts (id, event_id, day_id, name, category, gt_sub_team, start_time, end_time, label, capacity, is_active, has_bases) VALUES
-- Lunes: THE SHOW (GT)
('lunes-t1', 'the-show', 'lunes', 'T1', 'GT', NULL, '06:00', '08:00', '6:00 AM – 8:00 AM', 10, true, false),
('lunes-t2', 'the-show', 'lunes', 'T2', 'GT', NULL, '08:00', '12:30', '8:00 AM – 12:30 PM', 12, true, false),
('lunes-t3', 'the-show', 'lunes', 'T3', 'GT', NULL, '12:30', '16:00', '12:30 PM – 4:00 PM', 12, true, false),
('lunes-t4', 'the-show', 'lunes', 'T4', 'GT', NULL, '16:00', '19:30', '4:00 PM – 7:30 PM', 12, true, false),
('lunes-t5', 'the-show', 'lunes', 'T5', 'GT', NULL, '19:30', '22:30', '7:30 PM – 10:30 PM', 10, true, false),

-- Martes: THE ZONE (GT)
('martes-t1', 'the-zone', 'martes', 'T1', 'GT', NULL, '08:00', '11:00', '8:00 AM – 11:00 AM', 12, true, false),
('martes-t2', 'the-zone', 'martes', 'T2', 'GT', NULL, '11:00', '15:00', '11:00 AM – 3:00 PM', 15, true, false),
('martes-t3', 'the-zone', 'martes', 'T3', 'GT', NULL, '15:00', '18:00', '3:00 PM – 6:00 PM', 15, true, false),
('martes-t4', 'the-zone', 'martes', 'T4', 'GT', NULL, '18:00', '19:30', '6:00 PM – 7:30 PM', 12, true, false),

-- Miércoles: CARNIVAL GT (5 Turnos)
('miercoles-gt-t1', 'carnival', 'miercoles', 'T1', 'GT', NULL, '06:50', '09:00', '6:50 AM – 9:00 AM', 15, true, false),
('miercoles-gt-t2', 'carnival', 'miercoles', 'T2', 'GT', NULL, '08:50', '12:10', '8:50 AM – 12:10 PM', 15, true, false),
('miercoles-gt-t3', 'carnival', 'miercoles', 'T3', 'GT', NULL, '12:00', '15:10', '12:00 PM – 3:10 PM', 15, true, false),
('miercoles-gt-t4', 'carnival', 'miercoles', 'T4', 'GT', NULL, '15:00', '18:10', '3:00 PM – 6:10 PM', 15, true, false),
('miercoles-gt-t5', 'carnival', 'miercoles', 'T5', 'GT', NULL, '18:00', '21:00', '6:00 PM – 9:00 PM', 15, true, false),

-- Miércoles: CARNIVAL GAP (3 Turnos x 30 Bases = 60 cupos c/u)
('miercoles-gap-t1', 'carnival', 'miercoles', 'T1', 'GAP', NULL, '08:50', '12:10', '8:50 AM – 12:10 PM', 60, true, true),
('miercoles-gap-t2', 'carnival', 'miercoles', 'T2', 'GAP', NULL, '12:00', '15:10', '12:00 PM – 3:10 PM', 60, true, true),
('miercoles-gap-t3', 'carnival', 'miercoles', 'T3', 'GAP', NULL, '15:00', '18:10', '3:00 PM – 6:10 PM', 60, true, true),

-- Jueves: THE CHALLENGE & THE GAMES
('jueves-t1', 'the-challenge', 'jueves', 'T1 - The Challenge', 'GT', NULL, '06:00', '12:00', '6:00 AM – 12:00 PM (The Challenge)', 15, true, false),
('jueves-t2', 'the-challenge', 'jueves', 'T2 - The Games', 'GAP', NULL, '13:00', '21:00', '1:00 PM – 9:00 PM (The Games)', 30, true, true),

-- Viernes: THE GAMES
('viernes-gt', 'the-games', 'viernes', 'GT General', 'GT', NULL, '06:00', '21:30', 'GT: 6:00 AM – 9:30 PM', 25, true, false),
('viernes-gap', 'the-games', 'viernes', 'GAP Bases', 'GAP', NULL, '07:00', '21:00', 'GAP: 7:00 AM – 9:00 PM (15 bases)', 30, true, true)
ON CONFLICT (id) DO NOTHING;
