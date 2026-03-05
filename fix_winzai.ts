
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function fixData() {
    console.log("--- Fixing Data Anomalies ---");

    // 1. 修正 Win仔 (ID 5) 的原始关系。她是陈阿妹创建的，陈阿妹应该叫她“女儿”
    const { error: err1 } = await supabase
        .from("family_members")
        .update({ relationship: "女儿", standard_role: "daughter" })
        .eq("id", 5);

    if (err1) console.error("Error updating Win仔:", err1);
    else console.log("Updated Win仔 (ID 5) to '女儿'");

    // 2. 修正 K仔 (ID 6) 的原始关系。她是陈阿妹创建的，备注写“侄女”是 OK 的（可能是站在 k 仔角度注册的）
    // 但为了严谨，我们会确保推导引擎能跑通。

    console.log("Data fixed.");
}

fixData();
