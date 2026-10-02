import { loadEnv, build } from 'vite';
import { validatePublicConfig } from '../src/lib/publicConfig.js';
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
try {
    validatePublicConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, true);
    if (Object.keys(env).some(key => /^VITE_.*(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY)/i.test(key) && env[key])) {
        throw new Error('Remova credenciais privadas de variáveis VITE_.');
    }
    await build();
} catch (error) {
    // Configuration values must never appear in diagnostics.
    console.error(error.message); process.exitCode = 1;
}
