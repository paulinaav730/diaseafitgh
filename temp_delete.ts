export async function deleteRecordsFromSupabase(table: string, ids: string[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || ids.length === 0) return false;
  try {
    const { error } = await client.from(table).delete().in('id', ids);
    if (error) {
      console.warn(Error deleting from :, error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(Exception deleting from :, err);
    return false;
  }
}
export async function deleteAllRecordsFromSupabase(table: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.from(table).delete().neq('id', 'non_existent_id_hack_to_delete_all'); // Hack to delete all since empty .delete() without filters fails in supabase sometimes if no RLS
    if (error) {
      console.warn(Error deleting all from :, error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(Exception deleting all from :, err);
    return false;
  }
}
