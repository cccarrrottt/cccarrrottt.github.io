/* The site's icons, drawn from the one drawing of R·P (src/favicon.svg).
 *
 * The tab shows the SVG itself (build.py, favicon_link), sharp at any size.
 * What cannot be an SVG is drawn from it here: the PNG a browser without
 * SVG icons falls back to, and the three a phone puts on its home screen
 * and its launch screen (src/site/). Those were the 87-pixel PNG scaled up,
 * which is why the installed app opened on a blurred R·P (the owner's list
 * of 19.11). The home-screen ones stand the letters in more white, as they
 * stood before: a launcher may cut the icon to a circle, and the letters
 * have to be inside it.
 *
 *     node tools/icons.js
 */
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SVG = fs.readFileSync(path.join(ROOT, 'src', 'favicon.svg'), 'utf8');
/* The drawing is 87 units across with the letters 61 tall; on the home
   screen they were 41% of the icon, so the frame is widened to match. */
const PAD = (87 * 61 / 87 / 0.41 - 87) / 2;
const padded = SVG.replace('viewBox="0 0 87 87"', `viewBox="${-PAD} ${-PAD} ${87 + 2 * PAD} ${87 + 2 * PAD}"`)
  .replace('<rect width="87" height="87"', `<rect x="${-PAD}" y="${-PAD}" width="${87 + 2 * PAD}" height="${87 + 2 * PAD}"`);

const OUT = [
  {file: path.join(ROOT, 'src', 'favicon.png'), size: 96, svg: SVG},
  {file: path.join(ROOT, 'src', 'site', 'icon-192.png'), size: 192, svg: padded},
  {file: path.join(ROOT, 'src', 'site', 'icon-512.png'), size: 512, svg: padded},
  {file: path.join(ROOT, 'src', 'site', 'apple-touch-icon.png'), size: 180, svg: padded},
];

(async ()=>{
  const browser = await chromium.launch();
  for(const {file, size, svg} of OUT){
    const page = await browser.newPage({viewport: {width: size, height: size}, deviceScaleFactor: 1});
    await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    fs.writeFileSync(file, await page.screenshot({clip: {x: 0, y: 0, width: size, height: size}}));
    await page.close();
    console.log(path.relative(ROOT, file), size + '×' + size);
  }
  await browser.close();
})();
