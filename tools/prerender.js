/* The site's first drawing, put in the page itself.
 *
 * A reader on a slow phone waited two seconds for the chart: the page
 * arrives in a fraction of that, and then the program has to come down
 * (two hundred kilobytes) and run before anything is drawn. So the chart
 * the program would draw is drawn once here, when the site is published,
 * and written into dist/site/index.html as plain SVG. The reader sees it as
 * soon as the page is there; the program, when it arrives, takes it away in
 * the same moment it draws its own (dropPrerendered, 13-render-nodes.js),
 * so there is never a frame with neither.
 *
 * The drawing is a reader's: read-only, nothing picked, the faces loaded,
 * and no pictures (see snapshotInPage).
 * It is placed by a few lines that do what openingView does — the view this
 * reader left the chart at, or the origin in the middle — so the program's
 * own first frame lands where this one was. It is between markers, and
 * taken out of anything made from the page's source (inlineSiteFiles,
 * 20-about.js): an exported copy carries no drawing of the chart it was.
 *
 * A failure here leaves the page as it was built; the site is then only
 * slower to show, never wrong. CI runs it in the Pages job, on the Chrome
 * the runner already has.
 *
 *     node tools/prerender.js            # rewrites dist/site/index.html
 *     node tools/prerender.js some/site  # another staged site
 */
const fs = require('fs'), path = require('path'), http = require('http');

const BEGIN = '<!--rhizome:prerendered-->', END = '<!--/rhizome:prerendered-->';
const VIEWPORT = '<g id="viewport"></g>';

/* Everything the program drew into the world: its definitions and the
   layers under the view. Numbers in attributes are cut to two places — a
   route's coordinates come out of the arithmetic with fifteen — which is
   a third of the size and nothing anyone can see. Text is left alone. */
function snapshotInPage(){
  const short = v => v.replace(/(\d+\.\d\d)\d+/g, '$1');
  const tidy = root => {
    root.querySelectorAll('*').forEach(e => {
      for(const a of Array.from(e.attributes)){
        if(/\d\.\d{3}/.test(a.value)) e.setAttribute(a.name, short(a.value));
        // A key joined with a NUL is fine in the DOM and a parse error in a page.
        if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(a.value)) e.setAttribute(a.name, a.value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' '));
      }
      e.classList.remove('hover', 'selected', 'lit');
    });
    /* No pictures. They would be fetched alongside the program and hold it
       up — measured on a slow phone, by a second — and the program draws
       them a moment later anyway. Their place is kept. */
    root.querySelectorAll('image').forEach(e => { e.removeAttribute('href'); e.removeAttributeNS('http://www.w3.org/1999/xlink', 'href'); });
    return root;
  };
  const defs = tidy(document.getElementById('svgDefs').cloneNode(true));
  const view = tidy(document.getElementById('viewport').cloneNode(true));
  // The counts in the top bar, so they do not read nought until the program comes.
  const stats = ['statNodes', 'statEdges', 'statClusters'].map(id=> document.getElementById(id).textContent);
  return {defs: defs.innerHTML, view: view.innerHTML, stats};
}

/* What openingView would do, before the program is there to do it, and the
   counts the top bar will show. Kept in
   step with openingView and centreViewOn (18-canvas-gestures.js), VIEW_KEY
   and STORE_KEY (01-store.js) and setTheme; the suite checks the two land
   in the same place. */
const place = stats => `(function(){try{
['statNodes','statEdges','statClusters'].forEach(function(id,i){document.getElementById(id).textContent=${JSON.stringify(stats.map(String))}[i];});
var key=location.pathname+location.search||'default',v=null,x=0,y=0,s=1,t=null;
try{v=JSON.parse(localStorage.getItem('rhizome.view:'+key)||localStorage.getItem('rhizome.view')||'null');}catch(e){}
if(v&&isFinite(v.x)&&isFinite(v.y)&&isFinite(v.s)&&v.s>0){x=v.x;y=v.y;s=Math.min(3,Math.max(0.08,v.s));}
var r=document.getElementById('canvas').getBoundingClientRect();
document.getElementById('prerenderedView').setAttribute('transform','translate('+(r.width/2-x*s)+','+(r.height/2-y*s)+') scale('+s+')');
try{t=localStorage.getItem('rhizome.theme');}catch(e){}
if(t==='dark')document.documentElement.setAttribute('data-theme','dark');
}catch(e){}})();`;

