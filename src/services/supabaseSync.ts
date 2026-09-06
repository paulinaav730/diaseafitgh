import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { Person, Assignment, AvailabilityRecord, AttendanceRecord } from '../types';

export interface SupabaseSyncStatus {
  isConfigured: boolean;
  isConnected: boolean;
  lastSyncedAt?: string;
  errorMessage?: string;
}

/**
 * Tests connection to the Supabase PostgreSQL database
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Supabase no está configurado en las variables de entorno (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).',
    };
  }

  const client = getSupabase();
  if (!client) {
    return { success: false, message: 'No se pudo inicializar el cliente de Supabase.' };
  }

  try {
    const { error } = await client.from('people').select('id').limit(1);
    if (error) {
      // If table doesn't exist yet, it's a specific message
      if (error.code === '42P01') {
        return {
          success: false,
          message: 'Conexión exitosa, pero las tablas aún no han sido creadas. Ejecuta el archivo supabase/schema.sql en el SQL Editor de Supabase.',
        };
      }
      return { success: false, message: `Error de Supabase: ${error.message}` };
    }
    return { success: true, message: '¡Conexión con PostgreSQL en Supabase establecida exitosamente!' };
  } catch (err: any) {
    return { success: false, message: `Fallo de conexión: ${err?.message || 'Error desconocido'}` };
  }
}

/**
 * Converts camelCase Person to snake_case for PostgreSQL
 */
export function personToPostgres(p: Person) {
  return {
    id: p.id,
    name: p.name,
    full_name: p.fullName || p.name,
    document_id: p.documentId,
    username: p.username || null,
    email: p.email,
    phone: p.phone || null,
    institutional_email: p.institutionalEmail || null,
    epik_id: p.epikId || null,
    external_excel_id: p.externalExcelId || null,
    start_time_excel: p.startTimeExcel || null,
    end_time_excel: p.endTimeExcel || null,
    primary_type: p.primaryType,
    gt_teams: p.gtTeams || [],
    gt_sub_team: p.gtSubTeam || null,
    functions: p.functions || [],
    role_title: p.roleTitle || 'Staff',
    shirt_size: p.shirtSize || 'M',
    dietary_restrictions: p.dietaryRestrictions || 'Ninguna',
    notes: p.notes || '',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Converts snake_case PostgreSQL record to camelCase Person
 */
export function postgresToPerson(r: any): Person {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name || r.name,
    documentId: r.document_id,
    username: r.username || undefined,
    email: r.email,
    phone: r.phone || undefined,
    institutionalEmail: r.institutional_email || undefined,
    epikId: r.epik_id || undefined,
    externalExcelId: r.external_excel_id || undefined,
    startTimeExcel: r.start_time_excel || undefined,
    endTimeExcel: r.end_time_excel || undefined,
    primaryType: r.primary_type,
    gtTeams: r.gt_teams || [],
    gtSubTeam: r.gt_sub_team || undefined,
    functions: r.functions || [],
    roleTitle: r.role_title || 'Staff',
    shirtSize: r.shirt_size || 'M',
    dietaryRestrictions: r.dietary_restrictions || 'Ninguna',
    notes: r.notes || '',
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || undefined,
  };
}

/**
 * Synchronizes local people with Supabase PostgreSQL
 */
export async function pushPeopleToSupabase(people: Person[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || people.length === 0) return false;

  try {
    const payload = people.map(personToPostgres);
    const { error } = await client.from('people').upsert(payload, { onConflict: 'document_id' });
    if (error) {
      console.warn('Error syncing people to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception syncing people to Supabase:', err);
    return false;
  }
}

/**
 * Pulls all people from Supabase PostgreSQL
 */
export async function pullPeopleFromSupabase(): Promise<Person[] | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.from('people').select('*');
    if (error || !data) {
      console.warn('Error pulling people from Supabase:', error);
      return null;
    }
    return data.map(postgresToPerson);
  } catch (err) {
    console.warn('Exception pulling people from Supabase:', err);
    return null;
  }
}

/**
 * Synchronizes assignments to Supabase PostgreSQL
 */
export async function pushAssignmentsToSupabase(assignments: Assignment[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || assignments.length === 0) return false;

  try {
    const payload = assignments.map((a) => ({
      id: a.id,
      person_id: a.personId,
      day_id: a.dayId,
      shift_id: a.shiftId,
      base_id: a.baseNumber !== undefined ? String(a.baseNumber) : null,
      function_id: a.assignedFunction || null,
      notes: a.notes || null,
      updated_at: a.updatedAt || new Date().toISOString(),
    }));

    const { error } = await client.from('assignments').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Error syncing assignments to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception syncing assignments to Supabase:', err);
    return false;
  }
}

/**
 * Synchronizes availabilities to Supabase PostgreSQL
 */
export async function pushAvailabilitiesToSupabase(availabilities: AvailabilityRecord[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || availabilities.length === 0) return false;

  try {
    const payload = availabilities.map((av) => ({
      id: av.id,
      person_id: av.personId,
      day_id: av.dayId,
      shift_ids: av.shiftIds || [],
      updated_at: av.updatedAt || new Date().toISOString(),
    }));

    const { error } = await client.from('availabilities').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Error syncing availabilities to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception syncing availabilities to Supabase:', err);
    return false;
  }
}
