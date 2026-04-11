import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function repair() {
    console.log("Repairing members...");

    // Find a valid family or create a root one
    let { data: rootFam } = await supabase.from('families').select('id').eq('id', 1).maybeSingle();
    if (!rootFam) {
        const { data: nF } = await supabase.from('families').insert({ id: 1, name: "陈家大院", creator_id: 1 }).select().single();
        rootFam = nF;
    }

    // Force recreate member 1
    await supabase.from('family_members').delete().eq('id', 1);
    const { data: m1 } = await supabase.from('family_members').insert({
        id: 1,
        family_id: rootFam.id,
        name: "陈阿妹",
        relationship: "我",
        is_registered: true,
        user_id: 1,
        gender: "female",
        generation_num: 30
    }).select().single();

    // Force recreate member 2 (ID 31 or 122)
    await supabase.from('family_members').delete().eq('id', 31);
    await supabase.from('family_members').delete().eq('id', 122);
    const { data: m2 } = await supabase.from('family_members').insert({
        id: 31,
        family_id: rootFam.id,
        name: "老二",
        relationship: "弟",
        is_registered: true,
        user_id: 2,
        gender: "male",
        generation_num: 30
    }).select().single();

    await supabase.from('users').update({ 
        member_id: 1, 
        family_id: rootFam.id,
        home_family_id: rootFam.id,
        home_member_id: 1
    }).eq('id', 1);
    
    await supabase.from('users').update({ 
        member_id: 31, 
        family_id: rootFam.id,
        home_family_id: rootFam.id,
        home_member_id: 31
    }).eq('id', 2);

    console.log("Environment Repaired. Member 1 and 31 are back.");
}

repair();
