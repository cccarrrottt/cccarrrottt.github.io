#!/usr/bin/env python3
"""What build.py must refuse, and what the page it makes must be.

The browser suite can only test the page. This tests the one part of the
project that runs outside it: that the page is one document made from src/
and nothing else, that the program is its parts in their order, and that
the site is that page with its program and stylesheet beside it.

Every case runs against a throwaway copy of the project, so nothing here
can touch the real src/chart.json.

    python3 tests/build_guard.py
"""
import atexit
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PASS = FAIL = 0


def check(name, ok, detail=''):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f'  ok   {name}')
    else:
        FAIL += 1
        print(f'  FAIL {name}' + (f'\n       {detail}' if detail else ''))


def sandbox():
    """A copy of the project, built once already.

    Each is a whole copy of src/ and dist/, ~20 MB, and a run makes dozens;
    they were never taken away, so every run left half a gigabyte in the
    temporary directory until a machine that runs the guard often filled
    its disk (31.10: 2958 of them, 30 GB). They go when the guard ends."""
    tmp = Path(tempfile.mkdtemp(prefix='rhizome-build-'))
    atexit.register(shutil.rmtree, tmp, True)
    for part in ('src', 'dist', 'tools'):
        if (ROOT / part).exists():
            shutil.copytree(ROOT / part, tmp / part)
    shutil.copy(ROOT / 'build.py', tmp / 'build.py')
    return tmp


def parts_of(tmp):
    """APP_PARTS, read out of the sandbox's own copy of build.py."""
    body = (tmp / 'build.py').read_text(encoding='utf-8')
    m = re.search(r'APP_PARTS = \[(.*?)\]', body, re.S)
    assert m, 'fixture: build.py has no APP_PARTS'
    return re.findall(r"'([^']+)'", m.group(1))


def site_files(tmp):
    """The program and stylesheet the built site names, by name."""
    site = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8')
    return sorted(re.findall(r'(?:src|href)="([\w.-]+)" data-inline', site))


# The sandbox has no node_modules of its own, so its builds are pointed at
# this checkout's esbuild: the site they make is minified, as CI's is.
ESBUILD = ROOT / 'node_modules' / '.bin' / 'esbuild'


def run(tmp, *args, extra_env=None):
    env = dict(os.environ)
    # The counter's token is CI's to pass, and only to the publishing build.
    env.pop('CF_WEB_ANALYTICS_TOKEN', None)
    env.update(extra_env or {})
    if ESBUILD.exists():
        env['ESBUILD'] = str(ESBUILD)
    return subprocess.run([sys.executable, 'build.py', *args],
                          cwd=tmp, capture_output=True, text=True, env=env)


CHART_RE = re.compile(r'<script type="application/json" id="chart-data">\n(.*?)\n</script>', re.S)


def chart_of(text):
    """The chart a page carries: the text of its JSON element."""
    m = CHART_RE.search(text)
    return m.group(1) if m else None


def edit_one_label(text):
    """A page whose chart has been edited, with the same number of entries.

    The hard case for a staleness check, and the ordinary one in life:
    somebody renamed something. A check that compares how many items the
    chart holds sees nothing at all here, which is why the real one
    compares the text.
    """
    m = CHART_RE.search(text)
    assert m, 'fixture: no chart in the built page'
    body, n = re.subn(r'("label":")([^"]*)(")', lambda g: g.group(1) + g.group(2) + ' EDITED' + g.group(3),
                      m.group(1), count=1)
    assert n == 1, 'fixture: found no entry label to rename'
    return text[:m.start(1)] + body + text[m.end(1):]


def as_in_page(chart):
    """src/chart.json as the build writes it into a page (chart_script)."""
    return (chart.rstrip('\n').replace('<', '\\u003c')
            .replace('\u2028', '\\u2028').replace('\u2029', '\\u2029'))


