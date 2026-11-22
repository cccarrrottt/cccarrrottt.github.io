/* How much of the program a reader runs.
 *
 * Every reader of the site downloads the whole program, the editor's code
 * with it, because the page decides who may edit only once it is open.
 * CLAUDE.md allows one way to change that — the editing parts loaded
 * lazily from the one codebase — and this is the measurement that says
 * whether it is worth doing: the page opened on the site's address as a
 * reader, read the way a reader reads it (a pan, the wheel, an entry
 * pointed at and picked, a search, every drawer, About and the text
 * version), and the byte coverage of the program taken part by part.
 *
 * Code that ran is counted at the byte; a function that was never called,
 * and the untaken branches of one that was, are not. So "never ran" is an
 * upper bound on what lazy loading could take away: some of it is error
 * handling a reader needs on a bad day, and some is reached by a gesture
 * this script does not make.
 *
 *     node tools/bench-reader-code.js          # against dist/, so build first
 */
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const build = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
const PARTS = [.../APP_PARTS = \[([\s\S]*?)\]/.exec(build)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const config = fs.readFileSync(path.join(ROOT, 'src', 'app', '00-config.js'), 'utf8');
const SITE = /^\s*site: '([^']+)'/m.exec(config)[1];
const API = /^\s*api: '([^']*)'/m.exec(config)[1];

/* Bytes that ran, from V8's block coverage: each function's ranges nest,
   and the innermost range over a byte says how often it ran. */
function ranBytes(fns, length){
  const ran = new Uint8Array(length);
  const ranges = fns.flatMap(f => f.ranges).sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  for(const r of ranges) ran.fill(r.count > 0 ? 1 : 0, r.startOffset, Math.min(r.endOffset, length));
  return ran;
}

async function readAsAReader(page){
  const c = await page.locator('#canvas').boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down(); await page.mouse.move(c.x + c.width / 2 - 200, c.y + c.height / 2 - 80, {steps: 8}); await page.mouse.up();
  await page.mouse.wheel(0, -400); await page.waitForTimeout(250);
  await page.mouse.wheel(0, 300); await page.waitForTimeout(250);
  const node = page.locator('#nodeLayer .node').first();
  const nb = await node.boundingBox();
  if(nb){ await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2); await page.waitForTimeout(600); await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2); await page.waitForTimeout(400); }
  await page.locator('#searchInput').fill('ma'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  for(const id of ['tagsTab', 'refsTab', 'keyTab', 'mediaTab', 'minimapTab']){
    const tab = page.locator('#' + id);
    if(await tab.isVisible()){ await tab.click(); await page.waitForTimeout(250); await tab.click(); }
  }
  await page.locator('#aboutToggle').click(); await page.waitForTimeout(300);
  const tv = page.locator('#textViewToggle');
  if(await tv.isVisible()){ await tv.click(); await page.waitForTimeout(400); await page.keyboard.press('Escape'); }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

}

