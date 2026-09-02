const { chromium } = require('playwright');

async function testHumanized() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  // Remove webdriver flag
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  await page.goto('https://calendar.app.google/iueH4Lnt6qsCgVmZ6', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Pick Monday 7 slot 09:00
  const slotBtn = page.locator('button:has-text("09:00")').first();
  await slotBtn.click();
  await page.waitForTimeout(2000);

  // Fill inputs human-like with typing
  const firstNameInput = page.locator('input[type="text"]:visible').first();
  await firstNameInput.click();
  await firstNameInput.pressSequentially('Tri', { delay: 50 });

  const lastNameInput = page.locator('input[type="text"]:visible').nth(1);
  await lastNameInput.click();
  await lastNameInput.pressSequentially('Putra', { delay: 50 });

  const emailInput = page.locator('input[type="email"]:visible').first();
  await emailInput.click();
  await emailInput.pressSequentially('tri.kartika.putra+2@gmail.com', { delay: 50 });

  const addressInput = page.locator('textarea:visible').first();
  await addressInput.click();
  await addressInput.pressSequentially('Fortune spring Blok D2 - J05', { delay: 50 });

  const phoneInput = page.locator('textarea:visible').nth(1);
  await phoneInput.click();
  await phoneInput.pressSequentially('08111819112', { delay: 50 });

  await page.waitForTimeout(1500);

  // Click Reservasi
  const bookBtn = page.locator('button:has-text("Reservasi"), button:has-text("Book")').first();
  console.log('Clicking Reservasi button...');
  await bookBtn.click();

  // Listen to response or wait 10s
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'after_human_submit.png' });
  console.log('Saved after_human_submit.png');

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('Page text status:', pageText.slice(-300));

  await browser.close();
}

testHumanized();
