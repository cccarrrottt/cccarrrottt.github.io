#!/usr/bin/env node
/* Is the chart in src/data.js the chart's DATA, and only that?
 *
 *   node tools/chart_check.js
 *
 * src/data.js is written into the published page as a script, so whatever
 * its regions hold runs in every reader's browser. A push that changes only
 * the chart (a Save on the site) is published without the browser suite,
 * because the owner asked not to wait for it — so this is what that push
 * IS checked by, in seconds:
 *
 *   - every region reads as `const NAME = <literal>;` and nothing more, by
 *     the same reader the write service refuses a save with (parseRegion,
 *     worker/index.js), so the two cannot disagree about what data is;
 *   - the chart, put in the form Export writes, is what
 *     src/site/chart.schema.json describes.
 *
 * An entry or connector naming an entry that is not there is reported but
 * does not fail: the page draws past one, and refusing it here would hold
 * a publish hostage to a loose end it did not make. The service already
 * refuses a merge that would make a new one.
 *
 * Exit 0 when the chart is data and fits the schema, 1 when it is not.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

(async () => {
  const w = await import(path.join(ROOT, 'worker', 'index.js'));
  const text = fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8');
  const parts = w.regionsOf(text);
  if (!parts) {
    console.error('chart check: src/data.js does not have every region, each once.');
    process.exit(1);
  }
  const v = {};
  let bad = 0;
  for (const name of Object.keys(parts)) {
    try { v[name] = w.parseRegion(name, parts[name]); }
    catch (e) { bad++; console.error(`  FAIL ${name}: ${e.message}`); }
  }
  if (bad) { console.error('\nchart check: src/data.js holds something that is not the chart\'s data.'); process.exit(1); }

  const {format, ...settings} = v.SETTINGS;
  const chart = {format, nodes: v.NODES, edgeStyles: v.EDGESTYLES, stickers: v.STICKERS, media: v.MEDIA,
                 comments: v.COMMENTS, tagCats: v.TAGCATS, refs: v.REFS, settings};
  // A chart kept in the first form is a list of lists; the schema is about
  // records, and the page brings a first-form chart through MIGRATIONS
  // before anything reads it. Only the current form is held to the schema.
  if (format >= 2) {
    let Ajv;
    try { Ajv = require('ajv'); }
    catch (e) { console.error('chart check: ajv is not installed, so the schema could not be asked.'); process.exit(1); }
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'site', 'chart.schema.json'), 'utf8'));
    const validate = new Ajv({allErrors: true}).compile(schema);
    // Through JSON, as Export writes it: undefined slots drop out, NaN is null.
    if (!validate(JSON.parse(JSON.stringify(chart)))) {
      for (const e of validate.errors.slice(0, 10)) console.error(`  FAIL ${e.dataPath || '(top)'} ${e.message}`);
      console.error('\nchart check: the chart is not what chart.schema.json describes.');
      process.exit(1);
    }
  }

  const loose = w.looseEnds(v);
  for (const r of loose) console.log(`  note ${r.region} ${r.item} names '${r.to}', which is not an entry`);
  const counts = Object.keys(v).map(k => `${k} ${Array.isArray(v[k]) ? v[k].length : 1}`).join(', ');
  console.log(`src/data.js is the chart's data, as the schema describes (${counts}).`);
})().catch(e => { console.error(e); process.exit(1); });
