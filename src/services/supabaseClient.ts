import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variable retrieval compatible with both Vite (VITE_) and Next.js (NEXT_PUBLIC_)
const getEnvVar = (viteKey: string, nextKey: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const val = (import.meta as any).env[viteKey];
    if (val) return val;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[nextKey] || process.env[viteKey] || '';
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

let supabaseInstance: SupabaseClient | null = null;

/**
 * Checks if Supabase credentials have been configured in environment variables.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    !supabaseUrl.includes('placeholder')
  );
};

/**
 * Gets or initializes the Supabase client safely with lazy initialization.
 */
export const getSupabase = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (err) {
      console.warn('Could not initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
};

/**
 * Database table names in PostgreSQL (Supabase)
 */
export const SUPABASE_TABLES = {
  PEOPLE: 'people',
  EVENTS: 'events',
  SHIFTS: 'shifts',
  BASES: 'bases',
  AVAILABILITIES: 'availabilities',
  ASSIGNMENTS: 'assignments',
  ATTENDANCES: 'attendances',
  FUNCTIONS: 'group_functions',
  REQUIREMENTS: 'shift_requirements',
} as const;
