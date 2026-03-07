import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
    const { data: users } = await supabase.from("users").select("*");
    console.log("All Users:");
    users?.forEach(u => {
        console.log(`- ID: ${u.id}, Name: ${u.name}, MemberID: ${u.member_id}, FamilyID: ${u.family_id}`);
    });
}

check();
