import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { Person, Assignment, AvailabilityRecord, AttendanceRecord, ConfigurableShift } from '../types';
import { getBaseDisplayName } from '../data/eventStructure';

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

  const rawPrimaryType = r.primary_type;
  const gtSubTeam = r.gt_sub_team || undefined;
  const gtTeams = Array.isArray(r.gt_teams) ? r.gt_teams : [];
  // If a person has a GT subteam and is not MESA, they belong to GT
  const resolvedPrimaryType =
    rawPrimaryType === 'MESA'
      ? 'MESA'
      : (gtSubTeam || gtTeams.length > 0)
      ? 'GT'
      : rawPrimaryType || 'GT';

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
    primaryType: resolvedPrimaryType,
    alsoActsAsGap: r.also_acts_as_gap ?? (hasDualGapInNotes || false),
    gapRoleDescription: r.gap_role_description || extractedGapDesc || undefined,
    gtTeams: gtTeams,
    gtSubTeam: gtSubTeam,
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
    const payload = assignments.map((a) => {
      const validBaseId =
        a.baseId && a.baseId !== 'null' && a.baseId !== 'undefined' && a.baseId.trim() !== ''
          ? a.baseId.trim()
          : a.baseNumber !== undefined && a.baseNumber !== null && String(a.baseNumber) !== 'null' && String(a.baseNumber) !== 'undefined' && String(a.baseNumber).trim() !== ''
          ? String(a.baseNumber).trim()
          : null;

      const validBaseName = validBaseId ? (a.baseName || getBaseDisplayName(validBaseId) || null) : null;

      return {
        id: a.id,
        person_id: a.personId,
        day_id: a.dayId,
        shift_id: a.shiftId,
        assigned_type: a.assignedType || 'GT',
        gt_sub_team: a.gtSubTeam || null,
        base_id: validBaseId,
        base_name: validBaseName,
        function_id: a.assignedFunction || null,
        role_in_base: a.roleInBase || null,
        requirement_id: a.requirementId || null,
        notes: a.notes || null,
        updated_at: a.updatedAt || new Date().toISOString(),
      };
    });

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
      day_id: b.dayId || 'miercoles',
      name: b.name,
      base_number: isNaN(Number(b.baseNumber)) ? null : Number(b.baseNumber),
      category: b.category || null,
      color: b.color || '#B83A24',
      order_index: b.orderIndex || 0,
      is_active: b.isActive !== false,
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
      baseNumber: r.base_number !== null && r.base_number !== undefined ? String(r.base_number) : (r.id ? String(r.id).replace(/^[a-z_]+_/, '') : undefined),
      category: r.category || undefined,
      color: r.color || '#B83A24',
      orderIndex: r.order_index || 0,
      isActive: r.is_active !== false,
      capacity: 2,
      defaultCapacity: 2,
      isSpecial: r.name?.toLowerCase().includes('toro') || r.name?.toLowerCase().includes('speedway') || r.name?.toLowerCase().includes('arcade'),
    }));
  } catch (err) {
    console.warn('Exception pulling bases:', err);
    return null;
  }
}

/**
 * Converts a ConfigurableShift to PostgreSQL shifts table row
 */
export function shiftToPostgres(s: ConfigurableShift) {
  const validCategory = (['GT', 'GAP', 'MESA'].includes(s.category) ? s.category : 'MESA');
  const validEventId = s.eventId || (
    s.dayId === 'martes' ? 'the-zone' :
    s.dayId === 'miercoles' ? 'carnival' :
    s.dayId === 'jueves' ? 'the-challenge' :
    s.dayId === 'viernes' ? 'the-games' : 'the-show'
  );

  return {
    id: s.id,
    event_id: validEventId,
    day_id: s.dayId,
    name: s.name,
    category: validCategory,
    gt_sub_team: s.gtSubTeam || (s.gtSubTeams && s.gtSubTeams[0]) || null,
    start_time: s.startTime || '08:00',
    end_time: s.endTime || '12:00',
    label: s.label || `${s.startTime} - ${s.endTime}`,
    capacity: Number(s.capacity) || 10,
    is_active: s.isActive !== false,
    has_bases: Boolean(s.hasBases),
    base_ids: s.baseIds || [],
    specific_functions: s.specificFunctions || [],
    notes: s.notes || null,
    updated_at: new Date().toISOString(),
  };
}

