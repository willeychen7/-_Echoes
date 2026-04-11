import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function repair() {
    console.log("🛠️  全面修复测试环境...");

    // 1. 确保家族 1 和 2 存在
    const { data: fam1 } = await supabase.from('families').upsert({ id: 1, name: "陈家大院", creator_id: 1 }).select().single();
    const { data: fam2 } = await supabase.from('families').upsert({ id: 2, name: "老二空间", creator_id: 2 }).select().single();

    // 2. 清理并重建 Member 1
    await supabase.from('family_members').delete().eq('id', 1);
    const { data: m1 } = await supabase.from('family_members').insert({
        id: 1, family_id: 1, name: "陈阿妹", relationship: "我", is_registered: true, user_id: 1, gender: "female", generation_num: 30
    }).select().single();

    // 3. 清理并重建 Member 31
    await supabase.from('family_members').delete().eq('id', 31);
    const { data: m31 } = await supabase.from('family_members').insert({
        id: 31, family_id: 2, name: "老二", relationship: "我", is_registered: true, user_id: 2, gender: "male", generation_num: 30
    }).select().single();

    // 4. 更新 User 指针
    await supabase.from('users').update({ family_id: 1, member_id: 1, home_family_id: 1, home_member_id: 1 }).eq('id', 1);
    await supabase.from('users').update({ family_id: 2, member_id: 31, home_family_id: 2, home_member_id: 31 }).eq('id', 2);

    console.log("✅ 修复完成：用户 1 -> 成员 1, 用户 2 -> 成员 31。");
}

repair();
