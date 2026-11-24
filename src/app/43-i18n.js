/* ---- The page in another language (the owner's list of 19.11) --------
 *
 * The page speaks English, and src/i18n/<lang>.json holds every text it
 * says, each with a translation written by hand (tools/i18n.js gathers
 * them; the build carries the ones written into the page, in the
 * #i18n-data element, beside the chart). Choosing a language puts a text's
 * translation in place of the English wherever that text turns up — in
 * the page's own words and titles, placeholders and labels, and in every
 * menu, message and tooltip the program writes later, which the observer
 * below catches as it lands. A text with no translation yet stays in
 * English, so a half-translated page is a page half in each, never a page
 * with holes.
 *
 * What a person wrote is never translated: the chart's own words (every
 * text drawn on it, only its tooltips are the page's), what is typed into
 * a field, and anything inside an element marked translate="no". In
 * English nothing here runs at all, so the page as it always was costs
 * nothing more.
 *
 * The program is not touched to translate it. The keys are its texts as
 * the screen shows them, so a key is found by what is on screen, and a
 * text the program builds from pieces — "Imported {0} {1}." — is matched
 * with the pieces in their places, which the translation may reorder. */
const LANG_KEY = 'rhizome.lang';
const LANG_NAMES = {en: 'English', ru: 'Русский'};
const LANG_TABLES = (()=>{
  try{
    const e = document.getElementById('i18n-data');
    const t = e && JSON.parse(e.textContent);
    return t && typeof t === 'object' ? t : {};
  }catch(err){ return {}; }
})();
/* A language is offered once most of the page can speak it. The menu
   offered Russian from the day the texts were gathered, with not one of
   them translated: choosing it changed nothing, a button that does not
   work. A half-translated page is still allowed, as the note above says —
   only not one that is nearly all English. The build counts every text
   (`total`) beside the ones written. */
const LANG_READY = 0.8;
function langReady(lang){
  if(lang === 'en') return true;
  const t = LANG_TABLES[lang];
  if(!LANG_NAMES[lang] || !t || !t.strings || !(t.total > 0)) return false;
  return Object.keys(t.strings).length / t.total >= LANG_READY;
}
let pageLang = 'en';
try{ const was = localStorage.getItem(LANG_KEY); if(was && LANG_NAMES[was] && langReady(was)) pageLang = was; }catch(e){}

const I18N_ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
let i18nExact = null, i18nShaped = [], i18nObserver = null;
const i18nTextWas = new WeakMap();     // text node -> its English
const i18nAttrWas = new WeakMap();     // element -> {attr: its English}
const i18nNorm = s=> s.replace(/[ \t\n\r\f]+/g, ' ').trim();

