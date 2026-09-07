-- Activar RLS en todas las tablas clave
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_requirements ENABLE ROW LEVEL SECURITY;

-- 1. POLÍTICAS PARA ADMINISTRADORES (Basado en el rol "admin" guardado en Supabase Auth o un acceso general si es app de red cerrada)
-- Nota: Si usas Supabase Auth, reemplaza `true` con `auth.uid() IN (SELECT user_id FROM admins)` o verifica el rol en el JWT.
-- Asumiremos que los administradores autenticados tienen acceso total:

-- PEOPLE
CREATE POLICY "Admins pueden ver personas" ON public.people FOR SELECT USING (true);
CREATE POLICY "Admins pueden insertar personas" ON public.people FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins pueden actualizar personas" ON public.people FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Admins pueden eliminar personas" ON public.people FOR DELETE USING (true);

-- ASSIGNMENTS
CREATE POLICY "Admins pueden ver asignaciones" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "Admins pueden insertar asignaciones" ON public.assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins pueden actualizar asignaciones" ON public.assignments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Admins pueden eliminar asignaciones" ON public.assignments FOR DELETE USING (true);

-- AVAILABILITIES
CREATE POLICY "Admins pueden ver disponibilidades" ON public.availabilities FOR SELECT USING (true);
CREATE POLICY "Admins pueden insertar disponibilidades" ON public.availabilities FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins pueden actualizar disponibilidades" ON public.availabilities FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Admins pueden eliminar disponibilidades" ON public.availabilities FOR DELETE USING (true);

-- EVENTS, SHIFTS, BASES, REQUIREMENTS (CRUD Total)
CREATE POLICY "Acceso total a eventos" ON public.events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total a turnos" ON public.shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total a bases" ON public.bases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total a cupos" ON public.shift_requirements FOR ALL USING (true) WITH CHECK (true);

-- 2. POLÍTICAS PARA EL STAFF (Personas normales)
-- Si la aplicación tiene vista para el staff, ellos solo pueden ver sus propios datos.
-- Esto asume que el `auth.uid()` se mapea con el ID o email de la persona.

-- Ejemplo (Comentado para que lo adaptes a tu sistema de autenticación si es necesario):
/*
CREATE POLICY "Staff puede ver su propio perfil" ON public.people 
FOR SELECT USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Staff puede ver sus propias asignaciones" ON public.assignments 
FOR SELECT USING (person_id IN (SELECT id FROM public.people WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Staff puede ver su propia disponibilidad" ON public.availabilities 
FOR SELECT USING (person_id IN (SELECT id FROM public.people WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Staff puede actualizar su disponibilidad" ON public.availabilities 
FOR UPDATE USING (person_id IN (SELECT id FROM public.people WHERE email = auth.jwt() ->> 'email'));
*/
