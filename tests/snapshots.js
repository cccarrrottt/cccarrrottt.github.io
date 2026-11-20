#!/usr/bin/env node
/* Rhizome Project — what the chart looks like, compared by the pixel.
 *
 *   node tests/snapshots.js            compare with tests/snapshots/*.png
 *   node tests/snapshots.js --update   draw them again and keep what was drawn
 *   node tests/snapshots.js --only=merge   just the scenes whose name matches
 *
 * The regression suite asks the drawing questions in numbers: where a port
 * is, how long a stub is, which way an arrowhead points. Most of what the
 * owner's lists of fixes are about is the look of a merge, a fork or a line's
 * end — a T a pixel short of the border, a corner that squared off, a bead
 * standing on another bead — and a number only catches what someone thought
 * to ask about. A picture of the drawing catches the rest.
 *
 * So this draws one chart, kept for the purpose (tests/snapshots/reference.json:
 * merges of every kind, a fork, bends, every end a line can have), and
 * compares each scene of it with the picture kept beside it.
 *
 * What would make the pictures differ from one machine to the next is kept
 * out of them. The webfonts are answered with nothing, as in the suite, and
 * the text is hidden besides — a system face is a different face on every
 * machine; every entry has its size set by hand, so no box is measured from
 * text it cannot see; and the browser is the one package-lock.json pins.
 * What is left is lines and fills, which Chromium draws the same on any
 * Linux. CI keeps and compares them; a picture kept from another system
 * (macOS draws its lines differently) would only ever disagree.
 *
 * A change meant to change the look is a change to the pictures too: run
 * --update, look at what moved, and commit them with it. The pull request
 * then shows the old drawing and the new one side by side. A run that
 * differs writes what it drew, and a picture of where it differs, to
 * tests/snapshots/out/, which CI keeps with the run.
 */
const { chromium } = (() => {
  for(const where of ['/opt/node-tools/node_modules/playwright-core', 'playwright', 'playwright-core']){
    try { return require(where); } catch(e){ /* next */ }
  }
  console.error('Playwright is not installed. Run: npm ci');
  process.exit(2);
})();
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'dist');
const HERE = path.join(__dirname, 'snapshots');
const OUT = path.join(HERE, 'out');
const PORT = Number(process.env.RHIZOME_TEST_PORT) || 8840;
const ARGS = process.argv.slice(2);
const UPDATE = ARGS.includes('--update');
const ONLY = ((ARGS.find(a => a.startsWith('--only=')) || '').slice(7)).toLowerCase();

/* The scenes: where each one stands on the reference chart, and how close
   it is looked at. Close enough that a pixel on the chart is two on the
   picture, so a line that moved by one is plainly a line that moved. */
const SCENES = [
  {name: 'merge-from-above',      x: 0,    y: -20},
  {name: 'merge-from-the-side',   x: 1000, y: 0},
  {name: 'merge-straight-leave',  x: 2000, y: -20},
  {name: 'merge-ends-at-the-bar', x: 3000, y: -15},
  {name: 'merge-wavy-dashed',     x: 4000, y: -20},
  {name: 'fork',                  x: 5000, y: -15},
  {name: 'bends-and-curve',       x: 6000, y: 0},
  {name: 'line-ends',             x: 7000, y: 0, scale: 1.2}
];
const SCALE = 1.6;
const VIEW = {width: 1200, height: 900};
// The picture is this much of the drawing, round the middle of the chart's
// own area (which the toolbars leave off-centre in the window).
const CLIP = {width: 960, height: 680};

/* How different two pictures may be and still be the same drawing: a pixel
   counts as different when one of its channels moved by more than SHADE,
   and a scene fails at more than SPOTS of them. Antialiasing is the same
   from run to run on one build of Chromium, so this is slack for nothing
   in particular — and small enough that a T moved by a pixel, which is
   some twenty pixels on the picture, is not lost in it. */
const SHADE = 40, SPOTS = 6;

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
              '.css': 'text/css; charset=utf-8', '.json': 'application/json'};

/* The built page with the reference chart in place of the owner's: the
   chart goes where build.py puts it, written as chart_script writes it. */
function referencePage(){
  const html = fs.readFileSync(path.join(DIR, 'nexus.html'), 'utf8');
  const chart = fs.readFileSync(path.join(HERE, 'reference.json'), 'utf8').trimEnd().replace(/</g, '\\u003c');
  const at = /(<script type="application\/json" id="chart-data">\n)[\s\S]*?(\n<\/script>)/;
  if(!at.test(html)){ console.error('snapshots: the built page has no chart element to put the reference chart in.'); process.exit(2); }
  return html.replace(at, (_, open, close) => open + chart + close);
}

/* Compared inside the browser, which already decodes a PNG and reads its
   pixels — so the suite needs nothing installed for it. Answers how many
   pixels differ and, when any do, a picture of the new drawing faded with
   the differing pixels in red. */
