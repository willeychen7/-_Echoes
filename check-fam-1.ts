
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkFamily1() {
    const { data: family } = await supabase.from('families').select('*').eq('id', 1).single();
    console.log("Family 1:", family);

    const { data: creator } = await supabase.from('users').select('*').eq('id', family.created_by);
    console.log("Creator User:", creator);
}

checkFamily1();
