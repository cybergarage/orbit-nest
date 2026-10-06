// Synthetic research concepts only. Does not launch or modify Nest.
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOKU_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    for (const name of ['01-home', '02-focus', '03-today', '04-library', '05-routines', '06-plugins', '07-plugin-detail']) {
      for (const [label, width] of [['desktop', 1440], ['narrow', 390]]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
        await page.goto(pathToFileURL(path.join(__dirname, 'concepts', name + '.html')).href);
        async function checkLayout() {
          const result = await page.evaluate(() => {
            const pane = document.querySelector('.workspace');
            const nav = document.querySelector('.nav-panel');
            const p = pane.getBoundingClientRect(), n = nav.getBoundingClientRect();
            return {
              documentOverflow: document.documentElement.scrollWidth > innerWidth,
              paneOverflow: pane.scrollWidth > pane.clientWidth + 1,
              overlap: innerWidth > 700 ? n.right > p.left + 1 : n.bottom > p.top + 1,
              links: document.querySelectorAll('.dock a').length,
              active: document.querySelectorAll('.dock a[aria-current]').length,
              text: [...document.querySelectorAll('h1,h2,h3,p,button,a,.dock-label,.context-title')].filter(e => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent),
            };
          });
          if (result.documentOverflow || result.paneOverflow || result.overlap || result.links !== 5 || result.active !== 1 || result.text.length) throw new Error(JSON.stringify({ name, label, result }));
        }
        await checkLayout();
        if (width < 701) {
          if (await page.locator('.nav-panel').evaluate(e => e.open)) throw new Error('Narrow navigation should start collapsed');
          await page.getByLabel('Toggle main navigation').focus();
          await page.keyboard.press('Enter');
          if (!await page.locator('.nav-panel').evaluate(e => e.open)) throw new Error('Keyboard expansion failed');
          await checkLayout();
          await page.screenshot({ path: path.join(__dirname, 'concepts', name + '-narrow-expanded.png') });
        }
        await page.locator('.dock a[aria-current]').focus();
        if (await page.locator('.dock a[aria-current]').evaluate(e => getComputedStyle(e).outlineStyle) === 'none') throw new Error('Missing navigation focus');
        if (width < 701) {
          await page.getByLabel('Toggle main navigation').focus();
          await page.keyboard.press('Enter');
          if (await page.locator('.nav-panel').evaluate(e => e.open)) throw new Error('Keyboard collapse failed');
        }
        await page.locator('.workspace').evaluate(e => { e.scrollTop = e.scrollHeight; });
        if (name === '02-focus') {
          await page.locator('.chatentry').scrollIntoViewIfNeeded();
          const c = await page.locator('.chatentry').boundingBox();
          const p = await page.locator('.workspace').boundingBox();
          if (c.y < p.y || c.y + c.height > p.y + p.height || c.x < p.x) throw new Error('Composer outside safe pane');
        }
        await page.screenshot({ path: path.join(__dirname, 'concepts', name + '-' + label + '-scrolled.png') });
        await page.evaluate(() => { document.activeElement?.blur(); document.querySelector('.workspace').scrollTop = 0; });
        await page.screenshot({ path: path.join(__dirname, 'concepts', name + '-' + label + '.png') });
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
