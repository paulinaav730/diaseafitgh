# GUÍA DE ARQUITECTURA, SUPABASE (POSTGRESQL), NEXT.JS Y DESPLIEGUE EN VERCEL CON GITHUB

Esta aplicación ha sido estructurada para soportar **Next.js / TypeScript**, **PostgreSQL con Supabase** y despliegue continuo en **Vercel mediante GitHub**.

---

## 1. BASE DE DATOS: PostgreSQL con Supabase

Hemos generado el esquema oficial de base de datos relacional para Supabase en el archivo:
📁 `supabase/schema.sql`

### Pasos de Configuración en Supabase:
1. Crea una cuenta o ingresa a [Supabase](https://supabase.com).
2. Crea un nuevo proyecto (ej. `dias-eafit-2026`).
3. Ve a la sección **SQL Editor** en el menú lateral izquierdo.
4. Abre o copia el contenido de `supabase/schema.sql` y haz clic en **Run**.
   - Esto creará automáticamente las tablas: `people`, `app_events`, `shifts`, `bases`, `group_functions`, `availabilities`, `assignments`, `attendances` y `shift_requirements`.
   - Establece llaves primarias, llaves foráneas (`REFERENCES ... ON DELETE CASCADE`), índices optimizados y políticas de seguridad (Row Level Security - RLS).
5. Ve a **Project Settings -> API** y copia:
   - **Project URL** (ej: `https://xyzproject.supabase.co`)
   - **anon / public key** (clave pública para el cliente)
6. Configura estas variables en tu entorno o en `.env`:
   ```env
   VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
   VITE_SUPABASE_ANON_KEY="tu-clave-anon-publica"
   ```

El cliente Supabase (`src/services/supabaseClient.ts`) y el motor de sincronización (`src/services/supabaseSync.ts`) ya están integrados en el código.

---

## 2. FRAMEWORK: Next.js, TypeScript y JavaScript

El código está escrito en **TypeScript estricto con React 19**, siguiendo componentes funcionales, modularidad y hooks estándar compatibles al 100% con Next.js:

- **Estructura Modular**: Todos los componentes están en `/src/components/`, la lógica en `/src/services/` y los tipos en `/src/types.ts`.
- **Configuración Next.js lista**: Hemos incluido `next.config.mjs` en la raíz del proyecto.
- **En Next.js App Router**:
  Si deseas usar Next.js App Router (`app/page.tsx`), solo necesitas montar `'use client';` en la parte superior de tu página principal o componentes interactivos:
  ```tsx
  // app/page.tsx
  'use client';
  import App from '../src/App';

  export default function Page() {
    return <App />;
  }
  ```
- **Variables de entorno para Next.js**:
  El cliente de Supabase detecta automáticamente tanto `VITE_SUPABASE_*` como `NEXT_PUBLIC_SUPABASE_*`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-clave-anon-publica"
  ```

---

## 3. DESPLIEGUE CONTINUO: Vercel con GitHub

El repositorio cuenta con `vercel.json` configurado en la raíz para garantizar despliegues automáticos con cero fricción:

### Pasos para desplegar en Vercel vía GitHub:
1. **Exportar a GitHub**:
   - En el menú superior de Google AI Studio, haz clic en el menú desplegable de configuración y selecciona **Export to GitHub** (o clona el repositorio localmente y haz `git push origin main`).
2. **Conectar en Vercel**:
   - Entra a [Vercel](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
   - Haz clic en **Add New... -> Project**.
   - Selecciona el repositorio de GitHub exportado.
3. **Variables de Entorno en Vercel**:
   - En la pantalla de configuración de Vercel, expande la sección **Environment Variables**.
   - Agrega:
     - `VITE_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Hacer Clic en Deploy**:
   - Vercel detectará la configuración (`vercel.json` o `next.config.mjs`), compilará la aplicación y te entregará una URL de producción inmediata con certificado SSL y CDN global.
   - A partir de ese momento, cualquier cambio que envíes a la rama `main` en GitHub desplegará automáticamente la nueva versión en Vercel.
