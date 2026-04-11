import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const userAId = 1; 
const userBId = 2; 

async function runV7StressTest() {
    console.log("--- 🔄 开始：家系生命周期极限循环压力测试 (V7 - 祖先链条全自愈测试) ---");

    // 1. 获取基础成员 ID
    const { data: uA } = await supabase.from('users').select('name, member_id').eq('id', userAId).single();
    const { data: uB } = await supabase.from('users').select('name, member_id').eq('id', userBId).single();
    let memberAId = uA.member_id;
    let memberBId = uB.member_id;
    console.log(`用户 A: ${uA.name} (${memberAId}), 用户 B: ${uB.name} (${memberBId})`);

    // 2. 环境重置 (专用家族)
    const { data: famA } = await supabase.from('families').insert({ name: "V7-家族A", creator_id: userAId }).select().single();
    const { data: famB } = await supabase.from('families').insert({ name: "V7-家族B-主场", creator_id: userBId }).select().single();
    
    await supabase.from('users').update({ family_id: famA.id, home_family_id: famA.id, home_member_id: memberAId }).eq('id', userAId);
    await supabase.from('users').update({ family_id: famB.id, home_family_id: famB.id, home_member_id: memberBId }).eq('id', userBId);
    await supabase.from('family_members').update({ family_id: famA.id }).eq('id', memberAId);
    await supabase.from('family_members').update({ family_id: famB.id }).eq('id', memberBId);

    const apiPost = async (url: string, body: any) => {
        const res = await fetch(`http://localhost:3000${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await res.json();
    };

    console.log("\n3. A 和 B 分别添加一个三代以上的公共始祖 (曾祖/GGF)...");
    const ggfTag = "[F]-f,f,f"; // 曾祖的标准 Logic Tag
    const ggfA = await apiPost('/api/family-members', {
        familyId: famA.id, name: "陈家老根", relationship: "曾祖父", gender: "male", 
        createdByMemberId: memberAId, memberType: "virtual", logicTag: ggfTag, generationNum: 27
    });
    const ggfB = await apiPost('/api/family-members', {
        familyId: famB.id, name: "镜像老根", relationship: "曾祖父", gender: "male", 
        createdByMemberId: memberBId, memberType: "virtual", logicTag: ggfTag, generationNum: 27
    });

    // B 的路径：B -> (父亲) -> (爷爷) -> GGF-B
    // 我们手动设置 B 的父亲，让系统自动补全中间的“爷爷”
    console.log("\n4. B 设置父亲为自动生成的虚拟节点，并挂在 GGF-B 下...");
    const fatherB = await apiPost('/api/family-members', {
        familyId: famB.id, name: "老二的父亲", relationship: "父亲", gender: "male",
        createdByMemberId: memberBId, fatherId: ggfB.id // 故意跳过爷爷，看系统是否能自动补全
    });
    
    // 5. B 加入 A
    console.log("\n5. B 加入 A (首次归并，观察跨代补偿)...");
    const invCode1 = `V7-INV-1-${Date.now()}`;
    await apiPost('/api/family-members', {
        familyId: famA.id, name: "老二(占位)", relationship: "兄弟", inviteCode: invCode1, 
        fatherId: ggfA.id, createdByMemberId: memberAId // 故意让 A 的老二直接挂在高祖下，测试 B 迁入时的纠偏
    });
    await apiPost('/api/accept-invite', { inviteCode: invCode1, userId: userBId, mode: "migrate" });
    
    // 获取纠偏后的 B
    const { data: bInA } = await supabase.from('family_members').select('*').eq('user_id', userBId).eq('family_id', famA.id).single();
    console.log(`B 在 A 家族中的父亲 ID: ${bInA.father_id} (期望应为 GGF-A: ${ggfA.id})`);

    // 6. B 离开 A (分家)
    console.log("\n6. B 离开 A (分家提取行李箱)...");
    const leaveRes = await apiPost('/api/leave-family', { userId: userBId, familyId: famA.id, memberId: bInA.id, takeArchives: true });
    const bNewMeId = leaveRes.newMemberId;
    const { data: bNewMe } = await supabase.from('family_members').select('*').eq('id', bNewMeId).single();
    console.log(`B 已回到主场, 父亲 ID: ${bNewMe.father_id}`);

    // 7. B 在主场添加“堂叔” (GGF 的儿子)
    if (bNewMe.father_id) {
        console.log("\n7. B 在主场添加始祖的另一个儿子 (堂叔)...");
        // 获取 GGF 节点 (B 的父亲的父亲，逻辑上是 f,f,f)
        const { data: myFather } = await supabase.from('family_members').select('father_id').eq('id', bNewMeId).single();
        // 如果 B 直接挂在 GGF 下，由于 V5 报错那里 B 直认 GGF 为父。
        const uncle = await apiPost('/api/family-members', {
            familyId: leaveRes.newFamilyId, name: "行李箱堂叔", relationship: "阿叔", gender: "male", 
            createdByMemberId: bNewMeId, parentId: bNewMe.father_id // 挂在 B 的父亲下
        });
        console.log("堂叔 ID:", uncle.id);

        // 8. B 再次回归 A
        console.log("\n8. B 带着堂叔再次回归 A...");
        const invCode2 = `V7-INV-BACK-${Date.now()}`;
        await apiPost('/api/family-members', {
            familyId: famA.id, name: "老二(回归)", relationship: "兄弟", inviteCode: invCode2, 
            fatherId: ggfA.id, createdByMemberId: memberAId
        });
        await apiPost('/api/accept-invite', { inviteCode: invCode2, userId: userBId, mode: "migrate" });

        const { data: finalUncle } = await supabase.from('family_members').select('*').eq('family_id', famA.id).eq('name', "行李箱堂叔").maybeSingle();
        if (finalUncle) {
            console.log("✅ 成功：堂叔随着 B 成功进入了 A 家族");
            if (finalUncle.father_id === ggfA.id) {
                console.log("✅ 成功：堂叔已重定向挂在 A 的原始高祖节点下。");
            } else {
                console.log("❌ 失败：堂叔父亲 ID 为", finalUncle.father_id, "期望为", ggfA.id);
            }
        } else {
            console.log("❌ 失败：堂叔丢失");
        }
    }

    console.log("\n--- 🏁 祖先链条全自愈压力测试 V7 结束 ---");
}

runV7StressTest();
