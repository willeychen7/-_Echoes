
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const ids = [6, 7, 9, 13, 16];
  console.log(`Checking members ${ids}...`);
  const { data, error } = await supabase.from('family_members').select('id, name, family_id, is_registered').in('id', ids);
  console.log(JSON.stringify(data, null, 2));
}

check();
