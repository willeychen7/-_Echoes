
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function diagnose() {
    console.log("--- Family 6 Members ---");
    const { data: fam6Members } = await supabase.from('family_members').select('*').eq('family_id', 6);
    console.log(JSON.stringify(fam6Members, null, 2));

    console.log("\n--- Users linked to Family 6 ---");
    const { data: userLinks } = await supabase.from('users').select('id, name').eq('family_id', 6);
    console.log(JSON.stringify(userLinks, null, 2));
}

diagnose();
