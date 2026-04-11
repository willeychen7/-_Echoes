import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const inviterId = 31; // 老二 (30代)
const familyId = 6;

async function runExperiment() {
    console.log("--- 1. 老二添加「堂叔陈全蛋」 ---");
    // 模拟后端 resolveRigorousRel 对「堂叔」的处理
    // 目前逻辑会将「堂叔」映射为 uncle (生成 Gen 29 并连接到爷爷作为兄弟)
    
    // 我们先清理一下之前的测试数据
    await supabase.from('family_members').delete().eq('name', '陈全蛋');
    await supabase.from('family_members').delete().eq('name', '陈大爷');
    await supabase.from('family_members').delete().like('name', '%的父亲%');

    // 1. 添加堂叔
    const { data: tangshu } = await supabase.from('family_members').insert({
        family_id: familyId,
        name: "陈全蛋",
        relationship: "堂叔",
        gender: "male",
        added_by_member_id: inviterId,
        generation_num: 29
    }).select().single();

    console.log(`已添加堂叔: ${tangshu.name}`);

    console.log("\n--- 2. 老二添加「爷爷的兄弟陈大爷」 ---");
    // 模拟添加爷爷的兄弟
    // 假设用户先找到爷爷 (ID 16), 然后给爷爷添加兄弟
    const grandpaId = 16;
    const { data: daye } = await supabase.from('family_members').insert({
        family_id: familyId,
        name: "陈大爷",
        relationship: "兄弟",
        gender: "male",
        added_by_member_id: inviterId,
        generation_num: 28 // 爷爷是 28代
    }).select().single();

    console.log(`已添加爷爷的兄弟: ${daye.name}`);

    // 检查逻辑连接
    const { data: all } = await supabase.from('family_members').select('*').eq('family_id', familyId);
    
    console.log("\n--- 3. 检查当前节点间的父亲关系 ---");
    const getDad = (id) => all.find(m => m.id === id)?.father_id;
    const getName = (id) => all.find(m => m.id === id)?.name || "无";

    console.log(`陈全蛋 的父亲 ID: ${getDad(tangshu.id)} (${getName(getDad(tangshu.id))})`);
    console.log(`陈大爷 的父亲 ID: ${getDad(daye.id)} (${getName(getDad(daye.id))})`);
    console.log(`爷爷 (ID 16) 的父亲 ID: ${getDad(16)} (${getName(getDad(16))})`);

    console.log("\n结论：如果不进行手动关联，系统目前会自动为‘陈全蛋’和‘陈大爷’分别创建虚拟父辈节点，它们目前是‘断开’的。");
}

runExperiment();
