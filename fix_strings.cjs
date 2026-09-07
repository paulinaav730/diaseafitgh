const fs = require('fs');
let c = fs.readFileSync('src/services/storageService.ts', 'utf8');

c = c.replace(/alertMessage: \\REGLA DE CONTINUIDAD[^,]*,/, 'alertMessage: REGLA DE CONTINUIDAD EN CARNIVAL: Esta persona ya está asignada a  en otro turno de Carnival. En Carnival debe permanecer en la MISMA base física en todos sus turnos (aplica para Base 1..27, Base Toro, Base Speedway y Base Arcade). Asignación rechazada.,');
c = c.replace(/alertMessage: \\ALERTA DE CUPO[^,]*,/, 'alertMessage: ALERTA DE CUPO:  no tiene cupo suficiente en este turno (Capacidad máxima de  alcanzada). Por favor libere un cupo o seleccione otra base.,');
c = c.replace(/alertMessage: \\Error de Supabase: \\\\ \\/, 'alertMessage: Error de Supabase: ');
c = c.replace(/alert\(\\Error eliminando en Supabase: \\\\\);/, 'alert(Error eliminando en Supabase: );');

fs.writeFileSync('src/services/storageService.ts', c);
