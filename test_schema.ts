import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'events' });
    // If rpc doesn't exist, we can't use it.
    // Let's just try to insert an event with family_id and see the error.
    const { error: insError } = await supabase.from("events").insert({
        family_id: 1,
        title: "Test",
        date: "2024-01-01"
    });
    console.log("Insert Error:", insError);
}

check();
