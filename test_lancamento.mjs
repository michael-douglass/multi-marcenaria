import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleMsgs = [];
const netErrs = [];

page.on('console', msg => {
  if (['error','warn'].includes(msg.type())) consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', err => netErrs.push(`PAGE ERROR: ${err.message}`));
page.on('requestfailed', req => netErrs.push(`REQ FAILED: ${req.url()} — ${req.failure()?.errorText}`));

await page.goto('http://localhost:3001');
await page.waitForTimeout(4000);

console.log('URL:', page.url());
console.log('Console:', consoleMsgs.slice(0, 10));
console.log('Errors:', netErrs.slice(0, 10));

await page.screenshot({ path: 'test_screen1.png', fullPage: false });
console.log('Screenshot saved to test_screen1.png');

await browser.close();
