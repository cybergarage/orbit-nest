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
    for (const name of ['01-home', '02-focus', '03-today', '04-library', '05-routines', '06-plugins', '07-plugin-detail']) {
      for (const [label, width] of [['desktop', 1440], ['narrow', 390]]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
        await page.goto(pathToFileURL(path.join(__dirname, 'concepts', name + '.html')).href);
        const overflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth > innerWidth,
          text: [...document.querySelectorAll('h1,h2,h3,p,button,a,.dock-label,.context-title')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent),
        }));
        if (overflow.document || overflow.text.length) throw new Error(JSON.stringify({ name, label, overflow }));
        const shellCheck = await page.evaluate(() => {
          const pane = document.querySelector('.workspace');
          const dock = document.querySelector('.dock-area');
          return {
            paneOverflow: pane.scrollWidth > pane.clientWidth + 1,
            overlap: pane.getBoundingClientRect().bottom > dock.getBoundingClientRect().top + 1,
            links: document.querySelectorAll('.dock a').length,
            selected: document.querySelectorAll('.dock a[aria-current]').length,
          };
        });
        if (shellCheck.paneOverflow || shellCheck.overlap || shellCheck.links !== 5 || shellCheck.selected !== 1) {
          throw new Error(JSON.stringify({ name, label, shellCheck }));
        }
        await page.locator('.dock a[aria-current]').focus();
        const outline = await page.locator('.dock a[aria-current]').evaluate(e => getComputedStyle(e).outlineStyle);
        if (outline === 'none') throw new Error('Missing Dock focus outline');
        await page.locator('.workspace').evaluate(e => { e.scrollTop = e.scrollHeight; });
        if (name === '02-focus') {
          await page.locator('.chatentry').scrollIntoViewIfNeeded();
          const composer = await page.locator('.chatentry').boundingBox();
          const dock = await page.locator('.dock-area').boundingBox();
          if (composer.y + composer.height > dock.y) throw new Error('Composer overlaps Dock');
        }
        await page.evaluate(() => {
          document.activeElement?.blur();
          document.querySelector('.workspace').scrollTop = 0;
        });
        await page.screenshot({ path: path.join(__dirname, 'concepts', name + '-' + label + '.png'), fullPage: true });
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
