
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixAncestralHalls() {
    console.log("Fixing ancestral halls for 陈阿妹 (ID 1) and 老二 (ID 3)...");

    const { error: err1 } = await supabase.from('family_members').update({
        ancestral_hall: '三房',
    }).eq('id', 1);

    if (err1) console.error("Error updating ID 1:", err1);
    else console.log("ID 1 updated to 三房");

    const { error: err3 } = await supabase.from('family_members').update({
        ancestral_hall: '二房',
    }).eq('id', 3);

    if (err3) console.error("Error updating ID 3:", err3);
    else console.log("ID 3 updated to 二房");

    // Also fix target ID 24, 25, 26 just in case (老二 in his own family)
    await supabase.from('family_members').update({ ancestral_hall: '二房' }).eq('id', 24);
}

fixAncestralHalls();
