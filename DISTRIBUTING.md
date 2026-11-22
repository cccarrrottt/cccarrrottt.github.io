# Your own copy

This is how to run the chart for yourself: your own site, your own chart,
your own sign-in, saving into your own repository. Everything below is set
up with **your** accounts and **your** keys. Nothing of the original's is
shared: not its write service, not its Cloudflare quota, not its Google or
Yandex apps.

What you end up with is what the original has:

| | |
| --- | --- |
| the site | `https://<you>.github.io`, or `https://<you>.github.io/<repo>`, published by GitHub Pages from your repository |
| the write service | a Cloudflare Worker on your account, `https://rhizome-api.<your subdomain>.workers.dev` |
| who edits | the GitHub logins you list in `OWNERS` (and `EDITORS`) |
| where the chart lives | `src/chart.json` in your repository; Save on the site commits to it |
| cloud drives | optional; your own Google and Yandex apps |

The README explains each part; this file is the order to do them in. It
takes an evening, most of it waiting for pages in other people's dashboards.

**Or the short way:** a site that everybody reads and nobody edits on it,
with no Cloudflare and no GitHub App, the chart changed by committing a
file. Steps 1, 2 and 6, about ten minutes; see "Without the service" below.

## 1. The repository

1. **Fork** the repository. Named **`<your login>.github.io`**, it is
   served at `https://<you>.github.io`; named anything else, under a path,
   `https://<you>.github.io/<repo>`. Both work: the page is the site at the
   address `site` names (step 2) or below it. A second chart is a second
   repository under the same account.

   Charts under one account share an origin, and with it a browser's
   storage: a script on one of them could read a session kept by another.
   They are all yours, so this is your own code reading your own session;
   just do not publish anybody else's pages from the same account.
2. **Actions.** A fork starts with them switched off: open the *Actions* tab
   and enable them.
3. **Pages.** *Settings → Pages → Build and deployment → Source*:
   **GitHub Actions**. Not a branch: from a branch, Pages publishes the
   README through Jekyll, succeeds, and the site is not the chart.

## 2. The addresses, said in two files

Your site, your service and your repository are written once in
`src/app/00-config.js`:

```js
const SITE_CONFIG = {
  site: 'https://<you>.github.io',            // or 'https://<you>.github.io/<repo>'
  api: 'https://rhizome-api.<your subdomain>.workers.dev',   // or '' for no service
  repo: '<you>/<repo>',
};
```

`site` has no slash at the end. With a service, the service keeps its own
copy in `worker/wrangler.toml`, because Cloudflare deploys it from that
file. `ALLOWED_ORIGINS` is the site's address **without** its path, which is
all a browser tells the service:

```toml
REPO = "<you>/<repo>"
OWNERS = "<your GitHub login>"
EDITORS = ""
ALLOWED_ORIGINS = "https://<you>.github.io"
```

`tests/build_guard.py` fails if the two disagree, so a mistake here shows
up as a red check rather than as a sign-in that does not work. Your
Cloudflare subdomain comes from step 3; until you know it, leave `api` as it
is and come back.

**The About panel** carries the original author's contacts (`about-contact`
links in `src/index.html`). Put yours there, or take them out, then run
`node tools/i18n.js` so the translation files follow. What the chart is
called and what it is about are not in that file: they are the chart's (step
6).

**The preview picture** a link to your site shows is `src/site/og-image.png`,
the original's card, with its wordmark and tagline. Put any 1200×630 PNG of
your own in its place (`tools/og-image.js` is how the original drew its
card, and can be edited to draw yours).

## 3. Cloudflare: the write service

1. Make a free Cloudflare account and open *Workers & Pages* once. That
   gives the account its `*.workers.dev` subdomain; your service will be
   `https://rhizome-api.<subdomain>.workers.dev`. Put that in `api` (step 2).
2. Let CI deploy it: a Cloudflare API token made from the *Edit Cloudflare
   Workers* template, and your account id, as the repository's Actions
   secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (*Settings →
   Secrets and variables → Actions*). Once `repo` in `00-config.js` names
   your repository, the deploy job **fails** without them rather than
   skipping, so a site never talks to a service that was not deployed.

   (The README's "Setting up the write service" describes the other way,
   importing the repository into Cloudflare. Use one, not both.)

Your free plan allows 100,000 requests a day. They are yours: readers of
your site never touch anyone else's service.

## 4. GitHub: who may sign in

1. *GitHub → Settings → Developer settings → GitHub Apps → New*.
   - Homepage: your site.
   - Callback URL: `https://rhizome-api.<subdomain>.workers.dev/callback`.
   - Keep *Expire user authorization tokens* on. Webhook off.
   - Repository permissions: **Contents — Read and write** and
     **Issues — Read and write**, nothing else.
   - Installable only on your account.
