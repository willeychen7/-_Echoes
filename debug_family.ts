import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function debugFamily() {
    // 查询所有家族成员的关键字段
    const { data: members, error } = await supabase
        .from("family_members")
        .select("id, name, relationship, standard_role, father_id, mother_id, user_id, gender, birth_date")
        .order("id");

    if (error) { console.error("Error:", error); return; }

    console.log("\n=== 所有家族成员 ===");
    members?.forEach(m => {
        console.log(`ID:${m.id} | 名字:${m.name} | relationship:${m.relationship} | standard_role:${m.standard_role} | gender:${m.gender} | father_id:${m.father_id} | mother_id:${m.mother_id} | user_id:${m.user_id}`);
    });

    // 检查是否有 created_by_member_id 字段（关键字段）
    const { data: raw } = await supabase
        .from("family_members")
        .select("*")
        .limit(1);

    if (raw && raw[0]) {
        console.log("\n=== 数据库字段列表 ===");
        console.log(Object.keys(raw[0]).join(", "));
    }
}

debugFamily();
