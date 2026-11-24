#!/usr/bin/env node
/* Rhizome Project — regression suite.
 *
 *   node tests/regression.js              test dist/nexus.html
 *   node tests/regression.js src          test src/index.html instead
 *
 * Every scenario is a real browser driving the real built page. There are no
 * unit tests here on purpose: almost everything this page does is geometry,
 * layout and event wiring, none of which a unit test can vouch for. The suite
 * serves the page over HTTP from a throwaway server, because half the point is
 * exercising the code paths that a file:// origin would take differently.
 */
/* Playwright comes from wherever this machine keeps it. The sandbox this
   chart grew up in ships a copy at a fixed path, with a browser beside it;
   a CI runner installs the npm package and lets Playwright find its own
   browser. Neither should have to know the other exists, so the suite asks
   for each in turn and takes the first that answers. */
const { chromium, webkit } = (() => {
  const tried = ['/opt/node-tools/node_modules/playwright-core',
                 'playwright', 'playwright-core'];
  for(const where of tried){
    try { return require(where); } catch(e){ /* next */ }
  }
  console.error('Playwright is not installed. Run: npm ci  (or npm i -D playwright)');
  process.exit(2);
})();
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');  // eslint-disable-line no-unused-vars -- read by tests/scenarios/, run by eval in main()

const ROOT = path.join(__dirname, '..');
const MODE = process.argv[2] === 'src' ? 'src' : 'dist';
const DIR  = path.join(ROOT, MODE);
const PAGE = MODE === 'src' ? 'index.html' : 'nexus.html';
/* 8830 unless told otherwise — the override is for running two suites at
   once, which is the only way they collide. */
const PORT = Number(process.env.RHIZOME_TEST_PORT) || 8830;

const MIME = {'.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
              '.js':'text/javascript; charset=utf-8'};

/* The chart the suite draws is its own, not the repository's.
 *
 * Every page the suite opens is the page as built, with its chart swapped
 * for tests/fixtures/chart.json — and its pictures, fonts and films served
 * from tests/fixtures/media. The suite used to draw whatever src/chart.json
 * held, which is the owner's chart and changes with every Save; eleven of
 * its checks read entries of that chart, so a copy of the project with a
 * chart of its own came out red on its first push of code (DISTRIBUTING.md,
 * "Your own chart"). The fixture is a chart as the owner's stood on
 * 21.11, kept still so the checks that lean on it have something that
 * does not move. */
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const FIXTURE_RAW = fs.readFileSync(path.join(FIXTURE_DIR, 'chart.json'));
const FIXTURE_SHA = require('crypto').createHash('sha1')
  .update(Buffer.concat([Buffer.from(`blob ${FIXTURE_RAW.length}\0`), FIXTURE_RAW])).digest('hex');
/* A built page with the fixture where its chart stood: the chart's script
   element as build.py writes it (chart_script), and the id of the file it
   was built from (rhizome-data-sha), which a Save is checked against. */
function withFixture(html){
  const text = String(html);
  const open = '<script type="application/json" id="chart-data">\n';
  const a = text.indexOf(open);
  if(a < 0) return text;
  const b = text.indexOf('\n</script>', a + open.length);
  if(b < 0) return text;
  const body = FIXTURE_RAW.toString('utf8').replace(/\n+$/, '').replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return (text.slice(0, a + open.length) + body + text.slice(b))
    .replace(/(<meta name="rhizome-data-sha" content=")[0-9a-f]*(")/, `$1${FIXTURE_SHA}$2`);
}
/* A picture, font or film the fixture names, from beside it; anything else
   from where the page was built. */
function mediaFile(rel){
  const m = /^\/?(media\/[0-9a-f]{64}\.[a-z0-9]+)$/.exec(rel);
  if(!m) return null;
  const own = path.join(FIXTURE_DIR, m[1]);
  return fs.existsSync(own) ? own : null;
}

