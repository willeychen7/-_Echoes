import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkUser2Detailed() {
    const userId = 2;
    const { data: members } = await supabase.from('family_members').select('id, family_id, is_registered, user_id, created_at').eq('user_id', userId).order('created_at', { ascending: false });
    console.log("Recent Family Members for user_id 2:", members?.slice(0, 5));
}

checkUser2Detailed();
