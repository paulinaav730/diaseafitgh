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
          message: 'ConexiÃƒÂ³n exitosa, pero las tablas aÃƒÂºn no han sido creadas. Ejecuta el archivo supabase/schema.sql en el SQL Editor de Supabase.',
        };
      }
      return { success: false, message: `Error de Supabase: ${error.message}` };
    }
    return { success: true, message: 'Ã‚Â¡ConexiÃƒÂ³n con PostgreSQL en Supabase establecida exitosamente!' };
  } catch (err: any) {
    return { success: false, message: `Fallo de conexiÃƒÂ³n: ${err?.message || 'Error desconocido'}` };
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
    notes: p.alsoActsAsGap
      ? `${p.notes || ''} [DUAL_GAP${p.gapRoleDescription ? ':' + p.gapRoleDescription : ''}]`.trim()
      : p.notes || '',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Converts snake_case PostgreSQL record to camelCase Person
 */
export function postgresToPerson(r: any): Person {
  const hasDualGapInNotes = typeof r.notes === 'string' && r.notes.includes('[DUAL_GAP');
  const extractedGapDesc =
    typeof r.notes === 'string' ? r.notes.match(/\[DUAL_GAP:([^\]]+)\]/)?.[1] : undefined;
  const cleanNotes =
    typeof r.notes === 'string' ? r.notes.replace(/\[DUAL_GAP[^\]]*\]/g, '').trim() : '';

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
    alsoActsAsGap: r.also_acts_as_gap ?? (hasDualGapInNotes || false),
    gapRoleDescription: r.gap_role_description || extractedGapDesc || undefined,
    gtTeams: r.gt_teams || [],
    gtSubTeam: r.gt_sub_team || undefined,
    functions: r.functions || [],
    roleTitle: r.role_title || 'Staff',
    shirtSize: r.shirt_size || 'M',
    dietaryRestrictions: r.dietary_restrictions || 'Ninguna',
    notes: cleanNotes,
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
      assigned_type: a.assignedType || 'GAP',
      gt_sub_team: a.gtSubTeam || null,
      base_id: a.baseNumber !== undefined ? String(a.baseNumber) : null,
      base_name: a.baseName || null,
      function_id: a.assignedFunction || null,
      role_in_base: a.roleInBase || null,
      requirement_id: a.requirementId || null,
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
export async function pushBasesToSupabase(bases: any[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || bases.length === 0) return false;
  try {
    const payload = bases.map((b) => ({
      id: b.id,
      event_id: b.eventId || null,
      day_id: b.dayId || '',
      name: b.name,
      base_number: b.baseNumber || null,
      category: b.category || null,
      color: b.color || '#B83A24',
      order_index: b.orderIndex || 0,
      is_active: b.isActive !== false,
      capacity: b.capacity || 2,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client.from('bases').upsert(payload, { onConflict: 'id' });
    if (error) { console.warn('Error pushing bases:', error); return false; }
    return true;
  } catch (err) {
    console.warn('Exception pushing bases:', err);
    return false;
  }
}

export async function pullBasesFromSupabase(): Promise<any[] | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.from('bases').select('*');
    if (error || !data) return null;
    return data.map((r: any) => ({
      id: r.id,
      eventId: r.event_id || undefined,
      dayId: r.day_id || '',
      name: r.name,
      baseNumber: r.base_number || undefined,
      category: r.category || undefined,
      color: r.color || '#B83A24',
      orderIndex: r.order_index || 0,
      isActive: r.is_active !== false,
      capacity: r.capacity || 2,
    }));
  } catch (err) {
    console.warn('Exception pulling bases:', err);
    return null;
  }
}

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

/**
 * Pulls all assignments from Supabase PostgreSQL
 */
export async function pullAssignmentsFromSupabase(): Promise<Assignment[] | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.from('assignments').select('*');
    if (error || !data) {
      console.warn('Error pulling assignments from Supabase:', error);
      return null;
    }
    return data.map((r: any) => ({
      id: r.id,
      personId: r.person_id,
      dayId: r.day_id,
      shiftId: r.shift_id,
      assignedType: r.assigned_type || 'GAP',
      gtSubTeam: r.gt_sub_team || undefined,
      baseNumber: r.base_id !== null && r.base_id !== undefined ? (isNaN(Number(r.base_id)) ? r.base_id : Number(r.base_id)) : undefined,
      baseName: r.base_name || undefined,
      assignedFunction: r.function_id || undefined,
      roleInBase: r.role_in_base || undefined,
      requirementId: r.requirement_id || undefined,
      notes: r.notes || undefined,
      updatedAt: r.updated_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Exception pulling assignments from Supabase:', err);
    return null;
  }
}

/**
 * Pulls all availabilities from Supabase PostgreSQL
 */
export async function pullAvailabilitiesFromSupabase(): Promise<AvailabilityRecord[] | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.from('availabilities').select('*');
    if (error || !data) {
      console.warn('Error pulling availabilities from Supabase:', error);
      return null;
    }
    return data.map((r: any) => ({
      id: r.id,
      personId: r.person_id,
      dayId: r.day_id,
      shiftIds: Array.isArray(r.shift_ids) ? r.shift_ids : [],
      updatedAt: r.updated_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Exception pulling availabilities from Supabase:', err);
    return null;
  }
}

/**
 * Downloads all data from Supabase into storage
 */
export async function syncAllFromSupabase(): Promise<{ success: boolean; message: string; count?: number }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase no está configurado.' };
  }
  try {
    const people = await pullPeopleFromSupabase();
    if (people && people.length > 0) {
      const { replaceAllPeopleFromCloud } = await import('./storageService');
      replaceAllPeopleFromCloud(people);
    }

    const assignments = await pullAssignmentsFromSupabase();
    if (assignments && assignments.length > 0) {
      const { replaceAllAssignmentsFromCloud } = await import('./storageService');
      replaceAllAssignmentsFromCloud(assignments);
    }

    const availabilities = await pullAvailabilitiesFromSupabase();
    const bases = await pullBasesFromSupabase();
    if (bases && bases.length > 0) {
      const { replaceAllBasesFromCloud } = await import('./storageService');
      replaceAllBasesFromCloud(bases);
    }
    if (availabilities && availabilities.length > 0) {
      const { replaceAllAvailabilitiesFromCloud } = await import('./storageService');
      replaceAllAvailabilitiesFromCloud(availabilities);
    }

    return {
      success: true,
      message: `SincronizaciÃƒÂ³n completada: ${people?.length || 0} personas, ${assignments?.length || 0} turnos.`,
      count: people?.length || 0,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al sincronizar con Supabase' };
  }
}

/**
 * Uploads all local data to Supabase
 */
export async function syncAllToSupabase(
  people: Person[],
  assignments: Assignment[],
  availabilities: AvailabilityRecord[]
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase no está configurado en las variables de entorno.' };
  }
  try {
    const pOk = await pushPeopleToSupabase(people);
    const aOk = await pushAssignmentsToSupabase(assignments);
    const avOk = await pushAvailabilitiesToSupabase(availabilities);
    const { getBases } = await import('./storageService');
    await pushBasesToSupabase(getBases());

    if (!pOk && people.length > 0) {
      return { success: false, message: 'Fallo al sincronizar personas en Supabase.' };
    }

    return {
      success: true,
      message: `Ã‚Â¡Base de datos sincronizada en la nube! ${people.length} personas, ${assignments.length} turnos.`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al subir a Supabase' };
  }
}



// ---------------- ATOMIC CRUD DIRECTLY TO SUPABASE ----------------

export async function insertSingleAssignmentToSupabase(a: Assignment): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { success: false, error: 'No Supabase client' };
  
  try {
    const payload = {
      id: a.id,
      person_id: a.personId,
      day_id: a.dayId,
      shift_id: a.shiftId,
      assigned_type: a.assignedType || 'GAP',
      gt_sub_team: a.gtSubTeam || null,
      base_id: a.baseNumber !== undefined ? String(a.baseNumber) : null,
      base_name: a.baseName || null,
      function_id: a.assignedFunction || null,
      role_in_base: a.roleInBase || null,
      requirement_id: a.requirementId || null,
      notes: a.notes || null,
      updated_at: a.updatedAt || new Date().toISOString(),
    };
    const { error } = await client.from('assignments').insert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function deleteSingleAssignmentFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { success: false, error: 'No Supabase client' };
  
  try {
    const { error } = await client.from('assignments').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

// REALTIME SUBSCRIPTIONS
let realtimeChannel: any = null;

export function setupRealtimeSubscriptions(
  onAssignmentChange: () => void
) {
  const client = getSupabase();
  if (!client) return;
  
  if (realtimeChannel) return; // already subscribed

  realtimeChannel = client
    .channel('public:assignments_and_bases')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, (payload) => {
      console.log('Realtime change received on assignments!', payload);
      onAssignmentChange();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bases' }, (payload) => {
      console.log('Realtime change received on bases!', payload);
      onAssignmentChange();
    })
    .subscribe((status: string) => {
      console.log('Supabase Realtime status:', status);
    });
}

