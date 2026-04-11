import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const userAId = 1; 
const userBId = 2; 

async function runV8UltimateCycleTest() {
    console.log("--- 🔄 开始：极限循环生命周期测试 (V8 - 进进出出+中途加人+多次归宗) ---");

    // 1. 获取基础成员 ID
    const { data: uA } = await supabase.from('users').select('name, member_id').eq('id', userAId).single();
    const { data: uB } = await supabase.from('users').select('name, member_id').eq('id', userBId).single();
    let memberAId = uA.member_id;
    let memberBId = uB.member_id;

    // 2. 环境深度重置
    console.log("2. 建立专用测试家族...");
    const { data: famA } = await supabase.from('families').insert({ name: "V8-主线大族-陈家", creator_id: userAId }).select().single();
    const { data: famB_base } = await supabase.from('families').insert({ name: "V8-老二的自留地", creator_id: userBId }).select().single();
    
    await supabase.from('users').update({ family_id: famA.id, home_family_id: famA.id, home_member_id: memberAId }).eq('id', userAId);
    await supabase.from('users').update({ family_id: famB_base.id, home_family_id: famB_base.id, home_member_id: memberBId }).eq('id', userBId);
    await supabase.from('family_members').update({ family_id: famA.id }).eq('id', memberAId);
    await supabase.from('family_members').update({ family_id: famB_base.id }).eq('id', memberBId);

    const apiPost = async (url: string, body: any) => {
        const res = await fetch(`http://localhost:3000${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await res.json();
    };

    // 3. 初始状态：B 加入 A
    console.log("\n3. 步骤一：B 首次加入 A 家族...");
    const inv1 = `V8-INV-1-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "老二", relationship: "堂弟", inviteCode: inv1, createdByMemberId: memberAId 
    });
    await apiPost('/api/accept-invite', { inviteCode: inv1, userId: userBId, mode: "migrate" });

    // 4. B 离开 A (带走行李)
    console.log("\n4. 步骤二：B 离开 A 并带走行李 (档案克隆测试)...");
    const { data: bInA } = await supabase.from('family_members').select('*').eq('user_id', userBId).eq('family_id', famA.id).single();
    const leave1 = await apiPost('/api/leave-family', { userId: userBId, familyId: famA.id, memberId: bInA.id, takeArchives: true });
    console.log("B 已离开 A，建立新家 ID:", leave1.newFamilyId);

    // 5. 中途加人：B 在自己家里加了一个“曾孙” (跨代加人测试)
    console.log("\n5. 步骤三：B 在分家期间，添加了一个虚拟人物【流浪曾孙】...");
    const grandson = await apiPost('/api/family-members', {
        familyId: leave1.newFamilyId, name: "流浪曾孙", relationship: "曾孙", gender: "male",
        createdByMemberId: leave1.newMemberId
    });
    console.log("流浪曾孙录入完成，ID:", grandson.id);

    // 6. 再次加入 A (行李箱合并测试)
    console.log("\n6. 步骤四：B 再次加入 A 家族 (携带他在分家期间录入的所有后代)...");
    const inv2 = `V8-INV-2-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "老二(回归)", relationship: "堂弟", inviteCode: inv2, createdByMemberId: memberAId 
    });
    const joinRes2 = await apiPost('/api/accept-invite', { inviteCode: inv2, userId: userBId, mode: "migrate" });

    // 验证：流浪曾孙是否出现在 A 家族里
    const { data: grandsonInA } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "流浪曾孙").maybeSingle();
    if (grandsonInA) {
        console.log("✅ 验证成功：【流浪曾孙】随着 B 入驻了 A 家族。");
        // 验证关系：曾孙的爹应该也在 A 里了
        if (grandsonInA.father_id) {
            const { data: sonInA } = await supabase.from('family_members').select('*').eq('id', grandsonInA.father_id).single();
            console.log(`✅ 关系链验证：曾孙的父亲【${sonInA.name}】也同步到了 A 家族，ID: ${sonInA.id}`);
        }
    } else {
        console.log("❌ 验证失败：【流浪曾孙】未同步至 A 家族。");
    }

    // 7. 再次离开
    console.log("\n7. 步骤五：B 再次离开 A 家族 (最后验证数据完整性)...");
    const { data: bInAFinal } = await supabase.from('family_members').select('*').eq('user_id', userBId).eq('family_id', famA.id).single();
    const leave2 = await apiPost('/api/leave-family', { userId: userBId, familyId: famA.id, memberId: bInAFinal.id, takeArchives: true });
    
    const { count: finalCount } = await supabase.from('family_members').select('id', { count: 'exact', head: true }).eq('family_id', leave2.newFamilyId);
    console.log(`\nB 最终离场后的家族人数: ${finalCount} (期望应包含自己、儿子、曾孙等)`);
    
    const { data: finalGrandson } = await supabase.from('family_members').select('*').eq('family_id', leave2.newFamilyId).eq('name', "流浪曾孙").maybeSingle();
    if (finalGrandson) {
        console.log("✅ 验证成功：B 离场后，他的曾孙档案依然安全地跟随他回到了自留地。");
    } else {
        console.log("❌ 验证失败：离场后档案丢失。");
    }

    console.log("\n--- 🏁 V8 极限生命周期测试结束 ---");
}

runV8UltimateCycleTest();
