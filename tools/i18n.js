#!/usr/bin/env node
/* The words the page itself says, gathered into the file they are
 * translated in.
 *
 *   node tools/i18n.js            bring src/i18n/*.json up to date
 *   node tools/i18n.js --check    say whether they are, and exit 1 if not
 *
 * Every text the program writes and no person typed — a button's word, a
 * tooltip, a menu, a message, the About panel, the history of versions — is
 * a key in src/i18n/<lang>.json, in English, with its translation beside it
 * (empty until somebody writes it). The page shows a key's translation in
 * place of the English wherever the key turns up on screen (43-i18n.js), so
 * the program itself is never touched to translate it, and a text nobody has
 * translated yet stays in English.
 *
 * The keys are found rather than declared. There are some two thousand of
 * them spread over forty-three parts, and wrapping each in a call was a
 * change to every line that speaks, for a list that would still be only as
 * complete as whoever wrote the next line remembered to make it. So the
 * sources are read the way the page is read: src/index.html for its text
 * and its titles, labels and placeholders, and the program for every string
 * that reads as words — a space between letters, or one capitalised word —
 * outside the places a string is a name for the program rather than words
 * for a person (a selector, a key compared against, a class). Markup inside
 * a string is taken apart at its tags, as the browser takes it apart into
 * the pieces of text it shows. A template's `${…}` is written {0}, {1}…, and
 * the translation puts them where its own word order wants them.
 *
 * Bringing a file up to date keeps every translation already written, adds
 * the new keys empty, and drops the keys the sources no longer say.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const I18N = path.join(SRC, 'i18n');

/* The same rule the page applies before it looks a text up: runs of
   spaces, tabs and line breaks are one space, and the ends are trimmed. A
   no-break space is kept — it is a choice somebody made. */
const norm = s => s.replace(/[ \t\n\r\f]+/g, ' ').trim();

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', times: '×', mdash: '—', ndash: '–'};
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1))
               : (ENTITIES[e.toLowerCase()] ?? m));

/* Words the program uses as names, not as words: keys it compares a
   keystroke with, element names, fonts. */
const NOT_WORDS = new Set(['Enter', 'Escape', 'Backspace', 'Delete', 'Tab', 'Shift', 'Control', 'Alt', 'Meta',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Space', 'Insert',
  'Arial', 'Helvetica', 'Georgia', 'Verdana', 'Inter', 'Roboto', 'Courier', 'Times', 'Content-Type',
  'Authorization', 'GET', 'POST', 'PUT', 'DELETE', 'Infinity', 'NaN', 'true', 'false', 'Noto', 'IBM']);

