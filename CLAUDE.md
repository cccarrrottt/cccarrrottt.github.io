# Working on this repository

Read this before changing anything. `README.md` explains what the chart *is*;
this file is about how work on it is done, and which arguments have already
been had.

## The one rule that everything else follows from

`src/app/` holds 54 files. **They are not modules.** The page is a single
scope, and `build.py` assembles it by writing those files out one after
another in the order `APP_PARTS` declares. Nothing imports anything. A name
defined in part 32 is visible in part 07.

So:

- Moving a function between parts is free **only** if it is not read during
  boot before the part that now holds it has run. Function *declarations*
  hoist within a script, and the assembled program is one script — but
  `const`/`let`/`var` initialisation does not. `tools/tdz.js` (run by
  `tools/lint.py`) walks start-up and every call it makes and reports a
  const, let or class reached before its statement; the first chart is
  built in part 02, so anything `buildModel` asks is read then. Its
  `KNOWN` list is for a function that returns before such a read, with
  the reason — not for silencing a finding.
- Adding a part means adding it to `APP_PARTS` in `build.py` **and** to the
  loader array in `src/index.html`. The build refuses a mismatch between the
  two, a missing part, and a part on disk that nothing lists.
- `src/index.html` fetches the parts and runs them as **one** script with
  `//# sourceURL=app.js`. It does not use a `<script>` tag per part: as
  separate scripts, start-up reaches for hundreds of names whose part has not
  run yet. It therefore needs an HTTP server; for double-click use, build
  `dist/nexus.html`.

## How an entry is written

In `src/chart.json` an entry is a record with its fields named —
`{id, label, parent, edgeLabel, note, shape, …}`, every option beside them —
and the file's `format` says so (inside the page, `SETTINGS.format`; `DATA_FORMAT`, `02-model.js`). Inside the page
it is still the list it always was, `[id, label, parent, edgeLabel, note,
shape, opts]`, because every part reads it that way; `entryOfRecord` and
`recordOfEntry` are the only two places that know both. A list found in a
file is still read, so older saves, exports and pulls open as before; a
file whose `format` is higher than the page's is refused at import.

The number also says which `MIGRATIONS` (`02-model.js`) a chart still
needs. They run once, where a chart comes in — boot, `importChartFromText`,
`putChartData` — never in `buildModel`, so drawing never rewrites the
chart. A kept chart's number is its own: one kept without a number is form
1, not the file's. Something an older chart must be brought through is a
new step with the number it ends at, and `DATA_FORMAT` goes up by one.
Tests write entries in the current form; one that means an old chart says
so with `migrateChart(1)`.

The file is JSON — `{$schema, format, nodes: [records], edgeStyles, …,
settings}`, one record to a line — and the same file is what "Export the
contents" writes and Import reads; `src/site/chart.schema.json` (published
at the site's root) describes it. A field added to an entry or a connector
belongs in the schema too; `tools/chart_check.js` holds the owner's chart to
it and the suite a chart of every kind. A new part at the top of the file
also belongs in `CHART_KEYS` (`worker/index.js`), which refuses a save with
a part it does not know. Import still reads the `@@EDIT@@` regions of a file
from before 0.23.0 (`chartOfText`), and a page from then still opens.

## Where the chart's contents actually live

**In `src/chart.json`, and only there.** Save on the published site commits
the chart to the repository through the write service (`worker/`), so the
repository is current by construction, and `build.py` makes the page from
`src/` and nothing else.

It goes into the page as JSON in a `<script type="application/json"
id="chart-data">`, which a browser does not run; `CHART_IN` (`01-store.js`)
reads it with `JSON.parse` into the names every part has always used
(`NODES`, `EDGE_STYLES`, … `SETTINGS`). `src/index.html` fetches the file
and puts it in the same element, so both ways in read it the one way. Until
0.23.0 the chart was `src/data.js`, eight `const` statements in the
program's own script: it was code on every reader's screen, and the service
carried a parser of its own to be sure a save held nothing that could run.
Every `<` in the element is written `\u003c` (`chart_script` in `build.py`,
`chartForScript` in the page), so a label cannot end it.

