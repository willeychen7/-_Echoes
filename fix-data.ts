
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixData() {
    console.log("--- Fixing Data ---");

    // 1. Delete redundant orphaned '老二' (ID 4)
    console.log("Deleting orphaned member ID 4...");
    const { error: dErr4 } = await supabase.from('family_members').delete().eq('id', 4);
    if (dErr4) console.error("Error deleting ID 4:", dErr4);
    else console.log("Member 4 deleted.");

    // 2. Fix '陈阿妹' (ID 1) record in Family 1
    console.log("Setting sibling_order for 陈阿妹 (ID 1)...");
    const { error: uErr1 } = await supabase.from('family_members').update({
        sibling_order: 3,
        standard_role: 'creator',
        relationship: '我'
    }).eq('id', 1);
    if (uErr1) console.error("Error updating ID 1:", uErr1);
    else console.log("Member 1 updated.");

    // 3. Ensure '二哥' (ID 3) has correct rank
    console.log("Ensuring sibling_order for 二哥 (ID 3)...");
    const { error: uErr3 } = await supabase.from('family_members').update({
        sibling_order: 2,
        gender: 'male',
        standard_role: 'brother'
    }).eq('id', 3);
    if (uErr3) console.error("Error updating ID 3:", uErr3);
    else console.log("Member 3 updated.");

    console.log("--- Cleanup Result ---");
    const { data: finalLaoer } = await supabase.from('family_members').select('*').ilike('name', '%老二%');
    console.log("Remaining '老二' names:", finalLaoer.map(m => `ID: ${m.id}, FamID: ${m.family_id}`));
}

fixData();
