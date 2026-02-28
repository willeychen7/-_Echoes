import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
    for (const table of ['families', 'family_members', 'users', 'events', 'messages']) {
        const { data } = await supabase.from(table).select("*").limit(1);
        if (data && data.length > 0) {
            console.log(`Table ${table} keys:`, Object.keys(data[0]));
        } else {
            console.log(`Table ${table} is empty`);
        }
    }
}

check();
