
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkLaoerEntries() {
    const { data: members, error } = await supabase.from('family_members').select('*').ilike('name', '%老二%');
    if (error) console.error(error);
    else {
        members.forEach(m => {
            console.log(`ID: ${m.id}, Name: ${m.name}, FamID: ${m.family_id}, UserId: ${m.user_id}, Relation: ${m.relationship}, Gender: ${m.gender}, Standard: ${m.standard_role}`);
        });
    }
}

checkLaoerEntries();
