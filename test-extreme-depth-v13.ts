import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const userAId = 1; 
const userBId = 2; 

async function runV13Stress() {
    console.log("--- 🔄 开始：V13 极端代际深度压力测试 ---");

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
    const { data: uB_meta } = await supabase.from('users').select('*').eq('id', userBId).single();
    
    // 确保 B 的家和身份是活跃的
    const { data: bHomeMember } = await supabase.from('family_members').select('*').eq('id', uB_meta.home_member_id).maybeSingle();
    let effectiveBId = uB_meta.home_member_id;
    
    if (!bHomeMember) {
        console.log("   - B 的主场身份缺失，正在重建...");
        const { data: newB } = await supabase.from('family_members').insert({
            id: uB_meta.home_member_id, // 尝试恢复原 ID
            family_id: uB_meta.home_family_id,
            name: uB_meta.name,
            user_id: userBId,
            is_registered: true,
            member_type: 'human',
            relationship: '我',
            generation_num: 30
        }).select().single();
        effectiveBId = newB.id;
    } else {
        await supabase.from('family_members').update({ is_registered: true, family_id: uB_meta.home_family_id, generation_num: 30 }).eq('id', uB_meta.home_member_id);
    }

    await supabase.from('users').update({ family_id: uB_meta.home_family_id, member_id: effectiveBId }).eq('id', userBId);
    // 清理非 B 本人的虚拟人物
    await supabase.from('family_members').delete().eq('family_id', uB_meta.home_family_id).neq('id', effectiveBId).eq('is_registered', false);

    // 1. 构建 10 代祖先链
    console.log("1. 在自留地构建 10 代祖先链...");
    let currentChildId = effectiveBId;
    const ancestors = [];
    for (let i = 1; i <= 10; i++) {
        const result = await apiPost('/api/family-members', {
            familyId: uB_meta.home_family_id,
            name: `十世祖-${i}`,
            relationship: "父亲",
            gender: "male",
            createdByMemberId: currentChildId 
        });
        console.log(`   - 已添加第 ${i} 代祖先: ${result.name}, ID: ${result.id}`);
        ancestors.push(result);
        currentChildId = result.id;
    }

    // 2. 验证自留地初始深度
    const { data: p10_home } = await supabase.from('family_members').select('generation_num').eq('id', ancestors[9].id).single();
    console.log(`✅ 初始深度验证：最远祖先代际为 ${p10_home.generation_num}`);

    // 3. 准备家族 A
    const { data: uA_meta } = await supabase.from('users').select('name').eq('id', userAId).single();
    const { data: famA } = await supabase.from('families').insert({ name: "极端代际验证族", creator_id: userAId }).select().single();
    const { data: uA_member } = await supabase.from('family_members').insert({
        family_id: famA.id, name: uA_meta.name, relationship: "创建者", is_registered: true, user_id: userAId, standard_role: "creator"
    }).select().single();

    // 4. B 加入 A (携带整个 10 代链条)
    console.log("\n2. B 携带 10 代祖先链条加入家族 A...");
    const invCode = `V13-EXTREME-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "陈老二(深层版)", relationship: "堂弟", inviteCode: invCode, createdByMemberId: uA_member.id 
    });
    await apiPost('/api/accept-invite', { inviteCode: invCode, userId: userBId, mode: "migrate" });

    // 5. 校验 Family A 中的深度
    console.log("\n3. 校验 Family A 中的迁移结果...");
    const { data: membersInA } = await supabase.from('family_members').select('*').eq('family_id', famA.id).order('generation_num', { ascending: true });
    
    console.log(`   - 家族 A 总人数: ${membersInA?.length}`);
    const bInA = membersInA?.find(m => m.user_id === userBId);
    console.log(`   - B 在家族 A 中的 ID: ${bInA?.id}, 代际: ${bInA?.generation_num}`);

    const ancestorsInA = membersInA?.filter(m => m.name.startsWith("十世祖-"));
    console.log(`   - 成功迁移的祖先数量: ${ancestorsInA?.length} / 10`);

    if (ancestorsInA?.length === 10) {
        console.log("✅ 校验 1：所有 10 代祖先均已成功同步。");
    } else {
        console.log("❌ 校验 1：祖先链条丢失！");
    }

    // 检查链条逻辑：B -> P1 -> P2 -> ... -> P10
    let linkOk = true;
    let scanId = bInA?.id;
    for (let i = 1; i <= 10; i++) {
        const { data: curr } = await supabase.from('family_members').select('father_id').eq('id', scanId).single();
        const targetAncestor = ancestorsInA?.find(a => a.name === `十世祖-${i}`);
        if (curr?.father_id === targetAncestor?.id) {
            // console.log(`      [Link OK] ${i}: B descendants sequence matches.`);
            scanId = targetAncestor?.id;
        } else {
            console.log(`❌ 校验 2：第 ${i} 代祖先连线断裂！期望 father_id: ${targetAncestor?.id}, 实际: ${curr?.father_id}`);
            linkOk = false;
            break;
        }
    }

    if (linkOk) {
        console.log("✅ 校验 2：10 代祖先父子连线完美闭合。");
    }

    console.log("\n--- 🏁 V13 极端深度压力测试结束 ---");
}

runV13Stress().catch(console.error);
