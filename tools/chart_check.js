#!/usr/bin/env node
/* Is src/chart.json the chart, and the chart the schema describes?
 *
 *   node tools/chart_check.js
 *
 * A push that changes only the chart (a Save on the site) is published
 * without the browser suite, because the owner asked not to wait for it —
 * so this is what that push IS checked by, in seconds:
 *
 *   - the file reads as a chart, by the same reader the write service
 *     takes a save with (readChart, worker/index.js), so the two cannot
 *     disagree about what a chart is;
 *   - it is what src/site/chart.schema.json describes.
 *
 * The chart is JSON, which runs nowhere: the page reads it with JSON.parse
 * from an element a browser does not run. Until 0.23 it was src/data.js,
 * and this asked first of all whether every region was data and nothing
 * that could run; there is nothing of that left to ask.
 *
 * Two things are reported but do not fail. An entry or connector naming an
 * entry that is not there: the page draws past one, and refusing it here
 * would hold a publish hostage to a loose end it did not make (the service
 * refuses a merge that would make a new one). And a file not written one
 * item to a line, as the service writes it: a hand edit, which the next
 * Save writes the usual way.
 *
 * Exit 0 when the chart reads and fits the schema, 1 when it does not.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

(async () => {
  const w = await import(path.join(ROOT, 'worker', 'index.js'));
  const text = fs.readFileSync(path.join(ROOT, 'src', 'chart.json'), 'utf8');
  let chart;
  try { chart = w.readChart(text); }
  catch (e) { console.error(`chart check: src/chart.json is not a chart: ${e.message}.`); process.exit(1); }

  // A chart kept in the first form is a list of lists; the schema is about
  // records, and the page brings a first-form chart through MIGRATIONS
  // before anything reads it. Only a chart past that is held to the schema.
  if (chart.format >= 2) {
    let Ajv;
    try { Ajv = require('ajv'); }
    catch (e) { console.error('chart check: ajv is not installed, so the schema could not be asked.'); process.exit(1); }
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'site', 'chart.schema.json'), 'utf8'));
    const validate = new Ajv({allErrors: true}).compile(schema);
    if (!validate(chart)) {
      for (const e of validate.errors.slice(0, 10)) console.error(`  FAIL ${e.dataPath || '(top)'} ${e.message}`);
      console.error('\nchart check: the chart is not what chart.schema.json describes.');
      process.exit(1);
    }
  }

  for (const r of w.looseEnds(chart)) console.log(`  note ${r.region} ${r.item} names '${r.to}', which is not an entry`);
  if (w.chartText(chart) !== text) console.log('  note src/chart.json is not written one item to a line; the next Save will write it so');
  const counts = ['nodes', 'edgeStyles', 'stickers', 'media', 'comments', 'tagCats', 'refs']
    .map(k => `${k} ${(chart[k] || []).length}`).join(', ');
  console.log(`src/chart.json is the chart, as the schema describes (${counts}).`);
})().catch(e => { console.error(e); process.exit(1); });
