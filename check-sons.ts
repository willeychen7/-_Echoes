import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkRecentSons() {
    const { data: sons } = await supabase.from('family_members').select('*').eq('name', '老二长子').order('created_at', { ascending: false });
    console.log(JSON.stringify(sons, null, 2));
}

checkRecentSons();
