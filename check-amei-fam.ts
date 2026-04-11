
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAmeiFamily() {
    console.log("--- Family 1 (陈阿妹) Members ---");
    const { data, error } = await supabase.from('family_members').select('*').eq('family_id', 1);
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

checkAmeiFamily();
