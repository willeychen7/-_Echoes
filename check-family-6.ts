
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const familyId = 6;
  console.log(`Checking members for family ${familyId}...`);
  
  const { data: members, error: mError } = await supabase
    .from('family_members')
    .select('id, name, father_id, mother_id, added_by_member_id')
    .eq('family_id', familyId);
    
  if (mError) {
    console.error(mError);
    return;
  }
  
  console.log(JSON.stringify(members, null, 2));
}

check();
