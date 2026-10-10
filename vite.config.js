import { defineConfig, loadEnv } from 'vite'
import { versionServiceWorker } from './scripts/version-sw.js'
import react from '@vitejs/plugin-react'
import { isPublicKey, validatePublicConfig } from './src/lib/publicConfig.js'
import { assertPublicBundleConfig } from './scripts/public-build-integrity.js'
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const isCloudflareBuild = env.CF_PAGES === '1'
  if (isCloudflareBuild) validatePublicConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, true)
  if ((env.VITE_SUPABASE_ANON_KEY && !isPublicKey(env.VITE_SUPABASE_ANON_KEY)) ||
      Object.keys(env).some(key => /^VITE_.*(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY)/i.test(key) && env[key])) {
    throw new Error('Configuração recusada: use apenas uma chave pública anon/publishable nas variáveis VITE_.')
  }
  return {
    plugins: [react(), versionServiceWorker(), {
      name: 'pixico-cloudflare-supabase-config-guard',
      apply: 'build',
      generateBundle(_options, bundle) {
        if (!isCloudflareBuild) return
        const jsChunks = Object.values(bundle).filter(file => file.type === 'chunk').map(file => file.code)
        assertPublicBundleConfig(jsChunks, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
      },
    }],
    build: { rollupOptions: { output: {
      manualChunks(id) { if (id.replaceAll('\\', '/').includes('/node_modules/@supabase/')) return 'supabase' },
    } } },
  }
})
