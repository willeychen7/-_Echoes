import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkTables() {
    const tables = ["families", "family_members", "users", "events", "messages", "memories", "archive_memory_creators"];
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select("*", { count: 'exact', head: true });
        console.log(`Table ${table}:`, error ? `Error: ${error.message}` : "Exists");
    }
}

checkTables();
