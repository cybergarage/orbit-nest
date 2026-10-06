// Synthetic concept rendering only; does not launch or modify Nest.
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.MOKU_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  try {
    for (const name of ['01-home', '02-focus', '03-today']) {
      for (const [label, width] of [['desktop', 1440], ['narrow', 390]]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
        await page.goto(pathToFileURL(path.join(__dirname, 'concepts', name + '.html')).href);
        const overflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth > innerWidth,
          text: [...document.querySelectorAll('h1,h2,h3,p,button,a')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent),
        }));
        if (overflow.document || overflow.text.length) throw new Error(JSON.stringify({ name, label, overflow }));
        await page.screenshot({ path: path.join(__dirname, 'concepts', name + '-' + label + '.png'), fullPage: true });
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
