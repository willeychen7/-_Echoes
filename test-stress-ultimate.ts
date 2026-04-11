import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const inviterId = 31; // 老二 (30代, UserID: 2)
const userId = 2;

async function runStressTest() {
    console.log("--- 🚀 开始：家族逻辑终极压力测试 (上下五代/跨向/合并/带离) ---");
    
    // 1. 准备环境：创建两个测试家族
    const { data: sourceFamily } = await supabase.from('families').insert({ name: "压力测试-源家族", creator_id: userId }).select().single();
    const { data: destFamily } = await supabase.from('families').insert({ name: "压力测试-目标主场", creator_id: userId }).select().single();
    
    // 将用户设为源家族成员，并设置目标地址为 destFamily
    await supabase.from('family_members').update({ family_id: sourceFamily.id }).eq('id', inviterId);
    await supabase.from('users').update({ family_id: sourceFamily.id, home_family_id: destFamily.id }).eq('id', userId);
    
    console.log(`已创建源家族: ${sourceFamily.id}, 目标家族: ${destFamily.id}`);

    // 2. 【跨代添加】添加 高祖父 (G26)
    console.log("\n2. 测试：添加 高祖父 (G26)...");
    const resGGF = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: sourceFamily.id, name: "陈高祖", relationship: "曾祖的父亲", gender: "male", createdByMemberId: inviterId, memberType: "virtual"
        })
    });
    const ggfData: any = await resGGF.json();
    console.log("高祖父已添加, ID:", ggfData.id);

    // 3. 【左右跨向】添加 曾叔公 (G27)
    console.log("\n3. 测试：曾叔公... ");
    const resGGU = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: sourceFamily.id, name: "陈曾叔公", relationship: "曾叔公", gender: "male", 
            createdByMemberId: inviterId,
            selectedParentId: ggfData.id,
            memberType: "virtual"
        })
    });
    const gguData: any = await resGGU.json();
    console.log("曾叔公已添加, ID:", gguData.id);

    // 4. 【逻辑合并】验证不记录姓名，只记录结构
    console.log("\n4. 验证：再次添加逻辑相同的 曾叔公 (不看姓名)...");
    const resMerge = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: sourceFamily.id, name: "无名氏-合并测试", relationship: "曾叔公", gender: "male", 
            createdByMemberId: inviterId,
            selectedParentId: ggfData.id,
            memberType: "virtual"
        })
    });
    const mergeData: any = await resMerge.json();
    if (mergeData.merged && mergeData.id === gguData.id) {
        console.log("✅ 合并验证通过：结构一致即合并成功！(忽略了姓名差异)");
    } else {
        console.log("❌ 合并验证失败:", mergeData);
    }

    // 5. 【迁徙测试】退出源家族
    console.log("\n5. 测试：退出家族并搬迁行李...");
    const resLeave = await fetch(`http://localhost:3000/api/leave-family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, familyId: sourceFamily.id, memberId: inviterId, takeArchives: true })
    });
    console.log("退出 API 返回状态:", resLeave.status);

    // 验证：曾叔公是否已到达目标家族
    const { data: migrated } = await supabase.from('family_members').select('family_id, name').eq('id', gguData.id).single();
    if (migrated && migrated.family_id === destFamily.id) {
        console.log(`✅ 迁徙验证通过：${migrated.name} 已随迁至家族 ${migrated.family_id}`);
    } else {
        console.log(`❌ 迁徙验证失败:`, migrated);
    }

    // 清理测试家族
    await supabase.from('family_members').delete().eq('family_id', destFamily.id);
    await supabase.from('families').delete().eq('id', destFamily.id);
    // 源家族应该已经被 API 里的 Cleanup 删掉了
    
    console.log("\n--- 🏁 终极测试结束 ---");
}

runStressTest();
