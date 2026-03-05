import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkCreators() {
    const { data, error } = await supabase
        .from("archive_memory_creators")
        .select("*");

    if (error) { console.error("Error:", error); return; }

    console.log("\n=== 档案创建关系 (archive_memory_creators) ===");
    data?.forEach(row => {
        console.log(`ID:${row.id} | 被创建者(member_id):${row.member_id} | 创建者(creator_member_id):${row.creator_member_id}`);
    });
}

checkCreators();
