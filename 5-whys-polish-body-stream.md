# 5 Whys — Polish shows "Failed to execute 'text' on 'Response': body stream already read"

**Date:** 7 Nov 2026 (requests at 20:18 and 20:29 NZDT, 07:18:36 and 07:29:21 UTC)
**Artifact:** Kanbando production (`https://livedexptechexpert.com`, Railway service `kanban-local1`, deployment `d691b59b`, main after PR #176), `client/src/lib/api.ts`, `server/routes.ts`
**Status:** Root cause found. Code fix on branch `fix/ai-error-status`. The production key still has to be replaced on the Admin page; no code change does that.

## Problem statement

In Edit Task, pressing **Go** in the Polish popover with "Help me make sense of this" showed the red line "Failed to execute 'text' on 'Response': body stream already read" in place of a suggestion. Polish reached production when PR #176 was merged at 20:15 NZDT, and both production calls since then failed.

## 5 Whys

**1. Why did the popover show "body stream already read"?**
That is Chrome's `TypeError` from calling `res.text()` on a `Response` whose body has already been read. The only `.text()` call in the client is the error fallback in `apiRequest` (`client/src/lib/api.ts`, old line 69; found with `grep -rn "\.text()" client/src`). A `TypeError` is not an `ApiError`, so the popover showed its raw message.

**2. Why did `res.text()` find the body already read?**
For a failed response, `apiRequest` first called `res.json()` and fell back to `res.text()` if that threw. A body can be read once, and `json()` uses it up even when parsing fails, so the fallback could never work.
- **Reproduced:** two new tests that use real `Response` objects (plain-text 500, HTML 502) fail against the old `api.ts` (2 of 17 fail) and pass against the fix.
- **Why this was never caught:** the existing test used a hand-made stand-in whose `text()` still worked after `json()` rejected, so the broken fallback looked tested.

**3. Why did `res.json()` fail?**
The body that reached the browser was not JSON, although the server sent JSON.
- **The server sent JSON.** Railway's HTTP log shows both requests answered `502` by the app, in 305 ms and 230 ms, with no upstream error and `txBytes: 320`. The JSON body the route builds from the logged error is exactly 320 bytes.
- **Locally the same response works.** On the local server with an invalid key, the same 502 JSON parsed and `apiPost` threw a proper `ApiError` carrying the message.
- **Cloudflare sits in front.** Production answers with `server: cloudflare` and a `cf-ray` header, and the domain's nameservers are Cloudflare's. Cloudflare's 502/504 documentation says that when the origin responds with a 502 or 504, Cloudflare returns its own branded error page.
- **Provisional:** Cloudflare's page in your browser was not observed directly. This link rests on the documentation, the exact byte match and the local reproduction.

**4. Why did the server answer 502?**
The Polish route (PR #176) answered every provider failure with 502, a pattern copied from the goal planner's route (PR #145). The Admin page's key check ("Could not reach OpenAI to check the key") also answered 502. All three were exposed to Cloudflare's replacement. The goal planner was never tried against a real model in production (CHANGE-CONTROL Carried row #145, "No real model response was checked"), so this had not shown up before.

**5. Why did the AI call fail at all?**
OpenAI answered `401 Incorrect API key provided` for a key ending `XjEA`, both times (production deploy log, `description polish failed: AuthenticationError`).
- **The rejected key is the one saved on the Admin page.** Production's `OPENAI_API_KEY` variable is set but does not end in `XjEA`. Only the last four characters were compared, and only true/false was printed. `getAiConfig` (`server/settings.ts`) gives a key saved on the Admin page priority over the variable.
- **Out of reach:** why OpenAI rejects that key (revoked, mistyped, from another project). Only your OpenAI account shows that.

## Root cause

**`apiRequest` read a failed response's body twice, so any error body that was not JSON became "body stream already read" (latent since the helper was written). It was armed by AI routes that answer provider failures with 502, a status Cloudflare replaces with its own HTML page, and triggered on 7 Nov by OpenAI rejecting the key saved on the Admin page. It was masked by a test whose fake `Response` allowed a second read, and by a fallback that swallowed the real status and body.**

## Fix (countermeasures at each level)

1. **Read the body once (Whys 1–2).** `client/src/lib/api.ts` has a new `readErrorBody`: it takes the body as text once, then uses the JSON `error`, else the plain text, else the status text, else "The server answered <status>".
2. **Never show a proxy's error page (Why 3).** An HTML body is replaced with "The server answered <status>", so Cloudflare's page or any proxy's page reads as one plain line.
3. **Stop answering 502 (Why 4).** A new `server/ai-errors.ts` (`aiFailure`) is used by Polish and the goal planner:
   - a key OpenAI turns down → **400**, "OpenAI turned down the API key. Replace it on the Admin page (AI assistant), which also says where the key in use comes from.";
   - any other failure → **503** with the provider's message.

   The Admin key check's "Could not reach OpenAI" also moves to 503. No route in the app answers 502 any more.
4. **Un-mask the tests (Why 2).** The `api.test.ts` failure tests now use real `Response` objects. Tests were added for plain text, JSON 503, an HTML 502 with no status text (HTTP/2), and an empty body. `server/ai-errors.test.ts` and `server/routes.test.ts` cover 400 for a bad key and 503 otherwise.
5. **The key itself (Why 5): you need to act.** On production's Admin page (AI assistant), replace the saved key with a working one, or remove it so the `OPENAI_API_KEY` variable is used instead. Whether that variable's key works has not been checked.

## Verification

- **Full check:** `npm run check` passes: lint, type check, format check, 101 test files, 1028 tests.
- **Old code fails the new tests:** run against `origin/main`'s `api.ts`, the plain-text and HTML tests fail (2 of 17).
- **Local server with a deliberately invalid key** (`OPENAI_API_KEY=sk-proj-deliberately-invalid-for-repro`, port 5057), in the built-in Chrome:
  - Polish in Create Task with "Help me make sense of this" showed "OpenAI turned down the API key. Replace it on the Admin page (AI assistant), which also says where the key in use comes from." (screenshot: `/private/tmp/claude-502/-Users-Rich-core-personal-projects-c26-n-local-production-kanban-local1/740d372d-ff2b-403c-ad7c-8a7a7978b36d/scratchpad/polish-bad-key-after-fix.jpg`);
  - `apiPost` against a stand-in for Cloudflare's page (HTML 502, no status text) threw `ApiError` with "The server answered 502".
- **Cleanup:** the task was cancelled unsaved, the server stopped, and nothing is left listening on 5057.
- **Not tested:**
  - Cloudflare's actual page in your browser.
  - Whether Cloudflare passes an origin 503's body through. Its docs imply so; if it doesn't, the client now shows "The server answered 503" instead of crashing.
  - A successful OpenAI call: no working key was available.
  - Whether production's `OPENAI_API_KEY` works.

## Left as-is

- Error messages elsewhere in the app still show `ApiError.body` as before. Only the way it is read changed.
- `server/webhooks/gmail-pubsub.ts` answers Google with a plain-text 500. Google is not a browser, and no client reads it.
