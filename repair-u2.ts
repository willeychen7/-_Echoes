import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function repair() {
  const { data: fam } = await s.from('families').select('id').eq('creator_id', 2).limit(1).maybeSingle();
  const familyId = fam?.id || 85; 
  console.log('Using familyId:', familyId);
  await s.from('users').update({ home_family_id: familyId, home_member_id: 330, family_id: familyId }).eq('id', 2);
  const { data: m } = await s.from('family_members').select('id').eq('id', 330).maybeSingle();
  if (!m) {
    await s.from('family_members').insert({ 
      id: 330, family_id: familyId, name: '老二', user_id: 2, is_registered: true, member_type: 'human', relationship: '我', generation_num: 30, logic_tag: 'G30-H1' 
    });
  } else {
    await s.from('family_members').update({ generation_num: 30, logic_tag: 'G30-H1', family_id: familyId, is_registered: true, user_id: 2 }).eq('id', 330);
  }
  console.log('User 2 repaired.');
}

repair();
