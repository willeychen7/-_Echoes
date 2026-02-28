import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
    const { data: families } = await supabase.from("families").select("*");
    const { data: members } = await supabase.from("family_members").select("*");
    const { data: events } = await supabase.from("events").select("*");

    console.log("Families:", families?.length);
    console.log("Members:", members?.length);
    console.log("Events:", events?.length);

    if (events && events.length > 0) {
        console.log("First Event:", JSON.stringify(events[0], null, 2));
    }
}

check();
