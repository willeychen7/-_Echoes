
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function diagnose() {
    console.log("--- Memories related to Member 3 (Old User 2) in Family 1 ---");
    const { data: mems3 } = await supabase.from('memories').select('*').eq('member_id', 3);
    console.log("Member 3 as target:", JSON.stringify(mems3, null, 2));

    console.log("\n--- Memories authored by Member 3 in Family 1 ---");
    const { data: memsAuth3 } = await supabase.from('memories').select('*').eq('author_id', 3);
    console.log("Member 3 as author:", JSON.stringify(memsAuth3, null, 2));

    console.log("\n--- Events associated with Member 3 in Family 1 ---");
    const { data: evts3 } = await supabase.from('events').select('*').eq('member_id', 3);
    console.log("Member 3 as main member:", JSON.stringify(evts3, null, 2));
}

diagnose();
