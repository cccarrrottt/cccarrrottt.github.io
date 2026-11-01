#!/usr/bin/env python3
"""What build.py must refuse, and what the page it makes must be.

The browser suite can only test the page. This tests the one part of the
project that runs outside it: that the page is one document made from src/
and nothing else, that the program is its parts in their order, and that
the site is that page with its program and stylesheet beside it.

Every case runs against a throwaway copy of the project, so nothing here
can touch the real src/data.js.

    python3 tests/build_guard.py
"""
import atexit
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
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


def edit_one_label(text):
    """A page whose chart has been edited, with the same number of entries.

    The hard case for a staleness check, and the ordinary one in life:
    somebody renamed something. A check that compares how many items a
    region holds sees nothing at all here, which is why the real one
    compares the text.
    """
    m = re.search(r'(/\* @@EDIT:NODES:START@@ \*/)(.*?)(/\* @@EDIT:NODES:END@@ \*/)',
                  text, re.S)
    assert m, 'fixture: no NODES region in the built page'
    # An entry is a record now ({id:'…', label:'…'}); a page built before
    # that writes a list (['…', '…']). Either is a label to rename.
    body, n = re.subn(r"(\{id:'[^']*',\s*label:'|\[\s*'[^']*',\s*')([^']*)(')",
                      lambda g: g.group(1) + g.group(2) + ' EDITED' + g.group(3),
                      m.group(2), count=1)
    assert n == 1, 'fixture: found no entry label to rename'
    return text[:m.start(2)] + body + text[m.end(2):]


