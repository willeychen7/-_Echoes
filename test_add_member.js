const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => {
    if (response.url().includes('/api/')) {
       console.log('API RESPONSE:', response.status(), response.url());
    }
  });
  
  await page.goto('http://localhost:5173/add-member', {waitUntil: 'networkidle0'});
  console.log("Navigated");
  // Fill in the name
  await page.type('input[placeholder="请输入家人的姓名"]', 'Test Person');
  // Click relationship
  const buttons = await page.$$('button');
  for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text === '儿子' || text === '父亲' || text === '女儿') {
          await btn.click();
          break;
      }
  }
  // Click add
  for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text === '建立档案') {
          await btn.click();
          break;
      }
  }
  await page.waitForTimeout(2000).catch(()=>{});
  console.log("Done");
  await browser.close();
})();