It used to be two places, and it is worth knowing why it is not. A copy on
claude.ai saved by rewriting its own `@@EDIT@@` regions, so the newest chart
lived in a page nobody had committed; a build carried the chart over from the
`dist/nexus.html` it replaced, `build.py --pull` brought it back into the
sources by hand, and `tools/data_check.py` asked whether the two had drifted —
because a clean checkout, which is what CI is, built from `src/data.js` alone
however far behind it was. The owner dropped the claude.ai copy (0.22.0), and
the carrying, `--pull`, `.backups/` and the data check went with it. Do not
bring a second home for the chart back without bringing all of that back too.

## Before you say anything is done

Six checks, and all six have to be green:

```bash
python3 build.py
node tools/chart_check.js        # ~instant: the chart reads, and fits its schema
python3 tests/build_guard.py     # ~seconds
python3 tools/lint.py            # ~seconds, and tools/tdz.js with it
node tests/worker.js             # ~instant, the write service
node tests/regression.js         # ~6 minutes, against dist
node tests/regression.js src     # ~6 minutes, against src
node tests/snapshots.js          # ~10s, the look, by the pixel
```

`tests/snapshots.js` draws `tests/snapshots/reference.json` with its text
hidden and every entry sized by hand, and compares eight scenes with the
pictures beside it; a T moved by one unit fails it. A change meant to
change the look runs it with `--update` and commits the pictures, so the
pull request shows both. They are drawn by the headless shell
package-lock.json's Playwright names, which is what CI compares with; a
picture from another system would only ever disagree. CI also runs a few
scenarios in WebKit (`--browser=webkit`, and `--only=a|b` for several).

The suite draws `tests/fixtures/chart.json` (pictures in
`tests/fixtures/media/`), put in place of the owner's chart in every page
it serves, so a Save on the site, or a fork with a chart of its own, never
turns a check red. A check that wants the real chart's contents reads the
fixture; the fixture changes only in a commit that means it to.

`dist` and `src` load the same program by different paths. A green run on one
says nothing about the other; run both.

### Running less than all of it

The suite is 168 named scenarios, and they do not depend on one another —
which is checked rather than assumed: four shards print exactly the checks
one whole run prints, by name, and the wrapping that introduced them added
two lines per scenario and moved no bodies. They do not depend on one
another's leavings either: every scenario after the first starts on the
page opened again, with its storage emptied (`freshPage`). Until 24.11 they
shared one page as each left it, and a whole run in order failed five
checks that every shard passed — a chart, settings, a drawer or the view
left behind by a scenario dozens before.

```bash
node tests/regression.js --list           what there is to run
node tests/regression.js --only=callout   just those, ~20s rather than ~5min
node tools/shards.js                      the whole thing, four ways, ~90s
node tools/shards.js src                  the same against the sources
```

`--only` that matches nothing exits 2 rather than 0: a mistyped name used to
read exactly like a run that passed.

The suite answers both webfont hosts with an empty stylesheet rather than
letting the request out. It used to leave them to the network and filter the
resulting console error by matching the message against the host name —
which does not work, because Chromium reports a blocked stylesheet as
"Failed to load resource: net::ERR_…" without the URL in it. Every run on a
machine with no route to Google Fonts therefore came out red on a check
called "no uncaught page errors". A suite that goes red because a third
party is unreachable is testing the network; now every machine runs the same
test, and that test is the case README promises works. Each run names its three slowest
scenarios, so which ones are worth a quick set is answered by the suite
rather than guessed. A scenario that throws is caught and counted instead of
ending the run — one broken scenario used to take the sixty after it with it.

A plain `node tests/regression.js` still runs everything in order and still
takes about six minutes; the shards are for when you want the answer now. CI
runs the shards.

