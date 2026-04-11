
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function repairUser2() {
  const oldMemberId = 3;
  const newMemberId = 31;
  const newFamilyId = 6;
  const realArchiveIds = [6, 7, 9, 13, 16];
  const fakeFatherId = 32;

  console.log(`Starting repair for User 2 (Member ${newMemberId}, Family ${newFamilyId})...`);

  // 1. Move real archives to family 6
  console.log('Moving real archives to family 6...');
  const { error: moveError } = await supabase
    .from('family_members')
    .update({ family_id: newFamilyId, added_by_member_id: newMemberId })
    .in('id', realArchiveIds);
  if (moveError) console.error('Move error:', moveError);

  // 2. Update creator linkages
  console.log('Updating archive_memory_creators linkages...');
  const { error: linkError } = await supabase
    .from('archive_memory_creators')
    .update({ creator_member_id: newMemberId })
    .eq('creator_member_id', oldMemberId);
  if (linkError) console.error('Link error:', linkError);

  // 3. Link real Father (9) to User 2 (31)
  console.log('Linking real Father (9) to User 2 (31)...');
  const { error: parentError } = await supabase
    .from('family_members')
    .update({ father_id: 9 })
    .eq('id', newMemberId);
  if (parentError) console.error('Parent error:', parentError);

  // 4. Delete fake Father (32) if it exists
  console.log('Deleting fake Father (32)...');
  const { error: delError } = await supabase
    .from('family_members')
    .delete()
    .eq('id', fakeFatherId);
  if (delError) console.error('Delete error (expected if already gone):', delError);

  console.log('Repair complete!');
}

repairUser2();
