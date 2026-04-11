
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function restoreCorrectArchives() {
    console.log("Restoring correct archives for User 2...");

    // 1. Fix Family 6 Hierarchy
    // Grandfather (16) should be father of Father (9)
    // Currently Father (9) is father of Grandfather (16) - WRONG
    console.log("Fixing relationship: 爷爷1 (16) -> 陈金国 (9)...");
    
    // Clear 16's father_id
    const { error: err1 } = await supabase.from('family_members').update({ father_id: null }).eq('id', 16);
    if (err1) console.error("Error clearing 16's father:", err1);

    // Set 9's father_id to 16
    const { error: err2 } = await supabase.from('family_members').update({ father_id: 16 }).eq('id', 9);
    if (err2) console.error("Error setting 9's father:", err2);

    // 2. Link Brother (cxs, 13) to parents (9, 33)
    console.log("Linking Brother (cxs, 13) to parents (9, 33)...");
    const { error: err3 } = await supabase.from('family_members').update({ father_id: 9, mother_id: 33 }).eq('id', 13);
    if (err3) console.error("Error linking cxs:", err3);

    // 3. Clean up ghost parents in Family 1
    // These are redundant leftovers with no data
    const ghostIds = [25, 26, 28, 29];
    console.log(`Cleaning up ghost parents in Family 1: ${ghostIds}...`);
    const { error: err4 } = await supabase.from('family_members').delete().in('id', ghostIds);
    if (err4) {
        console.error("Error deleting ghosts (they might have been deleted already):", err4);
    } else {
        console.log("Ghosts deleted.");
    }

    // 4. Double check everything is in Family 6
    const finalIds = [6, 7, 9, 13, 16, 33];
    const { data: finalArchives } = await supabase.from('family_members').select('id, name, family_id, father_id, mother_id').in('id', finalIds);
    console.log("\n--- Final Family 6 Archive Status ---");
    console.table(finalArchives);

    console.log("\nRestoration complete.");
}

restoreCorrectArchives();
