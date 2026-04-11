import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkSchema() {
    const { data } = await supabase.from('family_members').select('*').limit(1);
    if (data && data.length > 0) {
        console.log("Columns in family_members:", Object.keys(data[0]));
    }
}

checkSchema();
