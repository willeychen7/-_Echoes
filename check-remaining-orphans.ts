
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkOrphans() {
  const oldMemberId = 3;
  console.log(`Checking for any remaining archives created by Member ${oldMemberId}...`);
  
  // Check amc
  const { data: amc } = await supabase.from('archive_memory_creators').select('member_id').eq('creator_member_id', oldMemberId);
  const amcIds = amc?.map(a => a.member_id) || [];
  
  // Check added_by
  const { data: added } = await supabase.from('family_members').select('id, name, family_id, is_placeholder').eq('added_by_member_id', oldMemberId);
  
  console.log('AMC Links:', amcIds);
  console.log('Added By Links:', added);
  
  const allIds = Array.from(new Set([...amcIds, ...(added?.map(a => a.id) || [])]));
  if (allIds.length > 0) {
    const { data: details } = await supabase.from('family_members').select('*').in('id', allIds);
    console.log('Details of these orphans:', JSON.stringify(details, null, 2));
  } else {
    console.log('No orphans found.');
  }
}

checkOrphans();
