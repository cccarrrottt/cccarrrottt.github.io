# Your own copy

This is how to run the chart for yourself: your own site, your own chart,
your own sign-in, saving into your own repository. Everything below is set
up with **your** accounts and **your** keys. Nothing of the original's is
shared: not its write service, not its Cloudflare quota, not its Google or
Yandex apps.

What you end up with is what the original has:

| | |
| --- | --- |
| the site | `https://<you>.github.io`, published by GitHub Pages from your repository |
| the write service | a Cloudflare Worker on your account, `https://rhizome-api.<your subdomain>.workers.dev` |
| who edits | the GitHub logins you list in `OWNERS` (and `EDITORS`) |
| where the chart lives | `src/chart.json` in your repository; Save on the site commits to it |
| cloud drives | optional; your own Google and Yandex apps |

The README explains each part; this file is the order to do them in. It
takes an evening, most of it waiting for pages in other people's dashboards.

## 1. The repository

1. **Fork** the repository and name the fork **`<your login>.github.io`**.
   Only a repository named exactly that is served at the root of
   `https://<you>.github.io`. Any other name is served under a path
   (`https://<you>.github.io/<repo>/`), which the page does not support: it
   tells the site from every other copy by its origin alone, and names its
   schema at the origin's root.
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
  site: 'https://<you>.github.io',
  api: 'https://rhizome-api.<your subdomain>.workers.dev',
  repo: '<you>/<you>.github.io',
};
```

and the service keeps its own copy in `worker/wrangler.toml`, because
Cloudflare deploys it from that file:

```toml
REPO = "<you>/<you>.github.io"
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
`node tools/i18n.js` so the translation files follow.

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

## Checklist

- [ ] fork named `<you>.github.io`, Actions on, Pages from GitHub Actions
- [ ] `src/app/00-config.js`: `site`, `api`, `repo`
- [ ] `worker/wrangler.toml`: `REPO`, `OWNERS`, `EDITORS`, `ALLOWED_ORIGINS`
- [ ] About contacts changed, `node tools/i18n.js` run
- [ ] Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- [ ] GitHub App, installed on your repository
- [ ] Worker Secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`
- [ ] pushed, signed in, chart made your own with Save
- [ ] (optional) drives' Secrets, analytics variable
