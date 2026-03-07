import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkKInFamily1() {
    const { data: members } = await supabase.from("family_members").select("*").eq("family_id", 1).eq("user_id", 3);
    console.log("K仔 in Family 1:", JSON.stringify(members, null, 2));
}

checkKInFamily1();
