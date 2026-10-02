import { validatePublicConfig } from './publicConfig';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
let client = null;
try {
    validatePublicConfig(supabaseUrl, publicKey);
    client = createClient(supabaseUrl, publicKey);
} catch { /* Fail closed without exposing configuration. */ }
export const supabase = client;
export const isSupabaseConfigured = () => supabase !== null;
export function requireSupabase() {
    if (!supabase) throw new Error('Sistema indisponível no momento.');
    return supabase;
}
