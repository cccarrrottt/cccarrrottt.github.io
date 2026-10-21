/* The picture a link to the site shows when it is pasted into a chat.
 *
 * og:image (see build_site in build.py) has to be a file at an address, and
 * a crawler that fetches it runs no script, so it is drawn here once and
 * kept in src/site/og-image.png: 1200×630, the size every preview asks for.
 *
 * It is a card, not a photograph of the chart. A photograph would show
 * whatever the chart held on the day it was taken — and CI runs no browser
 * on a Save, so it could only ever be that day's. The card is the site's
 * own wordmark and the icon's three entries, grown into a few more, on the
 * chart's ink: true for as long as the site is this site.
 *
 *     node tools/og-image.js
 *
 * The webfonts are let through when the network has them (through the
 * proxy in HTTPS_PROXY, when there is one), because a card in a fallback
 * face is not the wordmark.
 */
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'site', 'og-image.png');

const FONTS = 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=IBM+Plex+Mono:wght@500&display=block';
const INK = '#141c2b', ACCENT = '#c23b22', PAPER = '#ffffff', FAINT = '#8291a8';

/* Entries and the square-cornered lines between them, as the chart draws
   them: each line leaves its parent's right side and turns once to reach
   its child's left. */
const BOXES = [[70, 255, 120, 70], [262, 140, 120, 70], [262, 370, 120, 70],
               [454, 70, 96, 56], [454, 214, 96, 56], [454, 404, 96, 56], [454, 490, 96, 56]];
const LINKS = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
function card(){
  const mid = b => [b[0], b[1] + b[3] / 2];
  const lines = LINKS.map(([a, b]) => {
    const A = BOXES[a], B = BOXES[b];
    const x0 = A[0] + A[2], y0 = mid(A)[1], [x1, y1] = mid(B), xm = (x0 + x1) / 2;
    return `<path d="M${x0} ${y0} H${xm} V${y1} H${x1}"/>`;
  }).join('');
  const boxes = BOXES.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}">
<style>
  html,body{margin:0;width:1200px;height:630px;background:${INK};overflow:hidden;}
  svg{position:absolute;left:0;top:0;}
  .words{position:absolute;left:640px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;}
  .mark{font:800 92px/0.9 'Big Shoulders Display',sans-serif;color:${PAPER};text-transform:uppercase;letter-spacing:1px;}
  .mark span{color:${ACCENT};}
  .sub{font:500 21px/1.4 'IBM Plex Mono',monospace;color:${FAINT};text-transform:uppercase;letter-spacing:2.5px;margin-top:26px;}
</style></head><body>
<svg width="1200" height="630" viewBox="0 0 1200 630">
  <g fill="none" stroke="${ACCENT}" stroke-width="7">${lines}</g>
  <g fill="${PAPER}">${boxes}</g>
</svg>
<div class="words"><div class="mark">Rhizome<span>·</span><br>Project</div>
<div class="sub">A cartography<br>of crossed realities</div></div>
</body></html>`;
}

(async () => {
  const PINNED = '/opt/pw-browsers/chromium';
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(Object.assign(
    fs.existsSync(PINNED) ? {executablePath: PINNED} : {},
    proxy ? {proxy: {server: proxy}} : {}));
  const ctx = await browser.newContext({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1,
                                        ignoreHTTPSErrors: !!proxy});
  const page = await ctx.newPage();
  await page.setContent(card(), {waitUntil: 'load'});
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return ['800 92px "Big Shoulders Display"', '500 21px "IBM Plex Mono"'].filter(f => document.fonts.check(f)).length;
  });
  if(fonts < 2) console.warn('the webfonts did not load, so the card is in a fallback face');
  await page.screenshot({path: OUT});
  console.log(`wrote ${path.relative(ROOT, OUT)} (${fs.statSync(OUT).size.toLocaleString()} bytes)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
