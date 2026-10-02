import { defineConfig } from '@playwright/test';
export default defineConfig({
    outputDir: 'test-results/pwa',
    testDir: './tests/pwa', workers: 1, fullyParallel: false,
    use: { baseURL: 'http://127.0.0.1:4183', trace: 'retain-on-failure' },
    webServer: {
        command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4183 --strictPort',
        url: 'http://127.0.0.1:4183', reuseExistingServer: false, timeout: 120000,
        env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    },
});
