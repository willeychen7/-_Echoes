import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCols() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT column_name, table_name FROM information_schema.columns WHERE column_name = 'sync_uuid';"
  });
  if (error) console.error("Error checking columns:", error.message);
  console.log("Columns found:", data);
}

checkCols();