function i18nLoad(lang){
  i18nExact = new Map(); i18nShaped = [];
  const strings = (LANG_TABLES[lang] && LANG_TABLES[lang].strings) || {};
  Object.keys(strings).forEach(k=>{
    const v = strings[k];
    if(typeof v !== 'string' || !v) return;
    if(!/\{\d+\}/.test(k)){ i18nExact.set(k, v); return; }
    /* A text with pieces in it: the English around the pieces must be
       there as it is, and each piece is whatever stands in its place. The
       longest fixed run is asked for first, which rules most texts out
       before a pattern is tried. */
    const order = [];
    const re = new RegExp('^' + k.split(/(\{\d+\})/).map(p=>{
      const m = p.match(/^\{(\d+)\}$/);
      if(m){ order.push(+m[1]); return '([\\s\\S]+?)'; }
      return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('') + '$');
    const runs = k.split(/\{\d+\}/).sort((a, b)=> b.length - a.length);
    i18nShaped.push({re, order, to: v, run: runs[0]});
  });
}
function i18nTranslate(english){
  const k = i18nNorm(english);
  if(!k) return null;
  const hit = i18nExact.get(k);
  if(hit != null) return hit;
  for(const s of i18nShaped){
    if(s.run && k.indexOf(s.run) < 0) continue;
    const m = k.match(s.re);
    if(!m) continue;
    const got = {};
    s.order.forEach((n, i)=>{ got[n] = m[i + 1]; });
    return s.to.replace(/\{(\d+)\}/g, (all, n)=> got[n] != null ? got[n] : all);
  }
  return null;
}
/* Whether an element's words are a person's rather than the page's. */
function i18nIsTheirs(e){
  for(let x = e; x && x.nodeType === 1; x = x.parentNode){
    if(x.getAttribute('translate') === 'no' || x.isContentEditable) return true;
    const tag = x.tagName;
    if(tag === 'TEXTAREA' || tag === 'SCRIPT' || tag === 'STYLE') return true;
    // On the chart only a tooltip is the page's; everything else drawn there is the chart.
    if(x.id === 'canvas') return true;
  }
  return false;
}
function i18nOnChart(e){ return !!(e.closest && e.closest('#canvas')); }
function i18nText(t){
  const p = t.parentNode;
  if(!p || p.nodeType !== 1) return;
  const english = i18nTextWas.has(t) ? i18nTextWas.get(t) : t.nodeValue;
  const isTitle = p.tagName === 'title' && i18nOnChart(p);
  if(!isTitle && i18nIsTheirs(p)) return;
  const to = i18nTranslate(english);
  if(to == null) return;
  const lead = english.match(/^\s*/)[0], tail = english.match(/\s*$/)[0];
  const next = lead + to + tail;
  if(t.nodeValue === next) return;
  i18nTextWas.set(t, english);
  t.nodeValue = next;
}
function i18nAttrsOf(e){
  if(e.closest && e.closest('#canvas')) return;
  if(i18nIsTheirs(e) && !(e.tagName === 'TEXTAREA' || e.tagName === 'INPUT')) return;
  I18N_ATTRS.forEach(a=>{
    if(!e.hasAttribute(a)) return;
    const was = i18nAttrWas.get(e) || {};
    const now = e.getAttribute(a);
    // The program wrote it afresh: what it wrote is the English now.
    const english = (a in was && now === was[a + ':to']) ? was[a] : now;
    const to = i18nTranslate(english);
    if(to == null || to === now) return;
    was[a] = english; was[a + ':to'] = to;
    i18nAttrWas.set(e, was);
    e.setAttribute(a, to);
  });
}
function i18nTree(root){
  if(root.nodeType === 3){ i18nText(root); return; }
  if(root.nodeType !== 1 && root.nodeType !== 11) return;
  if(root.nodeType === 1 && i18nOnChart(root)){
    // The chart: its tooltips, nothing else.
    (root.tagName === 'title' ? [root] : [...root.querySelectorAll('title')])
      .forEach(t=> t.firstChild && i18nText(t.firstChild));
    return;
  }
  if(root.nodeType === 1) i18nAttrsOf(root);
  const walk = document.createTreeWalker(root, window.NodeFilter.SHOW_ELEMENT | window.NodeFilter.SHOW_TEXT, {
    acceptNode: n=> n.nodeType === 1 && (n.id === 'canvas' || n.getAttribute('translate') === 'no' || n.isContentEditable)
      ? window.NodeFilter.FILTER_REJECT : window.NodeFilter.FILTER_ACCEPT
  });
  for(let n = walk.nextNode(); n; n = walk.nextNode()){
    if(n.nodeType === 3) i18nText(n); else i18nAttrsOf(n);
  }
  if(root.nodeType === 1 && root.querySelector && root.querySelector('#canvas'))
    [...document.querySelectorAll('#canvas title')].forEach(t=> t.firstChild && i18nText(t.firstChild));
}
function i18nStart(){
  i18nLoad(pageLang);
  document.documentElement.lang = pageLang;
  if(!i18nExact.size && !i18nShaped.length) return;
  i18nTree(document.body);
  i18nObserver = new MutationObserver(list=>{
    list.forEach(m=>{
      if(m.type === 'childList') m.addedNodes.forEach(n=> i18nTree(n));
      else if(m.type === 'characterData'){
        // The program wrote the text again: what it wrote is the English now.
        if(i18nTextWas.has(m.target) && m.target.nodeValue !== i18nTranslateShown(m.target)) i18nTextWas.delete(m.target);
        i18nText(m.target);
      }
      else if(m.type === 'attributes') i18nAttrsOf(m.target);
    });
  });
  i18nObserver.observe(document.body, {subtree: true, childList: true, characterData: true,
                                       attributes: true, attributeFilter: I18N_ATTRS});
}
function i18nTranslateShown(t){
  const english = i18nTextWas.get(t);
  const to = english == null ? null : i18nTranslate(english);
  if(to == null) return null;
  return english.match(/^\s*/)[0] + to + english.match(/\s*$/)[0];
}
/* Back to English: everything put back as the program wrote it. */
function i18nStop(){
  if(i18nObserver){ i18nObserver.disconnect(); i18nObserver = null; }
  const walk = document.createTreeWalker(document.body, window.NodeFilter.SHOW_ELEMENT | window.NodeFilter.SHOW_TEXT);
  for(let n = walk.nextNode(); n; n = walk.nextNode()){
    if(n.nodeType === 3){
      if(i18nTextWas.has(n)){ n.nodeValue = i18nTextWas.get(n); i18nTextWas.delete(n); }
    } else {
      const was = i18nAttrWas.get(n);
      if(!was) continue;
      I18N_ATTRS.forEach(a=>{ if(a in was && n.getAttribute(a) === was[a + ':to']) n.setAttribute(a, was[a]); });
      i18nAttrWas.delete(n);
    }
  }
  i18nExact = null; i18nShaped = [];
}
function setPageLang(lang){
  if(!LANG_NAMES[lang] || !langReady(lang) || lang === pageLang) return;
  i18nStop();
  pageLang = lang;
  try{ if(lang === 'en') localStorage.removeItem(LANG_KEY); else localStorage.setItem(LANG_KEY, lang); }catch(e){}
  if(lang !== 'en') i18nStart();
  else document.documentElement.lang = 'en';
  syncLangButton();
}

/* The button on the top bar: the language the page speaks, and a menu of
   the others, each named in its own language — which is why the menu is
   never translated. */
const langToggle = document.getElementById('langToggle');
const langMenu = document.getElementById('langMenu');
/* Each language by its flag, the same emoji the language tabs of an entry
   wear (flagForCode), drawn by the same Noto face on every machine, so
   Windows shows flags too (the owner's list of 22.11, evening: the flags
   drawn here by hand looked like nothing else on the page). English is
   the American flag (the owner's list of 21.11). */
const LANG_FLAG_CODES = {en: 'US', ru: 'RU'};
function wearFlag(holder, lang){
  const f = holder && holder.querySelector('.lang-flag');
  if(f && f.dataset.flag !== lang){ f.textContent = flagForCode(LANG_FLAG_CODES[lang] || '') || ''; f.dataset.flag = lang; }
}
if(langMenu) langMenu.querySelectorAll('[data-lang]').forEach(b=> wearFlag(b, b.dataset.lang));
/* The menu holds the languages ready to speak; with English the only one,
   there is nothing to choose and the button is not shown. */
function syncLangOffer(){
  let offered = 0;
  if(langMenu) langMenu.querySelectorAll('[data-lang]').forEach(b=>{
    const ready = langReady(b.dataset.lang);
    b.hidden = !ready;
    if(ready) offered++;
  });
  if(langToggle) langToggle.hidden = offered < 2;
}
function syncLangButton(){
  syncLangOffer();
  if(!langToggle) return;
  wearFlag(langToggle, pageLang);
  langToggle.dataset.lang = pageLang;
  langToggle.setAttribute('aria-label', LANG_NAMES[pageLang] || pageLang);
  if(langMenu) langMenu.querySelectorAll('[data-lang]').forEach(b=>{
    b.classList.toggle('active', b.dataset.lang === pageLang);
    b.setAttribute('aria-checked', b.dataset.lang === pageLang ? 'true' : 'false');
  });
}
if(langToggle && langMenu){
  langToggle.addEventListener('click', ev=>{
    ev.stopPropagation();
    const open = langMenu.classList.contains('open');
    if(typeof closeToolbarMenus === 'function') closeToolbarMenus('langMenu');
    langMenu.classList.toggle('open', !open);
    if(!open && typeof placeUnderButton === 'function') placeUnderButton(langMenu, langToggle);
  });
  langMenu.addEventListener('click', ev=>{
    ev.stopPropagation();
    const b = ev.target.closest('[data-lang]');
    if(!b) return;
    langMenu.classList.remove('open');
    setPageLang(b.dataset.lang);
  });
  document.addEventListener('click', ()=> langMenu.classList.remove('open'));
}
syncLangButton();
if(pageLang !== 'en') i18nStart();
