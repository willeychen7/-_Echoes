import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkSon372() {
    const { data: son } = await supabase.from('family_members').select('*').eq('id', 372).single();
    process.stdout.write(JSON.stringify(son, null, 2));
}

checkSon372();
