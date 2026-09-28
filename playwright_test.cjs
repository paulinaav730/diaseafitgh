const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  await page.goto('https://diaseafitgh.vercel.app');
  
  // Wait a bit to let React initialize and Supabase Realtime connect
  await page.waitForTimeout(5000);
  
  await browser.close();
})();
