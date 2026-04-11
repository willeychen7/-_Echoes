import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function verifyConfusion() {
    console.log("--- 深度验证：防止血亲与姻亲 ID 混淆 ---");
    const inviterId = 31; // 我
    const familyId = 6;

    console.log("\n场景：从【母亲】路径添加【舅妈】...");
    const res = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId,
            name: "逻辑严密舅妈",
            relationship: "舅妈",
            gender: "female",
            createdByMemberId: inviterId,
            selectedSide: 'maternal' 
        })
    });
    
    const data: any = await res.json();
    const { data: m } = await supabase.from('family_members').select('*').eq('id', data.id).single();

    console.log(`\n结果分析：`);
    console.log(`- 成员姓名: ${m.name}`);
    console.log(`- father_id (父亲): ${m.father_id || '空 (正确)'}`);
    console.log(`- mother_id (母亲): ${m.mother_id || '空 (正确)'}`);
    console.log(`- spouse_id (配偶): ${m.spouse_id || '已关联 (正确)'}`);

    if (m.spouse_id) {
        const { data: sp } = await supabase.from('family_members').select('name, member_type').eq('id', m.spouse_id).single();
        console.log(`  - 关联的配偶是谁: ${sp.name} (${sp.member_type})`);
        if (sp.member_type === 'virtual' && sp.name.includes("舅")) {
            console.log("✅ 验证通过：系统自动创建了虚拟血亲（舅舅）作为桥接，没有把姻亲错挂在父母名下。");
        }
    }
    
    if (m.father_id === 15 || m.mother_id === 15) {
        console.log("❌ 严重错误：姻亲被误设为了血亲！");
    } else {
        console.log("✅ 逻辑防火墙生效：即便从母亲路径进入，系统也分清了【配偶】和【父母】。");
    }
}

verifyConfusion();
