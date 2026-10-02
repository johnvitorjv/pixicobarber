import { defineConfig, loadEnv } from 'vite'
import { versionServiceWorker } from './scripts/version-sw.js'
import react from '@vitejs/plugin-react'
import { isPublicKey } from './src/lib/publicConfig.js'
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  if ((env.VITE_SUPABASE_ANON_KEY && !isPublicKey(env.VITE_SUPABASE_ANON_KEY)) ||
      Object.keys(env).some(key => /^VITE_.*(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY)/i.test(key) && env[key])) {
    throw new Error('Configuração recusada: use apenas uma chave pública anon/publishable nas variáveis VITE_.')
  }
  return {
    plugins: [react(), versionServiceWorker()],
    build: { rollupOptions: { output: {
      manualChunks(id) { if (id.replaceAll('\\', '/').includes('/node_modules/@supabase/')) return 'supabase' },
    } } },
  }
})
