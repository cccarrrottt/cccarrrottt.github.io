#!/usr/bin/env node
/* What the reader's program asks of the editing parts, and must not.
 *
 * On the site the parts in LAZY_PARTS (build.py) are a file of their own,
 * fetched only for the owner or an editor (loadEditorParts). Until it
 * comes, the rest of the program runs without them, and CLAUDE.md lists
 * what that allows. Two of its rules are about names, so they can be asked
 * of the source rather than left to whichever path a bench happens to walk:
 *
 *   - a const, let or class of a lazy part is not there at all on a
 *     reader's page: read from any other part it is a ReferenceError on the
 *     site and nowhere else. (`typeof name` is the one read that cannot
 *     throw, and is how a part asks whether the editor has come.)
 *   - a function of a lazy part is an empty stand-in until the editor
 *     comes (editor_stubs), which answers undefined. Called from another
 *     part for its ANSWER — the call's value used, not just made — the
 *     reader gets undefined where the owner gets something.
 *
 *     node tools/lazy.js .lint/app.js part:line …   (tools/lint.py runs it)
 *
 * The arguments after the file are where each part starts in it, as
 * lint.py assembles it. Prints JSON: [{line, column, name, kind, part}].
 * A finding is either moved — the name to a part every page has, as
 * `defId` and the serializers were — or listed in KNOWN with the reason a
 * reader never reaches it.
 */
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const eslintScope = require('eslint-scope');

/* Functions of a lazy part whose answer the rest uses, and why a reader
   is never hurt by the stand-in's undefined. Read 23.11 one by one; a new
   name wants the same: where it is asked, and what keeps a reader away
   or makes undefined the right answer there. */
const EDITING = 'asked only on an editing path a reader cannot take (readOnlyView, or a gesture only the editor offers)';
const KNOWN = {
  openNodeEditor: 'undefined is "no field opened", and the double click falls to the settings, which is what a reader gets',
  edgeIsPicked: 'undefined is "not picked", which on a reader\'s page is always so',
  mergeOffersFor: 'the touch menu (openTouchMenu); touchMenuFor and the context menu return for readOnlyView',
  splitOffered: 'the touch menu, as mergeOffersFor',
  splitFractionAt: 'the touch menu\'s Split, as mergeOffersFor',
  splitEdgeAt: 'the touch menu\'s Split, as mergeOffersFor',
  ignoredBendRoutes: 'applyEdit, which returns for readOnlyView before it',
  stickerDataFromFile: EDITING, surfaceForToolbar: EDITING, lineStateOf: EDITING, edgeGroupFor: EDITING,
  routeRuns: EDITING, alignGuides: EDITING, resolveExplicitParents: EDITING, deleteNodes: EDITING
};

/* Functions of a lazy part named as a value elsewhere, and why the
   stand-in held there is never the one called. Empty, and best kept so. */
const HELD = {};

function lazyParts(){
  const build = fs.readFileSync(path.join(__dirname, '..', 'build.py'), 'utf8');
  const m = /LAZY_PARTS = \[(.*?)\]/s.exec(build);
  return new Set(m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : []);
}

function analyse(code, starts, lazy){
  const ast = espree.parse(code, {ecmaVersion: 2022, sourceType: 'script', range: true, loc: true});
  const scopes = eslintScope.analyze(ast, {ecmaVersion: 2022, sourceType: 'script'});
  const partAt = line => { let p = starts[0]; for(const s of starts){ if(s.line <= line) p = s; else break; } return p.name; };
  // Each node's parent, for asking how a reference is used.
  const parent = new Map();
  (function walk(n, up){
    if(!n || typeof n.type !== 'string') return;
    parent.set(n, up);
    for(const k of Object.keys(n)){
      if(k === 'parent') continue;
      const v = n[k];
      if(Array.isArray(v)) v.forEach(c => walk(c, n));
      else if(v && typeof v.type === 'string') walk(v, n);
    }
  })(ast, null);
  const global = scopes.globalScope;
  const out = [];
  for(const v of global.variables){
    const def = v.defs[0];
    if(!def) continue;
    const home = partAt(def.name.loc.start.line);
    if(!lazy.has(home)) continue;
    const isFn = def.type === 'FunctionName';
    const isLexical = def.type === 'ClassName' || (def.type === 'Variable' && def.parent && def.parent.kind !== 'var');
    if(!isFn && !isLexical) continue;
    // A script's global scope leaves its references unresolved (a global
    // can be anything at run time), so they are in `through`, by name.
    const refs = v.references.concat(global.through.filter(r => r.identifier.name === v.name));
    for(const ref of refs){
      const id = ref.identifier;
      const at = partAt(id.loc.start.line);
      if(lazy.has(at)) continue;
      const up = parent.get(id);
      if(up && up.type === 'UnaryExpression' && up.operator === 'typeof') continue;
      if(isLexical){
        out.push({line: id.loc.start.line, column: id.loc.start.column + 1, name: v.name, kind: 'lexical', part: home});
        continue;
      }
      /* A function named but not called — handed to addEventListener, kept
         in a table — is held as it is then: on a reader's page, and on the
         owner's until the editor comes, that is the empty stand-in, and the
         page keeps calling the stand-in after the editor has replaced it. */
      if(!(up && up.type === 'CallExpression' && up.callee === id)){
        if(!HELD[v.name]) out.push({line: id.loc.start.line, column: id.loc.start.column + 1, name: v.name, kind: 'held', part: home});
        continue;
      }
      let call = up, above = parent.get(call);
      while(above && (above.type === 'AwaitExpression' || above.type === 'ChainExpression')){ call = above; above = parent.get(call); }
      const unused = !above || above.type === 'ExpressionStatement'
        || (above.type === 'UnaryExpression' && above.operator === 'void')
        || (above.type === 'SequenceExpression' && above.expressions[above.expressions.length - 1] !== call)
        || (above.type === 'LogicalExpression' && above.right === call && (!parent.get(above) || parent.get(above).type === 'ExpressionStatement'))
        || (above.type === 'ConditionalExpression' && above.test !== call && parent.get(above) && parent.get(above).type === 'ExpressionStatement')
        || (above.type === 'ArrowFunctionExpression' && above.body === call);
      if(!unused && !KNOWN[v.name]) out.push({line: id.loc.start.line, column: id.loc.start.column + 1, name: v.name, kind: 'answer', part: home});
    }
  }
  return out;
}

if(require.main === module){
  const [file, ...rest] = process.argv.slice(2);
  const starts = rest.map(s => { const i = s.lastIndexOf(':'); return {name: s.slice(0, i), line: Number(s.slice(i + 1))}; });
  process.stdout.write(JSON.stringify(analyse(fs.readFileSync(file, 'utf8'), starts, lazyParts())));
}
module.exports = {analyse};
