import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function repair() {
    console.log("正在修复被误删的系统成员 31...");
    const { data: families } = await supabase.from('families').select('id').limit(1);
    if (!families || families.length === 0) {
        const { data: nF } = await supabase.from('families').insert({ name: "系统锚点", creator_id: 2 }).select().single();
        families!.push(nF);
    }
    const targetFamilyId = families[0].id;
    
    // 检查并恢复
    const { data: existing } = await supabase.from('family_members').select('id').eq('id', 31).maybeSingle();
    if (!existing) {
        await supabase.from('family_members').insert({
            id: 31,
            family_id: targetFamilyId,
            name: "老二",
            relationship: "我",
            is_registered: true,
            user_id: 2,
            generation_num: 30
        });
        console.log("成员 31 已恢复至家族:", targetFamilyId);
    } else {
        console.log("成员 31 仍然存在。");
    }
    
    // 确保用户的 member_id 对齐
    await supabase.from('users').update({ member_id: 31, family_id: targetFamilyId }).eq('id', 2);
    console.log("用户 2 身分对齐完成。");
}

repair();
