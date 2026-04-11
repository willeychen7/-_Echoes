import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const inviterId = 31; // 老二
const familyId = 6;

async function addTangshu() {
    console.log("--- Simulating adding 堂叔 as User 2 ---");
    
    // 1. Add the member record
    const { data: newMember, error } = await supabase.from('family_members').insert({
        family_id: familyId,
        name: "陈全蛋",
        relationship: "堂叔",
        gender: "male",
        added_by_member_id: inviterId,
        is_registered: false
    }).select().single();

    if (error) {
        console.error("Error adding member:", error);
        return;
    }

    console.log(`Added member: ${newMember.name}, ID: ${newMember.id}`);

    // 2. Simulate resolveRigorousRel (backend logic)
    // We already updated server.ts, so in the real app this would work automatically.
    
    const { data: inviter } = await supabase.from('family_members').select('*').eq('id', inviterId).single();
    const g = Number(inviter.generation_num);
    const targetGen = g - 1;

    console.log(`Deducing Generation: Inviter ${g} -> Target ${targetGen}`);

    // 3. Update the member with deductions
    await supabase.from('family_members').update({
        generation_num: targetGen,
        standard_role: "paternal_cousin_elder"
    }).eq('id', newMember.id);

    console.log("Member updated with correct generation.");
    
    return newMember.id;
}

addTangshu();
