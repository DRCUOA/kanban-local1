# 5 Whys — Kanbando logo still teal after the icon recolour (#169)

**Date:** 23 October 2026
**Artifact:** Kanbando, `/Users/Rich/core/personal-projects/c26-n/local-production/kanban-local1` (repo `DRCUOA/kanban-local1`), `main` at `5b1fd42` (merge of #169)
**Status:** Root cause confirmed; fixed on branch `fix/header-logo-orangered` (uncommitted at time of writing). Not yet seen on the live app, which runs on Railway (see Verification).

## Problem statement

Rich asked for "the ico for the app itself, its FAVICON" to be recoloured so "the main logo is 255 69 0" on a transparent background. PR #169 recoloured the favicon and home-screen icons and was merged and deployed at 03:21–03:22 UTC on 23 Oct. Afterwards Rich reported "the favicon hasn't changed color" and sent a screenshot of the app: the Kanbando mark at the top left of the header is still teal.

## 5 Whys

**1. Why is the logo in Rich's screenshot still teal?**
It isn't the favicon file. It's the header logo, an inline SVG drawn by `client/src/components/AppLogo.tsx` with `fill="currentColor"`. All three places that draw it give it `text-primary`, the app's accent (`--accent-1`: `#005f73` light, `#51b9cc` dark):
- `AccessGate.tsx:92`
- `Landing/LandingChrome.tsx:17`
- `Dashboard/DashboardHeader.tsx:93`

The screenshot shows no browser tab strip, so the header mark is the only logo on screen.

**2. Why didn't #169 change it?**
#169 changed only the image files the browser loads as icons, and their sources:
- `client/public/favicon.svg`, `favicon.png`, `favicon-16.png`
- `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, and `manifest.webmanifest`
- `script/icons/mark-32.svg`, `mark-16.svg`, `mark-app-icon.svg`

`AppLogo` is a separate copy of the same mark in React code. Its column path, `M256 62 L332 100 L332 320 L256 358 L180 320 L180 100 Z`, is identical to the one in `favicon.svg`, but nothing links the two. (Evidence: #169's file list; a grep of the path in both files.)

**3. Why did #169 miss that copy?**
When doing #169, Claude took the request to mean the favicon and home-screen icon files only. It never searched the code for other copies of the mark, although the request said "the main logo". (Evidence: #169's description scopes it to the icon files; the header logo isn't mentioned.)

**4. Why can the copies drift apart at all?**
The mark's colour was set independently in four places, with nothing tying them together:
- `AppLogo` took the theme accent.
- `favicon.svg` had its own hex values.
- `mark-32.svg` and `mark-16.svg` had their own.
- `mark-app-icon.svg` had its own.

They had already drifted before #169: the favicon was blue (`#1f5fde`, or `#7197f7` in dark mode) while the header was teal. No test or build step compared them, so a partial recolour looked finished.

**5. Why did the favicon recolour itself not show? (provisional)**
- The screenshot has no tab strip, so the favicon isn't visible in it at all. Whether Rich was viewing the installed app or a cropped window is unverified.
- Browsers cache favicons aggressively.
- The live app runs on Railway, whose address isn't recorded in the repo, so the deployed favicon could not be fetched; whether production serves the new one is unconfirmed. GitHub records the Railway deployment of `5b1fd42` ("Kanbando / production") as successful.

## Root cause

**The Kanbando mark existed as four independent copies with independently set colours: the header's `AppLogo` inherited the theme accent through `text-primary`, while the icon files hard-coded their own hex. #169 recoloured only the icon-file copies (armed by reading the request as "favicon files" without searching for the mark elsewhere), and nothing linked the copies, so the change looked complete while the most visible logo stayed teal.**

## Fix (countermeasures at each level)

1. **(Why 1)** `AppLogo` paints its own colour: a new exported constant `MARK_COLOR = '#ff4500'`, instead of inheriting `currentColor`.
2. **(Why 1–2)** `text-primary` is removed from the three places that draw `AppLogo`, so nothing suggests the accent applies to the mark. This covers the landing page, the board header and the access-code screen.
3. **(Why 4)** A new test, `client/src/components/AppLogo.test.ts`, holds `MARK_COLOR`, `favicon.svg`, `mark-32.svg`, `mark-16.svg` and `mark-app-icon.svg` to one colour. A recolour that misses a copy now fails `npm run check`.
4. **(Why 3)** The lesson for future requests: "the logo" means every place the mark is drawn. Fix 3 now enforces that mechanically for the colour.
5. A `CHANGELOG.md` entry records the change.

## Verification

- `npm run check` on `fix/header-logo-orangered`: lint, type-check and format check pass, and all 920 tests pass, including the new guard.
- **Guard proven:** with `favicon.svg`'s fill temporarily set back to `#1f5fde`, `AppLogo.test.ts` fails (`expected … to contain 'fill: #ff4500'`). The file was then restored.
- **Rendered:** the dev server against a throwaway demo database (`kanban_wizard_demo`, port 5056, stopped afterwards). On both `/` and `/board`, the header mark's `fill` attribute is `#ff4500` and its computed fill is `rgb(255, 69, 0)`.
- **Not tested: production.** Production is Railway. Its deployment record links only to the Railway dashboard, not the app's address, and the Railway CLI here isn't linked to the project, so neither the deployed favicon nor this fix has been seen live. (GitHub also lists a `kanbando-prod-on-heroku` environment. Its app answers 503 "Application Error", but the app doesn't run on Heroku, so that's expected and says nothing about production. An earlier draft of this report wrongly called it a production fault.)
- **Not tested:** how Rich views the app (installed app, or a browser tab), and whether a cached favicon is involved.

## Left as-is

- **Heroku deployment environment.** GitHub still records deployments to `kanbando-prod-on-heroku`, an app that isn't live (503). Production is Railway. If the Heroku integration is no longer wanted, disconnecting it would stop those deployment records.
- **`mark-full.svg`.** `script/icons/mark-full.svg` is still blue. Nothing builds from it or displays it, so the guard doesn't cover it.
- **Stale `theme-color` tags.** The `theme-color` meta tags in `client/index.html` (`#c4c9d4` / `#10141d`) predate the Clinical restyle. They tint browser chrome, not the logo, so they're out of scope here.
