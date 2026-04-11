import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const inviterId = 31; // 老二 (30代, 男)
const familyId = 6;

async function testComplexRel() {
    console.log("--- 验证【表哥的孩子】与【姑父 (姑爷)】逻辑 ---");
    
    // 清理
    await supabase.from('family_members').delete().or('name.ilike.%小小名%,name.ilike.%姑爷%');

    // 1. 添加表哥 (用于作为父节点)
    console.log("\n1. 预设：添加表哥...");
    const resCousin = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: familyId,
            name: "远方表哥",
            relationship: "表哥",
            gender: "male",
            createdByMemberId: inviterId
        })
    });
    const cousinData: any = await resCousin.json();
    console.log("表哥已添加, ID:", cousinData.id);

    // 2. 从表哥角度添加「表哥的孩子」
    console.log("\n2. 添加【表哥的孩子】(表侄)...");
    const resNephew = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: familyId,
            name: "小小名",
            relationship: "表侄",
            gender: "male",
            createdByMemberId: inviterId,
            selectedParentId: cousinData.id // 显式磁吸到表哥名下
        })
    });
    const nephewData: any = await resNephew.json();
    console.log("表侄已添加, 返回:", nephewData);

    // 3. 添加姑父 (姑爷)
    console.log("\n3. 添加【姑父】(姑爷)...");
    const resGuFu = await fetch(`http://localhost:3000/api/family-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            familyId: familyId,
            name: "王姑爷",
            relationship: "姑父",
            gender: "male",
            createdByMemberId: inviterId,
            selectedSide: 'paternal' // 奶奶这边的姑姑的丈夫
        })
    });
    const guFuData: any = await resGuFu.json();
    console.log("姑父已添加, 返回:", guFuData);

    console.log("\n--- 数据深度验证 ---");
    const { data: results } = await supabase.from('family_members').select('*').in('id', [nephewData.id, guFuData.id]);

    for (const m of results || []) {
        console.log(`\n成员: ${m.name} (${m.relationship})`);
        console.log(`- 世代 (G): ${m.generation_num}`);
        console.log(`- 房分 (H): ${m.ancestral_hall}`);
        console.log(`- 父节点 ID: ${m.father_id}`);
        console.log(`- 配偶 ID: ${m.spouse_id}`);

        if (m.relationship === "表侄") {
            if (m.father_id === cousinData.id && m.generation_num === 31) {
                console.log("✅ 表侄逻辑正确：成功吸附到表哥名下，世代下沉一级 (+1)");
            } else {
                console.log("❌ 表侄逻辑异常", { father: m.father_id, gen: m.generation_num });
            }
        }

        if (m.relationship === "姑父") {
            if (m.generation_num === 29 && m.spouse_id) {
                console.log("✅ 姑父逻辑正确：世代上浮一级 (-1)，并自动关联了虚拟/真实姑姑");
                const { data: spouse } = await supabase.from('family_members').select('name').eq('id', m.spouse_id).single();
                console.log(`  - 关联配偶姓名: ${spouse?.name}`);
            } else {
                console.log("❌ 姑父逻辑异常", { gen: m.generation_num, spouse: m.spouse_id });
            }
        }
    }
}

testComplexRel();