`tests/regression.js` is the harness — the server, the browser, `check`,
the flags — and the scenarios are in `tests/scenarios/`, eight files by
the stretch of the suite's history they come from, run in the order
`SCENARIO_FILES` gives (the order they always ran in). Each is run by a
direct `eval` inside the harness's `main()`, so it sees the one scope the
scenarios were written against; they were moved there without a byte of
a body changed (24.11.2026), and a file the list does not name stops the
suite. Adding behaviour means adding a named check inside the scenario it
belongs to, in its file, or a new scenario at the end of the newest
file. When a claim turns out to be wrong — including
one this file makes — the fix is a check that would have caught it, not a
note.

## One build, and who may edit it

There used to be four builds — editable or read-only, fragment or document —
because who could edit was decided when the page was built. For a while the
one Pages needed (read-only AND a document) did not exist, so the site served
the editor; later an exported copy carried the read-only declaration onto
readers' disks and froze it there. Both were consequences of deciding at
build time.

Now `build.py` writes one page, `dist/nexus.html`, a whole document, and the
page decides when it opens:

| where it is opened | what it is |
| --- | --- |
| `SITE_BASE` (the published site, or below it) | a reader; the editor once the write service confirms the owner or an editor |
| anywhere else (disk, other hosts, the test server) | its holder's own copy, saving into their browser |

Things that follow, and are pinned in the suite ("the page on the published
site") and `build_guard`:

- **The hidden controls are not the security.** Every reader can fetch
  the editor's code. The write service (`worker/index.js`) is what refuses:
  session sealed with `SESSION_SECRET`, login in `OWNERS` (or `EDITORS`,
  whose saves keep the repository's settings but for the notes in the
  margin), session handed only to `ALLOWED_ORIGINS`, and the commit made
  with the owner's own GitHub App user token so GitHub checks it again —
  an editor's by the app's installation token when `GITHUB_APP_ID` and
  `GITHUB_APP_PRIVATE_KEY` are set (`appToken`), so an editor needs no
  access to the repository, which would let them past all of this.
  `tests/worker.js` is mostly about what it refuses.
- **The site is that page with its program beside it.** `build.py` also
  writes `dist/site/` (`build_site`), which CI publishes: the same page,
  but with the program and stylesheet in `app.<hash>.js` and
  `style.<hash>.css`, named by the sha-256 of their bytes, and minified
  by esbuild (pinned in `package.json`; whitespace and syntax only, so
  every name — and every stack trace — stays readable), with
  `app.<hash>.map` beside the program — and without its version log,
  which is `versions.<hash>.js` beside it, fetched the first time the
  history in About is unfolded (`lift_version_log`; 207 KB gzipped
  became 177). A build without esbuild writes
  them unminified and says so; CI sets `RHIZOME_MINIFY=required`, so a
  publish cannot. 491 KB gzipped became 200, and the first drawing on a
  cold load 588 ms → 269 together with the fonts below. A Save changes
  only the chart, so readers keep both and fetch ~15 KB instead of ~200.
  Their tags carry `data-inline`, and `readOwnSource` puts both back inside
  (`inlineSiteFiles`, `20-about.js`), so Export is still one file. The
  service worker keeps them cache-first, like pictures, and lets go of a
  pair once neither the newest page nor the one before it names them. The
  site's `<head>` also says what a link to it is (og/twitter tags, and
  `src/site/og-image.png`, drawn by `tools/og-image.js`). `build_guard`
  checks that the site, with the files put back unminified, is
  `nexus.html` byte for byte but for the one seam between the chart's
  script and the program's, and that the files ARE the program and the
  stylesheet minified — so an export from the site carries the minified
  program, which the suite drives as it drives any other.
- **The site says which scripts may run** — a Content-Security-Policy
  `<meta>` written by `site_policy` (`build.py`), outside the markers so
  no export carries it. The owner's session is in localStorage, and this
  is what keeps a script nobody wrote from reading it. Nothing is run from
  a string (the version log is JSON, read with `JSON.parse`), and an
  inline script or handler runs only by its hash: the build hashes every
  `on…=` it finds in the page, and `tools/prerender.js` adds the hash of
  the placement script it writes. Something new the page loads from
  another host, or runs inline, needs its place in the policy, or the
  site breaks while every other copy works; the suite counts what the
  policy refuses as a page error on the site.