/* Does this read as words for a person? */
function isWords(s){
  if(!s || s.length < 2 || !/[A-Za-z]/.test(s)) return false;
  if(/^(https?:|mailto:|data:|blob:|#|\.|\/|\[|:|@@)/.test(s)) return false;
  if(/[{};]|=>|\$\{|^\s*[a-z-]+\s*:\s*[^ ]+;?$/.test(s.replace(/\{\d+\}/g, ''))) return false;
  if(/^[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-e]+$/.test(s)) return false;           // path data
  if(/^[\w.-]+\.(js|css|json|png|svg|gif|jpe?g|webp|mp4|webm|html|map|md|py)$/i.test(s)) return false;
  if(/^[a-z0-9_.:-]+$/.test(s)) return false;                               // a name: node-split, rhizome.view
  if(/^[A-Z0-9_]+$/.test(s) && s.length <= 5) return false;                 // DIV, LI, SVG
  if(/^[A-Z][A-Z0-9_]+$/.test(s)) return false;                             // CONSTANT_NAMES
  if(/^[a-z]+[A-Z]\w*$/.test(s)) return false;                              // camelCase
  if(NOT_WORDS.has(s)) return false;
  const bare = s.replace(/\{\d+\}/g, '');
  if(/[=\[\]<>]|\w\(|\w:\S|^[\s,;:()'"]|sans-serif|monospace|\bserif\b/.test(bare)) return false;   // code, markup, a font stack
  const tokens = bare.split(/\s+/).filter(Boolean);
  if(tokens.length > 1 && tokens.every(t => /-/.test(t))) return false;      // a class list
  if(tokens.length > 1 && tokens.every(t => /^[A-Z0-9]{2,}$/.test(t))) return false;   // codes
  if(!/[A-Za-z]{2,}/.test(bare)) return false;
  if(/\s/.test(s)) return /[A-Za-z]{2,}/.test(s) && !/^[\w-]+(\s+[\w-]+)*$/.test(s) || /[A-Z]|[a-z]{2,} [a-z]{2,}/.test(s);
  return /^[A-ZÀ-ɏ][a-zà-ɏ'’]+[!?.…]?$/.test(s) || /^[A-Z][a-z]+(-[A-Za-z]+)+$/.test(s);
}

/* A string that carries markup is the pieces of text between its tags. */
function piecesOf(s){
  if(!/<[a-zA-Z\/!]/.test(s)) return [s];
  const words = [...s.matchAll(/\b(?:title|aria-label|placeholder|alt)=(["'])(.*?)\1/g)].map(m => m[2]);
  return s.replace(/<!--[\s\S]*?-->/g, '<>').split(/<[^>]*>/).concat(words);
}

const keys = new Map();   // key -> where it was first seen
function add(raw, where){
  for(const piece of piecesOf(raw)){
    const k = norm(decode(piece));
    if(isWords(k) && !keys.has(k)) keys.set(k, where);
  }
}

/* ---- src/index.html: its text, and its words in attributes ---------- */
function readIndex(){
  const file = path.join(SRC, 'index.html');
  let html = fs.readFileSync(file, 'utf-8');
  const a = html.indexOf('<!-- @@BODY:BEGIN@@ -->'), b = html.indexOf('<!-- @@BODY:END@@ -->');
  const head = html.slice(0, a);
  const title = head.match(/<title>([\s\S]*?)<\/title>/);
  if(title) add(title[1], 'index.html');
  html = html.slice(a, b).replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  for(const m of html.matchAll(/\b(?:title|aria-label|placeholder|alt|data-tip)="([^"]*)"/g)) add(m[1], 'index.html');
  for(const m of html.matchAll(/>([^<]+)</g)) add(m[1], 'index.html');
}

/* ---- the program ---------------------------------------------------- */
/* Places a string is a name the program uses rather than words it says. */
const NAME_CALLS = new Set(['querySelector', 'querySelectorAll', 'closest', 'matches', 'getElementById',
  'getElementsByClassName', 'createElement', 'createElementNS', 'getAttribute', 'hasAttribute', 'removeAttribute',
  'addEventListener', 'removeEventListener', 'getItem', 'setItem', 'removeItem', 'getPropertyValue', 'setProperty',
  'add', 'remove', 'toggle', 'contains', 'split', 'join', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf',
  'includes', 'replace', 'replaceAll', 'match', 'test', 'RegExp', 'qNode', 'qNodes', 'qEdges', 'fetch', 'postMessage',
  'carryOverKey', 'defId', 'execCommand', 'queryCommandState', 'dispatchEvent', 'Event', 'CustomEvent']);
const NAME_PROPS = new Set(['className', 'id', 'type', 'href', 'src', 'rel', 'target', 'cursor', 'display', 'key',
  'tagName', 'nodeName', 'role', 'name', 'lang', 'dir', 'contentEditable', 'inputMode', 'autocomplete', 'accept',
  'mode', 'method', 'credentials', 'cache', 'encoding', 'kind', 'shape', 'routing', 'dash', 'border', 'value']);
function readProgram(){
  const parts = fs.readdirSync(path.join(SRC, 'app')).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
  for(const part of parts){
    const code = fs.readFileSync(path.join(SRC, 'app', part), 'utf-8');
    const ast = espree.parse(code, {ecmaVersion: 2022, sourceType: 'script', range: true});
    (function walk(node, up, upKey){
      if(!node || typeof node.type !== 'string') return;
      /* Words put together from pieces — 'Show' or 'Hide', then ' this
         whole category' — are on screen as one text, so the key is the
         whole, every way it can come out: each piece that is a string,
         or either string of a choice between two, as it is, and anything
         else as {n}. */
      if(node.type === 'BinaryExpression' && node.operator === '+' && !(up && up.type === 'BinaryExpression' && up.operator === '+')){
        const flat = [];
        (function f(x){ if(x.type === 'BinaryExpression' && x.operator === '+'){ f(x.left); f(x.right); } else flat.push(x); })(node);
        if(flat.some(x=> x.type === 'Literal' && typeof x.value === 'string' || x.type === 'TemplateLiteral')){
          let ways = [''], n = 0;
          for(const x of flat){
            let opts;
            if(x.type === 'Literal' && typeof x.value === 'string') opts = [x.value];
            else if(x.type === 'ConditionalExpression' && [x.consequent, x.alternate].every(y=> y.type === 'Literal' && typeof y.value === 'string'))
              opts = [x.consequent.value, x.alternate.value];
            else if(x.type === 'TemplateLiteral' && !x.expressions.length) opts = [x.quasis[0].value.cooked];
            else opts = ['{' + (n++) + '}'];
            ways = ways.flatMap(w=> opts.map(o=> w + o));
            if(ways.length > 16) break;
          }
          if(ways.length <= 16 && !isName(node, up, upKey)) ways.forEach(w=> add(w, part));
        }
      }
      if(node.type === 'Literal' && typeof node.value === 'string'){
        if(!isName(node, up, upKey)) add(node.value, part);
      } else if(node.type === 'TemplateLiteral'){
        if(!isName(node, up, upKey)){
          let s = '';
          node.quasis.forEach((q, i) => { s += q.value.cooked ?? q.value.raw; if(i < node.expressions.length) s += '{' + i + '}'; });
          add(s, part);
        }
      }
      for(const k of Object.keys(node)){
        if(k === 'range' || k === 'parent') continue;
        const v = node[k];
        if(Array.isArray(v)) v.forEach(c => walk(c, node, k));
        else if(v && typeof v.type === 'string') walk(v, node, k);
      }
    })(ast, null, null);
  }
}
function calleeName(c){
  if(!c) return '';
  if(c.type === 'Identifier') return c.name;
  if(c.type === 'MemberExpression' && !c.computed) return c.property.name;
  return '';
}
function isName(node, up, upKey){
  if(!up) return false;
  if(up.type === 'Property' && upKey === 'key') return true;
  if(up.type === 'MemberExpression' && upKey === 'property') return true;
  if(up.type === 'BinaryExpression' && /^[!=]==?$/.test(up.operator)) return true;
  if(up.type === 'SwitchCase' && upKey === 'test') return true;
  if(up.type === 'ImportDeclaration' || up.type === 'ExpressionStatement') return true;   // 'use strict'
  if((up.type === 'CallExpression' || up.type === 'NewExpression') && upKey === 'arguments'){
    const name = calleeName(up.callee);
    if(NAME_CALLS.has(name)) return true;
    // setAttribute(name, value): the name always, the value unless it is words for a person.
    if(name === 'setAttribute' && up.arguments[0] === node) return true;
    if(name === 'setAttribute' && up.arguments[0] && up.arguments[0].type === 'Literal' &&
       !/^(title|aria-label|placeholder|alt|data-tip)$/.test(up.arguments[0].value)) return true;
    // el(tag, attrs, parent) and its kin: the tag is a name.
    if(/^(el|svgEl|make)$/.test(name) && up.arguments[0] === node) return true;
  }
  if(up.type === 'AssignmentExpression' && upKey === 'right' && up.left.type === 'MemberExpression' && !up.left.computed &&
     NAME_PROPS.has(up.left.property.name)) return true;
  if(up.type === 'Property' && upKey === 'value' && up.key && NAME_PROPS.has(up.key.name || up.key.value) &&
     !/^(name)$/.test(up.key.name || '')) return true;
  return false;
}

readIndex();
readProgram();

/* ---- the files ------------------------------------------------------- */
const LANGS = {ru: 'Русский'};
const check = process.argv.includes('--check');
let stale = false;
if(!fs.existsSync(I18N)) fs.mkdirSync(I18N);
for(const [lang, name] of Object.entries(LANGS)){
  const file = path.join(I18N, lang + '.json');
  const was = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
  const had = (was && was.strings) || {};
  const strings = {};
  for(const k of keys.keys()) strings[k] = typeof had[k] === 'string' ? had[k] : '';
  const dropped = Object.keys(had).filter(k => !(k in strings) && had[k]);
  const doc = {
    $comment: 'The words the page says, in English, each with its translation. Write the translation in the empty ' +
              'string after a text; a text left empty stays in English. {0}, {1}… stand for what the page puts in ' +
              'the text (a name, a number) and go where the translation wants them. Kept up to date by ' +
              '`node tools/i18n.js`, which keeps every translation written here and adds the new texts.',
    language: lang,
    name: was.name || name,
    strings
  };
  // One text to a line, so a translation is a diff of the line it is on.
  const text = '{\n' +
    `  "$comment": ${JSON.stringify(doc.$comment)},\n` +
    `  "language": ${JSON.stringify(doc.language)},\n` +
    `  "name": ${JSON.stringify(doc.name)},\n` +
    '  "strings": {\n' +
    Object.entries(strings).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') +
    '\n  }\n}\n';
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  if(before !== text){
    stale = true;
    if(!check) fs.writeFileSync(file, text);
  }
  const done = Object.values(strings).filter(Boolean).length;
  console.log(`src/i18n/${lang}.json: ${Object.keys(strings).length} texts, ${done} translated` +
              (dropped.length ? `; ${dropped.length} translated text(s) the page no longer says were dropped: ${dropped.slice(0, 5).map(s => JSON.stringify(s)).join(', ')}` : '') +
              (check && before !== text ? ' — NOT up to date: run node tools/i18n.js' : ''));
}
if(check && stale) process.exit(1);
