
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function diagnose() {
    console.log("--- Member 17 (陈金国) in Family 1 ---");
    const { data: m17 } = await supabase.from('family_members').select('*').eq('id', 17).single();
    console.log(JSON.stringify(m17, null, 2));

    console.log("\n--- Member 32 (陈金国) in Family 6 ---");
    const { data: m32 } = await supabase.from('family_members').select('*').eq('id', 32).single();
    console.log(JSON.stringify(m32, null, 2));
}

diagnose();
