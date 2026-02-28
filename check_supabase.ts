import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: families, error: fError } = await supabase.from("families").select("*");
    console.log("Families:", families, "Error:", fError);

    const { data: users, error: uError } = await supabase.from("users").select("*");
    console.log("Users:", users?.length, "Error:", uError);

    const { data: members, error: mError } = await supabase.from("family_members").select("*");
    console.log("Members:", members?.length, "Error:", mError);
}

check();
