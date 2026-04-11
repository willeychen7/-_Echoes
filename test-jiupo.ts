import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const inviterId = 31; // 老二 (30代, 男)
const familyId = 6;

async function testJiuPo() {
    console.log("--- 验证「舅婆」添加逻辑 ---");
    
    // 清理
    await supabase.from('family_members').delete().ilike('name', '%舅婆%');

    console.log("\n1. 添加【父系舅婆】(奶奶那边的)");
    const resP = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: familyId,
            name: "陈家舅婆",
            relationship: "舅婆",
            gender: "female",
            createdByMemberId: inviterId,
            selectedSide: 'paternal'
        })
    });
    const dataP: any = await resP.json();
    console.log("父系返回:", dataP);

    console.log("\n2. 添加【母系舅婆】(外婆那边的)");
    const resM = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: familyId,
            name: "李家舅婆",
            relationship: "舅婆",
            gender: "female",
            createdByMemberId: inviterId,
            selectedSide: 'maternal'
        })
    });
    const dataM: any = await resM.json();
    console.log("母系返回:", dataM);

    console.log("\n--- 数据验证 ---");
    const { data: members } = await supabase.from('family_members').select('*').in('id', [dataP.id, dataM.id]);
    
    for (const m of members || []) {
        console.log(`\n成员: ${m.name} (${m.relationship})`);
        console.log(`- 世代: ${m.generation_num}`);
        console.log(`- 父节点: ${m.father_id}`);
        console.log(`- 母节点: ${m.mother_id}`);
        console.log(`- 配偶节点: ${m.spouse_id}`);

        if (m.spouse_id) {
            const { data: spouse } = await supabase.from('family_members').select('name').eq('id', m.spouse_id).single();
            console.log(`  - 配偶名称 (舅公): ${spouse?.name}`);
        }
    }
}

testJiuPo();
