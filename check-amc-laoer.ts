
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    const { data } = await supabase.from('archive_memory_creators')
        .select('member_id, creator_member_id')
        .or('creator_member_id.eq.3,creator_member_id.eq.31');
    console.table(data);

    if (data && data.length > 0) {
        const memberIds = data.map(d => d.member_id);
        const { data: members } = await supabase.from('family_members').select('id, name, family_id').in('id', memberIds);
        console.table(members);
    }
}
run();
