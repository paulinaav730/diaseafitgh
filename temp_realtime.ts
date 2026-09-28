let realtimeChannel: any = null;

export function setupRealtimeSubscriptions(
  onChange: (table?: string) => void
) {
  const client = getSupabase();
  if (!client) return;
  
  if (realtimeChannel) return; // already subscribed

  realtimeChannel = client
    .channel('public:all_tables')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => onChange('assignments'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bases' }, () => onChange('bases'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => onChange('shifts'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, () => onChange('people'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, () => onChange('attendances'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'food_deliveries' }, () => onChange('food_deliveries'))
    .subscribe((status: string) => {
      console.log('Supabase Realtime status:', status);
    });
}
