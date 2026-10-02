import { defineConfig } from '@playwright/test';
export default defineConfig({
    outputDir: 'test-results/e2e',
    testDir: './tests/e2e', fullyParallel: false, workers: 1,
    use: { baseURL: 'http://127.0.0.1:4173', headless: true, trace: 'retain-on-failure' },
    reporter: 'list',
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173', reuseExistingServer: false,
        env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'sb_publishable_local_test' },
    },
});
