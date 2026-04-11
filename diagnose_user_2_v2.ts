
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function diagnose() {
    const { data: user } = await supabase.from('users').select('*').eq('id', 2).single();
    console.log("USER 2 RECORD:", JSON.stringify(user, null, 2));

    const { data: userMembers } = await supabase.from('family_members').select('*').eq('user_id', 2);
    console.log("MEMBER RECORDS LINKED TO USER 2:", JSON.stringify(userMembers, null, 2));

    const { data: fam1Mem3 } = await supabase.from('family_members').select('*').eq('id', 3).single();
    console.log("FAMILY 1 MEMBER ID 3 (EXPECTED TO BE USER 2):", JSON.stringify(fam1Mem3, null, 2));
}

diagnose();