- **An SVG is never a file on the site.** Opened at its own address its
  scripts run as the site; so the page keeps one embedded (`MEDIA_EXT`
  has no `svg`) and the service refuses `media/*.svg`.
- **Fonts do not hold up the first drawing.** The UI faces' stylesheet
  loads as `media="print"` and switches itself on; an entry face
  (`FONT_OPTIONS[].web`) is asked for the first time an entry is drawn in
  it (`askForFace`), and `fontsLanded` measures again when it arrives.
- **The site counts and reports, and only the site.** A Cloudflare Web
  Analytics beacon, when CI passes `CF_WEB_ANALYTICS_TOKEN` (a repository
  variable), outside the markers so no export carries it; and faults a
  reader's browser meets go to `POST /report` (`reportFault`,
  `01-store.js`), at most five a load, never with the session, which the
  service writes to its log and counts in a KV namespace (`FAULTS`, made
  by wrangler on deploy), listed for the owner at the top of About. At
  most `MAX_FAULT_COUNTS_A_DAY` are counted a day (`withinFaultBudget`):
  the Origin it checks is one a script can write, and a flood must not
  bury the list or spend the namespace's writes.
- **Where the site lives is said once**, in `src/app/00-config.js`
  (`SITE_CONFIG`: `site`, `api`, `repo`, one quoted string to a line, so
  `build.py` and the suite read it as text). `SITE_BASE`, `SITE_API` and
  `SITE_REPO` in `01-store.js` are taken from it, the build writes the
  site's address into the link preview, the schema's `$id` and the
  published `chart.json`, and `build_guard` holds `REPO`/`ALLOWED_ORIGINS`
  in `worker/wrangler.toml` to it — the service is deployed from that file
  and cannot read ours. `site` may carry a path (a repository Pages serves
  at `<login>.github.io/<repo>`): the page is on the site at that address or
  below it (`atSite`), and the service lets in its origin. An empty `api`
  is a copy with no service: read-only for everybody, and CI deploys
  nothing.
  Those are THIS repository's values. A copy published from any other
  repository is told where it lives by CI (`tools/where.py`, the `where`
  job): the Pages address, the service on its own Cloudflare account, its
  repository, its owner as `OWNERS` — or the repository variables
  `RHIZOME_SITE`, `RHIZOME_API`, `RHIZOME_DATA`, `RHIZOME_OWNERS`,
  `RHIZOME_EDITORS`, which a fork does not copy. Only the publishing build
  is told (`RHIZOME_SITE` … in the `pages` job; `config_part` writes them in
  place of the file's lines), and the service gets them as `--var` on
  deploy; the checks build with 00-config.js as it stands, because the
  suite reads it. So a fork changes no file of ours for its addresses.
- **Where the chart is kept is `data`** in 00-config.js,
  `owner/name/path/chart.json@branch` (`DATA_PLACE`, `01-store.js`;
  `dataOf`, `worker/index.js`; `RHIZOME_DATA` for a copy). Save commits
  there, the history of edits is that file's, suggestions are that
  repository's issues, and the pictures are the `media/` beside the file.
  Kept in another repository, CI fetches it and names it to the build
  (`RHIZOME_CHART`, also read by `tools/chart_check.js`). It is still one
  home: a repository of its own is not a second copy of the chart.
- **What the chart is called is the chart's**, not the platform's:
  `settings.title`, `settings.description` and `settings.about`, written in
  About (`showChartWords`, `20-about.js`), carried by Save, Import and
  Export like every other setting. `build.py` (`chart_words`) writes the
  first two into the site's preview, `<title>` and the manifest. No text
  about one particular chart belongs in `src/index.html` or `build.py`.
- **The site publishes the chart as data**, `<site>/chart.json` beside the
  page (`build_site`), the file Save commits with `$schema` naming the
  site's own schema.
- **No part may contain a closing script tag**, in a string or a comment:
  the program is inside a `<script>` in every build but the site's, and the
  parser ends it there. The build refuses it and names the part.
- **A save made on an older chart is merged, not refused.** The service
  reads the `chart.json` the save was made on (its base, by blob id) and
  merges the three as values (`mergeCharts`, `worker/index.js`): a list
  record by record, each named as `CHART_LISTS` says (an entry by its id, a
  connector style by its two ends), and the settings field by field. Only
  what both changed differently is a 409, with the colliding items named,
  and a merge that would leave a name pointing at an entry that is gone is
  one too. The answer carries the merged chart and `over`, the file it
  replaced.
- **A page that is behind the repository may not save.** `build.py` writes
  the git blob id of `src/chart.json` into the page — as a
  `<meta name="rhizome-data-sha">` in the wrapper's head, outside the
  page's markers, which `DATA_SHA` (`01-store.js`) reads. Not into the
  program, which would then change with every Save and the site's program
  file with it. An exported copy carries none. The service refuses a
  save whose base is not the file on `main`, and the owner's page refuses to
  become an editor when `/me` reports a different id. Moving to the next
  base after a save is what lets two saves in a row work before the site
  has rebuilt.
- **What the page sends is the file, as the service writes it** —
  `chartJsonText` in the page and `chartText` in the service write the same
  bytes, one item to a line, and the suite holds them to each other — but
  for each embedded picture past 2 KB, which goes as its path,
  `media/<sha256>.<ext>`, with the file beside it (`liftMedia`,
  `04-assets.js`). The service writes what it commits itself, so a commit
  of one edit is a diff of the lines it changed.
- **Pictures live in `src/media/`, named by the hash of their bytes**, and
  the build copies them to `dist/media/`. The service refuses a file whose
  bytes are not its name and a chart naming a path nobody sent. Anything
  that leaves the site (Export, Export the contents, the PNG/SVG picture) inlines
  them again with `inlineMediaRefs`.
- **A push that changes only `src/chart.json` and `src/media/` skips CI's checks** and is
  published at once — that is what a Save on the site is, and the owner
  asked not to wait for the suite. The `changes` job decides from the
  pushed trees, so any other file in the push runs everything. Such a push
  is still published only once `tools/chart_check.js` reads it as a chart
  that fits its schema.
- **On the site a chart in localStorage is never restored** — it could only
  be a reader's edit from the days the site served an editor.
- **With no connection the owner still edits, and Save goes to an outbox**
  (IndexedDB, beside the draft; `36-site-owner.js`), sent when the
  connection returns. The service worker (`src/site/sw.js`) is network-first
  for the page on purpose: a cached page that is behind must not become the
  page the owner saves from. Sessions renew through GitHub's refresh token,
  which is good once — so the page's requests to the service go one at a
  time (`siteRequest`), and every answer, a refusal included, may carry the
  new session.
- Read-only is still a flag (`body.read-only`, `readOnlyView`), and
  `markEditable` is its way back; lifting it means drawing again, because
  some parts ask `readOnlyView` while they draw.

## The field

The chart is drawn on whole pages of `FIELD_PAGE_W`×`FIELD_PAGE_H` (2000 square), the
first centred on the origin, as many as hold every entry with
`FIELD_MARGIN` to spare (`fieldOf`, `10-decor.js`). It is worked out from
the entries on every rebuild and every frame of a carry, never kept. A pan,
the wheel and a pinch keep the middle of the view on it
(`keepFieldInView`); a view set in so many words (a link, the overview, a
test) is not held to it.

## Where two lines cross

The level line arches over the upright one (`drawHops`, `14-edges-draw.js`).
The hop is written into the line's own path (`seatHops`; `roundedPath`
takes it as `cut`), so it lights, dims and hides with its line, a double
line hops with both rails and dashes run on over it. It was a hole cut by
a mask and an arch laid over it, and the two never met cleanly — do not
go back to that. Only a straight leg of a line that is not a curve hops,
at 35° or more, clear of its turns and arrowheads and of the crossed
line's ends; a wavy line hops too, laid flat for half a wave either side;
crossings an arch apart share one arch; a line hidden by its tags has its
hops taken out of its path (`hopsFollowVisibility`, from the plain path
kept in `hoppedLines`). Computed every pass from `drawnRoutes`, never
kept, so it changes no route. `SETTINGS.hops === false` (the button
beside the guides) draws none.

