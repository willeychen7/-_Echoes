import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function clean() {
    console.log("Cleaning old users...");
    // Keep the one we just seeded if we want, or just delete all and re-seed.
    const { error } = await supabase.from("users").delete().neq("id", 0); // Delete all
    if (error) console.error("Error wiping users:", error);

    // Also clear other tables if needed to be fully "clean"
    // But maybe the user just wants the broken users gone.
}

clean();
