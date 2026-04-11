import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const userAId = 1; 
const userBId = 2; 

async function runV10Debug() {
    console.log("--- 🔄 Debugging V10 Step 1 ---");

    const { data: uA } = await supabase.from('users').select('name, member_id').eq('id', userAId).single();
    const { data: uB } = await supabase.from('users').select('name, member_id').eq('id', userBId).single();
    let memberAId = uA.member_id;
    let memberBId = uB.member_id;

    const apiPost = async (url: string, body: any) => {
        const res = await fetch(`http://localhost:3000${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) {
            console.error(`❌ API Error [${url}]:`, data);
            throw new Error(data.error || 'API Error');
        }
        return data;
    };

    const baseSuffix = `_DEBUG_${Date.now().toString().slice(-4)}`;
    const { data: famA } = await supabase.from('families').insert({ name: "A族" + baseSuffix, creator_id: userAId }).select().single();
    const { data: famB } = await supabase.from('families').insert({ name: "B族" + baseSuffix, creator_id: userBId }).select().single();
    
    // Ensure B is anchored to famB
    await supabase.from('users').update({ family_id: famB.id, home_family_id: famB.id, home_member_id: memberBId }).eq('id', userBId);
    await supabase.from('family_members').update({ family_id: famB.id }).eq('id', memberBId);

    // Add wife to B
    const { data: wifeB } = await supabase.from('family_members').insert({
        family_id: famB.id,
        name: "DEBUG媳妇",
        relationship: "妻子",
        gender: "female",
        is_registered: false,
        member_type: 'virtual',
        added_by_member_id: memberBId
    }).select().single();
    console.log(`B home member: ${memberBId}, Wife added_by_member_id: ${wifeB.added_by_member_id}`);

    // B join A
    const inv1 = `DEBUG-INV-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "B(TEMP)", relationship: "堂弟", inviteCode: inv1, createdByMemberId: memberAId 
    });
    console.log("B accepting invite...");
    await apiPost('/api/accept-invite', { inviteCode: inv1, userId: userBId, mode: "migrate" });

    // Inspect famA
    const { data: membersInA } = await supabase.from('family_members').select('id, name, family_id, added_by_member_id').eq('family_id', famA.id);
    console.log("Members in A after join:", membersInA);

    const wifeInA = membersInA?.find(m => m.name === "DEBUG媳妇");
    if (wifeInA) {
        console.log(`✅ Success: Wife found in A with ID ${wifeInA.id}`);
    } else {
        console.log("❌ Failure: Wife NOT found in A!");
        // Check B's current member_id
        const { data: uB_final } = await supabase.from('users').select('member_id').eq('id', userBId).single();
        console.log(`User B final member_id: ${uB_final.member_id}`);
    }
}

runV10Debug().catch(console.error);
