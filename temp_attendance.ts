export async function pushAttendancesToSupabase(attendances: AttendanceRecord[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || attendances.length === 0) return false;

  try {
    const payload = attendances.map((at) => ({
      id: at.id,
      person_id: at.personId,
      day_id: at.dayId,
      shift_id: at.shiftId,
      status: at.status,
      observations: at.observations || null,
      updated_at: at.updatedAt || new Date().toISOString(),
    }));

    const { error } = await client.from('attendances').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Error syncing attendances to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception syncing attendances:', err);
    return false;
  }
}

export async function pullAttendancesFromSupabase(): Promise<AttendanceRecord[] | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const data = await fetchAllRecords(client, 'attendances');
    if (!data) return null;
    return data.map((r: any) => ({
      id: r.id,
      personId: r.person_id,
      dayId: r.day_id,
      shiftId: r.shift_id,
      status: r.status,
      observations: r.observations || undefined,
      updatedAt: r.updated_at || undefined,
    }));
  } catch (err) {
    console.warn('Exception pulling attendances:', err);
    return null;
  }
}
