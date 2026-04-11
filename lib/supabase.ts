import { createClient } from "@supabase/supabase-js";

let supabase: any;

export const getSupabase = () => {
    if (supabase) return supabase;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
        console.error("[LIB:SUPABASE] Missing Supabase URL or Key.");
        return null;
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    return supabase;
};
