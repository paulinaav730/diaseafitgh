# Calendario DÍAS y DÍAS League — guía de configuración

Estos módulos funcionan de inmediato en el navegador (igual que el resto de la app).
Para que los datos se compartan entre todos los dispositivos y para enviar
recordatorios con la app cerrada hay que hacer estos pasos una sola vez.

## 1. Crear las tablas en Supabase

En Supabase → **SQL Editor**, ejecutar `supabase/calendar_league.sql`.

Crea: `calendar_events`, `calendar_reminders`, `push_subscriptions`,
`reminder_deliveries`, `event_attendances`, `conectados_closures`,
`league_challenges`, `point_movements` y `league_settings`.

`point_movements` tiene un trigger que **impide borrar** movimientos: solo se
pueden anular (queda quién, cuándo y por qué).

## 2. Notificaciones push (recordatorios con la app cerrada)

1. Generar las claves VAPID (una sola vez):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. En Vercel → Settings → Environment Variables agregar
   `VITE_VAPID_PUBLIC_KEY` = la clave **pública**, y volver a desplegar.
3. Desplegar la función que envía los avisos:
   ```bash
   supabase functions deploy send-reminders --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:dias@eafit.edu.co
   ```
4. En Supabase → Database → Extensions activar **pg_cron** y **pg_net**, y
   ejecutar el bloque `cron.schedule(...)` que está comentado al final de
   `supabase/calendar_league.sql` (reemplazando `<PROJECT_REF>` y
   `<SERVICE_ROLE_KEY>`). Corre cada 5 minutos.

Sin estos pasos los recordatorios igual funcionan **mientras la app esté
abierta** en el dispositivo. Si la persona no da permiso de notificaciones, ve
los eventos en el calendario pero no recibe avisos.

> En iPhone, las notificaciones web solo funcionan si la persona agrega DÍAS a
> la pantalla de inicio (Compartir → “Agregar a inicio”) — iOS 16.4 o superior.

## 3. Cómo se calculan los DÍAS POINTS de un Conectados

```
% asistencia GT = asistencia efectiva ÷ integrantes habilitados × 100
DÍAS POINTS GT  = puntos máximos × % ÷ 100
```

- **Integrantes habilitados:** personas activas cuyo GT principal es ese GT.
  Quien se marque como “No habilitado” sale del cálculo.
- **Llegada tarde:** cuenta completa, media o nada (configurable).
- **Excusa válida:** no penaliza (sale del total), cuenta como asistencia o
  como ausencia (configurable).
- **Sin marcar:** cuenta como “No asistió”.
- Al **cerrar** la asistencia se congelan los totales y las reglas: si después
  cambia el tamaño del GT, el histórico no cambia. Para corregir se **reabre**
  (los puntos anteriores se anulan con el motivo) y se vuelve a cerrar.

Pruebas del cálculo: `npm test`.
