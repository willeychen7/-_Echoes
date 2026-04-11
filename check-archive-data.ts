
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkData() {
    const ids = [25, 26, 28, 29, 6, 7, 9, 13, 16, 33];
    console.log("Checking for data linked to these IDs...");

    for (const id of ids) {
        const { count: memCount } = await supabase.from('archive_memories').select('*', { count: 'exact', head: true }).eq('member_id', id);
        const { count: creatorCount } = await supabase.from('archive_memory_creators').select('*', { count: 'exact', head: true }).eq('member_id', id);
        
        // Also check if they are parents/spouses
        const { count: childCountF } = await supabase.from('family_members').select('*', { count: 'exact', head: true }).eq('father_id', id);
        const { count: childCountM } = await supabase.from('family_members').select('*', { count: 'exact', head: true }).eq('mother_id', id);
        const { count: spouseCount } = await supabase.from('family_members').select('*', { count: 'exact', head: true }).eq('spouse_id', id);

        if ((memCount ?? 0) > 0 || (creatorCount ?? 0) > 0 || (childCountF ?? 0) > 0 || (childCountM ?? 0) > 0 || (spouseCount ?? 0) > 0) {
            console.log(`ID ${id}: Memories: ${memCount}, CreatorLinks: ${creatorCount}, Children: ${(childCountF ?? 0) + (childCountM ?? 0)}, Spouses: ${spouseCount}`);
        } else {
            // console.log(`ID ${id}: No data.`);
        }
    }
}

checkData();
