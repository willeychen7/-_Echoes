
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function findAllArchives() {
    // 1. Get all member IDs associated with User 2
    const { data: userMembers } = await supabase.from('family_members').select('id, family_id').eq('user_id', 2);
    const memberIds = userMembers?.map(m => m.id) || [];
    console.log("User 2 Member IDs:", memberIds);

    // Also include Member 3 as it was likely User 2's id in Family 1
    if (!memberIds.includes(3)) memberIds.push(3);

    // 2. Find everything added by these member IDs
    const { data: addedByUs } = await supabase.from('family_members')
        .select('*')
        .in('added_by_member_id', memberIds);
    
    console.log("\n--- Archives ADDED BY User 2 ---");
    console.table(addedByUs?.map(a => ({ id: a.id, name: a.name, family: a.family_id, addedBy: a.added_by_member_id })));

    // 3. Find everything where User 2 (Member 3 or 31) is the CREATOR in amc
    const { data: creatorLinks } = await supabase.from('archive_memory_creators')
        .select('member_id')
        .in('creator_member_id', memberIds);
    const creatorIds = Array.from(new Set(creatorLinks?.map(c => c.member_id) || []));
    
    if (creatorIds.length > 0) {
        const { data: createdByUs } = await supabase.from('family_members')
            .select('*')
            .in('id', creatorIds);
        console.log("\n--- Archives where User 2 is CREATOR in AMC ---");
        console.table(createdByUs?.map(a => ({ id: a.id, name: a.name, family: a.family_id })));
    }

    // 4. Check for "Orphaned" members in Family 1 that look like they belong to User 2
    const { data: fam1Orphans } = await supabase.from('family_members')
        .select('*')
        .eq('family_id', 1)
        .ilike('name', '%老二%');
    console.log("\n--- '老二' related members in Family 1 ---");
    console.table(fam1Orphans?.map(o => ({ id: o.id, name: o.name, addedBy: o.added_by_member_id })));
}

findAllArchives();
