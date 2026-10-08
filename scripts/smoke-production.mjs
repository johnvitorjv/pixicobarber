import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
const issues = [];
page.on('pageerror', e => issues.push('PAGE_ERROR ' + e.message));
page.on('console', msg => { if (msg.type() === 'error') issues.push('CONSOLE_ERROR ' + msg.text().slice(0, 180)); });
for (const route of ['/', '/login', '/agendar']) {
  try {
    const response = await page.goto('https://pixicobarber.pages.dev' + route, { waitUntil: 'domcontentloaded', timeout: 18000 });
    await page.waitForTimeout(750);
    console.log(JSON.stringify({route, status: response?.status(), finalUrl: page.url(), title: await page.title(), bodyPresent: await page.locator('body').isVisible(), heading: (await page.locator('h1').allTextContents()).slice(0, 3), networkErrors: issues.splice(0)}));
  } catch (e) { console.log(JSON.stringify({route, error: e.message})); }
}
await browser.close();
