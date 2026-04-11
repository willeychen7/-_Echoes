
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugData() {
    console.log("--- Querying Users ---");
    const { data: users, error: uErr } = await supabase.from('users').select('*').eq('phone_or_email', '2');
    if (uErr) console.error(uErr);
    else console.log(JSON.stringify(users, null, 2));

    console.log("\n--- Querying Family Members named '老二' ---");
    const { data: members, error: mErr } = await supabase.from('family_members').select('*').ilike('name', '%老二%');
    if (mErr) console.error(mErr);
    else console.log(JSON.stringify(members, null, 2));

    console.log("\n--- Querying Family Members named '阿妹' ---");
    const { data: amei, error: aErr } = await supabase.from('family_members').select('*').ilike('name', '%阿妹%');
    if (aErr) console.error(aErr);
    else console.log(JSON.stringify(amei, null, 2));

    if (users?.[0]?.family_id) {
        console.log("\n--- Querying family_members for Account 2's family ---");
        const { data: fam, error: fErr } = await supabase.from('family_members').select('*').eq('family_id', users[0].family_id);
        if (fErr) console.error(fErr);
        else console.log(JSON.stringify(fam, null, 2));
    }
}

debugData();
