import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const userAId = 1; 
const userBId = 2; 

async function runV12Stress() {
    console.log("--- 🔄 开始：V12 档案全生命周期压力测试 (双系统验证版) ---");

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

    // 0. 环境恢复
    const { data: uA_meta } = await supabase.from('users').select('name, home_family_id, home_member_id').eq('id', userAId).single();
    const { data: uB_meta } = await supabase.from('users').select('name, home_family_id, home_member_id').eq('id', userBId).single();

    await supabase.from('users').update({ family_id: uA_meta.home_family_id, member_id: uA_meta.home_member_id, relationship: "我" }).eq('id', userAId);
    await supabase.from('users').update({ family_id: uB_meta.home_family_id, member_id: uB_meta.home_member_id, relationship: "我" }).eq('id', userBId);
    await supabase.from('family_members').update({ is_registered: true, family_id: uA_meta.home_family_id }).eq('id', uA_meta.home_member_id);
    await supabase.from('family_members').update({ is_registered: true, family_id: uB_meta.home_family_id }).eq('id', uB_meta.home_member_id);
    await supabase.from('family_members').delete().eq('family_id', uB_meta.home_family_id).eq('is_registered', false);

    // 1. 准备：自留地添加【老二媳妇】
    console.log("1. 自留地准备：添加【老二媳妇】...");
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

    // 2. 准备：家族 A
    console.log("2. 外部主族 A 准备...");
    const baseSuffix = `_V12_${Date.now().toString().slice(-4)}`;
    const { data: famA } = await supabase.from('families').insert({ name: "陈氏主族" + baseSuffix, creator_id: userAId }).select().single();
    const { data: uA_new_member } = await supabase.from('family_members').insert({
        family_id: famA.id, name: uA_meta.name, relationship: "创建者", is_registered: true, user_id: userAId, standard_role: "creator"
    }).select().single();
    await supabase.from('users').update({ family_id: famA.id, member_id: uA_new_member.id }).eq('id', userAId);

    // 3. 首次加入：B -> A (归宗)
    console.log("\n3. 步骤一：B 首次加入 A (归宗迁移)...");
    const inv1 = `V12-INV-1-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "陈老二", relationship: "堂弟", inviteCode: inv1, createdByMemberId: uA_new_member.id 
    });
    await apiPost('/api/accept-invite', { inviteCode: inv1, userId: userBId, mode: "migrate" });

    // 验证 1：自留地数据是否还在？(应还在)
    const { data: wifeStillInHome } = await supabase.from('family_members').select('id').eq('family_id', uB_meta.home_family_id).eq('name', "老二媳妇").maybeSingle();
    if (wifeStillInHome) console.log("✅ 验证 1：自留地【老二媳妇】依然通过影子或实体保留。");
    else console.log("❌ 验证 1：自留地数据丢失！说明使用了物理移动而非克隆。");

    // 4. 在野期间：B 离开 A，并添加新人物
    console.log("\n4. 步骤二：B 离开 A，并在自留地新增【老二长子】...");
    const { data: bInA } = await supabase.from('family_members').select('id').eq('user_id', userBId).eq('family_id', famA.id).single();
    await apiPost('/api/leave-family', { userId: userBId, familyId: famA.id, memberId: bInA.id, takeArchives: true });
    
    const { data: uB_now } = await supabase.from('users').select('family_id, member_id').eq('id', userBId).single();
    console.log(`DEBUG: B is currently in Family ${uB_now.family_id}, Member ${uB_now.member_id}`);
    const son = await apiPost('/api/family-members', {
        familyId: uB_now.family_id, name: "老二长子", relationship: "儿子", gender: "male", createdByMemberId: uB_now.member_id
    });

    // 5. 再次加入：B -> A (行李合龙)
    console.log("\n5. 步骤三：B 再次加入 A (验证关系链合龙)...");
    const inv2 = `V12-INV-2-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "陈老二(归来)", relationship: "堂弟", inviteCode: inv2, createdByMemberId: uA_new_member.id 
    });
    await apiPost('/api/accept-invite', { inviteCode: inv2, userId: userBId, mode: "migrate" });

    // 6. 核心校验环节
    console.log("\n6. 深度校验：");

    const { data: bFinalInA } = await supabase.from('family_members').select('id').eq('user_id', userBId).eq('family_id', famA.id).single();
    const { data: sonInA } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "老二长子").single();
    
    // 验证 2：父亲 ID 是否指向新坑位？
    if (sonInA.father_id === bFinalInA.id) {
        console.log(`✅ 验证 2：【老二长子】的 father_id 正确指向了 B 在 A 中的新档案 ID: ${bFinalInA.id}`);
    } else {
        console.log(`❌ 验证 2：关系链断裂！长子父亲 (${sonInA.father_id}) 未能映射到新坑位 (${bFinalInA.id})`);
    }

    // 验证 3：媳妇是否发生重复？
    const { data: wives } = await supabase.from('family_members').select('id').eq('family_id', famA.id).eq('name', "老二媳妇");
    if (wives?.length === 1) {
        console.log("✅ 验证 3：【老二媳妇】无重复，迁移归并正常。");
    } else {
        console.log(`❌ 验证 3：检测到 ${wives?.length} 个重复档案！归并逻辑失效。`);
    }

    console.log("\n--- 🏁 V12 压力测试结束 ---");
}

runV12Stress().catch(console.error);