def main():
    # One file, and it is a whole document. There used to be four — editable
    # or read-only, fragment or document — because who may edit was decided
    # here; it is decided when the page opens now, and a second file would
    # only be a second thing to forget to publish. GitHub Pages and a disk
    # both need a document.
    tmp = sandbox()
    r = run(tmp)
    check('the sources build', r.returncode == 0, r.stdout + r.stderr)
    check('dist/nexus.html is the only page the build writes, beside the site and its pictures',
          sorted(f.name for f in (tmp / 'dist').iterdir()) == ['media', 'nexus.html', 'site'],
          str(sorted(f.name for f in (tmp / 'dist').iterdir())))
    built = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8')
    check('and it is a whole document',
          built.lstrip().lower().startswith('<!doctype html>'), built[:80])
    # Read-only is the page's own decision, from where it was opened; a
    # declaration written in here would travel with every copy exported
    # from the site and freeze it on the reader's disk.
    check('with no read-only declaration built into it',
          '@@SHARE' not in built and '<title>Rhizome Project</title>' in built)

    # The chart is src/chart.json and nothing else. A build used to carry the
    # chart over from the dist/nexus.html it was about to replace, because
    # a copy on claude.ai saved into its own page and that page was where
    # the newest chart lived. That copy is gone, and with it every reason
    # for the page a build makes to be anything but a function of src/: a
    # build that read its own previous output could only ever put back
    # something src/chart.json no longer says.
    tmp = sandbox()
    old = tmp / 'dist' / 'nexus.html'
    old.write_text(edit_one_label(old.read_text(encoding='utf-8')), encoding='utf-8')
    seed = (tmp / 'src' / 'chart.json').read_text(encoding='utf-8')
    r = run(tmp)
    built = old.read_text(encoding='utf-8')
    check('a build takes the chart from src/chart.json, not from the page it replaces',
          r.returncode == 0 and ' EDITED' not in built and chart_of(built) == as_in_page(seed),
          r.stdout + r.stderr)
    check('and leaves src/chart.json as it was',
          (tmp / 'src' / 'chart.json').read_text(encoding='utf-8') == seed)
    check('and puts nothing aside, there being nothing a build can lose',
          not (tmp / '.backups').exists() and r.stdout.count('NOTE') == 0, r.stdout)

    # The chart is data in the page, not code: JSON in an element a browser
    # does not run, which the program reads with JSON.parse. Until 0.23 it
    # was src/data.js, written into the program's own script.
    check('the chart is in the page as JSON a browser does not run, apart from the program',
          built.count('<script type="application/json" id="chart-data">') == 1
          and built.index('id="chart-data"') < built.index('const APP_VERSION')
          and '\n</script>\n<script>\n' in built[built.index('id="chart-data"'):built.index('const APP_VERSION')])
    import json as _json
    check('and it is src/chart.json, which reads back as the same chart',
          _json.loads(chart_of(built)) == _json.loads(seed))
    # A label is the owner's text, and HTML ends a script element at the
    # first closing tag it meets, in a string or not.
    hostile = _json.loads(seed)
    hostile['nodes'][0]['label'] = 'see </script><script>alert(1)</script> and <!-- this \u2028'
    (tmp / 'src' / 'chart.json').write_text(_json.dumps(hostile, ensure_ascii=False), encoding='utf-8')
    r = run(tmp)
    built = old.read_text(encoding='utf-8')
    inside = chart_of(built) or ''
    check('a closing script tag in the chart\'s text cannot end the element, nor open a comment',
          r.returncode == 0 and '<' not in inside and '\u2028' not in inside
          and _json.loads(inside)['nodes'][0]['label'] == hostile['nodes'][0]['label'], r.stdout + r.stderr)
    (tmp / 'src' / 'chart.json').write_text(seed[:-3], encoding='utf-8')
    r = run(tmp)
    check('a chart.json that is not JSON stops the build, and says so',
          r.returncode != 0 and 'src/chart.json is not JSON' in (r.stdout + r.stderr), r.stdout + r.stderr)
    (tmp / 'src' / 'chart.json').write_text('{"format": 4}', encoding='utf-8')
    r = run(tmp)
    check('and so does one that is JSON but no chart',
          r.returncode != 0 and 'no list of entries' in (r.stdout + r.stderr), r.stdout + r.stderr)
    (tmp / 'src' / 'chart.json').write_text(seed, encoding='utf-8')
    part = tmp / 'src' / 'app' / '01-store.js'
    kept = part.read_text(encoding='utf-8')
    part.write_text(kept.replace("CHART_ELEMENT_ID = 'chart-data'", "CHART_ELEMENT_ID = 'chart'"), encoding='utf-8')
    r = run(tmp)
    check('a program that looks for its chart anywhere else stops the build, and says where it lived',
          r.returncode != 0 and '01-store.js' in (r.stdout + r.stderr), r.stdout + r.stderr)
    part.write_text(kept, encoding='utf-8')
    r = run(tmp, '--pull', 'x.html')
    check('a flag the build no longer takes is refused, not ignored',
          r.returncode != 0 and '--pull' in (r.stdout + r.stderr), r.stdout + r.stderr)

    # 9. The program is one scope assembled in one order, and there are three
    #    ways for that order to quietly stop being true. None of them may
    #    produce a page — a part left out of an assembled program does not
    #    fail loudly, it fails as a function that is simply not there.
    tmp = sandbox()
    parts = parts_of(tmp)
    check('the sandbox has every part APP_PARTS names',
          all((tmp / 'src' / 'app' / n).exists() for n in parts), str(parts[:3]))

    gone = tmp / 'src' / 'app' / parts[3]
    keep = gone.read_text(encoding='utf-8')
    gone.unlink()
    r = run(tmp)
    check('a part that APP_PARTS names but src/app/ has not stops the build',
          r.returncode != 0 and parts[3] in (r.stdout + r.stderr),
          r.stdout + r.stderr)
    gone.write_text(keep, encoding='utf-8')

    stray = tmp / 'src' / 'app' / '99-stray.js'
    stray.write_text('function strayFn(){ return 1; }\n', encoding='utf-8')
    r = run(tmp)
    check('a part in src/app/ that APP_PARTS does not name stops it too',
          r.returncode != 0 and '99-stray.js' in (r.stdout + r.stderr),
          r.stdout + r.stderr)
    stray.unlink()

    idx = tmp / 'src' / 'index.html'
    html = idx.read_text(encoding='utf-8')
    a, b = f"    '{parts[0]}',", f"    '{parts[1]}',"
    idx.write_text(html.replace(a + '\n' + b, b + '\n' + a), encoding='utf-8')
    r = run(tmp)
    check('index.html running the parts in another order stops it',
          r.returncode != 0 and 'index.html' in (r.stdout + r.stderr),
          r.stdout + r.stderr)
    idx.write_text(html.replace(a + '\n', ''), encoding='utf-8')
    r = run(tmp)
    check('and so does index.html leaving a part out',
          r.returncode != 0 and 'index.html' in (r.stdout + r.stderr),
          r.stdout + r.stderr)
    idx.write_text(html, encoding='utf-8')

    # 10. And the page really is those files, in that order, with nothing
    #     added between them: the split is a move, not a transformation.
    r = run(tmp)
    check('with all of it in place the build runs again', r.returncode == 0,
          r.stdout + r.stderr)
    joined = ''.join((tmp / 'src' / 'app' / n).read_text(encoding='utf-8')
                     for n in parts)
    built = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8')
    check('and the built page contains the parts concatenated verbatim',
          joined in built, f'{len(joined)} chars of parts, {len(built)} of page')

    # 10b. The parts are joined with nothing between them, which is only safe
    #      while each of them ends in a newline. One that does not would have
    #      its last line joined to the next part's first — and a part ending
    #      in a comment would comment that line out. Nothing about the page
    #      would look wrong; something would simply not be there.
    tmp = sandbox()
    parts = parts_of(tmp)
    victim = tmp / 'src' / 'app' / parts[2]
    whole = victim.read_text(encoding='utf-8')
    victim.write_text(whole.rstrip('\n') + '\n// a trailing comment, unterminated by a newline',
                      encoding='utf-8')
    r = run(tmp)
    check('a part that does not end in a newline stops the build',
          r.returncode != 0 and parts[2] in (r.stdout + r.stderr),
          r.stdout + r.stderr)
    victim.write_text(whole, encoding='utf-8')
    r = run(tmp)
    check('and putting the newline back lets it build again',
          r.returncode == 0, r.stdout + r.stderr)

    # 10b'. A closing script tag anywhere in a part — a string, a comment —
    #       ends the page's script there, and the page is a syntax error that
    #       names nothing. The build says which part.
    tmp = sandbox()
    parts = parts_of(tmp)
    victim = tmp / 'src' / 'app' / parts[5]
    whole = victim.read_text(encoding='utf-8')
    victim.write_text(whole + '// a note that mentions </script> in passing\n', encoding='utf-8')
    r = run(tmp)
    check('a closing script tag in a part stops the build and names the part',
          r.returncode != 0 and parts[5] in (r.stdout + r.stderr), r.stdout + r.stderr)

    # 10c. The page carries the git blob id of the chart.json it was built from.
    #      The write service refuses a save whose base is not the file in the
    #      repository, so this id being wrong would lock the owner out of
    #      saving — or, worse, being the same for two different files would
    #      let a page that is behind write over a newer chart.
    tmp = sandbox()
    r = run(tmp)
    raw = (tmp / 'src' / 'chart.json').read_bytes()
    want = hashlib.sha1(b'blob %d\0' % len(raw) + raw).hexdigest()
    built = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8')
    site = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8')
    meta = f'<meta name="rhizome-data-sha" content="{want}">'
    check('the page names the chart.json it was built from, as git names it',
          meta in built and meta in site, want)
    # In the wrapper, outside the page's own markers: what is cut out of the
    # page — an export, a publish to claude.ai — is nobody's base to save on.
    check('outside the content an exported copy is cut from',
          all(p.index(meta) < p.index('<!-- @@PAGE:BEGIN@@ -->') for p in (built, site)))
    app_before = site_files(tmp)
    (tmp / 'src' / 'chart.json').write_bytes(raw + b'\n')
    run(tmp)
    again = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8')
    check('and a different chart.json gives a different name',
          meta not in again and '<meta name="rhizome-data-sha" content="' in again)
    # The point of the site's files: a Save changes the chart and nothing a
    # reader's browser has kept.
    check('while the site\'s program and stylesheet keep their names, and their bytes',
          site_files(tmp) == app_before, f'{app_before} -> {site_files(tmp)}')
    part = tmp / 'src' / 'app' / '01-store.js'
    kept = part.read_text(encoding='utf-8')
    part.write_text(kept.replace('meta[name="rhizome-data-sha"]', 'meta[name="something-else"]'),
                    encoding='utf-8')
    r = run(tmp)
    check('a program that no longer reads the name stops the build and says where it lived',
          r.returncode != 0 and '01-store.js' in (r.stdout + r.stderr), r.stdout + r.stderr)
    part.write_text(kept, encoding='utf-8')

    # 10e. The site is the same page with its program and stylesheet beside
    #      it. Put back where their tags stand, they give dist/nexus.html's
    #      content byte for byte. (There used to be one seam: the chart was
    #      code in the program's script, which the site closed and reopened
    #      as two. The chart is its own element now, in both.)
    tmp = sandbox()
    r = run(tmp)
    built = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8')
    site = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8')
    files = site_files(tmp)
    check('the site names a program and a stylesheet, each by the hash of its bytes',
          len(files) == 2 and all(
              hashlib.sha256((tmp / 'dist' / 'site' / n).read_bytes()).hexdigest()[:16] == n.split('.')[1]
              for n in files), str(files))
    # What a reader downloads has a ceiling (the page as built, before
    # tools/prerender.js adds its drawing), so that growing is a decision
    # written here rather than something nobody saw. The editor split took
    # the reader's program to 194 KB gzipped on 21.11; by 0.27.0 it was 210,
    # heavier than the whole program of 0.23.2. Raise a number only on
    # purpose, with the reason in the commit; tools/bench-reader-code.js
    # says what a reader runs, and so what could go to LAZY_PARTS instead.
    import gzip
    gz = lambda name: len(gzip.compress((tmp / 'dist' / 'site' / name).read_bytes(), 9))
    app_name = next((n for n in files if n.startswith('app.')), None)
    CEILINGS = {'the reader\'s program': (app_name, 206_000), 'the page': ('index.html', 30_000)}
    for what, (name, most) in CEILINGS.items():
        size = gz(name) if name else None
        check(f'{what} is at most {most // 1000} KB gzipped', size is not None and size <= most, f'{name}: {size}')
    # What the files hold is the program and the stylesheet minified, and
    # nothing else: esbuild's output for the same sources, byte for byte,
    # and the line that names the program's source map.
    sys.path.insert(0, str(tmp))
    import build as built_by
    os.environ.setdefault('ESBUILD', str(ESBUILD))
    sources = {'js': built_by.read_app(), 'css': (tmp / 'src' / 'style.css').read_text(encoding='utf-8')}
    # The program goes out without its version log, which is a file of its
    # own beside it; the program names it where the log stood.
    lifted, log_name, log_text = built_by.lift_version_log(sources['js'])
    # As JSON, which the page reads as data (the site's policy lets nothing
    # run from a string), and which is the log as written: node evaluates
    # the literal and must get the same value.
    lit_at = sources['js'].index(built_by.VERSION_LOG_OPEN) + len(built_by.VERSION_LOG_OPEN) - 1
    lit_end = sources['js'].index(built_by.VERSION_LOG_CLOSE, lit_at) + 2
    as_js = subprocess.run(['node', '-e', 'process.stdout.write(JSON.stringify(Function("return (" + '
                            'require("fs").readFileSync(0, "utf8") + ")")()))'],
                           input=sources['js'][lit_at:lit_end], capture_output=True, text=True)
    check('the version log is beside the program, named by its bytes, and is the log as written, as JSON',
          (tmp / 'dist' / 'site' / log_name).read_text(encoding='utf-8') == log_text
          and log_text.startswith('[') and log_text.endswith(']') and '{"v":"' in log_text
          and as_js.returncode == 0 and json.loads(log_text) == json.loads(as_js.stdout)
          and lifted.replace(f'"{log_name}"', sources['js'][lit_at:lit_end]) == sources['js'], log_name)
    check('and it keeps every "<" escaped, since an export puts it back inside a script',
          '<' not in log_text)
    # On the site the editing parts (LAZY_PARTS) are a file of their own:
    # the program holds a mark where each stood, and ends with an empty
    # stand-in for each of their functions the rest names, and the editor's
    # name. Each put back where its mark stands, the program is whole.
    head_js, editor_js = built_by.split_site_program(sources['js'])
    rebuilt = head_js
    for n in built_by.LAZY_PARTS:
        rebuilt = rebuilt.replace(built_by.LAZY_MARK.format(n) + '\n', (tmp / 'src' / 'app' / n).read_text(encoding='utf-8'))
    check('the site\'s program and the editor\'s file, each part put back where its mark stands, are the program',
          rebuilt == sources['js'] and all(built_by.PART_MARK.format(n) in editor_js for n in built_by.LAZY_PARTS))
    head_lifted = built_by.lift_version_log(head_js)[0]
    site_sources = {'js': head_lifted, 'css': sources['css']}
    def bare(n):
        text = (tmp / 'dist' / 'site' / n).read_text(encoding='utf-8').split('\n//# sourceMappingURL=')[0].rstrip('\n')
        return text.split('\n' + built_by.EDITOR_OPEN + '\n')[0] if n.endswith('.js') else text
    minified = all(
        bare(n) == built_by.minify_for_site(site_sources[n.rsplit('.', 1)[1]], n.rsplit('.', 1)[1])[0].rstrip('\n')
        for n in files)
    check('they are the program and the stylesheet, minified and nothing else', minified)
    app_name = next(n for n in files if n.endswith('.js'))
    app_text = (tmp / 'dist' / 'site' / app_name).read_text(encoding='utf-8')
    tail = re.search(re.escape(built_by.EDITOR_OPEN) + r'\n(.*?)\nvar RHIZOME_EDITOR = "(editor\.[0-9a-f]{16}\.js)";\n'
                     + re.escape(built_by.EDITOR_CLOSE) + r'\n', app_text, re.S)
    editor_name = tail and tail.group(2)
    editor_file = editor_name and (tmp / 'dist' / 'site' / editor_name)
    check('the program ends naming the editor\'s file, which is beside it, named by its bytes',
          bool(editor_file) and editor_file.exists()
          and hashlib.sha256(editor_file.read_bytes()).hexdigest()[:16] == editor_name.split('.')[1], app_text[-200:])
    if editor_file and editor_file.exists():
        check('and the file is the editing parts, minified and nothing else',
              editor_file.read_text(encoding='utf-8').split('\n//# sourceMappingURL=')[0].rstrip('\n')
              == built_by.minify_for_site(editor_js, 'js')[0].rstrip('\n'))
        stubs = tail.group(1).split('\n')
        check('with an empty stand-in for every function of theirs the rest of the program names, and nothing else',
              stubs == built_by.editor_stubs(head_lifted, editor_js)
              and all(re.fullmatch(r'(?:async )?function\*? [\w$]+\(\)\{\}', x) for x in stubs)
              and 'closeEdgePopover' in tail.group(1), f'{len(stubs)} stand-ins')
    js_name = next(n for n in files if n.endswith('.js'))
    js_text = (tmp / 'dist' / 'site' / js_name).read_text(encoding='utf-8')
    if ESBUILD.exists():
        check('smaller than half what they were', len(js_text) < len(sources['js']) / 2,
              f'{len(js_text):,} of {len(sources["js"]):,}')
        mapped = re.search(r'//# sourceMappingURL=([\w.-]+)\n$', js_text)
        check('and the program names its source map, which is beside it',
              bool(mapped) and (tmp / 'dist' / 'site' / mapped.group(1)).exists(), js_text[-120:])
    # Put back as written, they give dist/nexus.html.
    inlined = site
    for n in files:
        text = sources[n.rsplit('.', 1)[1]]
        if n.endswith('.css'):
            inlined = inlined.replace(f'<link rel="stylesheet" href="{n}" data-inline>', f'<style>{text}</style>')
        else:
            inlined = inlined.replace(f'<script src="{n}" data-inline></script>', f'<script>\n{text}</script>')
    cut = lambda p: p[p.index('<!-- @@PAGE:BEGIN@@ -->'):p.index('<!-- @@PAGE:END@@ -->')]
    check('and put back inside it, they make the page dist/nexus.html is', cut(inlined) == cut(built),
          f'{len(cut(inlined))} chars against {len(cut(built))}')
    check('beside the files src/site/ holds, the preview picture among them',
          all((tmp / 'dist' / 'site' / f.name).read_bytes() == f.read_bytes()
              for f in (tmp / 'src' / 'site').iterdir() if f.name != 'manifest.webmanifest')
          and (tmp / 'dist' / 'site' / 'og-image.png').exists())
    # The chart as data beside the page: the file Save commits, but for the
    # address of its schema, which is the site's own.
    published = (tmp / 'dist' / 'site' / 'chart.json')
    own = (tmp / 'src' / 'chart.json').read_text(encoding='utf-8')
    check('and the chart itself, as data, at <site>/chart.json',
          published.exists() and json.loads(published.read_text(encoding='utf-8'))['nodes'] == json.loads(own)['nodes']
          and json.loads(published.read_text(encoding='utf-8'))['$schema'] == built_by.site_origin() + '/chart.schema.json')
    check('which the page names as where its data is',
          '<link rel="alternate" type="application/json" href="chart.json">' in site[:site.index('<!-- @@PAGE:BEGIN@@ -->')])
    og = ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']
    check('the site says what a link to it is, for a chat to show',
          all(f'"{k}"' in site[:site.index('<!-- @@PAGE:BEGIN@@ -->')] for k in og)
          and 'content="https://' in site and '/og-image.png"' in site)
    check('and only the site: neither the single page nor an export cut from it carries it',
          not any(k in built for k in og) and not any(k in cut(site) for k in og))

    # The site's Content-Security-Policy, which is what stands between a
    # script nobody wrote and the owner's session in localStorage
    # (site_policy, build.py). In the head, outside the markers: an export
    # runs its program inline and would be refused by it.
    policy = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)">', site)
    handlers = re.findall(r'<[^>]*\son[a-z]+="([^"]*)"', site)
    check('the site has a policy, in its head, before anything it governs',
          bool(policy) and policy.start() < site.index('</head>') and policy.start() < site.index('<script')
          and policy.start() < site.index('<link rel="stylesheet"'))
    pol = policy.group(1) if policy else ''
    check('it runs nothing from a string, nothing inline but by hash, and embeds nothing',
          "script-src 'self'" in pol and 'unsafe-eval' not in pol and "'unsafe-inline'" not in pol.split('style-src')[0]
          and "object-src 'none'" in pol and "base-uri 'none'" in pol and "form-action 'none'" in pol, pol)
    check('every handler the page carries inline is in it by its hash',
          bool(handlers) and all(
              "'sha256-" + base64.b64encode(hashlib.sha256(h.replace('&#39;', "'").encode()).digest()).decode() + "'" in pol
              for h in handlers), handlers)
    api = built_by.site_config()['api'].rstrip('/')
    check('and it lets requests go to the write service, when there is one',
          (api in pol.split('connect-src')[1].split(';')[0]) if api else "connect-src 'self' https://" in pol, pol)
    check('only the site has one: not the single page, nor an export cut from it',
          'Content-Security-Policy' not in built and 'Content-Security-Policy' not in cut(site))

    # The visitor counter: the site has it when CI passes a token, and like
    # the preview it stands outside the markers, so an export cut from the
    # site never counts its holder's visits on the owner's account.
    check('with no token the site has no visitor counter', 'cloudflareinsights' not in site)
    token = '0123456789abcdef0123456789abcdef'
    r = run(tmp, extra_env={'CF_WEB_ANALYTICS_TOKEN': token})
    counted = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8')
    head = counted[:counted.index('<!-- @@PAGE:BEGIN@@ -->')]
    check('with one, the site counts its visits',
          r.returncode == 0 and 'static.cloudflareinsights.com/beacon.min.js' in head and f'"token": "{token}"' in head,
          r.stdout + r.stderr)
    check('and only the site: not the single page, nor an export cut from it',
          'cloudflareinsights' not in (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8')
          and 'cloudflareinsights' not in cut(counted))
    snippet = ("<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js'"
               f" data-cf-beacon='{{\"token\": \"{token}\"}}'></script><!-- End Cloudflare Web Analytics -->")
    r = run(tmp, extra_env={'CF_WEB_ANALYTICS_TOKEN': snippet})
    counted = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8')
    check('the whole snippet Cloudflare offers, pasted as the token, gives the same counter',
          r.returncode == 0 and counted.count('beacon.min.js') == 1 and f'"token": "{token}"' in counted
          and 'End Cloudflare' not in counted, r.stdout + r.stderr)
    r = run(tmp, extra_env={'CF_WEB_ANALYTICS_TOKEN': '"><script>alert(1)</script>'})
    check('a token that is not one stops the build rather than being written into the page',
          r.returncode != 0 and 'CF_WEB_ANALYTICS_TOKEN' in (r.stdout + r.stderr), r.stdout + r.stderr)

    # 10d. Files the old builds made are taken away, not left looking current
    #      beside the one that is: one of them is exactly the file somebody
    #      would reach for to publish.
    tmp = sandbox()
    for gone in ('nexus-share.html', 'nexus-standalone.html', 'nexus-share-standalone.html'):
        (tmp / 'dist' / gone).write_text('an old build', encoding='utf-8')
    r = run(tmp)
    check('a build removes what the four-build days left in dist/',
          r.returncode == 0 and sorted(f.name for f in (tmp / 'dist').iterdir()) == ['media', 'nexus.html', 'site'],
          str(sorted(f.name for f in (tmp / 'dist').iterdir())))

    # The pictures beside the chart go beside the built page, where the
    # page's relative paths find them; one already there is left as it is.
    tmp = sandbox()
    (tmp / 'src' / 'media').mkdir(exist_ok=True)
    name = 'a' * 64 + '.png'
    (tmp / 'src' / 'media' / name).write_bytes(b'bytes of a picture')
    r = run(tmp)
    copied = tmp / 'dist' / 'media' / name
    check('the media folder is copied beside the built page',
          r.returncode == 0 and copied.exists() and copied.read_bytes() == b'bytes of a picture',
          r.stdout + r.stderr)
    r = run(tmp)
    check('and a second build has nothing new to copy',
          r.returncode == 0 and 'new' not in [l for l in r.stdout.splitlines() if 'dist/media' in l][0],
          r.stdout)

    # The site's addresses are said once, in src/app/00-config.js. The write
    # service cannot read that file — Cloudflare deploys it with what
    # worker/wrangler.toml says — so the two are held together here: an
    # address changed in one and not the other would otherwise surface as a
    # sign-in that fails on the live site.
    config = dict(re.findall(r"^\s*(site|api|repo): '([^']*)',?\s*$",
                             (ROOT / 'src' / 'app' / '00-config.js').read_text(encoding='utf-8'), re.M))
    wrangler = dict(re.findall(r'^(\w+) = "([^"]*)"', (ROOT / 'worker' / 'wrangler.toml').read_text(encoding='utf-8'), re.M))
    check('the config says site, api and repo', all(k in config for k in ('site', 'api', 'repo')), str(config))
    # A copy with no write service (api empty) is read-only for everybody
    # and deploys nothing, so what wrangler.toml says is nobody's business.
    # The service lets in an ORIGIN: a site under a path is let in by the
    # origin it is under, which is all a browser tells the service.
    site_at = urllib.parse.urlsplit(config.get('site', ''))
    if config.get('api'):
        check('the write service is deployed for the repository the config names',
              wrangler.get('REPO') == config.get('repo'), f"{wrangler.get('REPO')} vs {config.get('repo')}")
        check('and lets in the site the config names',
              f'{site_at.scheme}://{site_at.netloc}' in [o.strip() for o in wrangler.get('ALLOWED_ORIGINS', '').split(',')],
              f"{wrangler.get('ALLOWED_ORIGINS')} vs {config.get('site')}")
    else:
        check('with no write service in the config, there is no service to agree with', True)

    # And everything the build writes about where it lives follows the
    # config: another address there is another address in the link preview,
    # in the schema's name for itself and in the program — and nowhere the
    # old one.
    tmp = sandbox()
    part = tmp / 'src' / 'app' / '00-config.js'
    text = part.read_text(encoding='utf-8')
    old_site = config.get('site', '')
    part.write_text(text.replace(f"site: '{old_site}'", "site: 'https://example.org'"), encoding='utf-8')
    r = run(tmp)
    site_page = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8') if r.returncode == 0 else ''
    schema = (tmp / 'dist' / 'site' / 'chart.schema.json').read_text(encoding='utf-8') if r.returncode == 0 else ''
    nexus = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8') if r.returncode == 0 else ''
    # Only the preview's own tags: the chart may well link to the site in
    # its entries, and those are the chart's words, not the build's.
    check('another site in the config is the site the preview names',
          'og:url" content="https://example.org/"' in site_page
          and 'og:image" content="https://example.org/og-image.png"' in site_page, r.stdout + r.stderr)
    check('and the address the schema gives itself',
          '"$id": "https://example.org/chart.schema.json"' in schema, schema[:300])
    check('and the one the program asks',
          "site: 'https://example.org'" in nexus and f"site: '{old_site}'" not in nexus)
    # A repository Pages serves under a path: the site is the address with
    # it, everywhere the build writes one, and the page is told the same.
    part.write_text(text.replace(f"site: '{old_site}'", "site: 'https://example.org/charts/'"), encoding='utf-8')
    r = run(tmp)
    site_page = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8') if r.returncode == 0 else ''
    schema = (tmp / 'dist' / 'site' / 'chart.schema.json').read_text(encoding='utf-8') if r.returncode == 0 else ''
    data = (tmp / 'dist' / 'site' / 'chart.json').read_text(encoding='utf-8') if r.returncode == 0 else '{}'
    check('a site under a path is named with it, and with one slash, in the preview',
          'og:url" content="https://example.org/charts/"' in site_page
          and 'og:image" content="https://example.org/charts/og-image.png"' in site_page, r.stdout + r.stderr)
    check('and in the schema and the chart published beside it',
          '"$id": "https://example.org/charts/chart.schema.json"' in schema
          and json.loads(data).get('$schema') == 'https://example.org/charts/chart.schema.json')
    # No write service at all: the build makes the same site, read-only for
    # everybody, and its policy names no service.
    part.write_text(re.sub(r"api: '[^']*'", "api: ''", text), encoding='utf-8')
    r = run(tmp)
    site_page = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8') if r.returncode == 0 else ''
    check('a config with no write service builds a site whose policy names none',
          r.returncode == 0 and "connect-src 'self' https://api.github.com" in site_page, r.stdout + r.stderr)
    part.write_text(text, encoding='utf-8')

    # What the chart is called and says it is comes from the chart
    # (settings.title, settings.description), not from the platform: the
    # tab, the link preview and the app a phone keeps all follow it.
    chart_file = tmp / 'src' / 'chart.json'
    chart_text = chart_file.read_text(encoding='utf-8')
    ch = json.loads(chart_text)
    ch['settings'] = dict(ch.get('settings') or {}, title='A <Map> of Rivers', description='Where the water goes.')
    chart_file.write_text(json.dumps(ch), encoding='utf-8')
    r = run(tmp)
    site_page = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8') if r.returncode == 0 else ''
    nexus = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8') if r.returncode == 0 else ''
    manifest = json.loads((tmp / 'dist' / 'site' / 'manifest.webmanifest').read_text(encoding='utf-8')) if r.returncode == 0 else {}
    check("the chart's name and sentence are what a link to the site shows",
          'og:title" content="A &lt;Map&gt; of Rivers"' in site_page and 'og:description" content="Where the water goes."' in site_page
          and 'Transformers' not in site_page[:site_page.index('<!-- @@PAGE:BEGIN@@ -->')], r.stdout + r.stderr)
    check('and the title of the tab, in the site and the single page',
          '<title>A &lt;Map&gt; of Rivers</title>' in site_page and '<title>A &lt;Map&gt; of Rivers</title>' in nexus)
    check('and the name of the app a phone keeps',
          manifest.get('name') == 'A <Map> of Rivers' and manifest.get('description') == 'Where the water goes.', str(manifest))
    for k in ('title', 'description'):
        ch['settings'].pop(k)
    chart_file.write_text(json.dumps(ch), encoding='utf-8')
    r = run(tmp)
    site_page = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8') if r.returncode == 0 else ''
    head = site_page[:site_page.index('<!-- @@PAGE:BEGIN@@ -->')] if site_page else ''
    check('a chart that names nothing is called by the platform\'s name, and says no sentence',
          'og:title" content="Rhizome Project"' in head and 'og:description' not in head
          and 'name="description"' not in head, r.stdout + r.stderr)
    chart_file.write_text(chart_text, encoding='utf-8')

    part.write_text(text.replace("site: '", "site: \"").replace(f"{old_site}',", f'{old_site}",'), encoding='utf-8')
    r = run(tmp)
    check('a config the build cannot read stops it and says which file',
          r.returncode != 0 and '00-config.js' in (r.stdout + r.stderr), r.stdout + r.stderr)

    # CLAUDE.md and README say how many scenarios the browser suite has,
    # and both had drifted (89 and 77, against 121) because nothing read
    # them back. The number is counted from the suite's own source rather
    # than asked of it: --list sets up the page before it names anything,
    # and this job has no browser to set it up with.
    suite = ''.join(f.read_text(encoding='utf-8') for f in
                    [ROOT / 'tests' / 'regression.js', *sorted((ROOT / 'tests' / 'scenarios').glob('*.js'))])
    n = len(re.findall(r'^\s*await scenario\(', suite, re.M))
    if not n:
        check('the suite says how many scenarios it has', False, 'no scenario( calls found')
    else:
        for doc in ('CLAUDE.md', 'README.md'):
            said = re.findall(r'(\d+) named scenarios', (ROOT / doc).read_text(encoding='utf-8'))
            check(f'{doc} says the suite has the {n} scenarios it has',
                  said and all(int(x) == n for x in said), f'{doc} says {said or "nothing"}')

    # Every text the page says is a key in the files it is translated in
    # (the owner's list of 19.11): a text added to the program and not to
    # them is one nobody can translate. tools/i18n.js brings them up to date.
    r = subprocess.run(['node', str(ROOT / 'tools' / 'i18n.js'), '--check'], capture_output=True, text=True)
    check('src/i18n/ holds every text the page says (node tools/i18n.js)', r.returncode == 0, r.stdout + r.stderr)

    print(f'\n{PASS} passed, {FAIL} failed\n')
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