async function compare(page, kept, got){
  return page.evaluate(async ([a, b, shade]) => {
    const load = async b64 => createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if(ia.width !== ib.width || ia.height !== ib.height) return {size: `${ia.width}×${ia.height} kept, ${ib.width}×${ib.height} drawn`};
    const read = img => {
      const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, img.width, img.height);
    };
    const da = read(ia), db = read(ib);
    const out = new ImageData(ia.width, ia.height);
    let spots = 0;
    for(let i = 0; i < da.data.length; i += 4){
      let d = 0;
      for(let k = 0; k < 4; k++) d = Math.max(d, Math.abs(da.data[i + k] - db.data[i + k]));
      if(d > shade){
        spots++;
        out.data.set([230, 0, 0, 255], i);
      } else {
        const v = 255 - (255 - (db.data[i] + db.data[i + 1] + db.data[i + 2]) / 3) * 0.25;
        out.data.set([v, v, v, 255], i);
      }
    }
    if(!spots) return {spots};
    const c = new OffscreenCanvas(ia.width, ia.height);
    c.getContext('2d').putImageData(out, 0, 0);
    const blob = await c.convertToBlob({type: 'image/png'});
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for(let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return {spots, diff: btoa(s)};
  }, [kept.toString('base64'), got.toString('base64'), SHADE]);
}

async function main(){
  if(!fs.existsSync(path.join(DIR, 'nexus.html'))){ console.error('snapshots: build first (python3 build.py).'); process.exit(2); }
  const page0 = referencePage();
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]);
    if(rel === '/' || rel === '/nexus.html'){ r.writeHead(200, {'Content-Type': MIME['.html']}); r.end(page0); return; }
    let body; try { body = fs.readFileSync(path.join(DIR, rel)); }
    catch(e){ r.writeHead(404); r.end('not found'); return; }
    r.writeHead(200, {'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream'});
    r.end(body);
  });
  await new Promise(r => srv.listen(PORT, r));
  /* Whatever Playwright installed for itself, and never a browser found
     elsewhere: the pictures are only comparable when they come from the
     very build that drew the kept ones, and that build is the one
     package-lock.json's Playwright names (its headless shell, in CI). */
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: VIEW, deviceScaleFactor: 1, reducedMotion: 'reduce'});
  const none = r => r.fulfill({status: 200, contentType: 'text/css', body: ''});
  await ctx.route('https://fonts.googleapis.com/**', none);
  await ctx.route('https://fonts.gstatic.com/**', none);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/nexus.html`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => typeof nodes !== 'undefined' && nodes.size > 0);
  /* Only the drawing: no text (see above), no grid or field behind it, no
     pointer anywhere near it, and nothing of the page's own over it. */
  await page.addStyleTag({content: `
    #canvas text, #canvas foreignObject { visibility: hidden !important; }
    #bgLayer { display: none !important; }
    body > *:not(.app), .app > *:not(.main), .main > *:not(#canvas):not(svg) { visibility: hidden !important; }
    * { animation: none !important; transition: none !important; caret-color: transparent !important; }
  `});
  await page.mouse.move(1, 1);

  if(!UPDATE) fs.rmSync(OUT, {recursive: true, force: true});
  let failed = 0, ran = 0;
  for(const s of SCENES){
    if(ONLY && !s.name.includes(ONLY)) continue;
    ran++;
    await page.evaluate(({x, y, k}) => { centreViewOn(x, y, k); }, {x: s.x, y: s.y, k: s.scale || SCALE});
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const box = await page.evaluate(() => { const r = document.getElementById('canvas').getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; });
    const clip = {x: Math.round(box.x - CLIP.width/2), y: Math.round(box.y - CLIP.height/2), width: CLIP.width, height: CLIP.height};
    const got = await page.screenshot({clip, animations: 'disabled'});
    const file = path.join(HERE, s.name + '.png');
    if(UPDATE){
      fs.writeFileSync(file, got);
      console.log(`  kept  ${s.name}`);
      continue;
    }
    if(!fs.existsSync(file)){
      failed++;
      console.log(`  FAIL  ${s.name}  — no picture kept for it; run with --update and look at it`);
      fs.mkdirSync(OUT, {recursive: true});
      fs.writeFileSync(path.join(OUT, s.name + '.actual.png'), got);
      continue;
    }
    const res = await compare(page, fs.readFileSync(file), got);
    if(res.size || res.spots > SPOTS){
      failed++;
      fs.mkdirSync(OUT, {recursive: true});
      fs.writeFileSync(path.join(OUT, s.name + '.actual.png'), got);
      if(res.diff) fs.writeFileSync(path.join(OUT, s.name + '.diff.png'), Buffer.from(res.diff, 'base64'));
      console.log(`  FAIL  ${s.name}  — ${res.size || res.spots + ' pixels differ'}; see tests/snapshots/out/`);
    } else {
      console.log(`  ok    ${s.name}${res.spots ? `  (${res.spots} pixels within slack)` : ''}`);
    }
  }
  if(errors.length){ failed++; console.log(`  FAIL  the page threw: ${errors[0]}`); }
  await browser.close();
  srv.close();
  if(ONLY && !ran){ console.log(`no scene matches "${ONLY}"`); process.exit(2); }
  console.log(UPDATE ? `\n${ran} pictures kept.` : `\n${ran - Math.min(failed, ran)} of ${ran} scenes look as they did.`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