## The field's ground and the chart's history

`SETTINGS.background` is `{color, image, fit}`: the colour fills the
field's pages and a double line's gap (`--field`), the picture lies on
the field, filling it or repeated (`syncBackdrop`, `10-decor.js`); it is
set from Background in the menu over open paper (`49-background.js`).
About's "History of edits" lists the commits of `src/chart.json` from
GitHub's API (`48-history.js`), with links to each change on GitHub.

## Notes in the margin

The pencil and the eraser on the top bar (`44-ink.js`) write by hand over
the field. A stroke is world points in `SETTINGS.ink`, saved with the
chart and part of the field's extent; while a tool is in the hand the
chart takes no other gesture, and a reader holds neither.

## A chart's own fonts

`SETTINGS.fonts` is `{key, name, src}`, the file a font in `media/` like a
picture (`MEDIA_EXT` knows ttf, otf, woff and woff2; `mediaSrcOk` still
refuses a font as a picture). `FONT_OPTIONS` is the program's faces and
then the chart's, remade from SETTINGS whenever `SETTINGS.fonts` is
another array — so anything that lists faces asks `fontOptions()`, and
anything that changes the fonts assigns a new array. A face is handed to
the page (`FontFace`) the first time something is set in it.

## The owner's cloud drives

Google Drive and Yandex Disk, through the write service (`CLOUDS` in
`worker/index.js`, `45-clouds.js`). The owner's grant to a drive lives in
the owner's session beside the GitHub token, and a GitHub renewal carries
it on. A picked file is shared by link and named by the service's address
(`/cloud/<drive>/file…`), which answers readers without the owner's
grant: Google with `GOOGLE_API_KEY`, Yandex by its public key — and only
for an address carrying the service's mark of what it names (`fileMark`,
from `SESSION_SECRET`, given out by pick), or the service would pass on
any file anyone has shared by link. The service still stores nothing. A drive whose Secrets are missing is not offered
(`/me` says which are ready), and the page shows drives only to the owner
on the site.

