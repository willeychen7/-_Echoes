
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function cleanup() {
    console.log("Checking for ghost members...");

    // We use .or() for multiple conditions.
    // In postgrest, we can use name.ilike.*的父亲,name.ilike.*的母亲 etc.
    const { data: ghosts, error } = await supabase
        .from("family_members")
        .select("id, name")
        .or("name.ilike.%的父亲,name.ilike.%的母亲,name.ilike.%的兄弟姐妹");

    if (error) {
        console.error("Query error:", error);
        return;
    }

    if (!ghosts || ghosts.length === 0) {
        console.log("No ghost members found.");
        return;
    }

    console.log(`Found ${ghosts.length} ghost members:`, ghosts.map((g: any) => g.name));

    const idsToDelete = ghosts.map((g: any) => g.id);

    // Check if any of these are registered (safety)
    // Actually we only delete if is_registered is false
    const { data: realGhosts, error: fetchError } = await supabase
        .from("family_members")
        .select("id, name")
        .in("id", idsToDelete)
        .eq("is_registered", false);

    if (fetchError) {
        console.error("Fetch error:", fetchError);
        return;
    }

    if (!realGhosts || realGhosts.length === 0) {
        console.log("No non-registered ghost members found.");
        return;
    }

    const finalIds = realGhosts.map((g: any) => g.id);
    console.log(`Deleting ${finalIds.length} members with IDs:`, finalIds);

    const { error: delError } = await supabase
        .from("family_members")
        .delete()
        .in("id", finalIds);

    if (delError) {
        console.error("Delete error:", delError);
    } else {
        console.log("Successfully deleted ghost members.");
    }
}

cleanup();
