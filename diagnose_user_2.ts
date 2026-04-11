
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function diagnose() {
    console.log("--- User 2 Status ---");
    const { data: user, error: uErr } = await supabase.from('users').select('*').eq('id', 2).maybeSingle();
    if (uErr) console.error("Error fetching user:", uErr);
    console.log(user);

    if (user) {
        console.log("\n--- Current Family Member Record ---");
        const { data: currentMember, error: mErr } = await supabase.from('family_members').select('*').eq('id', user.member_id).maybeSingle();
        if (mErr) console.error("Error fetching current member:", mErr);
        console.log(currentMember);

        console.log("\n--- Home Family Members ---");
        if (user.home_family_id) {
            const { data: homeMembers } = await supabase.from('family_members').select('*').eq('family_id', user.home_family_id);
            console.log(homeMembers);
        } else {
            console.log("No home_family_id set.");
        }
    }

    console.log("\n--- All Family Members with user_id = 2 ---");
    const { data: allMemberLinks } = await supabase.from('family_members').select('*').eq('user_id', 2);
    console.log(allMemberLinks);

    console.log("\n--- Family 1 Members ---");
    const { data: fam1Members } = await supabase.from('family_members').select('*').eq('family_id', 1);
    console.log(fam1Members);
    
    console.log("\n--- Family 1 Creator ---");
    const { data: fam1 } = await supabase.from('families').select('*').eq('id', 1).maybeSingle();
    console.log(fam1);
}

diagnose();
