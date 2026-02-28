import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
    const { data } = await supabase.from("events").select("*").limit(1);
    if (data && data.length > 0) {
        console.log("Keys in events:", Object.keys(data[0]));
    }
}

check();