With `GOOGLE_PICKER_KEY` and `GOOGLE_APP_ID` set (`pickerReady`), Google
Drive is connected for `drive.file` and picked in Google's Picker, in a
window that is the service's page (`/cloud/gdrive/picker`, its own CSP),
so the drive's token never reaches the site; what comes back by
postMessage goes through `/pick` like a file from the folders. A grant
that reaches the whole drive is never handed to that window: it is let
go, and the owner connects again.

## The page in other languages

Every text the page says — and no person typed — is a key, in English, in
`src/i18n/<lang>.json`, with its translation beside it, written by hand and
empty until it is. `node tools/i18n.js` finds the keys in `src/index.html`
and in every string of the program that reads as words, keeps every
translation already written, and drops what the sources no longer say;
`build_guard` fails when the files are behind, so **a text added to the
program means running it**. A built page carries only the translations
written (`lang_script`, `build.py`), and `43-i18n.js` puts them in place of
the English on screen as it lands, by a MutationObserver, so nothing in
the program is wrapped to be translated. It runs only once a language
other than English is chosen on the top bar. The chart's own words, what
is typed into a field, and anything under `translate="no"` are a person's
and are never translated; on the chart only its tooltips are the page's.

## What has been measured, so it need not be argued

The numbers, and the benches that make them, are in `docs/performance.md`.
What they decided, which is what a change has to know:

- **A pan is one transform.** Anything that writes text or sizes on every
  frame of a gesture lays out the whole drawing (`showCoord` was 60 ms a
  frame at 600 entries). Culling off-screen entries saves half a
  millisecond and is not worth building.
- **A rebuild's cost was measuring text twice**, now cached (`blockCache`);
  then routing, now indexed (`routedNear`, `obstaclesNear`) and reused
  between passes while the router's world is the same (`routePass`). A test
  that wants a fresh pass sets `routeLast = null`.
