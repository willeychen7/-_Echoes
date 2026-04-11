import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDatabase() {
  console.log("🧨 Starting full database clear-out...");

  const tables = [
    'archive_memory_creators',
    'likes',
    'notifications',
    'messages',
    'memories',
    'events',
    'family_members',
    'users',
    'families',
    'otp_codes'
  ];

  for (const table of tables) {
    console.log(`🧹 Clearing table: ${table}...`);
    const { error } = await supabase.from(table).delete().neq('id', -1); // Delete all where id is not -1 (standard way to delete all rows if no truncate)
    if (error) {
      if (error.code === '42P01') {
        console.warn(`⚠️  Table ${table} does not exist, skipping.`);
      } else {
        console.error(`❌ Error clearing ${table}:`, error.message);
      }
    }
  }

  console.log("✅ All users and family data cleared.");
  console.log("🏁 Database is now blank.");
}

clearDatabase();
