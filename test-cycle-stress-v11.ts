import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const userAId = 1; 
const userBId = 2; 

async function runV11Stress() {
    console.log("--- 🔄 开始：V11 档案循环生命周期压力测试 (环境自清理版) ---");

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

    // 0. 环境恢复：将 A 和 B 踢回他们的 home 空间，确保无历史瓜葛
    console.log("0. 环境恢复：重置 A 和 B 的主场状态...");
    const { data: uA_meta } = await supabase.from('users').select('name, home_family_id, home_member_id').eq('id', userAId).single();
    const { data: uB_meta } = await supabase.from('users').select('name, home_family_id, home_member_id').eq('id', userBId).single();

    // 强制更新 users 表，让他们回到各自的 home_family_id
    await supabase.from('users').update({ 
        family_id: uA_meta.home_family_id, 
        member_id: uA_meta.home_member_id, 
        relationship: "我" 
    }).eq('id', userAId);
    await supabase.from('users').update({ 
        family_id: uB_meta.home_family_id, 
        member_id: uB_meta.home_member_id, 
        relationship: "我" 
    }).eq('id', userBId);
    
    // 确保各自的 member 记录也是 registered 状态
    await supabase.from('family_members').update({ is_registered: true, family_id: uA_meta.home_family_id }).eq('id', uA_meta.home_member_id);
    await supabase.from('family_members').update({ is_registered: true, family_id: uB_meta.home_family_id }).eq('id', uB_meta.home_member_id);

    // 清理 B 自留地里的所有虚拟人物 (还原纯净自留地)
    await supabase.from('family_members').delete().eq('family_id', uB_meta.home_family_id).eq('is_registered', false);

    // 1. 在 B 的自留地重新添加【老二媳妇】
    console.log("1. 在 B 自留地重新添加【老二媳妇】...");
    const { data: wifeB } = await supabase.from('family_members').insert({
        family_id: uB_meta.home_family_id,
        name: "老二媳妇",
        relationship: "妻子",
        gender: "female",
        is_registered: false,
        member_type: 'virtual',
        added_by_member_id: uB_meta.home_member_id
    }).select().single();
    await supabase.from('family_members').update({ spouse_id: wifeB.id }).eq('id', uB_meta.home_member_id);

    // 2. 准备 A 家族
    console.log("2. 准备专用测试 A 家族...");
    const baseSuffix = `_V11_${Date.now().toString().slice(-4)}`;
    const { data: famA } = await supabase.from('families').insert({ name: "陈氏主族" + baseSuffix, creator_id: userAId }).select().single();
    // A 入驻 A
    const { data: uA_new_member } = await supabase.from('family_members').insert({
        family_id: famA.id,
        name: uA_meta.name,
        relationship: "创建者",
        is_registered: true,
        user_id: userAId,
        standard_role: "creator"
    }).select().single();
    await supabase.from('users').update({ family_id: famA.id, member_id: uA_new_member.id }).eq('id', userAId);

    // 3. 步骤一：B 首次加入 A
    console.log("\n3. 步骤一：B 首次加入 A 家族 (携带【老二媳妇】)...");
    const inv1 = `V11-INV-1-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "陈老二", relationship: "堂弟", inviteCode: inv1, createdByMemberId: uA_new_member.id 
    });
    await apiPost('/api/accept-invite', { inviteCode: inv1, userId: userBId, mode: "migrate" });

    // 验证媳妇是否跟过来了
    const { data: wifeInA } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "老二媳妇").maybeSingle();
    if (wifeInA) {
        console.log(`✅ 校验：【老二媳妇】已同步到 A 家族，ID: ${wifeInA.id}`);
    } else {
        console.log("❌ 严重：【老二媳妇】丢失！");
        // 这里查找原因
        const { data: allInA } = await supabase.from('family_members').select('name').eq('family_id', famA.id);
        console.log("A 家族目前成员:", allInA?.map(m => m.name));
        process.exit(1);
    }

    // 4. 步骤二：B 离开 A
    console.log("\n4. 步骤二：B 离开 A 并带走行李...");
    const { data: bInA } = await supabase.from('family_members').select('id').eq('user_id', userBId).eq('family_id', famA.id).single();
    await apiPost('/api/leave-family', { userId: userBId, familyId: famA.id, memberId: bInA.id, takeArchives: true });
    
    // 5. 步骤三：B 在分家期间，添加新人物【老二长子】
    console.log("\n5. 步骤三：B 在自留地添加了新人物【老二长子】...");
    const { data: uB_final } = await supabase.from('users').select('family_id, member_id').eq('id', userBId).single();
    const son = await apiPost('/api/family-members', {
        familyId: uB_final.family_id, 
        name: "老二长子", 
        relationship: "儿子", 
        gender: "male",
        createdByMemberId: uB_final.member_id
    });
    console.log(`✅ 【老二长子】录入完成，ID: ${son.id}`);

    // 6. 步骤四：重头戏 - B 再次加入 A
    console.log("\n6. 步骤四：B 再次加入 A 家族 (验证合并逻辑)...");
    const inv2 = `V11-INV-2-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "陈老二(归来)", relationship: "堂弟", inviteCode: inv2, createdByMemberId: uA_new_member.id 
    });
    await apiPost('/api/accept-invite', { inviteCode: inv2, userId: userBId, mode: "migrate" });

    // 7. 详细验证 (矛盾与歧义检查)
    console.log("\n7. 深度验证环节：");
    
    // A. 检查【老二媳妇】在 A 家族中是否有多个
    const { data: wivesInA_final } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "老二媳妇");
    console.log(`   - A 家族中【老二媳妇】数量: ${wivesInA_final?.length} (期望: 1)`);
    if (wivesInA_final && wivesInA_final.length > 1) {
        console.log("❌ 警告：检测到重复档案！说明合并失效。");
    } else {
        console.log("✅ 校验：档案成功合并或复用。");
    }

    // B. 检查【老二长子】是否成功入驻 A
    const { data: sonInA } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "老二长子").maybeSingle();
    if (sonInA) {
        console.log(`✅ 校验：【老二长子】已同步入驻 A 家族`);
        const { data: bInAFinal } = await supabase.from('family_members').select('id').eq('user_id', userBId).eq('family_id', famA.id).single();
        if (sonInA.father_id === bInAFinal.id) {
            console.log(`✅ 关系链对齐：长子的父亲指向了 B 在 A 的新身份`);
        } else {
            console.log(`❌ 关系链断裂：长子的父亲 ID 错误。`);
        }
    } else {
        console.log("❌ 严重：【老二长子】丢失！");
    }

    console.log("\n--- 🏁 V11 压力测试结束 ---");
}

runV11Stress().catch(console.error);
