import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkK() {
    const { data: member } = await supabase.from("family_members").select("*").eq("id", 29).single();
    console.log("K仔 Member Record:", JSON.stringify(member, null, 2));
}

checkK();
