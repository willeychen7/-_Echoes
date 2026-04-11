
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkTimestamps() {
    const ids = [25, 26, 28, 29, 3, 6, 7, 9, 13, 16];
    const { data: members } = await supabase.from('family_members').select('*').in('id', ids).order('created_at');
    console.table(members?.map(m => ({
        id: m.id,
        name: m.name,
        family_id: m.family_id,
        created_at: m.created_at,
        added_by: m.added_by_member_id
    })));
}

checkTimestamps();
