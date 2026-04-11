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

async function cleanup() {
  console.log("🚀 Starting database cleanup of virtual 'industrial waste'...");

  // 1. Delete all members with member_type: 'virtual'
  const { data: virtuals, error: vError } = await supabase
    .from('family_members')
    .select('id, name')
    .eq('member_type', 'virtual');

  if (vError) {
    console.error("Error fetching virtuals:", vError.message);
  } else if (virtuals && virtuals.length > 0) {
    console.log(`🗑️  Deleting ${virtuals.length} virtual members:`, virtuals.map(v => v.name).join(', '));
    const idsToDelete = virtuals.map(v => v.id);
    
    // Also clean up related records first to be safe (though cascade should handle it)
    await supabase.from('messages').delete().in('family_member_id', idsToDelete);
    await supabase.from('memories').delete().in('member_id', idsToDelete);
    await supabase.from('events').delete().in('member_id', idsToDelete);
    await supabase.from('archive_memory_creators').delete().in('member_id', idsToDelete);

    const { error: dError } = await supabase
      .from('family_members')
      .delete()
      .in('id', idsToDelete);

    if (dError) {
      console.error("Delete failed:", dError.message);
    } else {
      console.log("✅ Virtual members deleted successfully.");
    }
  } else {
    console.log("✨ No virtual members found.");
  }

  // 2. Also check for is_placeholder: true entries
  const { data: placeholders } = await supabase
    .from('family_members')
    .select('id, name')
    .eq('is_placeholder', true);

  if (placeholders && placeholders.length > 0) {
    console.log(`🗑️  Deleting ${placeholders.length} placeholder members:`, placeholders.map(p => p.name).join(', '));
    const pIds = placeholders.map(p => p.id);
    await supabase.from('family_members').delete().in('id', pIds);
    console.log("✅ Placeholders deleted successfully.");
  }

  console.log("🏁 Cleanup complete.");
}

cleanup();