2. Generate a client secret, then **Install** the app on your repository
   only.
3. In Cloudflare, *your Worker → Settings → Variables and Secrets*, add
   three **Secrets** (not plain text, which a deploy wipes):
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, from the app;
   - `SESSION_SECRET`: any random 32 characters or more
     (`openssl rand -hex 32`).

Never write any of these into `worker/wrangler.toml`: that file is public,
and `tests/worker.js` refuses it if one appears there.

## 5. Push, and sign in

Commit steps 2–4 and push to `main`. CI builds, runs the checks, deploys the
service and publishes the site. Open your site, press **Sign in**, and the
page becomes the editor for the login in `OWNERS`.

## 6. Your own chart

The fork carries the original's chart. Start yours **from the site**, once
you are signed in: take out what you do not want (select, Delete), add your
own, and press **Save**. That commit changes only `src/chart.json`, so it is
published at once without waiting for the checks.

You may also replace `src/chart.json` in a commit of code: the browser
suite draws a chart of its own, `tests/fixtures/chart.json` with its
pictures in `tests/fixtures/media/`, and never reads yours. That is why
a code push comes out green whatever your chart holds, and why bringing
in the original's code later does not depend on it either.

Then give it its own name: *About → The chart's name and description*.
The name is the tab's title and what a link to your site shows, with the
sentence under it; the text below is the top of About. They are saved with
the chart (`settings.title`, `settings.description`, `settings.about` in
`src/chart.json`), and a link's preview follows them at the next publish.

The original's chart brings a font of its own (`settings.fonts`, Autobot
Characters). Remove it under *My files → Fonts* once nothing is set in it,
unless you have checked that you may use it.

## 7. Optional: cloud drives

Google Drive and Yandex Disk in *My files* need apps of **your own**, on
your service. Follow the README's "The owner's cloud drives" with your
service's address in each redirect URI:

- Google: `https://rhizome-api.<subdomain>.workers.dev/cloud/gdrive/back`;
  Secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_API_KEY`.
- Yandex: `https://rhizome-api.<subdomain>.workers.dev/cloud/yadisk/back`;
  Secrets `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`.

A drive whose Secrets are missing is simply not offered. Pictures picked
from a drive are shown to your readers by your service, from your quota.

## 8. Optional: counting visitors

A Cloudflare Web Analytics token as the repository **variable**
`CF_WEB_ANALYTICS_TOKEN` (README, "What the site counts"). Without it your
site counts nothing.

## Without the service

A site everybody reads, with no Cloudflare account, no GitHub App and no
secrets. Nobody signs in on it, the owner included, and there are no
suggestions; the chart changes by a commit of `src/chart.json`.

1. Step 1 as above.
2. In `src/app/00-config.js`, `site` and `repo` as above and **`api: ''`**.
   `worker/wrangler.toml` can be left as it is: with no service named,
   nothing checks it and CI deploys nothing.
3. Push. The site is published as a reader for everybody.

To change the chart, open your copy anywhere but the site and edit it
there: *Export/Import → the page* on the site saves a copy of it that
opens from a disk and edits into that browser. When it is as you want it,
*Export the contents* gives a `chart.json`; put it in place of
`src/chart.json` (on GitHub, *Add file → Upload files* into `src/`). A
commit that changes only the chart is published without waiting for the
checks. To add the service later, follow steps 3–5 and fill in `api`.

## The chart as data

Every copy publishes its chart beside the page, at `<site>/chart.json`:
the file Save commits, described by `<site>/chart.schema.json`. GitHub
Pages answers it to any origin, so another page or a script can read your
chart without scraping it; the site's `<head>` names it as the page's data
(`<link rel="alternate" type="application/json">`).

## The licence

The platform is MIT (`LICENSE`): keep that file, with its copyright line,
in your copy. `NOTICE` says what the licence does not cover, the original's
chart and everything it names or carries; rewrite it for your own chart.

## Checklist

- [ ] fork (any name), Actions on, Pages from GitHub Actions
- [ ] `src/app/00-config.js`: `site` (with the path, if any), `api` (or `''`), `repo`
- [ ] with a service: `worker/wrangler.toml` `REPO`, `OWNERS`, `EDITORS`, `ALLOWED_ORIGINS` (origin only)
- [ ] About contacts changed, `node tools/i18n.js` run
- [ ] Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- [ ] GitHub App, installed on your repository
- [ ] Worker Secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`
- [ ] pushed, signed in, chart made your own with Save, named in About
- [ ] your own `src/site/og-image.png`
- [ ] (optional) drives' Secrets, analytics variable
