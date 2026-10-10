import { loadEnv, build } from 'vite';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertPublicBundleConfig } from './public-build-integrity.js';
import { validatePublicConfig } from '../src/lib/publicConfig.js';
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
try {
    validatePublicConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, true);
    if (Object.keys(env).some(key => /^VITE_.*(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY)/i.test(key) && env[key])) {
        throw new Error('Remova credenciais privadas de variáveis VITE_.');
    }
    await build();
    const files = (await readdir('dist/assets')).filter(file => file.endsWith('.js'));
    const jsChunks = await Promise.all(files.map(file => readFile(join('dist/assets', file), 'utf8')));
    assertPublicBundleConfig(jsChunks, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
} catch (error) {
    // Configuration values must never appear in diagnostics.
    console.error(error.message); process.exitCode = 1;
}