let pass = 0, fail = 0;
const results = [];
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4z8DwnwEIGP4zMDAwAAAj7AT8W4yTIQAAAABJRU5ErkJggg==', 'base64');
function check(name, ok, detail){
  (ok ? pass++ : fail++);
  results.push({name, ok, detail});
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
}
function eq(name, got, want){  // eslint-disable-line no-unused-vars -- read by tests/scenarios/, run by eval in main()
  check(name, Object.is(got, want), Object.is(got, want) ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const wait = ms => new Promise(r => setTimeout(r, ms));
/* A wavy path is a polyline now — see wavyPath — so a test that wants its
   crests reads the points and picks the turning ones. Installed in the
   page, since that is where the tests run. */
/* The wave is drawn as curves, so its shape is not in the numbers of its
   path data — it is what those numbers describe. Both helpers therefore
   ask the browser: the path is measured, walked at a fine step, and what
   comes back is the line itself, whatever commands were used to write it
   down. A test written this way cannot go red because the emitter moved
   from segments to curves, which is exactly what it did. */
const WAVE_HELPERS = `
  window.wavePts = (d, step)=>{
    const svg = document.getElementById('canvas');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', String(d));
    p.setAttribute('style', 'display:none;');
    svg.appendChild(p);
    const out = [];
    try{
      const L = p.getTotalLength();
      const st = step || 0.4;
      for(let s = 0; s <= L + 1e-6; s += st){
        const q = p.getPointAtLength(Math.min(s, L));
        out.push({x:q.x, y:q.y});
      }
    } finally { p.remove(); }
    return out;
  };
  /* Where the line turns back on itself along one axis — the crests and
     troughs of a wave, in the order they come. Read with a deadband,
     because a sampled curve wobbles by a fraction of a unit around its
     extremes and every one of those wobbles is a turn if counted
     exactly. */
  window.waveCrests = (d, axis, band)=>{
    const p = wavePts(d);
    if(p.length < 3) return [];
    const tol = (typeof band === 'number') ? band : 0.2;
    const other = axis === 'y' ? 'x' : 'y';
    const out = [];
    let dir = 0, ext = p[0];
    for(let i = 1; i < p.length; i++){
      const q = p[i], v = q[axis], e = ext[axis];
      if(dir === 0){
        // Which way the line set off is not known until it has actually
        // gone somewhere; until then nothing is a turn.
        if(v > e + tol){ dir = 1; ext = q; }
        else if(v < e - tol){ dir = -1; ext = q; }
        continue;
      }
      if(dir === 1){
        if(v >= e) ext = q;
        else if(v < e - tol){ out.push(+ext[other].toFixed(1)); dir = -1; ext = q; }
      } else {
        if(v <= e) ext = q;
        else if(v > e + tol){ out.push(+ext[other].toFixed(1)); dir = 1; ext = q; }
      }
    }
    return out;
  };
`;

/* ---------------------------------------------------------------------
   The suite as named scenarios.

   This was one linear run of 8,700 lines. Every check in it was named, and
   the suite as a whole was not: there was no way to run one of them, so a
   one-line change cost twelve minutes and a failure could only be looked
   into by reading the log of everything that came before it. The sections
   had numbers, and by the end the numbers had stopped meaning anything —
   markers ran 1..41 and then 27b..27z while the TEXT of those same lines
   said "section 42".."section 65", two schemes disagreeing inside one line.

   So sections are named and addressable now, and nothing else about them
   changed: the wrapping added two lines per section and moved none of the
   bodies, which is why the diff that introduced it is 134 insertions and no
   deletions, and why the suite prints the same checks in the same order.

       node tests/regression.js                 everything, against dist
       node tests/regression.js src             everything, against src
       node tests/regression.js --list          what there is to run
       node tests/regression.js --only=callout  scenarios whose name matches
       node tests/regression.js --shard=0/4     every fourth one, from the
                                                first — four of these in
                                                parallel, on four ports, is
                                                the whole suite in a quarter
                                                of the time

   A scenario that throws is caught and counted, rather than ending the run.
   One broken scenario used to take the sixty after it with it, which is the
   opposite of what a suite is for.
   ------------------------------------------------------------------ */
const ARGS = process.argv.slice(2);
const argOf = (flag) => {
  const hit = ARGS.find(a => a.startsWith(flag + '='));
  return hit ? hit.slice(flag.length + 1) : null;
};
/* --only takes alternatives too, `a|b`: a scenario runs when its name holds
   any of them. No scenario's name has a bar in it. */
const ONLY = (argOf('--only') || '').toLowerCase();
const ONLY_ANY = ONLY ? ONLY.split('|').filter(Boolean) : [];
/* Which engine draws the page. Chromium unless told otherwise; WebKit is
   the engine of every browser on an iPhone, and CI runs a few scenarios in
   it (the "Regression in WebKit" job), because the suite's Chromium cannot
   say what a reader there sees. */
const ENGINE = argOf('--browser') || 'chromium';
if(ENGINE !== 'chromium' && ENGINE !== 'webkit'){
  console.error(`--browser is chromium or webkit, not ${ENGINE}`);
  process.exit(2);
}
const LIST = ARGS.includes('--list');
const SHARD = (() => {
  const v = argOf('--shard');
  if(!v) return null;
  const [i, of] = v.split('/').map(Number);
  if(!Number.isInteger(i) || !Number.isInteger(of) || of < 1 || i < 0 || i >= of){
    console.error(`--shard wants i/n with 0 <= i < n, not ${v}`);
    process.exit(2);
  }
  return {i, of};
})();

let sceneNo = 0, sceneRan = 0, sceneSkipped = 0;
const sceneTimes = [];
async function scenario(name, body){
  const index = sceneNo++;
  if(LIST){ console.log(`  ${String(index).padStart(3)}  ${name}`); return; }
  if(ONLY && !ONLY_ANY.some(o => name.toLowerCase().includes(o))){ sceneSkipped++; return; }
  if(SHARD && index % SHARD.of !== SHARD.i){ sceneSkipped++; return; }
  const t0 = Date.now();
  try{
    if(sceneRan++ && freshPage) await freshPage();
    await body();
  }catch(e){
    // Counted as a failure of this scenario, not as the end of the run.
    check(`scenario “${name}” threw`, false, (e && e.message) || String(e));
  }
  sceneTimes.push({name, ms: Date.now() - t0});
}

/* Set by main() once the page is up: see there. */
let freshPage = null;

async function main(){
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]);
    const p = mediaFile(rel) || path.join(DIR, rel === '/' ? PAGE : rel);
    if(rel === '/favicon.ico'){ r.writeHead(204); r.end(); return; }
    let body; try { body = rel === '/chart.json' ? FIXTURE_RAW : fs.readFileSync(p); }
    catch(e){ r.writeHead(404); r.end('not found'); return; }
    if(path.extname(p) === '.html') body = withFixture(body);
    r.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    r.end(body);
  });
  await new Promise(r => srv.listen(PORT, r));
  /* The pinned browser if this machine has one, otherwise whatever
     Playwright installed for itself. */
  const PINNED = '/opt/pw-browsers/chromium';
  const browser = ENGINE === 'webkit' ? await webkit.launch()
    : await chromium.launch(fs.existsSync(PINNED) ? {executablePath: PINNED} : {});

  const errors = [];
  const ctx = await browser.newContext({viewport:{width:1500, height:950}});

  /* The webfonts are answered here, with nothing, on purpose.
   *
   * They used to be left to the network and the resulting console error
   * filtered out by matching the message text against the host name. That
   * does not work: Chromium reports a blocked stylesheet as "Failed to load
   * resource: net::ERR_…" and does not put the URL in the message, so the
   * filter matched nothing and every run on a machine without a route to
   * Google Fonts came out red — this one included, for a whole day, on a
   * check whose name says "no uncaught page errors".
   *
   * A suite that goes red because a third party is unreachable is testing
   * the network. So the request never leaves: both hosts are answered with
   * an empty stylesheet, which is exactly the case README promises works —
   * the page falls back to system faces and is otherwise unchanged. Every
   * machine now runs the same test, and the check can go back to meaning
   * what it says.
   */
  let fontsAsked = 0;  // eslint-disable-line no-unused-vars -- read by tests/scenarios/, run by eval in main()
  const noFonts = r => { fontsAsked++; return r.fulfill({status: 200, contentType: 'text/css', body: ''}); };
  await ctx.route('https://fonts.googleapis.com/**', noFonts);
  await ctx.route('https://fonts.gstatic.com/**', noFonts);
  /* The site icon an entry's link wears is asked of a public service;
     answered here with a two-pixel picture, for the reason the fonts are. */
  await ctx.route('https://icons.duckduckgo.com/**', r => r.fulfill({status: 200, contentType: 'image/png', body: TINY_PNG}));

  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  /* The server answers /favicon.ico with a 204, so nothing here is about
     it any more; what is left is filtered because a machine may still have
     its own opinions about name resolution. */
  const NOISE = /favicon|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/i;
  page.on('console', m => { if(m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('requestfailed', () => {});

  console.log(`\nRhizome Project regression — ${MODE}/${PAGE}${ENGINE === 'chromium' ? '' : ', in ' + ENGINE}\n`);

  await page.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
  await page.evaluate(WAVE_HELPERS);
  /* The chart exactly as the file holds it, kept aside before any scenario
     has touched it. EDGE_STYLES is the data array itself — refilled in
     place by whoever needs a chart of their own — so a scenario that
     forgets to put it back leaves every later scenario looking at a chart
     whose connectors have lost the sides they were given. The one check
     that reads the WHOLE chart restores from this first. */
  await page.evaluate(()=>{
    window.__pristine = {
      nodes: workingNodes.map(item=> item.slice()),
      styles: EDGE_STYLES.map(x=> Object.assign({}, x))
    };
  });
  await wait(1500);

  /* Every scenario after the first starts on a page just opened, as the
   * first does.
   *
   * The scenarios share one page, and many leave it as they used it: a
   * chart of their own put back only in part, settings changed, a drawer
   * open, the view far away, something in storage. In shards each
   * scenario follows other ones than in a whole run, so a whole run could
   * fail where all four shards passed — five checks did, unseen,
   * because CI runs shards. Putting everything back by hand in
   * each scenario is a promise every new one has to keep; opening the
   * page again keeps it for them. Storage is emptied first, or the page
   * would open on what a scenario left there (off the site, a chart in
   * localStorage is restored). A reload is about a quarter of a second.
   * What a scenario sets up on the page object — a route, a listener —
   * is its own business; routes are dropped, the window's size put back. */
  const PAGE_URL = `http://127.0.0.1:${PORT}/${PAGE}`;
  freshPage = async () => {
    await page.evaluate(async () => {
      try{ localStorage.clear(); sessionStorage.clear(); }catch(e){}
      try{ for(const d of (indexedDB.databases ? await indexedDB.databases() : [])) indexedDB.deleteDatabase(d.name); }catch(e){}
    }).catch(() => {});
    if(page.unrouteAll) await page.unrouteAll({behavior: 'ignoreErrors'});
    await page.setViewportSize({width: 1500, height: 950});
    await page.goto(PAGE_URL, {waitUntil: 'load'});
    await page.waitForFunction(() => typeof rebuildChart === 'function' && document.querySelector('#nodeLayer .node'));
    await page.evaluate(WAVE_HELPERS);
    await page.evaluate(()=>{
      window.__pristine = {
        nodes: workingNodes.map(item=> item.slice()),
        styles: EDGE_STYLES.map(x=> Object.assign({}, x))
      };
    });
    await page.evaluate(() => document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))));
  };

  /* The scenarios are in tests/scenarios/, a file to a stretch of the
   * suite's history, run in the order this list gives — which is the order
   * they always ran in, so --list, --only and the shards name and number
   * them as before.
   *
   * They are not modules, for the reason the page's parts are not: every
   * scenario reads what this function has set up — `page`, `ctx`,
   * `browser`, `errors`, `fontsAsked` — and the helpers above it, and the
   * scenarios were all written against that one scope. Handing each file a
   * list of what it may use would have meant rewriting every body, and a
   * rewrite of 26,000 lines of checks is the one change nobody could check.
   * So each file is run by a direct eval here, inside this function, where
   * it sees exactly what it saw when it was part of this file; the bodies
   * moved without a byte changed. The sourceURL makes a stack trace name
   * the file and its line.
   *
   * A file on disk that this list does not name, or a name with no file,
   * stops the suite: a scenario that silently never runs is the failure
   * this suite exists to prevent. A new scenario goes into the file of its
   * time, or a new file at the end of the list. */
  const SCENARIO_FILES = [
    '01-core.js',
    '02-early-rounds.js',
    '03-published-site.js',
    '04-later-rounds.js',
    '05-work-not-repeated.js',
    '06-october-lists.js',
    '07-november-lists.js',
    '08-late-november.js',
  ];
  {
    const dir = path.join(__dirname, 'scenarios');
    const onDisk = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
    const listed = SCENARIO_FILES.slice().sort();
    if(onDisk.join() !== listed.join()){
      console.error(`tests/scenarios/ holds ${onDisk.join(', ')}, and SCENARIO_FILES names ${listed.join(', ')}`);
      process.exit(2);
    }
  }
  for(const file of SCENARIO_FILES){
    const where = path.join(__dirname, 'scenarios', file);
    // One line of wrapper, before the file's first: its lines keep their numbers.
    await eval('(async () => {' + fs.readFileSync(where, 'utf8') + '\n})()\n//# sourceURL=' + where);
  }


  await scenario("nothing threw along the way", async () => {
  check('no uncaught page errors', errors.length === 0, errors.slice(0, 4).join(' | '));

  });
  await browser.close(); srv.close();
  if(LIST){
    console.log(`\n${sceneNo} scenarios\n`);
    process.exit(0);
  }
  /* A filter that matched nothing exited 0, which reads exactly like a run
     that passed — the worst possible answer to a mistyped scenario name,
     because the mistake looks like success and the change looks tested. */
  if(!sceneRan){
    console.error(`\nno scenario matched ${ONLY ? `--only=${ONLY}` : 'the filter'}` +
                  ` — nothing ran. node tests/regression.js --list names them.\n`);
    process.exit(2);
  }
  /* The three slowest, every run. Which scenarios are worth putting in a
     quick set is a question about where the time actually goes, and the
     suite is the only thing that knows — naming them here is cheaper than
     guessing, and keeps the answer current as scenarios are added. */
  const slowest = sceneTimes.slice().sort((a, b) => b.ms - a.ms).slice(0, 3)
    .map(s => `${s.name} ${(s.ms / 1000).toFixed(1)}s`).join(', ');
  console.log(`\n${pass} passed, ${fail} failed` +
              ` — ${sceneRan} scenario${sceneRan === 1 ? '' : 's'}` +
              (sceneSkipped ? `, ${sceneSkipped} skipped` : '') +
              (slowest ? `\nslowest: ${slowest}` : '') + '\n');
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('SUITE CRASHED', e); process.exit(1); });