def region_of(text, name):
    m = re.search(rf'/\* @@EDIT:{name}:START@@ \*/.*?/\* @@EDIT:{name}:END@@ \*/', text, re.S)
    return m.group(0) if m else None


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

    # The chart is src/data.js and nothing else. A build used to carry the
    # chart over from the dist/nexus.html it was about to replace, because
    # a copy on claude.ai saved into its own page and that page was where
    # the newest chart lived. That copy is gone, and with it every reason
    # for the page a build makes to be anything but a function of src/: a
    # build that read its own previous output could only ever put back
    # something src/data.js no longer says.
    tmp = sandbox()
    old = tmp / 'dist' / 'nexus.html'
    old.write_text(edit_one_label(old.read_text(encoding='utf-8')), encoding='utf-8')
    seed = (tmp / 'src' / 'data.js').read_text(encoding='utf-8')
    r = run(tmp)
    built = old.read_text(encoding='utf-8')
    check('a build takes the chart from src/data.js, not from the page it replaces',
          r.returncode == 0 and ' EDITED' not in built and region_of(built, 'NODES') == region_of(seed, 'NODES'),
          r.stdout + r.stderr)
    check('and leaves src/data.js as it was',
          (tmp / 'src' / 'data.js').read_text(encoding='utf-8') == seed)
    check('and puts nothing aside, there being nothing a build can lose',
          not (tmp / '.backups').exists() and r.stdout.count('NOTE') == 0, r.stdout)
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

    # 10c. The page carries the git blob id of the data.js it was built from.
    #      The write service refuses a save whose base is not the file in the
    #      repository, so this id being wrong would lock the owner out of
    #      saving — or, worse, being the same for two different files would
    #      let a page that is behind write over a newer chart.
    tmp = sandbox()
    r = run(tmp)
    raw = (tmp / 'src' / 'data.js').read_bytes()
    want = hashlib.sha1(b'blob %d\0' % len(raw) + raw).hexdigest()
    built = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8')
    site = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8')
    meta = f'<meta name="rhizome-data-sha" content="{want}">'
    check('the page names the data.js it was built from, as git names it',
          meta in built and meta in site, want)
    # In the wrapper, outside the page's own markers: what is cut out of the
    # page — an export, a publish to claude.ai — is nobody's base to save on.
    check('outside the content an exported copy is cut from',
          all(p.index(meta) < p.index('<!-- @@PAGE:BEGIN@@ -->') for p in (built, site)))
    app_before = site_files(tmp)
    (tmp / 'src' / 'data.js').write_bytes(raw + b'\n// one more line\n')
    run(tmp)
    again = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8')
    check('and a different data.js gives a different name',
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
    #      content byte for byte but for the one seam between the chart and
    #      the program, which the site closes and reopens as two scripts.
    tmp = sandbox()
    r = run(tmp)
    built = (tmp / 'dist' / 'nexus.html').read_text(encoding='utf-8')
    site = (tmp / 'dist' / 'site' / 'index.html').read_text(encoding='utf-8')
    files = site_files(tmp)
    check('the site names a program and a stylesheet, each by the hash of its bytes',
          len(files) == 2 and all(
              hashlib.sha256((tmp / 'dist' / 'site' / n).read_bytes()).hexdigest()[:16] == n.split('.')[1]
              for n in files), str(files))
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
    check('the version log is beside the program, named by its bytes, and is the log as written',
          (tmp / 'dist' / 'site' / log_name).read_text(encoding='utf-8') == log_text
          and log_text.startswith('[') and log_text.endswith(']') and "v:'" in log_text
          and lifted.replace(f'"{log_name}"', log_text) == sources['js'], log_name)
    site_sources = {'js': lifted, 'css': sources['css']}
    minified = all(
        (tmp / 'dist' / 'site' / n).read_text(encoding='utf-8').split('\n//# sourceMappingURL=')[0].rstrip('\n')
        == built_by.minify_for_site(site_sources[n.rsplit('.', 1)[1]], n.rsplit('.', 1)[1])[0].rstrip('\n')
        for n in files)
    check('they are the program and the stylesheet, minified and nothing else', minified)
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
            inlined = inlined.replace(f'\n</script>\n<script src="{n}" data-inline></script>', f'\n{text}</script>')
    cut = lambda p: p[p.index('<!-- @@PAGE:BEGIN@@ -->'):p.index('<!-- @@PAGE:END@@ -->')]
    check('and put back inside it, they make the page dist/nexus.html is', cut(inlined) == cut(built),
          f'{len(cut(inlined))} chars against {len(cut(built))}')
    check('beside the files src/site/ holds, the preview picture among them',
          all((tmp / 'dist' / 'site' / f.name).read_bytes() == f.read_bytes()
              for f in (tmp / 'src' / 'site').iterdir()) and (tmp / 'dist' / 'site' / 'og-image.png').exists())
    og = ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']
    check('the site says what a link to it is, for a chat to show',
          all(f'"{k}"' in site[:site.index('<!-- @@PAGE:BEGIN@@ -->')] for k in og)
          and 'content="https://' in site and '/og-image.png"' in site)
    check('and only the site: neither the single page nor an export cut from it carries it',
          not any(k in built for k in og) and not any(k in cut(site) for k in og))

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
          r.returncode == 0 and counted.count('cloudflareinsights') == 1 and f'"token": "{token}"' in counted
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
    check('the write service is deployed for the repository the config names',
          wrangler.get('REPO') == config.get('repo'), f"{wrangler.get('REPO')} vs {config.get('repo')}")
    check('and lets in the site the config names',
          config.get('site') in [o.strip() for o in wrangler.get('ALLOWED_ORIGINS', '').split(',')],
          f"{wrangler.get('ALLOWED_ORIGINS')} vs {config.get('site')}")

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
    part.write_text(text.replace("site: '", "site: \"").replace(f"{old_site}',", f'{old_site}",'), encoding='utf-8')
    r = run(tmp)
    check('a config the build cannot read stops it and says which file',
          r.returncode != 0 and '00-config.js' in (r.stdout + r.stderr), r.stdout + r.stderr)

    # CLAUDE.md and README say how many scenarios the browser suite has,
    # and both had drifted (89 and 77, against 121) because nothing read
    # them back. The number is counted from the suite's own source rather
    # than asked of it: --list sets up the page before it names anything,
    # and this job has no browser to set it up with.
    suite = (ROOT / 'tests' / 'regression.js').read_text(encoding='utf-8')
    n = len(re.findall(r'^\s*await scenario\(', suite, re.M))
    if not n:
        check('the suite says how many scenarios it has', False, 'no scenario( calls found')
    else:
        for doc in ('CLAUDE.md', 'README.md'):
            said = re.findall(r'(\d+) named scenarios', (ROOT / doc).read_text(encoding='utf-8'))
            check(f'{doc} says the suite has the {n} scenarios it has',
                  said and all(int(x) == n for x in said), f'{doc} says {said or "nothing"}')

    print(f'\n{PASS} passed, {FAIL} failed\n')
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
