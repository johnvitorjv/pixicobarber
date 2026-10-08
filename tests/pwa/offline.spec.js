import { readFile, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({context}) => {
    await context.route('**/*', route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
});
test('production PWA uses an informative offline page, preserving foreign caches and excluding private requests', async ({ page, context }) => {
    await page.goto('/offline.html');
    await page.evaluate(async () => { await caches.open('unrelated-app-cache'); await caches.open('pixico-static-v1'); });
    await page.goto('/');
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).toContain('unrelated-app-cache'); expect(keys).not.toContain('pixico-static-v1');
    expect(keys.filter(k=>k.startsWith('pixico-static-'))).toHaveLength(1);
    await page.reload();
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('pwa-test@example.invalid');
    await page.locator('input[name="senha"]').fill('PwaTest123!');
    await page.getByRole('button', {name:'Entrar',exact:true}).click();
    await expect(page.getByText('Acesso indisponível no momento.')).toBeVisible();
    await page.evaluate(async () => {
        await fetch('/private-test', { headers: { Authorization: 'Bearer mock-test-only' } });
        await fetch('/login');
    });
    const cachedPaths = await page.evaluate(async () => {
        const urls = []; for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
        return urls;
    });
    expect(cachedPaths).toContain('/offline.html'); expect(cachedPaths).not.toContain('/login'); expect(cachedPaths).not.toContain('/private-test');
    expect(cachedPaths.every(p => p.startsWith('/assets/') || p.startsWith('/icons/') || p.startsWith('/offline'))).toBe(true);
    await context.setOffline(true);
    await page.goto('/agendar');
    await expect(page.getByRole('heading')).toContainText('sem conexão');
    await expect(page.getByRole('button', { name: /confirmar|agendar/i })).toHaveCount(0);
    await context.setOffline(false);
    await page.goto('/login'); await expect(page.getByRole('heading',{name:'Entrar',exact:true})).toBeVisible();
});

test('new worker offers an update; activation removes old PIXICO cache', async ({ page }) => {
    const path = new URL('../../dist/sw.js',import.meta.url);
    const original = await readFile(path,'utf8');
    await page.goto('/login');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})); });
    try {
        expect(original).toMatch(/const CACHE_NAME = '[^']+';/);
        await writeFile(path,original.replace(/const CACHE_NAME = '[^']+';/, () => "const CACHE_NAME = 'pixico-static-test-updated';"));
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await expect(page.getByRole('button',{name:'Atualizar agora'})).toBeVisible();
        await Promise.all([
            page.waitForEvent('load'),
            page.getByRole('button',{name:'Atualizar agora'}).click(),
        ]);
        await expect(page.getByRole('heading',{name:'Entrar',exact:true})).toBeVisible();
        await expect.poll(()=>page.evaluate(()=>caches.keys())).toEqual(['pixico-static-test-updated']);
    } finally { await writeFile(path,original); }
});
