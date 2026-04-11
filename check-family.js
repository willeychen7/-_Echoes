import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
    const { data: users } = await supabase.from('users').select('*');
    const { data: members } = await supabase.from('family_members').select('*').order('id', { ascending: true });
    console.log('USERS:', JSON.stringify(users, null, 2));
    console.log('MEMBERS:', JSON.stringify(members, null, 2));
})();
