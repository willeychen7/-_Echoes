import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load env from the project directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing keys. VITE_SUPABASE_URL:", !!supabaseUrl, "VITE_SUPABASE_ANON_KEY:", !!supabaseKey);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanUp() {
    console.log("Starting data standardization via Supabase API...");

    // 1. family_members table
    const { data: fmMale, error: fmMaleError } = await supabase
        .from("family_members")
        .update({ gender: "male" })
        .eq("gender", "男")
        .select("id");

    const { data: fmFemale, error: fmFemaleError } = await supabase
        .from("family_members")
        .update({ gender: "female" })
        .eq("gender", "女")
        .select("id");

    if (fmMaleError) console.error("Error updating male members:", fmMaleError);
    if (fmFemaleError) console.error("Error updating female members:", fmFemaleError);

    console.log(`Updated family_members: Male: ${fmMale?.length || 0}, Female: ${fmFemale?.length || 0}`);

    // 2. users table
    const { data: uMale, error: uMaleError } = await supabase
        .from("users")
        .update({ gender: "male" })
        .eq("gender", "男")
        .select("id");

    const { data: uFemale, error: uFemaleError } = await supabase
        .from("users")
        .update({ gender: "female" })
        .eq("gender", "女")
        .select("id");

    if (uMaleError) console.error("Error updating male users:", uMaleError);
    if (uFemaleError) console.error("Error updating female users:", uFemaleError);

    console.log(`Updated users: Male: ${uMale?.length || 0}, Female: ${uFemale?.length || 0}`);

    console.log("Final verify...");
    const { data: finalMembers } = await supabase.from("family_members").select("gender");
    const finalCounts: Record<string, number> = {};
    finalMembers?.forEach(m => { finalCounts[String(m.gender)] = (finalCounts[String(m.gender)] || 0) + 1; });
    console.log("New gender counts in family_members:", finalCounts);
}

cleanUp();
