
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const client = createClient(url, key);

async function repair() {
  let allData = [];
  let from = 0;
  let hasMore = true;
  while(hasMore) {
    const {data} = await client.from('assignments').select('id, day_id, base_id').range(from, from+999);
    if(data && data.length) { allData.push(...data); from+=1000; if(data.length<1000) hasMore=false; }
    else hasMore=false;
  }
  
  const toRepair = allData.filter(a => 
    (a.day_id === 'jueves' || a.day_id === 'viernes') && 
    a.base_id && a.base_id.startsWith('carnival_')
  );
  
  console.log('Found ' + toRepair.length + ' broken assignments to repair.');
  
  let fixedCount = 0;
  for (const a of toRepair) {
    const numMatch = a.base_id.match(/carnival_(\d+)/);
    if (!numMatch) continue;
    const num = numMatch[1];
    
    let newBaseId;
    if (a.day_id === 'jueves') {
      newBaseId = 'games_jueves_' + num;
    } else if (a.day_id === 'viernes') {
      newBaseId = 'games_viernes_' + num;
    }
    
    const { error: upErr } = await client.from('assignments').update({
      base_id: newBaseId,
      base_name: 'Base ' + num
    }).eq('id', a.id);
    
    if (upErr) {
      console.error('Failed to update', a.id, upErr);
    } else {
      fixedCount++;
    }
  }
  console.log('Successfully repaired ' + fixedCount + ' assignments.');
}
repair();

