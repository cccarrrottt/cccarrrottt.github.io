#!/usr/bin/env node
/* A const, let or class read before the part that declares it has run.
 *
 * The page is one scope assembled from forty parts in order (CLAUDE.md), so
 * a name defined in part 32 is visible in part 07 — and a function
 * declaration in part 32 can be CALLED from part 07, because declarations
 * are hoisted. What is not hoisted is a const's value. A function in part
 * 32 that reads a const of part 32, called while part 07 is still running,
 * throws "Cannot access … before initialization", and the page does not
 * open. Nothing about either part on its own is wrong; the order is.
 *
 * The suite catches that when the path is taken. This catches it when the
 * path exists: it walks the program as start-up would — the top-level
 * statements in order, and everything they call, as far as calls go —
 * and reports every read of a const, let or class that this walk reaches
 * before the statement that declares it.
 *
 * What runs later is not walked. A function handed to addEventListener,
 * setTimeout or a promise, or assigned to a property, runs after start-up;
 * one handed to forEach, map and the like, or called on the spot, runs now.
 * Every branch is taken to run, because which do is decided by the
 * chart and the browser — so a read behind a condition that start-up never
 * meets is reported too, and is either moved or listed in KNOWN below with
 * the reason it cannot happen.
 *
 *     node tools/tdz.js .lint/app.js      (tools/lint.py runs it)
 *
 * Prints JSON: [{line, column, name, declared, read, via}] — where start-up
 * makes the call, the name, where it is declared and read, and the calls in
 * between — as lines of the file it was given; tools/lint.py turns them
 * into parts and lines.
 */
const fs = require('fs');
const espree = require('espree');
const eslintScope = require('eslint-scope');

/* Reads the walk reaches that start-up cannot, for a reason this walk does
   not follow: a function on the way that returns before them. Each is the
   function that returns, the names it keeps start-up from, and why. A new
   entry wants the same: the line that returns, and what makes it return
   while the page is opening. */
const KNOWN = {
  drawBendHandles: {names: ['BEND_R'],
    why: 'returns from the catch at its top while bendLayer is not declared yet, which it is not on the first draw'},
  scheduleDraft: {names: ['DRAFT_DELAY', 'draftOffer', 'draftDbPromise'],
    why: 'returns at once until the draft store has been looked at (draftLooked), which happens after start-up'}
};

// Calls whose function argument runs before the call returns.
const SYNC_CALLEES = new Set(['forEach', 'map', 'filter', 'some', 'every', 'reduce', 'reduceRight',
  'find', 'findIndex', 'findLast', 'findLastIndex', 'flatMap', 'sort', 'toSorted', 'replace', 'replaceAll', 'from']);

