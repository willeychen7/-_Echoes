import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const userAId = 1; 
const userBId = 2; 

async function runV10ArchiveCycleTest() {
    console.log("--- 🔄 开始：V10 档案循环生命周期压力测试 (进进出出+中加人+重复入驻) ---");

    // 1. 获取基础成员 ID
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

    // 2. 环境准备：创建独立的家族
    console.log("2. 建立专用测试家族...");
    const baseSuffix = `_V10_${Date.now().toString().slice(-4)}`;
    const { data: famA } = await supabase.from('families').insert({ name: "陈氏主族" + baseSuffix, creator_id: userAId }).select().single();
    const { data: famB_base } = await supabase.from('families').insert({ name: "老二自留地" + baseSuffix, creator_id: userBId }).select().single();
    
    // 初始化锚点
    await supabase.from('users').update({ family_id: famA.id, home_family_id: famA.id, home_member_id: memberAId }).eq('id', userAId);
    await supabase.from('users').update({ family_id: famB_base.id, home_family_id: famB_base.id, home_member_id: memberBId }).eq('id', userBId);
    await supabase.from('family_members').update({ family_id: famA.id }).eq('id', memberAId);
    await supabase.from('family_members').update({ family_id: famB_base.id }).eq('id', memberBId);

    // 在 B 的自留地里先加一个“老二媳妇”
    console.log("   - 在 B 自留地添加【老二媳妇】");
    const { data: wifeB } = await supabase.from('family_members').insert({
        family_id: famB_base.id,
        name: "老二媳妇",
        relationship: "妻子",
        gender: "female",
        is_registered: false,
        member_type: 'virtual',
        added_by_member_id: memberBId
    }).select().single();
    await supabase.from('family_members').update({ spouse_id: wifeB.id }).eq('id', memberBId);

    // 3. 步骤一：B 首次加入 A
    console.log("\n3. 步骤一：B 首次加入 A 家族 (携带【老二媳妇】)...");
    const inv1 = `V10-INV-1-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "陈老二", relationship: "堂弟", inviteCode: inv1, createdByMemberId: memberAId 
    });
    await apiPost('/api/accept-invite', { inviteCode: inv1, userId: userBId, mode: "migrate" });

    // 验证媳妇是否跟过来了
    const { data: wifeInA } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "老二媳妇").single();
    console.log(`✅ 校验：【老二媳妇】已同步到 A 家族，ID: ${wifeInA.id}`);

    // 4. 步骤二：B 离开 A
    console.log("\n4. 步骤二：B 离开 A 并带走行李...");
    const { data: bInA } = await supabase.from('family_members').select('*').eq('user_id', userBId).eq('family_id', famA.id).single();
    await apiPost('/api/leave-family', { userId: userBId, familyId: famA.id, memberId: bInA.id, takeArchives: true });
    
    // 检查 A 家族中原来的【老二媳妇】是否还在 (应作为 Ghost 存在)
    const { data: ghostWife } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "老二媳妇").maybeSingle();
    if (ghostWife) {
        console.log(`✅ 校验：旧的【老二媳妇】作为 Ghost 留在 A 家族，ID: ${ghostWife.id}`);
    } else {
        console.log("ℹ️ 说明：旧的【老二媳妇】在 B 离开时被清理或移除（这取决于系统清理策略）");
    }

    // 5. 步骤三：B 在分家期间，添加新人物【老二长子】
    console.log("\n5. 步骤三：B 在自留地添加了新人物【老二长子】...");
    const { data: uB_after_leave } = await supabase.from('users').select('family_id, member_id').eq('id', userBId).single();
    const son = await apiPost('/api/family-members', {
        familyId: uB_after_leave.family_id, 
        name: "老二长子", 
        relationship: "儿子", 
        gender: "male",
        createdByMemberId: uB_after_leave.member_id
    });
    console.log(`✅ 【老二长子】录入完成，ID: ${son.id}`);

    // 6. 步骤四：重头戏 - B 再次加入 A
    console.log("\n6. 步骤四：B 再次加入 A 家族 (验证是否会与旧的【老二媳妇】等人物产生冲突)...");
    const inv2 = `V10-INV-2-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "陈老二(归来)", relationship: "堂弟", inviteCode: inv2, createdByMemberId: memberAId 
    });
    await apiPost('/api/accept-invite', { inviteCode: inv2, userId: userBId, mode: "migrate" });

    // 7. 详细验证 (矛盾与歧义检查)
    console.log("\n7. 深度验证环节：");
    
    // A. 检查【老二媳妇】在 A 家族中有几个？(应仅有一个，且已被合并或重用)
    const { data: wivesInA_final } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "老二媳妇");
    console.log(`   - A 家族中【老二媳妇】数量: ${wivesInA_final?.length} (期望: 1)`);
    if (wivesInA_final && wivesInA_final.length > 1) {
        console.log("⚠️ 警告：检测到重复档案！");
        wivesInA_final.forEach(w => console.log(`      ID: ${w.id}, added_by: ${w.added_by_member_id}`));
    }

    // B. 检查【老二长子】是否成功入驻 A
    const { data: sonInA } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "老二长子").maybeSingle();
    if (sonInA) {
        console.log(`✅ 校验：【老二长子】已入驻 A 家族`);
        const { data: bInAFinal } = await supabase.from('family_members').select('*').eq('user_id', userBId).eq('family_id', famA.id).single();
        if (sonInA.father_id === bInAFinal.id) {
            console.log(`✅ 关系链验证：长子的父亲正确指向了 B 的新身份 ID: ${bInAFinal.id}`);
        } else {
            console.log(`❌ 关系链错误：长子的父亲 (${sonInA.father_id}) 不匹配 B 的新身份 (${bInAFinal.id})`);
        }
    } else {
        console.log("❌ 验证失败：【老二长子】未同步至 A 家族。");
    }

    // C. 检查【老二媳妇】的配偶关系是否还在
    const finalWife = wivesInA_final?.[0];
    const { data: bInAFinal_C } = await supabase.from('family_members').select('*').eq('user_id', userBId).eq('family_id', famA.id).single();
    if (finalWife && finalWife.spouse_id === bInAFinal_C.id) {
        console.log(`✅ 关系链验证：媳妇的丈夫正确指向了 B 的新身份`);
    } else {
        console.log(`❌ 关系链错误：媳妇的丈夫关系丢失或错误。Wife spouse_id: ${finalWife?.spouse_id}, B member_id: ${bInAFinal_C.id}`);
    }

    // 8. 步骤五：最后一次撤离，验证“扫地出门”逻辑
    console.log("\n8. 步骤五：B 再次离开 A 家族 (最后清理验证)...");
    await apiPost('/api/leave-family', { userId: userBId, familyId: famA.id, memberId: bInAFinal_C.id, takeArchives: true });
    
    // 检查自留地里的人物数量
    const { data: bHomeAfterFinal } = await supabase.from('users').select('family_id').eq('id', userBId).single();
    const { data: homeMembers } = await supabase.from('family_members').select('name').eq('family_id', bHomeAfterFinal.family_id);
    console.log(`✅ 校验：B 回归自留地，目前该空间有人物: ${homeMembers?.map(m => m.name).join(', ')}`);

    console.log("\n--- 🏁 V10 档案循环生命周期压力测试结束 ---");
}

runV10ArchiveCycleTest().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
