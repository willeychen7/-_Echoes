import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkChenAMei() {
    const { data: members, error } = await supabase
        .from("family_members")
        .select("*")
        .ilike("name", "%陈阿妹%");

    if (error) {
        console.error("Error fetching members:", error);
        return;
    }

    if (!members || members.length === 0) {
        console.log("陈阿妹 not found.");
        return;
    }

    console.log("Found 陈阿妹:", JSON.stringify(members, null, 2));

    for (const member of members) {
        if (member.family_id) {
            const { data: family } = await supabase
                .from("families")
                .select("*")
                .eq("id", member.family_id)
                .single();
            console.log(`Family for member ${member.id}:`, JSON.stringify(family, null, 2));
        }
    }
}

checkChenAMei();