function withSnapshot(html, snap){
  if(html.includes(BEGIN)) html = withoutSnapshot(html);
  const at = html.indexOf(VIEWPORT);
  if(at < 0 || html.indexOf(VIEWPORT, at + 1) >= 0) throw new Error('the page has no single empty viewport to draw beside');
  const close = html.indexOf('</svg>', at);
  if(close < 0) throw new Error('the chart’s <svg> is not closed');
  if(/<\/script/i.test(snap.defs + snap.view)) throw new Error('the drawing holds a closing script tag');
  const drawing = `${BEGIN}<g id="prerendered" aria-hidden="true"><defs>${snap.defs}</defs>` +
                  `<g id="prerenderedView">${snap.view}</g></g>${END}`;
  const after = close + '</svg>'.length;
  return html.slice(0, at + VIEWPORT.length) + drawing + html.slice(at + VIEWPORT.length, after) +
         `\n${BEGIN}<script>${place(snap.stats || ['0', '0', '0'])}</script>${END}` + html.slice(after);
}
function withoutSnapshot(html){
  return html.split(BEGIN).map((piece, i)=> i ? piece.slice(piece.indexOf(END) + END.length) : piece).join('');
}

function serve(dir){
  const types = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8',
                 '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
                 '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'};
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    // The pictures sit beside the site in dist/media, as CI stages them.
    const file = rel.startsWith('media/') ? path.join(dir, '..', rel) : path.join(dir, rel);
    if(!file.startsWith(path.resolve(dir, '..'))){ res.statusCode = 404; return res.end(); }
    fs.readFile(file, (e, b) => {
      if(e){ res.statusCode = 404; return res.end(); }
      res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
      res.end(b);
    });
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

/* The drawing a reader of `dir` would get, from a browser the caller has. */
async function drawingOf(browser, dir, opts){
  const srv = await serve(path.resolve(dir));
  const ctx = await browser.newContext({viewport: {width: 1500, height: 950}, serviceWorkers: 'block'});
  try{
    const page = await ctx.newPage();
    if(opts && opts.route) await opts.route(page);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`, {waitUntil: 'load'});
    await page.waitForFunction(() => typeof rebuildChart === 'function', null, {timeout: 30000});
    // The faces an entry asks for arrive after the first drawing; give them a moment.
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 5000))]));
    await page.waitForTimeout(600);
    if(errors.length) throw new Error('the page failed while starting: ' + errors[0]);
    await page.evaluate(() => { markReadOnly(); deselect(); rebuildChart(); });
    return await page.evaluate(snapshotInPage);
  } finally {
    await ctx.close();
    srv.close();
  }
}

async function launch(){
  const {chromium} = require('playwright');
  const PINNED = '/opt/pw-browsers/chromium';
  const exe = process.env.PRERENDER_BROWSER || (fs.existsSync(PINNED) ? PINNED : null);
  return exe ? chromium.launch({executablePath: exe}) : chromium.launch({channel: 'chrome'});
}

module.exports = {withSnapshot, withoutSnapshot, drawingOf, BEGIN, END};

if(require.main === module){
  (async () => {
    const dir = process.argv[2] || path.join(__dirname, '..', 'dist', 'site');
    const file = path.join(dir, 'index.html');
    const browser = await launch();
    try{
      const snap = await drawingOf(browser, dir);
      const html = withSnapshot(fs.readFileSync(file, 'utf8'), snap);
      fs.writeFileSync(file, html);
      const kb = Buffer.byteLength(snap.defs + snap.view) / 1024;
      console.log(`prerender: ${file} now carries the first drawing (${kb.toFixed(0)} KB before compression)`);
    } finally {
      await browser.close();
    }
  })().catch(e => {
    // Never a failed publish: the page stays as built, only slower to show.
    console.log('prerender: left the page as built — ' + (e && e.message || e));
    process.exitCode = 0;
  });
}
