import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('https://diaseafitgh.vercel.app');
  await page.evaluate(() => {
    localStorage.setItem('dias_eafit_current_user', JSON.stringify({ role: 'admin', username: 'admin' }));
  });
  await page.reload();
  await page.waitForTimeout(5000);
  await browser.close();
})();
