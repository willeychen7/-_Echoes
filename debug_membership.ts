
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function debug() {
    console.log("--- Family Members Debug ---");
    const { data: members, error } = await supabase
        .from("family_members")
        .select(`
            id, 
            name, 
            relationship, 
            standard_role, 
            gender,
            archive_memory_creators!member_id(creator_member_id)
        `);

    if (error) {
        console.error(error);
        return;
    }

    members.forEach((m: any) => {
        const creatorId = Array.isArray(m.archive_memory_creators)
            ? m.archive_memory_creators[0]?.creator_member_id
            : m.archive_memory_creators?.creator_member_id;
        console.log(`ID: ${m.id} | Name: ${m.name} | Rel: ${m.relationship} | Role: ${m.standard_role} | Gender: ${m.gender} | CreatedBy: ${creatorId}`);
    });
}

debug();
