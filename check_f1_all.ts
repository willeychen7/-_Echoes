import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkFamily1() {
    const { data: members } = await supabase.from("family_members").select("*").eq("family_id", 1);
    console.log("Family 1 Members:");
    members?.forEach(m => {
        console.log(`- ID: ${m.id}, Name: ${m.name}, Relationship remark: ${m.relationship}, Gender: ${m.gender}, Role: ${m.standard_role}`);
    });
}

checkFamily1();
