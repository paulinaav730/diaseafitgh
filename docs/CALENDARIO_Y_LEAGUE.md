# Calendario, DÍAS League, Perfil DÍAS y QR — guía de instalación

## Orden de instalación (importante)

Con Supabase configurado, el **inicio de sesión** y todas las acciones de
Calendario, DÍAS League, Perfil DÍAS y QR los valida el servidor. Por eso:

1. **Primero** ejecutar `supabase/calendar_league.sql` en Supabase → SQL Editor.
2. **Después** desplegar la nueva versión de la app en Vercel.

Si se despliega la app antes de ejecutar el SQL, nadie podrá iniciar sesión
hasta que se ejecute. Al abrir la app nueva, quien tenga una sesión guardada de
la versión anterior tendrá que volver a ingresar una vez.

El administrador sigue entrando con `DIAS2026` / `2580DIAS`. La contraseña ya
no está escrita en la app: se guarda cifrada en la tabla `admin_users`. Para
cambiarla:

```sql
UPDATE admin_users SET password_hash = crypt('NUEVA_CLAVE', gen_salt('bf')) WHERE username = 'DIAS2026';
```

## Modelo de seguridad

- El navegador solo tiene la clave pública (anon). Ninguna tabla nueva acepta
  escrituras directas: todo pasa por funciones que verifican la sesión
  (`login_admin` / `login_staff` emiten un token; las sesiones de staff duran
  30 días y las de admin 12 horas).
- **QR**: los códigos personales, de eventos y de actividades son tokens
  aleatorios de 192 bits. No contienen cédula ni datos personales y se guardan
  en tablas que la clave pública no puede leer. Se pueden renovar.
- Asistencias, excusas, recordatorios, escaneos y auditoría solo se leen con
  sesión. Un integrante solo ve sus propios registros.
- Los movimientos de DÍAS POINTS no se borran (lo impide un trigger): se anulan
  o se corrigen dejando valor anterior, valor nuevo, motivo y responsable.
- Cada cambio administrativo queda en `admin_audit_log`; cada escaneo, en
  `qr_scans`.

> Pendiente fuera de este módulo: las tablas que ya existían (`people`,
> `assignments`, `attendances`, etc.) siguen aceptando lectura y escritura con
> la clave pública, como antes. Conviene protegerlas en una siguiente etapa.

## Cómo funcionan los QR

| QR | Quién lo muestra | Quién lo escanea | Qué pasa |
|---|---|---|---|
| **Personal** (en Mi DÍAS, debajo del logo) | El integrante | La administración | Abre la identificación del integrante: registrar su llegada a un evento en curso, su participación en una actividad o asignarle DÍAS POINTS. Si lo escanea otro integrante, solo ve nombre y GT. |
| **De asistencia** (uno por evento) | La administración (Proyectar) | Cada integrante, con su sesión | Registra su propia asistencia con la hora exacta: LLEGÓ o LLEGÓ TARDE según la tolerancia. Un segundo escaneo avisa que ya estaba registrada. |
| **De actividad** | La administración | Cada integrante, con su sesión | Entrega los DÍAS POINTS de la actividad una sola vez por persona. |

Se puede escanear con la cámara normal del celular (abre el enlace) o con el
botón **Escanear QR** dentro de la app. Si la persona no ha iniciado sesión,
el código se guarda y se procesa apenas ingrese.

## Asistencia

- Mientras el evento está abierto, quien no ha escaneado aparece **PENDIENTE**.
- El QR funciona desde los minutos configurados antes del inicio hasta el final
  del evento. Después de la tolerancia, el registro queda como LLEGÓ TARDE.
- **Cerrar asistencia** muestra el cálculo para revisarlo. Al confirmar, los
  pendientes pasan a NO ASISTIÓ, se congelan los resultados y (en CONECTADOS)
  se entregan los DÍAS POINTS. Para corregir: **Reabrir** (anula los puntos con
  el motivo) y volver a cerrar.

```
% asistencia GT = asistencia efectiva ÷ integrantes habilitados × 100
DÍAS POINTS GT  = puntos máximos × % ÷ 100
```

Excusa válida: por defecto no penaliza (sale del total); se puede configurar
para que cuente como asistencia o como ausencia. Llegada tarde: completa, media
o nada.

## Recordatorios con la app cerrada (opcional)

1. `npx web-push generate-vapid-keys`
2. En Vercel: variable `VITE_VAPID_PUBLIC_KEY` = clave pública, y volver a desplegar.
3. `supabase functions deploy send-reminders --no-verify-jwt` y
   `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:dias@eafit.edu.co`
4. Activar **pg_cron** y **pg_net** y ejecutar el `cron.schedule(...)` que está
   comentado al final de `supabase/calendar_league.sql`.

Sin esto, los recordatorios funcionan mientras la app esté abierta. En iPhone
las notificaciones web requieren agregar DÍAS a la pantalla de inicio.

## Pruebas

- `npm test`: cálculo de asistencia y ranking.
- `SUPABASE_TEST_URL=<url de una base de PRUEBA> node tests/supabase.rpc.test.mjs`:
  seguridad y funciones de la base de datos con la clave pública. No ejecutar
  contra producción: crea datos.
