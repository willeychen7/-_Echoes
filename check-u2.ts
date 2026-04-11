import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkUser2() {
    const userId = 2;
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    console.log("User 2:", user);

    const { data: members } = await supabase.from('family_members').select('*').eq('user_id', userId);
    console.log("Family Members for user_id 2:", members?.map(m => ({ id: m.id, family_id: m.family_id, is_registered: m.is_registered })));
}

checkUser2();