function analyse(code){
  const ast = espree.parse(code, {ecmaVersion: 2022, sourceType: 'script', range: true, loc: true});
  const scopes = eslintScope.analyze(ast, {ecmaVersion: 2022, sourceType: 'script'});
  const top = ast.body;
  // Which top-level statement holds a position.
  const stmtAt = pos => {
    let lo = 0, hi = top.length - 1;
    while(lo <= hi){
      const mid = (lo + hi) >> 1, r = top[mid].range;
      if(pos < r[0]) hi = mid - 1; else if(pos >= r[1]) lo = mid + 1; else return mid;
    }
    return -1;
  };

  /* Parents, so a function can be asked how it is reached. */
  const parent = new Map();
  (function walk(node, up){
    parent.set(node, up);
    for(const k of Object.keys(node)){
      if(k === 'parent') continue;
      const v = node[k];
      if(Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, node));
      else if(v && typeof v.type === 'string') walk(v, node);
    }
  })(ast, null);

  const isFn = n => n && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
  /* Whether a function expression runs where it stands: called on the spot,
     or handed to a call that runs it before returning. */
  function runsInPlace(fn){
    const p = parent.get(fn);
    if(!p) return false;
    if(p.type === 'CallExpression' && p.callee === fn) return true;
    if(p.type === 'NewExpression' && p.callee.type === 'Identifier' && p.callee.name === 'Promise' && p.arguments[0] === fn) return true;
    if(p.type === 'CallExpression' && p.arguments.includes(fn)){
      const c = p.callee;
      const name = c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
      return !!name && SYNC_CALLEES.has(name);
    }
    return false;
  }
  /* The function whose running runs this node: the nearest enclosing
     function that does not run in place, or null for start-up itself. */
  const unitMemo = new Map();
  function unitOf(node){
    let n = parent.get(node);
    while(n){
      if(isFn(n)){
        if(unitMemo.has(n)) return unitMemo.get(n);
        const u = (n.type !== 'FunctionDeclaration' && runsInPlace(n)) ? unitOf(n) : n;
        unitMemo.set(n, u);
        return u;
      }
      n = parent.get(n);
    }
    return null;
  }
  /* Whether a TDZ error here would be caught where it happens: inside the
     block of a try that has a catch, before leaving the function. The
     program uses exactly this to ask for a name that may not exist yet
     (currentZoom, drawBendHandles), and it is a real answer. */
  function caught(node){
    let child = node, n = parent.get(node);
    while(n && !isFn(n)){
      if(n.type === 'TryStatement' && n.block === child && n.handler) return true;
      child = n; n = parent.get(n);
    }
    return false;
  }
  /* What has to be true for a node to run, as far as start-up can know:
     the conditions it stands behind, inside its own function. Two kinds
     are understood, because the program writes both to mean "not yet":
     a top-level var named in the condition (`typeof v !== 'undefined'`, or
     plain `v`), which is undefined until its own statement has run; and a
     parameter of the function itself (`if(arraysOnly)`), which is
     undefined when the call leaves it out. */
  const topVar = name => {
    const v = scopes.globalScope.set.get(name);
    const d = v && v.defs[0];
    return d && d.type === 'Variable' && d.parent.kind === 'var' ? v : null;
  };
  function testGuards(test, fn, out){
    if(test.type === 'LogicalExpression' && test.operator === '&&'){
      testGuards(test.left, fn, out); testGuards(test.right, fn, out); return;
    }
    let name = null;
    if(test.type === 'Identifier') name = test.name;
    else if(test.type === 'BinaryExpression' && test.left.type === 'UnaryExpression' && test.left.operator === 'typeof' &&
            test.left.argument.type === 'Identifier' && test.right.type === 'Literal' &&
            ((/^!==?$/.test(test.operator) && test.right.value === 'undefined') ||
             (/^===?$/.test(test.operator) && (test.right.value === 'function' || test.right.value === 'object')))){
      name = test.left.argument.name;
    }
    if(!name) return;
    const at = paramOf(fn, name);
    if(at >= 0) out.params.add(at);
    else if(topVar(name)) out.vars.add(topVar(name));
  }
  /* Which parameter a name is, or stands for: the parameter itself, or a
     const of the function made from it the way a flag is
     (`const arraysOnly = !!(opts && opts.arraysOnly)`), which is falsy
     whenever the parameter is left out. */
  function paramOf(fn, name){
    if(!fn || !fn.params) return -1;
    const direct = fn.params.findIndex(q => q.type === 'Identifier' && q.name === name);
    if(direct >= 0) return direct;
    const body = fn.body && fn.body.type === 'BlockStatement' ? fn.body.body : [];
    for(const st of body){
      if(st.type !== 'VariableDeclaration' || st.kind !== 'const') continue;
      for(const d of st.declarations){
        if(d.id.type !== 'Identifier' || d.id.name !== name || !d.init) continue;
        let e = d.init;
        while(e.type === 'UnaryExpression' && e.operator === '!' && e.argument.type === 'UnaryExpression' && e.argument.operator === '!') e = e.argument.argument;
        while(e.type === 'LogicalExpression' && e.operator === '&&') e = e.left;
        if(e.type === 'Identifier') return fn.params.findIndex(q => q.type === 'Identifier' && q.name === e.name);
      }
    }
    return -1;
  }
  function guardsOf(node, unit){
    const out = {vars: new Set(), params: new Set()};
    let child = node, n = parent.get(node);
    while(n && n !== unit){
      if(n.type === 'IfStatement' && n.consequent === child) testGuards(n.test, unit, out);
      else if(n.type === 'ConditionalExpression' && n.consequent === child) testGuards(n.test, unit, out);
      else if(n.type === 'LogicalExpression' && n.operator === '&&' && n.right === child) testGuards(n.left, unit, out);
      child = n; n = parent.get(n);
    }
    return out;
  }
  /* What a name stands for, as something that can be run: a function
     declaration, or a const/let/var whose value is written as a function. */
  function runnable(variable){
    for(const d of variable.defs){
      if(d.type === 'FunctionName') return d.node;
      if(d.type === 'Variable' && d.node.init && isFn(d.node.init)) return d.node.init;
    }
    return null;
  }
  // The const/let/class names declared at the top, and where.
  const lexical = new Map();
  for(const v of scopes.globalScope.variables){
    const d = v.defs[0];
    if(!d) continue;
    if((d.type === 'Variable' && d.parent.kind !== 'var') || d.type === 'ClassName'){
      lexical.set(v, {stmt: stmtAt(d.name.range[0]), end: (d.type === 'Variable' ? d.node : d.node).range[1]});
    }
  }

  /* For every unit, the top-level lexical names it reads and the units it
     calls, as far as the reading goes without leaving the unit. */
  const reads = new Map(), calls = new Map();
  const add = (m, k, v) => { if(!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for(const scope of scopes.scopes){
    for(const ref of scope.references){
      /* A script's global var and function names are left unresolved by
         the scope analysis (they are properties of the global object, and
         could be anyone's); a name nothing nearer declares is the top's. */
      const v = ref.resolved || scopes.globalScope.set.get(ref.identifier.name);
      if(!v) continue;
      const id = ref.identifier, unit = unitOf(id);
      if(caught(id)) continue;
      if(lexical.has(v) && ref.isRead()) add(reads, unit, {v, id, g: guardsOf(id, unit)});
      const p = parent.get(id);
      if(p && (p.type === 'CallExpression' || p.type === 'NewExpression') && p.callee === id){
        const target = runnable(v);
        if(target) add(calls, unit, {target, id, args: p.arguments.length, g: guardsOf(id, unit)});
      }
    }
  }

  /* Start-up, statement by statement. A unit's reads are found once and
     kept, each with the vars it waits on; the call that reaches it then
     settles the unit's own parameters, and the statement that makes the
     call settles the vars. */
  const reachMemo = new Map();
  function reach(unit, seen){
    if(reachMemo.has(unit)) return reachMemo.get(unit);
    if(seen.has(unit)) return [];
    seen.add(unit);
    const out = [];
    for(const r of reads.get(unit) || []) out.push({v: r.v, id: r.id, via: [], vars: r.g.vars, params: r.g.params});
    for(const c of calls.get(unit) || []){
      for(const r of reach(c.target, seen)){
        // A parameter the call leaves out is undefined: what waits on it does not run.
        if([...r.params].some(i => i >= c.args)) continue;
        out.push({v: r.v, id: r.id, via: [c.id.name, ...r.via],
                  vars: new Set([...c.g.vars, ...r.vars]), params: c.g.params});
      }
    }
    // One way to each read for each set of conditions it waits on.
    const one = new Map();
    out.forEach(r => {
      const k = r.v.name + '@' + r.id.range[0] + '|' + [...r.vars].map(v => v.name).sort() + '|' + [...r.params].sort();
      if(!one.has(k)) one.set(k, r);
    });
    const list = [...one.values()];
    reachMemo.set(unit, list);
    return list;
  }
  const varStmt = v => stmtAt(v.defs[0].name.range[0]);
  const found = [], said = new Set();
  const atStartup = [...(reads.get(null) || []).map(r => ({v: r.v, id: r.id, via: [], vars: r.g.vars, from: r.id})),
                     ...(calls.get(null) || []).flatMap(c => reach(c.target, new Set())
                       .filter(r => ![...r.params].some(i => i >= c.args))
                       .map(r => ({...r, via: [c.id.name, ...r.via], vars: new Set([...c.g.vars, ...r.vars]), from: c.id})))];
  for(const r of atStartup){
    const here = stmtAt(r.from.range[0]);
    // Behind a var whose statement has not run: it is undefined, and this does not run.
    if([...r.vars].some(v => varStmt(v) > here)) continue;
    const decl = lexical.get(r.v);
    const ahead = decl.stmt > here || (decl.stmt === here && r.from.range[0] < decl.end);
    if(!ahead) continue;
    if(r.via.some(f => KNOWN[f] && KNOWN[f].names.includes(r.v.name))) continue;
    const key = r.from.range[0] + ':' + r.v.name;
    if(said.has(key)) continue;
    said.add(key);
    found.push({line: r.from.loc.start.line, column: r.from.loc.start.column + 1, name: r.v.name,
                declared: r.v.defs[0].name.loc.start.line, read: r.id.loc.start.line, via: r.via});
  }
  return found;
}

if(require.main === module){
  const file = process.argv[2];
  if(!file){ console.error('usage: node tools/tdz.js <assembled program>'); process.exit(2); }
  process.stdout.write(JSON.stringify(analyse(fs.readFileSync(file, 'utf8'))));
}
module.exports = {analyse};
