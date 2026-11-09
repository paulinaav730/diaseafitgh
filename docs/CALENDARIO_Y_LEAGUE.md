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
- El QR de asistencia **no tiene horario**: se muestra al final del evento y
  registra mientras esté abierto, hasta que la administración toca **Cerrar QR**.
  Escanear cuenta como LLEGÓ; LLEGÓ TARDE se marca a mano si hace falta.
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

## Ranking equitativo de la DÍAS LEAGUE

El ranking de los nueve GT (Generales, Finanzas, GH, Mercadeo, RRPP, Logística,
Seguridad, Carnival, The Games) da un puntaje sobre 100 que no premia al GT con
más integrantes:

| Dimensión | Peso | Cómo se calcula |
| --- | --- | --- |
| Promedio de DÍAS POINTS por integrante | 50 % | DÍAS POINTS del GT ÷ todos sus integrantes (también los que tienen 0) |
| Participación ajustada | 50 % | Promedio, entre las actividades que cuentan, del % de integrantes del GT que participó en cada una |

Cada dimensión se lleva a 0–100 tomando como 100 el mejor de los nueve GT.
Puntaje final = 50 % × escala del promedio + 50 % × escala de la participación.

- **Integrantes:** las personas del directorio cuyo GT principal es ese GT (MESA no cuenta).
- **Puntos:** los no anulados. Por defecto entran los de cada integrante + los entregados al
  GT completo; en Configuración se puede dejar solo los individuales.
- **Participación:** cuentan los eventos con la **asistencia cerrada** de los tipos elegidos
  (por defecto Conectados, Expectadías, Decoración, Reto, Capacitación y Otras) y las
  actividades de DÍAS POINTS por QR ya terminadas (cerradas o de días anteriores). En cada
  una, el % del GT = participantes ÷ invitados habilitados del GT (las excusas y llegadas
  tarde siguen la regla del evento). Un GT sin invitados en una actividad no se penaliza por ella.
- **Configuración:** DÍAS League → Configuración → *Qué cuenta para el ranking* (tipos,
  actividades QR, base de puntos y exclusión de actividades puntuales).
- **Servidor:** `league_ranking()` calcula el ranking con los datos de Supabase; la app lo
  muestra y se actualiza sola. `src/services/leagueRanking.ts` tiene la misma lógica (modo
  local y pruebas: `tests/ranking.test.ts` y la comparación en `tests/supabase.rpc.test.mjs`).
- **Historial:** `league_ranking_history` guarda un registro por día, que se actualiza solo
  cada vez que cambian puntos, asistencias, actividades, la configuración o el directorio.
  La administración puede guardar *cortes* con nombre (por ejemplo, "Cierre semestre 1").

## Recordatorios con la app cerrada (opcional)

1. `npx web-push generate-vapid-keys`
2. En Vercel: variable `VITE_VAPID_PUBLIC_KEY` = clave pública, y volver a desplegar.
3. `supabase functions deploy send-reminders --no-verify-jwt` y
   `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:dias@eafit.edu.co`
4. Activar **pg_cron** y **pg_net** y ejecutar el `cron.schedule(...)` que está
   comentado al final de `supabase/calendar_league.sql`.

Sin esto, los recordatorios funcionan mientras la app esté abierta. En iPhone
las notificaciones web requieren agregar DÍAS a la pantalla de inicio.

## Cumpleaños de los integrantes

- **Dónde se guarda:** la fecha de nacimiento va en el Perfil DÍAS del integrante
  existente (`person_profiles.birth_date`), no en `people` ni como evento. Es
  privada: la clave pública no puede leerla y solo una sesión de administración
  la consulta (`admin_list_birthdays`) o la cambia (`admin_set_birth_date`, con
  auditoría). El integrante no ve su fecha ni su edad.
- **Cómo se registra:** lo normal es ponerla en el **Excel del directorio de
  personal** (Personas → *Importar Excel*) en una columna *Fecha de nacimiento*
  (también sirve *Cumpleaños*): al importar a las personas se guardan sus
  fechas, sin cargar otro archivo. Una fecha que no se entiende solo avisa y no
  bloquea a la persona. También se puede cargar aparte desde Calendario → *🎂 Cargar cumpleaños*
  (descargar la plantilla con todos los integrantes, llenar *Fecha de
  nacimiento* y subirla; también sirve cualquier Excel/CSV con cédula o nombre
  y fecha). Cada fila se une al integrante existente; no se crean personas.
  También se puede editar una por una en Perfil DÍAS → *Fecha de nacimiento*.
  Sin fecha registrada no se muestra ningún cumpleaños.
- **Todo el año:** arriba del calendario, el bloque *Cumpleaños* tiene dos
  pestañas: *Próximos 30 días* y *Todo el año* (los próximos 12 meses, mes por
  mes, con el día, la edad que cumple y el GT).
- **Calendario:** la administración ve `🎂 CUMPLEAÑOS — Nombre` con color propio,
  la edad que cumple y el GT; al tocarlo abre el cumpleaños y el Perfil DÍAS.
  No se crean eventos: se calculan cada año a partir de la fecha, así que se
  repiten solos y la edad se actualiza sola. Quien nació el 29 de febrero lo
  celebra el 28 en años no bisiestos.
- **Recordatorios:** 7 días antes, 1 día antes y el mismo día, a las 12:00 p. m.
  de Colombia (America/Bogota). Los envía `send-reminders` a todas las cuentas
  de administración que tocaron *Activar notificaciones* en el Calendario
  (tabla privada `admin_push_subscriptions`). Usa la misma configuración de la
  sección anterior (VAPID + función + cron cada 5 minutos). Con la app abierta
  también se muestran en el navegador, sin duplicarse.
- **Para activarlo:** volver a ejecutar `supabase/calendar_league.sql` (no borra
  datos) y volver a desplegar la función: `supabase functions deploy send-reminders --no-verify-jwt`.

## Pruebas

- `npm test`: cálculo de asistencia y ranking, alimentación y cumpleaños.
- `SUPABASE_TEST_URL=<url de una base de PRUEBA> npx tsx tests/supabase.rpc.test.mjs`:
  seguridad y funciones de la base de datos con la clave pública. No ejecutar
  contra producción: crea datos.
