import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testColumn() {
  const { error } = await supabase.from('memories').insert({
    content: 'schema test',
    sync_uuid: '00000000-0000-0000-0000-000000000000'
  });
  if (error && error.message.includes('column "sync_uuid" of relation "memories" does not exist')) {
    console.log("❌ Column sync_uuid DOES NOT EXIST.");
  } else if (!error) {
     console.log("✅ Column sync_uuid EXISTS.");
     // cleanup
     await supabase.from('memories').delete().eq('content', 'schema test');
  } else {
     console.log("Error:", error.message);
  }
}

testColumn();
