
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAncestralHall() {
    const { data, error } = await supabase
        .from('family_members')
        .select('id, name, relationship, ancestral_hall, sibling_order, is_placeholder, member_type')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Recent Members:');
    console.table(data);
}

checkAncestralHall();
