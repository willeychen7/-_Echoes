import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function runUltimateKinshipStress() {
    console.log("--- 🌋 极限关系逻辑压力测试 (V3.1) ---");
    const userId = 1;
    const memberId = 1;
    const familyId = 1;

    const addMember = async (payload: any) => {
        const res = await fetch(`http://localhost:3000/api/family-members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) console.error("API Error:", data.error);
        return data;
    };

    // A. 测试：闭环关系预防
    console.log("\n1. 测试：预防闭环关系...");
    const ggf = await addMember({ familyId, name: "闭环始祖", relationship: "曾祖的父亲", createdByMemberId: memberId });
    if (!ggf.id) { console.log("创建始祖失败，停止测试。"); return; }
    console.log("始祖 ID:", ggf.id);

    const loopData = await addMember({ familyId, name: "虚假的爹", relationship: "爹", createdByMemberId: ggf.id, selectedParentId: memberId });
    console.log("闭环添加结果 (预期应被结构对齐或拦截):", loopData.success ? "成功(注意是否有环)" : (loopData.error || "拦截"));

    // B. 测试：碎片拼接
    console.log("\n2. 测试：碎片拼接 (先加玄孙，再补中间代)...");
    const gss = await addMember({ familyId, name: "隔空玄孙", relationship: "玄孙", createdByMemberId: memberId });
    console.log("玄孙 ID:", gss.id); 

    console.log("添加中间层：孙子...");
    const gsData = await addMember({ familyId, name: "补位孙子", relationship: "孙子", createdByMemberId: memberId });
    console.log("补位孙子 ID:", gsData.id);

    // 验证逻辑
    const { data: gssRec } = await supabase.from('family_members').select('father_id, mother_id').eq('id', gss.id).single();
    if (gssRec && (gssRec.father_id || gssRec.mother_id)) {
        const parentId = gssRec.father_id || gssRec.mother_id;
        const { data: pRec } = await supabase.from('family_members').select('father_id, mother_id').eq('id', parentId).single();
        if (pRec && (pRec.father_id || pRec.mother_id)) {
             const gParentId = pRec.father_id || pRec.mother_id;
             if (gParentId === gsData.id) {
                 console.log("✅ 成功：碎片自动拼接对齐。");
             } else {
                 console.log("❌ 拼接失败：期望父辈为", gsData.id, "实际为", gParentId);
             }
        } else {
             console.log("❌ 曾孙级桥梁缺失");
        }
    } else {
        console.log("❌ 玄孙父辈缺失");
    }

    console.log("\n--- 🏁 极限压力测试结束 ---");
}

runUltimateKinshipStress();
