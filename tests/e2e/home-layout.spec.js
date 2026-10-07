import { test, expect } from '@playwright/test';

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    test(`home gallery and contact remain complete at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
        await page.goto('/');
        const gallery = page.locator('#galeria');
        await gallery.scrollIntoViewIfNeeded();
        const images = gallery.locator('img');
        await expect(images).toHaveCount(5);
        await expect.poll(() => images.evaluateAll(elements => elements.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
        await expect.poll(() => gallery.locator('.gallery-item').evaluateAll(elements => elements.every(el => Number(getComputedStyle(el).opacity) === 1))).toBe(true);
        const layout = await images.evaluateAll(elements => elements.map(img => {
            const rect = img.parentElement.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, clip: getComputedStyle(img.parentElement).clipPath };
        }));
        for (const card of layout) {
            expect(Math.abs(card.width - card.height)).toBeLessThan(2);
            expect(card.clip).toBe('none');
        }
        // On desktop all five photos must fill one row, with no orphaned second row.
        if (width >= 1024) expect(Math.max(...layout.map(card => card.top)) - Math.min(...layout.map(card => card.top))).toBeLessThan(2);
        await gallery.screenshot({ path: `test-results/gallery-${width}.png` });

        const cta = page.locator('.contact-cta');
        await cta.scrollIntoViewIfNeeded();
        await expect.poll(() => cta.evaluate(el => Number(getComputedStyle(el).opacity))).toBe(1);
        const booking = cta.getByRole('link', { name: 'Agendar pelo Site' });
        const whatsapp = cta.getByRole('link', { name: 'Falar pelo WhatsApp' });
        await expect(booking).toHaveAttribute('href', '/agendar');
        await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/5571994096863\?text=/);
        for (const button of [booking, whatsapp]) {
            await button.scrollIntoViewIfNeeded();
            const visibility = await button.evaluate(el => {
                const rect = el.getBoundingClientRect();
                const label = el.querySelector('span').getBoundingClientRect();
                const points = [4, rect.width / 2, rect.width - 4].flatMap(x => [4, rect.height / 2, rect.height - 4].map(y => [rect.left + x, rect.top + y]));
                return {
                    uncovered: points.every(([x, y]) => el.contains(document.elementFromPoint(x, y))),
                    labelFits: label.left >= rect.left && label.right <= rect.right,
                    insideViewport: rect.left >= 0 && rect.right <= innerWidth,
                };
            });
            expect(visibility).toEqual({ uncovered: true, labelFits: true, insideViewport: true });
        }
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await cta.screenshot({ path: `test-results/contact-${width}.png` });
        await booking.click();
        await expect(page).toHaveURL(/\/login$/);
    });
}
