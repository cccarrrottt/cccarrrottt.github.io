/* The site, kept on the device.
 *
 * Installed from the home screen, the chart has to open where there is no
 * signal. This worker keeps a copy of the page and answers with it when
 * the network cannot — and ONLY then. The page is asked of the network
 * first, every time, because a copy that is behind the repository is the
 * one thing a Save must not be made from (see 36-site-owner.js): a page
 * served from the cache while the site has moved on would open as the
 * owner's editor on an old chart.
 *
 * A network that is merely slow is waited for a few seconds and no more;
 * then the kept copy is shown, and the network's answer, when it comes,
 * still replaces the copy for next time. The page itself says when the
 * repository has moved past it, so that copy never saves over anything.
 *
 * The pictures beside the page are the exception, and kept the other way
 * round: see aPicture.
 *
 * What it does not touch: anything on another origin — the write service,
 * whose every answer has to be live, and the webfonts, which the page does
 * without when they cannot be had.
 */
const CACHE = 'rhizome-site-1';
const PAGE = new URL('./', self.location).href;
const SHELL = ['./', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const PATIENCE = 4000;

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  if(req.mode === 'navigate' || url.href.split(/[?#]/)[0] === PAGE || url.pathname.endsWith('/index.html')){
    ev.respondWith(thePage());
    return;
  }
  if(/\/media\/[0-9a-f]{64}\.[a-z0-9]+$/.test(url.pathname)){
    ev.respondWith(aPicture(req));
    return;
  }
  ev.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});

/* A picture beside the chart is named by the hash of its bytes, so the copy
   kept is never behind: it is asked of the cache first, and kept the first
   time it is fetched — which is what lets a chart opened with no signal
   still show the pictures it showed the last time. Asked for in pieces (a
   clip being played), it goes to the network as asked and is kept whole
   only when the answer was whole. */
function aPicture(req){
  return caches.open(CACHE).then(c => c.match(req.url).then(hit => hit || fetch(req).then(res => {
    if(res.status === 200) c.put(req.url, res.clone());
    return res;
  })));
}

/* Every address in the site is the one page, kept under one key: the
   sign-in hands its session back as a fragment on the page's address, and
   a reader may arrive with a query on it. */
function thePage(){
  const fresh = fetch(PAGE, {cache: 'no-cache', credentials: 'same-origin'}).then(res => {
    if(res.ok){
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(PAGE, copy));
    }
    return res;
  });
  const kept = () => caches.match(PAGE);
  return new Promise(resolve => {
    let done = false;
    const give = res => { if(!done && res){ done = true; resolve(res); } };
    const timer = setTimeout(() => kept().then(give), PATIENCE);
    fresh.then(res => { clearTimeout(timer); give(res); },
               () => { clearTimeout(timer); kept().then(res => give(res || Response.error())); });
  });
}
