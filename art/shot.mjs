// Screenshot a local page to a PNG: node shot.mjs <url> <out.png> [width]
import { chromium } from 'playwright-core';
const [url, out, width = '2400'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: +width, height: 800 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(url);
await page.waitForSelector('body[data-done]', { timeout: 15000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
