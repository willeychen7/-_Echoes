import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const userAId = 1; 
const userBId = 2; 
const memberAId = 1; 
const memberBId = 31; 

async function runAdvancedStressTest() {
    console.log("--- 🚀 开始：虚构森林合并与歧义拦截压力测试 ---");

    // 1. 环境准备
    const { data: familyA } = await supabase.from('families').insert({ name: "家族A-祖宅", creator_id: userAId }).select().single();
    const { data: familyB } = await supabase.from('families').insert({ name: "家族B-个人空间", creator_id: userBId }).select().single();
    
    // 绑定用户到各自家族
    await supabase.from('users').update({ family_id: familyA.id }).eq('id', userAId);
    await supabase.from('users').update({ family_id: familyB.id }).eq('id', userBId);
    await supabase.from('family_members').update({ family_id: familyA.id }).eq('id', memberAId);
    await supabase.from('family_members').update({ family_id: familyB.id }).eq('id', memberBId);

    console.log(`家族A: ${familyA.id}, 家族B: ${familyB.id}`);

    // 2. A 和 B 分别添加同一个高祖 (G26)
    console.log("\n2. A 和 B 分别在各自家族添加高祖父...");
    
    const addGGF = async (fId: number, mId: number, name: string) => {
        const res = await fetch(`http://localhost:3000/api/family-members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                familyId: fId, name: name, relationship: "曾祖的父亲", gender: "male", createdByMemberId: mId, memberType: "virtual"
            })
        });
        return await res.json();
    };

    const ggfA = await addGGF(familyA.id, memberAId, "陈家始祖");
    const ggfB = await addGGF(familyB.id, memberBId, "远方始祖");
    console.log(`家族A高祖 ID: ${ggfA.id}, 家族B高祖 ID: ${ggfB.id}`);

    // 3. 歧义测试：添加“亲戚”
    console.log("\n3. 测试：添加称谓模糊的人物 (亲戚)...");
    const resAmbiguous = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: familyA.id, name: "路人甲", relationship: "亲戚", createdByMemberId: memberAId
        })
    });
    const ambData = await resAmbiguous.json();
    if (ambData.needDisambiguation) {
        console.log("✅ 歧义拦截成功：系统跳出了提醒:", ambData.message);
    } else {
        console.log("❌ 歧义拦截失败:", ambData);
    }

    // 4. 重大测试：B 携带行李加入 A (模拟认亲)
    console.log("\n4. 重大测试：B 携带行李加入家族 A (验证深度递归合并)...");
    
    // 我们需要构造一个合法的邀请场景
    // A 邀请 B，B 在 A 家族中原本有个占位符
    const inviteCode = `TEST-INVITE-${Date.now()}`;
    const { data: placeholder } = await supabase.from('family_members').insert({
        family_id: familyA.id,
        name: "老二(在A家的占位)",
        relationship: "堂弟",
        invite_code: inviteCode,
        is_registered: false,
        father_id: ggfA.id // 假设他们在始祖处汇合
    }).select().single();

    // 同时 B 在家里的父亲也得对齐，这样合拢时才会触发 mergeVirtualNodes
    await supabase.from('family_members').update({ father_id: ggfB.id }).eq('id', memberBId);

    console.log("正在执行 accept-invite...");
    const resJoin = await fetch(`http://localhost:3000/api/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            inviteCode: inviteCode,
            userId: userBId,
            mode: "migrate"
        })
    });
    const joinResult = await resJoin.json();
    console.log("加入结果:", joinResult);

    // 验证：B 的父亲 (ggfB.id) 是否被合并到了 A 的对应节点 (ggfA.id)？
    const { data: checkGGFB } = await supabase.from('family_members').select('*').eq('id', ggfB.id).maybeSingle();
    if (!checkGGFB) {
        console.log("✅ 始祖深度归并成功：B 的冗余始祖节点已被安全销毁，且所有关系已重定向。");
    } else {
        console.log("❌ 始祖合并失败：B 的虚拟始祖节点依然独立存在于家族", checkGGFB.family_id);
    }
    
    // 验证 B 的新成员 ID 是否挂在了正确的父节点上
    const { data: bNewRecord } = await supabase.from('family_members').select('father_id').eq('user_id', userBId).eq('family_id', familyA.id).single();
    if (bNewRecord.father_id === ggfA.id) {
        console.log("✅ 关系链对齐成功：B 在新家族中已正确挂接在合并后的始祖节点下。");
    } else {
        console.log("❌ 关系链断裂：B 的父节点 ID 为", bNewRecord.father_id, "期望值为", ggfA.id);
    }

    console.log("\n--- 🏁 终极测试结束 ---");
}

runAdvancedStressTest();
