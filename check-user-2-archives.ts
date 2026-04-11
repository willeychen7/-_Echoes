
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkUser2() {
    const { data: user } = await supabase.from('users').select('*').eq('id', 2).maybeSingle();
    console.log("User 2:", user);

    if (user) {
        // Find all family member records for this user
        const { data: memberRecords } = await supabase.from('family_members').select('*').eq('user_id', 2);
        console.log("Member Records for User 2:", memberRecords);

        // Find archives created by this user
        // We need to know which member_id they used to create archives.
        // In the previous sessions, we might have established that User 2 created certain archives.
        const memberIds = memberRecords?.map(m => m.id) || [];
        if (memberIds.length > 0) {
            const { data: createdBy } = await supabase.from('family_members')
                .select('*')
                .in('added_by_member_id', memberIds);
            console.log("Archives created by User 2's member IDs:", createdBy);
        }
    }
}

checkUser2();
