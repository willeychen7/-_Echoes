
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function resetPassword() {
    const hashedPassword = await bcrypt.hash("2", 12);
    const { error } = await supabase.from('users').update({ password: hashedPassword }).eq('id', 2);
    if (error) console.error(error);
    else console.log("User 2 password reset to '2'");
}

resetPassword();
