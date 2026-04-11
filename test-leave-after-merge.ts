import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const userAId = 1; 
const userBId = 2; 
const memberAId = 1; 
const memberBId = 31; 

async function testLeaveAfterMerge() {
    console.log("--- 🕵️ 测试：归并后的分家表现 ---");

    // 1. A 和 B 分别创建始祖
    const { data: familyA } = await supabase.from('families').insert({ name: "分家测试-A", creator_id: userAId }).select().single();
    const { data: familyB } = await supabase.from('families').insert({ name: "分家测试-B", creator_id: userBId }).select().single();
    
    await supabase.from('users').update({ family_id: familyA.id }).eq('id', userAId);
    await supabase.from('users').update({ family_id: familyB.id }).eq('id', userBId);
    await supabase.from('family_members').update({ family_id: familyA.id }).eq('id', memberAId);
    await supabase.from('family_members').update({ family_id: familyB.id }).eq('id', memberBId);

    // B 添加虚拟始祖
    const resGGFB = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: familyB.id, name: "B录入的始祖", relationship: "曾祖的父亲", gender: "male", createdByMemberId: memberBId, memberType: "virtual"
        })
    });
    const ggfB = await resGGFB.json();
    console.log("B 录入的始祖 ID:", ggfB.id);

    // A 也添加虚拟始祖
    const resGGFA = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: familyA.id, name: "A录入的始祖", relationship: "曾祖的父亲", gender: "male", createdByMemberId: memberAId, memberType: "virtual"
        })
    });
    const ggfA = await resGGFA.json();
    console.log("A 录入的始祖 ID:", ggfA.id);

    // 2. B 加入 A
    console.log("\n2. B 加入 A，触发归并...");
    const inviteCode = `LEAVE-TEST-${Date.now()}`;
    await supabase.from('family_members').insert({
        family_id: familyA.id, name: "老二(在A家)", relationship: "弟", invite_code: inviteCode, is_registered: false, father_id: ggfA.id
    });

    const resJoin = await fetch(`http://localhost:3000/api/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, userId: userBId, mode: "migrate" })
    });
    console.log("加入 A 成功");

    // 验证合并
    const { data: checkBOrig } = await supabase.from('family_members').select('id').eq('id', ggfB.id).maybeSingle();
    if (!checkBOrig) console.log("✅ 合并成功：B 的原始节点已消失。");

    // 3. B 离开 A
    console.log("\n3. B 离开 A，尝试带走行李...");
    const resLeave = await fetch(`http://localhost:3000/api/leave-family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userBId, familyId: familyA.id, memberId: 31, takeArchives: true })
    });
    const leaveData = await resLeave.json();
    const newHomeId = leaveData.newFamilyId;
    console.log("B 已回到新主场:", newHomeId);

    // 4. 验证 B 的主场里是否有始祖？
    const { data: ancestors } = await supabase.from('family_members')
        .select('name')
        .eq('family_id', newHomeId)
        .eq('member_type', 'virtual');
    
    console.log("B 主场里的虚拟人物:", ancestors.map(a => a.name));

    if (ancestors.length === 0) {
        console.log("❌ 严重问题：归并后的虚拟始祖被 A “侵吞”了，B 走的时候没带出来。");
    } else {
        console.log("✅ 成功：B 依然保留了其始祖节点。");
    }

    // 清理
    await supabase.from('family_members').delete().eq('family_id', familyA.id);
    await supabase.from('families').delete().eq('id', familyA.id);
}

testLeaveAfterMerge();
