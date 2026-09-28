import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://diaseafitgh.vercel.app');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'C:/Users/user/.gemini/antigravity/brain/46d54790-28d0-485d-ad23-9e113273fd4a/screenshot.png' });
  await browser.close();
})();
