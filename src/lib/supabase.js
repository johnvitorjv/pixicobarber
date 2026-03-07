import { createClient } from '@supabase/supabase-js';

// Usaremos variáveis de ambiente do Vite no futuro.
// Por enquanto, como o usuário não forneceu as chaves ainda,
// vamos deixar preparado usando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
// com fallback para string vazia para não quebrar o app.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Função auxiliar para verificar se o Supabase está configurado
export const isSupabaseConfigured = () => supabase !== null;
