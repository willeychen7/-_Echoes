import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function fixData() {
    console.log("正在修正家族成员原始关系数据...");

    // 1. 修正 K仔 为 陈阿妹的 "外甥女" (之前备注是 侄女)
    const { error: e1 } = await supabase
        .from("family_members")
        .update({
            relationship: "外甥女",
            standard_role: "niece"
        })
        .eq("id", 6);

    if (e1) console.error("Error fixing K仔:", e1);

    // 2. 确保 Win仔 的备注是 "女儿"
    const { error: e2 } = await supabase
        .from("family_members")
        .update({
            relationship: "女儿",
            standard_role: "daughter"
        })
        .eq("id", 5);

    if (e2) console.error("Error fixing Win仔:", e2);

    // 3. 检查并修正 陈阿妹 的角色。如果她是 舅妈，应该标注为 aunt_maternal
    const { error: e3 } = await supabase
        .from("family_members")
        .update({
            standard_role: "aunt_maternal"
        })
        .eq("id", 1);

    if (e3) console.error("Error fixing 陈阿妹:", e3);

    console.log("修正完成。");
}

fixData();
