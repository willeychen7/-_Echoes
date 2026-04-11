
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    console.log("Checking for members in Family 1 that might belong to User 2...");
    const { data: members } = await supabase.from('family_members').select('*').eq('family_id', 1);
    
    // User 2 was Member 3 in Family 1.
    // Chen Amei is Member 1.
    
    const migrationCandidates = members?.filter(m => {
        if (m.id === 1 || m.id === 17 || m.id === 18) return false; // Chen Amei and her parents stay
        if (m.mother_id === 1 || m.father_id === 1) return false; // Her children stay
        
        // Anything related to "老二" name
        if (m.name.includes("老二") || m.name.includes("二嫂")) return true;
        
        // Anything added by Member 3 (User 2)
        if (m.added_by_member_id === 3) return true;
        
        return false;
    });

    console.table(migrationCandidates?.map(m => ({
        id: m.id,
        name: m.name,
        rel: m.relationship,
        addedBy: m.added_by_member_id,
        created: m.created_at
    })));
}
run();
