
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    const { data, error } = await supabase.rpc('inspect_table_columns', { table_name: 'family_members' });

    // If RPC doesn't exist, try a simple select with everything and see what fails
    const { data: cols, error: colError } = await supabase.from('family_members').select('*').limit(1);

    if (colError) {
        console.log('Error selecting *: ', colError.message);
    } else if (cols && cols.length > 0) {
        console.log('Columns found:', Object.keys(cols[0]));
    } else {
        console.log('Table empty or not found');
    }
}

inspectSchema();