(async () => {
  const html = fs.readFileSync(path.join(ROOT, 'dist', 'nexus.html'), 'utf8');
  const program = PARTS.map(n => fs.readFileSync(path.join(ROOT, 'src', 'app', n), 'utf8')).join('');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 1500, height: 950}, serviceWorkers: 'block'});
  const quiet = r => r.fulfill({status: 200, contentType: 'text/css', body: ''});
  await ctx.route('https://fonts.googleapis.com/**', quiet);
  await ctx.route('https://fonts.gstatic.com/**', quiet);
  await ctx.route('https://api.github.com/**', r => r.fulfill({status: 200, headers: {'Access-Control-Allow-Origin': '*'}, contentType: 'application/json', body: '[]'}));
  await ctx.route(API + '/**', r => r.fulfill({status: 401, headers: {'Access-Control-Allow-Origin': SITE}, contentType: 'application/json', body: '{"error":"not signed in."}'}));
  await ctx.route(SITE + '/**', r => {
    const u = new URL(r.request().url());
    const file = path.join(ROOT, 'dist', u.pathname);
    if(u.pathname.startsWith('/media/') && fs.existsSync(file)) return r.fulfill({status: 200, body: fs.readFileSync(file)});
    return r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html});
  });
  const page = await ctx.newPage();
  await page.coverage.startJSCoverage({resetOnNavigation: false, reportAnonymousScripts: false});
  await page.goto(SITE + '/');
  await page.waitForFunction(() => document.querySelector('#nodeLayer .node') && document.body.classList.contains('read-only'));
  await readAsAReader(page);

  const cov = await page.coverage.stopJSCoverage();
  const script = cov.find(s => s.source && s.source.includes(program.slice(0, 2000)));
  if(!script) throw new Error('the program was not among the scripts the page ran');
  const at = script.source.indexOf(program);
  if(at < 0) throw new Error('the script is not the parts written out in order');
  const ran = ranBytes(script.functions, script.source.length);

  let off = at, rows = [], all = 0, allRan = 0;
  for(const n of PARTS){
    const len = fs.readFileSync(path.join(ROOT, 'src', 'app', n), 'utf8').length;
    let r = 0;
    for(let i = off; i < off + len; i++) r += ran[i];
    rows.push({n, len, r});
    all += len; allRan += r; off += len;
  }
  rows.sort((a, b) => (b.len - b.r) - (a.len - a.r));
  console.log(`\nA reader on the site — what of the program ran\n`);
  console.log(`  ${'part'.padEnd(22)} ${'chars'.padStart(8)} ${'ran'.padStart(6)} ${'never ran'.padStart(10)}`);
  for(const x of rows) console.log(`  ${x.n.padEnd(22)} ${String(x.len).padStart(8)} ${(Math.round(100 * x.r / x.len) + '%').padStart(6)} ${String(x.len - x.r).padStart(10)}`);
  console.log(`\n  the sources, comments and all: ${all} chars, ${Math.round(100 * allRan / all)}% ran`);
  await ctx.close();

  /* The same reading of the site as it is published, minified, which is
     what a reader downloads: what share of those bytes ran. The parts
     cannot be told apart in it, so this is the total only. */
  const SITE_DIR = path.join(ROOT, 'dist', 'site');
  const siteHtml = fs.readFileSync(path.join(SITE_DIR, 'index.html'), 'utf8');
  const ctx2 = await browser.newContext({viewport: {width: 1500, height: 950}, serviceWorkers: 'block'});
  await ctx2.route('https://fonts.googleapis.com/**', quiet);
  await ctx2.route('https://fonts.gstatic.com/**', quiet);
  await ctx2.route('https://api.github.com/**', r => r.fulfill({status: 200, headers: {'Access-Control-Allow-Origin': '*'}, contentType: 'application/json', body: '[]'}));
  await ctx2.route(API + '/**', r => r.fulfill({status: 401, headers: {'Access-Control-Allow-Origin': SITE}, contentType: 'application/json', body: '{"error":"not signed in."}'}));
  await ctx2.route(SITE + '/**', r => {
    const u = new URL(r.request().url());
    const name = u.pathname.slice(1);
    if(/^[\w.-]+\.(js|css)$/.test(name) && fs.existsSync(path.join(SITE_DIR, name)))
      return r.fulfill({status: 200, contentType: name.endsWith('.css') ? 'text/css' : 'text/javascript', body: fs.readFileSync(path.join(SITE_DIR, name))});
    const file = path.join(ROOT, 'dist', u.pathname);
    if(u.pathname.startsWith('/media/') && fs.existsSync(file)) return r.fulfill({status: 200, body: fs.readFileSync(file)});
    return r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: siteHtml});
  });
  const p2 = await ctx2.newPage();
  /* A reader's page that throws, or that asks for the editor's file, has
     reached into the editing parts (LAZY_PARTS, build.py) — which is what
     this reading is for finding before a reader does. */
  const faults = [], asked = [];
  p2.on('pageerror', e => faults.push(e.message));
  p2.on('request', r => { if(/\/editor\.[0-9a-f]+\.js$/.test(r.url())) asked.push(r.url()); });
  await p2.coverage.startJSCoverage({resetOnNavigation: false});
  await p2.goto(SITE + '/');
  await p2.waitForFunction(() => document.querySelector('#nodeLayer .node') && document.body.classList.contains('read-only'));
  await readAsAReader(p2);
  const cov2 = await p2.coverage.stopJSCoverage();
  const app = cov2.find(s => /\/app\.[0-9a-f]+\.js$/.test(s.url));
  const ran2 = ranBytes(app.functions, app.source.length);
  let kept = '', dropped = '';
  for(let i = 0; i < app.source.length; i++) (ran2[i] ? (kept += app.source[i]) : (dropped += app.source[i]));
  const gz = s => zlib.gzipSync(Buffer.from(s), {level: 9}).length;
  const kb = n => Math.round(n / 1024) + ' KB';
  console.log(`  the site's program:  ${kb(app.source.length)}, ${kb(gz(app.source))} gzipped`);
  console.log(`    ran for a reader   ${Math.round(100 * kept.length / app.source.length)}% of its bytes`);
  console.log(`    never ran          ${kb(dropped.length)}, ${kb(gz(dropped))} gzipped on its own`);
  const editor = fs.readdirSync(SITE_DIR).find(n => /^editor\.[0-9a-f]+\.js$/.test(n));
  if(editor){
    const text = fs.readFileSync(path.join(SITE_DIR, editor), 'utf8');
    console.log(`  the editor, fetched only for the owner: ${kb(text.length)}, ${kb(gz(text))} gzipped`);
  }
  console.log(`  the reader's page threw ${faults.length} time(s), and asked for the editor ${asked.length}`);
  for(const f of faults) console.log('    ' + f);
  if(faults.length || asked.length) process.exitCode = 1;
  await browser.close();
})();