- **An entry drawn as it was keeps its drawing** (`drawOrKeep`), and its
  grips and strips are built only when something can reach them
  (`nodeControlsWanted`; a test calls `nodeControlsOn(id)`).
  A connector drawn as it was keeps its drawing too (`keepEdgeDrawings`,
  `14-edges-draw.js`); a test that wants a fresh pass sets
  `drawnEdges = new Map()`.
- **Not worth doing, measured:** a Map for `edgeStyleFor`; the A\* lattice's
  obstacle fill (`latticeRoute` is not called on an ordinary chart);
  `applyVisibility` as a second pass; a two-phase render; incremental
  rendering of connectors; preloading pictures; batching `inkBoxOf`;
  carrying a group's connectors by translation. Re-propose one with a new
  measurement, not an argument about the shape of the code.
- **Snapshots of entries are by content** (`HEAVY_STRING` lifts long
  strings out of what undo and `isDirty` serialize), not by region.
- **What a reader downloads has a ceiling** in `tests/build_guard.py`, and
  `tools/bench-reader-code.js` says what a reader runs.

### How much of the program a reader runs, and the editor beside it

`tools/bench-reader-code.js` opens the site as a reader and reads it as
one does (a pan, the wheel, an entry pointed at and picked, a search,
every drawer, About, the text version), takes V8's byte coverage, and
fails if the reader's page throws or asks for the editor's file.

November 21, before: the site's program was 234 KB gzipped and 38% of
it ran. The code a reader skips is mostly spread through every part —
untaken branches of functions that do run — but ten parts are editing
from top to bottom, and the owner asked for them to go
(`LAZY_PARTS`, `build.py`). On the site they are `editor.<hash>.js`,
fetched by `loadEditorParts` (`36-site-owner.js`) once the service has
said the owner or an editor (`OWNERS`, `EDITORS`) is here, before anything is made editable, and kept by
the service worker for editing with no signal. After: the reader's
program is 194 KB gzipped, and the editor 42 KB beside it.

