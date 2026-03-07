import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function testAddMember() {
    const payload = {
        family_id: 1,
        name: "测试新成员",
        relationship: "亲戚",
        is_registered: false,
        standard_role: "family",
        member_type: "human"
    };

    const { data, error } = await supabase
        .from("family_members")
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error("Insert error:", error);
    } else {
        console.log("Insert success:", data);
    }
}

testAddMember();