export function postgresToShift(r: any): ConfigurableShift {
  return {
    id: r.id,
    eventId: r.event_id || undefined,
    dayId: r.day_id,
    name: r.name,
    category: r.category,
    gtSubTeam: r.gt_sub_team || undefined,
    gtSubTeams: r.gt_sub_team ? [r.gt_sub_team] : undefined,
    startTime: r.start_time,
    endTime: r.end_time,
    label: r.label,
    capacity: r.capacity || 10,
    isActive: r.is_active !== false,
    hasBases: Boolean(r.has_bases),
    baseIds: r.base_ids || [],
    specificFunctions: r.specific_functions || [],
    notes: r.notes || '',
    forTypes: [r.category],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function pushShiftsToSupabase(shifts: ConfigurableShift[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || shifts.length === 0) return false;
  try {
    const payload = shifts.map(shiftToPostgres);
    const { error } = await client.from('shifts').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Error pushing shifts to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception pushing shifts to Supabase:', err);
    return false;
  }
}

export async function pushSingleShiftToSupabase(s: ConfigurableShift): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { success: false, error: 'No client' };
  try {
    const payload = shiftToPostgres(s);
    const { error } = await client.from('shifts').upsert(payload, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function deleteSingleShiftFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { success: false, error: 'No client' };
  try {
    const { error } = await client.from('shifts').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function pullShiftsFromSupabase(): Promise<ConfigurableShift[] | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.from('shifts').select('*');
    if (error || !data) return null;
    return data.map(postgresToShift);
  } catch (err) {
    console.warn('Exception pulling shifts from Supabase:', err);
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
    return data.map((r: any) => {
      const validBaseId =
        r.base_id && r.base_id !== 'null' && r.base_id !== 'undefined' && String(r.base_id).trim() !== ''
          ? String(r.base_id).trim()
          : undefined;

      const validBaseName =
        r.base_name && r.base_name !== 'null' && r.base_name !== 'undefined' && String(r.base_name).trim() !== ''
          ? String(r.base_name).trim()
          : validBaseId
          ? getBaseDisplayName(validBaseId)
          : undefined;

      const parsedBaseNumber = validBaseId
        ? isNaN(Number(validBaseId))
          ? validBaseId
          : Number(validBaseId)
        : undefined;

      return {
        id: r.id,
        personId: r.person_id,
        dayId: r.day_id,
        shiftId: r.shift_id,
        assignedType: r.assigned_type || 'GT',
        gtSubTeam: r.gt_sub_team || undefined,
        baseId: validBaseId,
        baseNumber: parsedBaseNumber,
        baseName: validBaseName,
        assignedFunction: r.function_id || undefined,
        roleInBase: r.role_in_base || undefined,
        requirementId: r.requirement_id || undefined,
        notes: r.notes || undefined,
        updatedAt: r.updated_at || new Date().toISOString(),
      };
    });
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

    const cloudShifts = await pullShiftsFromSupabase();
    if (cloudShifts && cloudShifts.length > 0) {
      const { replaceAllShiftsFromCloud } = await import('./storageService');
      replaceAllShiftsFromCloud(cloudShifts);
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
      message: `Sincronización completada: ${people?.length || 0} personas, ${assignments?.length || 0} turnos.`,
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
    const { getShifts, getBases } = await import('./storageService');
    await pushShiftsToSupabase(getShifts());
    const pOk = await pushPeopleToSupabase(people);
    const aOk = await pushAssignmentsToSupabase(assignments);
    const avOk = await pushAvailabilitiesToSupabase(availabilities);
    await pushBasesToSupabase(getBases());

    if (!pOk && people.length > 0) {
      return { success: false, message: 'Fallo al sincronizar personas en Supabase.' };
    }

    return {
      success: true,
      message: `¡Base de datos sincronizada en la nube! ${people.length} personas, ${assignments.length} turnos.`,
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
    // 1. Ensure the shift exists in Supabase to strictly prevent foreign key constraint violations (assignments_shift_id_fkey)
    const { data: shiftRow } = await client.from('shifts').select('id').eq('id', a.shiftId).maybeSingle();
    if (!shiftRow) {
      const { getShifts } = await import('./storageService');
      const allShifts = getShifts();
      const matching = allShifts.find((s) => s.id === a.shiftId);
      if (matching) {
        await client.from('shifts').upsert(shiftToPostgres(matching), { onConflict: 'id' });
      } else {
        const validEventId =
          a.dayId === 'martes' ? 'the-zone' :
          a.dayId === 'miercoles' ? 'carnival' :
          a.dayId === 'jueves' ? 'the-challenge' :
          a.dayId === 'viernes' ? 'the-games' : 'the-show';
        await client.from('shifts').upsert({
          id: a.shiftId,
          event_id: validEventId,
          day_id: a.dayId,
          name: a.shiftId.replace(/_/g, ' '),
          category: (['GT', 'GAP', 'MESA'].includes(a.assignedType as any) ? a.assignedType : 'MESA') as any,
          start_time: '06:00',
          end_time: '22:00',
          label: 'Turno ' + a.shiftId,
          capacity: 20,
          is_active: true,
          has_bases: false,
        }, { onConflict: 'id' });
      }
    }

    // 2. Ensure the person exists in Supabase to strictly prevent foreign key constraint violations (assignments_person_id_fkey)
    const { data: personRow } = await client.from('people').select('id').eq('id', a.personId).maybeSingle();
    if (!personRow) {
      const { getPeople } = await import('./storageService');
      const allPeople = getPeople();
      const matchingPerson = allPeople.find((p) => p.id === a.personId);
      if (matchingPerson) {
        await client.from('people').upsert(personToPostgres(matchingPerson), { onConflict: 'document_id' });
      }
    }

    const cleanBaseId =
      a.baseId && a.baseId !== 'null' && a.baseId !== 'undefined' && a.baseId.trim() !== ''
        ? a.baseId.trim()
        : a.baseNumber !== undefined && a.baseNumber !== null && String(a.baseNumber) !== 'null' && String(a.baseNumber) !== 'undefined' && String(a.baseNumber).trim() !== ''
        ? String(a.baseNumber).trim()
        : null;

    const cleanBaseName = cleanBaseId ? (a.baseName || getBaseDisplayName(cleanBaseId) || null) : null;

    const payload = {
      id: a.id,
      person_id: a.personId,
      day_id: a.dayId,
      shift_id: a.shiftId,
      assigned_type: a.assignedType || 'GT',
      gt_sub_team: a.gtSubTeam || null,
      base_id: cleanBaseId,
      base_name: cleanBaseName,
      function_id: a.assignedFunction || null,
      role_in_base: a.roleInBase || null,
      requirement_id: a.requirementId || null,
      notes: a.notes || null,
      updated_at: a.updatedAt || new Date().toISOString(),
    };
    const { error } = await client.from('assignments').upsert(payload, { onConflict: 'id' });
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, (payload) => {
      console.log('Realtime change received on shifts!', payload);
      onAssignmentChange();
    })
    .subscribe((status: string) => {
      console.log('Supabase Realtime status:', status);
    });
}