November 23 (0.27.2): the five heaviest parts a reader half runs gave up
the functions a reader never calls — carrying an entry and its grips,
writing in a text, the add menus, the style bar's workings — to four
parts of their own beside them (`18b-carry.js`, `25b-rich-text.js`,
`34b-add-menus.js`, `37b-style-bar-edit.js`), lazy like the rest. Chosen
by the bench's coverage, then by hand: a function every reader draws
with (a figure's outline) stayed whatever the coverage said, and so did
any that `tools/lazy.js` reported, which is how part 22's Import stayed
where it was. The reader's program went from 213 KB gzipped to 203, the
editor from 45 to 57.

How it holds together, since the page is still one scope:

- **Only the site is split.** `dist/nexus.html`, `src/index.html` and an
  export have every part where `APP_PARTS` puts it, so the suite drives
  the one program it always did; `inlineSiteFiles` puts each part back
  where its mark (`/*! @lazy … */`) stands. `build_guard` checks both
  halves are the program minified, and that they make it whole again.
- **What a reader's page reads of them is not in them.** The panels'
  state and the layers they draw in are declared at the end of
  `26-bio-crop.js`; what drawing, copying and exporting call is in the
  part it belongs to (`defId`, `cssEscape`, `settleAnchor`, the
  serializers, the drawer's note). A `const` the reader's paths read in
  a lazy part is a ReferenceError on the site and nowhere else —
  `tools/lazy.js` (run by `tools/lint.py`) refuses any `const`, `let` or
  `class` of a lazy part read from another part, and the editing
  constants the gestures read are at the end of `26-bio-crop.js`.
- **Their functions the rest names are empty until the file comes**
  (`editor_stubs`): closing a panel nobody could open is nothing to do.
  A function a reader needs an ANSWER from must not live in a lazy part —
  a stand-in answers `undefined`. `tools/lazy.js` reports every call from
  another part whose answer is used; its `KNOWN` says, name by name, why
  `undefined` is harmless there.
- **Listeners in a lazy part are registered when it arrives**, after
  every other part's, on the owner's page only. One that must run before
  another's on the same target does not belong in a lazy part.


### The cache, and why it may exist

The cache is only allowed to exist because nothing can tell it is there, and
that is checked rather than asserted: see the named checks in
`tests/scenarios/`. The one piece of state its arguments do not carry is
the order of `REFS` — a citation draws as the number its reference has in the
list, so moving one changes `[1]` to `[11]` and the width of every text that
cites it. The key carries that order, and only for texts that cite anything.


## Directions already rejected, with the reason

Do not re-propose these without new evidence:

- **ES modules / a bundler.** The call graph has 348 boot-reachable forward
  references with cycles; there is no order in which each part only uses what
  came before it. A bundler would also have destroyed the `@@EDIT@@` markers
  the page saved itself through. Looked at again in October 2026: the cycles
  alone would not forbid modules — a module may take part in a cycle as long
  as it does not read the other side's names while it runs — but the markers
  stood, and the owner's answer was to keep one scope. The markers went in
  0.23.0, when the chart became `src/chart.json`, so that reason is gone; one
  scope stays because nothing measured asks for anything else. Re-propose
  modules with such a measurement, not with the markers' absence alone.
- **A full TypeScript migration**, and a **Model/View split as an end in
  itself**. Cost without a measured problem behind it.
- **Splitting the editor and the viewer into two builds.** Editing and drawing
  are threaded through the same functions, so "not calling" the editor does
  not separate it; and two builds create a class of "looks different in the
  viewer" bugs that one program with a flag cannot have. If this is ever
  wanted, do it as lazy loading of the editing parts from one codebase, not as
  a second build. That is what the site does now (`LAZY_PARTS`; see "How
  much of the program a reader runs").
- **An `[A-Za-z0-9_-]+` whitelist for entry ids.** Ids come from the chart's
  own content.

## Priorities

1. **Independence from the claude.ai runtime.** Done as of 0.22.0: Pages
   serves the page, Save on the site commits to the repository through
   `worker/`, pictures are files beside the page, and the page no longer
   asks an artifact host anything. The last of the artifact's shape, the
   chart as `@@EDIT@@` regions of a script, became `src/chart.json` in
   0.23.0.
2. **The owner's lists.** Most work is a list of the owner's, dated, of
   things to add or change; it is done as asked, and each list is one
   version and one pull request — not three versions in one.
3. **After every two or three of those, a release of cleaning up**:
   bughunting, removing behaviour that is unwanted or surprising, and what
   the last review found (0.25.2 "Code 1", 0.27.1). It used to say
   bughunting came before features; the pace of the lists said otherwise,
   and a priority every session reads should be the one being kept.

A third priority stood here: splitting the suites so a small change did not
cost twelve minutes. It is done, and differently from how it was posed — not
a quick set and a full set, which would have meant deciding by hand which
checks matter, but named scenarios that can be selected (`--only`) and run in
parallel (`tools/shards.js`). Twelve minutes of waiting is now about three,
and one scenario is twenty seconds.

## House style

- Comments explain **why**, in prose, and are expected to be worth reading.
  Match the existing voice rather than adding `// set x to 1`.
- Review work is not delegated to subagents.
- A message containing **"код 1"** means: run a full review → critique →
  optimise cycle over the codebase.
- Deliverable archives keep the split-source layout (`src/`, `dist/`, `tests/`,
  `tools/`, `build.py`, `README.md`, `DISTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`, `NOTICE`, `package.json`,
  `eslint.config.mjs`).
- Every version bump touches four places: `APP_VERSION` and `VERSION_LOG` in
  `src/app/20-about.js`, `CHANGELOG.md`, `README.md`, `package.json`. The
  About panel and the changelog are generated from the same `VERSION_LOG`, so
  they cannot disagree.
- The code is MIT (`LICENSE`); the chart's content is not, and `NOTICE`
  says so. The owner claims the platform only: what a chart names or
  carries belongs to its own authors.
- Replies to the repository owner are written in Russian.
