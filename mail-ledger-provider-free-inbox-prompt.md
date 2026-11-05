# Mail Ledger: remove every Google and Gmail dependency; mail arrives at the app's own inbox

From Richard, 30 Oct 2026. Project: `/Users/Rich/core/personal-projects/personalemailmanager`.

## 0. What went wrong

**My requirement is that Mail Ledger has no Google or Gmail dependency.** What was built makes a Gmail mailbox the inbound address and depends on all of the following:

- the Gmail API, Google Cloud Pub/Sub and an OAuth refresh token
- `googleapis` and `google-auth-library`
- a `gmail-watch` cron service on Railway

That is wrong and has to come out.

Here is how it got in. The brief never stated my rule in words, and P3 sent you to `~/kanban-local1` to copy Kanbando's inbound mechanism. **That checkout is stale.** Its last commit is `91eb650` of 16 Oct 2026, so it contains only Kanbando's Gmail/Pub/Sub pipeline. On 20 Oct 2026 (commit `6926bea`) Kanbando added a provider-free inbox alongside that pipeline. Only the inbox is a reference for you. It is in the current checkout:

`/Users/Rich/core/personal-projects/c26-n/local-production/kanban-local1`

**Never read `~/kanban-local1` again.**

## 1. First, put my rule into the instructions (task P5.1)

Commit the two uncommitted rows in `docs/EPIC-01-build-log.md` as they are, on their own, before anything else.

**This is my authorised change to the brief (Limit 8).** Apply it exactly, in `docs/epics/EPIC-01-brief.md`:

- Append to **P3**: "*Superseded 30 Oct 2026 by P5.*" Keep its text; no id is changed or reused.
- Under "How the references are used", add:
  - **P5** (30 Oct 2026, replaces P3) No Google or Gmail dependency in how the app receives or reads mail: no Gmail mailbox as the inbound address, no Gmail API, no Google Cloud, no Pub/Sub, no Google OAuth, no Google packages. Mail reaches the app the way it reaches Kanbando's provider-free inbox (`INBOX_SETUP.md` and `server/inbox/` in `/Users/Rich/core/personal-projects/c26-n/local-production/kanban-local1`, commit `6926bea`). Whatever receives mail for the inbound address posts the raw message to the app over HTTPS with a token, and the app parses it itself with `mailparser`. Kanbando's Gmail pipeline is not a reference. Gmail remains only as a mailbox I forward *from* (T1's Gmail forward format, R27's links).
- Append to **C2**: "*Amended 30 Oct 2026 by P5: 'whatever Kanbando's inbound mechanism requires' means `INBOX_TOKEN`; no `GOOGLE_*` or `GMAIL_*` setting.*"

**In `CLAUDE.md`, replace this sentence:**

> From Kanbando (`/Users/Rich/kanban-local1`) copy only the inbound-email plumbing; where it handles attachments, the brief's attachment section wins.

**with this one:**

> From Kanbando (`/Users/Rich/core/personal-projects/c26-n/local-production/kanban-local1`) copy only the provider-free inbox plumbing (P5), never its Gmail pipeline, and never read `/Users/Rich/kanban-local1`; where it handles attachments, the brief's attachment section wins.

**In `docs/architecture/EPIC-01-architecture-decision.md`:**

- Rewrite every part that rests on Gmail:
  - the summary
  - "What follows from Kanbando's mechanism"
  - rows 2 (inbound) and 3 (extraction "from Gmail's payload") of the decisions table near the top
  - §2
  - §3's "Gmail's message JSON"
  - the inbound tables in the data model
  - the settings
  - the risks
- In the questions table at the end, mark rows 2 (watch renewal) and 3 (Gmail's sender authentication) "superseded by P5, 30 Oct 2026".

**In the build log, never delete a row.**

- Add a "(P5 added)" row, the way R27 was added.
- In "Essential, unanticipated work", append "superseded by P5, 30 Oct 2026" to the watch-renewal row and the Gmail DMARC/DKIM row.
- Append "void, P5" to the nice-to-haves that only concern the Gmail pipeline: watch expiry, the 72-hour window, the Pub/Sub token issuer, and googleapis' warnings.
- In the custom-domain row, void only the `GMAIL_PUBSUB_AUDIENCE` and push-subscription part. Its `API_BASE_URL` point still stands.

**Settings templates:** `.env.example` and `agent/.env.example` hold setting names only. I authorise you to read and edit both. Never open `.env` or any file holding values (C1).

## 2. What this instruction authorises

**"P5 rework" is one deliverable,** made of four tasks. Each task gets its own three attempts (Limit 1), its own build-log rows, `npm run check` passing at its end, and its own local commit on `main` citing P5. Do them in order:

1. **P5.1:** the instructions (section 1).
2. **P5.2:** the inbox replaces the Gmail path in ingestion (sections 3, 6.1 to 6.6, and 7).
   - Work inside the task in this order: parsing and the `.eml` fixtures and test helpers, then storage and the endpoint, then the worker and the sender check, then `0004`.
   - Run the affected tests as you go. An attempt is a full `npm run check` run.
3. **P5.3:** whatever in section 4 is left after P5.2: packages, settings, Railway, CI and the remaining Gmail files.
4. **P5.4:** the README and docs, then the final checks (sections 6.7 and 8).

This rework covers deliverables the build log shows as done (D1 to D6), and I authorise it. All your other Limits still apply.

**Not authorised:**

- push or deploy
- any change on Railway
- anything in Google Cloud or in a Gmail account
- deleting any data outside throwaway local test databases

## 3. Decisions already made: don't ask me, apply them

Record each in the build log as my answer of 30 Oct 2026. Ask me only if the code contradicts this prompt.

1. **The receiver.** The app doesn't depend on which service receives the mail, so build without knowing it.
   - Document Cloudflare Email Routing with an Email Worker as the way in. I will set up the receiver and the address myself.
   - Give inbound-parse services (Postmark, Mailgun, SendGrid, SES) one paragraph. They post JSON or a form, not a bare `message/rfc822` body, so each one needs a small adapter that takes out the raw MIME and posts it.
2. **The sender check,** replacing "Gmail vouches for the sender".
   - **The rule:** verify in the app from the raw message with `mailauth` (by the author of `mailparser`): a DKIM pass aligned with the From domain, or a DMARC pass, evaluated on DKIM only. SPF is not checked, because the app doesn't have the connecting IP.
   - **What to trust:** no `Authentication-Results` header that arrives with the mail.
   - **The resolver** is injected through `mailauth`'s `resolver` option. Production uses DNS. Tests use a fake resolver and fixtures signed with a test key (`mailauth`'s `dkimSign`).
   - **Outcomes:** a DNS temporary error is retried like any other processing error, never treated as a failed check. A failed check is `not_allowed` and discarded (R3).
   - **No bypass:** no setting switches the check off.
   - **The allowed-list check is unchanged.**
   - If `mailauth` turns out unsuitable, stop and tell me why; don't substitute something else.
3. **Migrations.** Leave `0001` to `0003` as they are, because I may already have run them on Railway. Add `migrations/0004_inbox.sql`, which runs on Railway only when I deploy:
   - **`inbound_email_processing`:**
     - Rename `gmail_message_id` to `message_key`.
     - Drop `history_id_seen`.
     - Add `raw_file`, `raw_size`, `raw_sha256` and `received_at`, all nullable, because Gmail-era rows have none. `rfc_message_id` already exists.
   - **`emails`:** rename `gmail_message_id` to `message_key`. Old values stay as keys.
   - **Constraints:** rename both generated unique constraints to match the new column name.
   - **`gmail_watch_cursor`:** drop it. It holds Gmail's cursor only, no ledger data.
   - **Old rows:** Gmail-era queue rows still `pending` or `processing` become `failed`, with the reason "Gmail pipeline removed (P5)". Nothing is deleted.
   - **The outcome CHECK stays as it is.** `not_addressed` remains valid for old rows; the app never writes it again.

## 4. What goes: Google as infrastructure

**Code:**

- `src/server/gmail/`: delete `gmail-client.ts`, `history-sync.ts` and its test, `pubsub-verify.ts` and `watch-cli.ts`.
- `src/server/gmail/` keeps nothing:
  - The lease, attempt and poll constants in `constants.ts` move to the inbound module.
  - `inbound-trace.ts` moves there too, renamed for the inbox. It is used by `src/server/ingest/worker.ts`, `src/server/ingest/process.ts` and `tests/helpers/test-server.ts`.
- `src/server/webhooks/gmail-pubsub.ts` and its test.
- `src/server/inbound/repository.ts`: the watch-cursor functions, and its use of `gmail_message_id` and `history_id_seen`. Its claim query already orders by `id`: keep that and test it.
- `src/server/ingest/gating.ts`: trusting `mx.google.com`'s `Authentication-Results`. It is replaced by section 3.2.
- `src/server/ingest/process.ts`: fetching the message and its attachments from Gmail, the recipient filter (`triggerRecipient`, Kanbando's `GMAIL_TRIGGER_RECIPIENT`), and `forwarded_at` taken from Gmail's `internalDate`.
- `src/server/ingest/message.ts` and `forwarded.ts`: the `GmailMessage` and `GmailPart` types. They now read the parsed MIME message.

**Tests and scripts:**

- `tests/fakes/fake-gmail.ts`, `tests/fixtures/forwards/gmail-message.ts`, `GMAIL_PASS` in `tests/fixtures/forwards/synthetic.ts`, and the Gmail-capture text in `tests/fixtures/forwards/real/README.md`.
- Every suite that uses the fake or the builder moves to raw `.eml`:
  - `tests/helpers/test-server.ts`
  - `agent/agent.test.ts`
  - `src/server/agent/agent.test.ts`
  - `src/server/api/api.test.ts`
  - `tests/screens/screens.test.ts`
  - the real-fixture loader in `src/server/ingest/forwarded.test.ts`
- `scripts/capture-fixture.ts` and its npm script: remove them.
  - I will save real forwards myself as `.eml`, from the forwarding account's Sent folder ("Show original" or "Download message").
  - Real fixtures are redacted, which breaks DKIM, so they are tested through `extractForwarded` only, not through the sender check.

**Packages and settings:**

- `package.json` and the lockfile: `googleapis`, `google-auth-library` and the `gmail:watch` script.
- `src/server/settings.ts`: every `GOOGLE_*` and `GMAIL_*` setting, `GmailCredentials`, `loadWatchSettings` and `loadGmailCredentials`.
- `src/server/application.ts` and `src/server/app.ts`: the Gmail client, the webhook and the Pub/Sub verifier wiring.
- `.env.example`: both Gmail blocks. Add `INBOX_TOKEN` and the `INBOUND_*` names.

**Deployment:**

- `.railway/railway.ts`:
  - Remove the `gmail-watch` service and every `GOOGLE_*` and `GMAIL_*` variable.
  - Add `INBOX_TOKEN`, `INBOUND_POLL_MS`, `INBOUND_WORKER_DISABLED` and `INBOUND_TRACE` with `preserve()`. A variable left out of this file is removed on the next apply.
- `.github/workflows/ci.yml`:
  - Remove the Google and Gmail stand-ins.
  - Add an `INBOX_TOKEN` stand-in of at least 32 characters to the start step, or the built app refuses to start.

**Database:** handled by `0004`, as in section 3.3.

**Text and docs:**

- UI text that says Gmail receives or vouches for mail: the "Gmail confirms the sender" line in `src/client/screens/Accounts.tsx`, and the "still in the inbound Gmail" line in `src/client/screens/Email.tsx`.
- `README.md`: Parts 4 (the inbound Gmail account) and 5 (Google Cloud), every Gmail or Google Cloud step and setting elsewhere, and the Gmail items under "Not yet verified".

## 5. What stays: Gmail as a mailbox I forward *from*

None of this is a dependency. It is plain text and URLs, with no Google code, package, account or credential:

- The forward format `gmail` (Gmail's "---------- Forwarded message ---------" block) and T1's Gmail-format fixtures.
- R27's links to `mail.google.com` and `allowed_accounts.mailbox = 'google'`.
- The `gmail.com` guess in `src/shared/mailbox.ts`, and labels such as "Gmail / Google Workspace" and "Gmail forward".
- Comments in `dates.ts` and `addresses.ts` describing how Gmail formats a forward.

## 6. What to build

1. **`POST /api/inbox`**, mounted where the webhook was, outside the same-origin guard.
   - **Order of checks:**
     1. The token, before any of the body is read. A missing or wrong token gets 401.
     2. The type. No `Content-Type` gets 400, as in Kanbando: nothing was sent. Anything but `message/rfc822` gets 415.
     3. The size. A body over 25 MiB (Cloudflare Email Routing's ceiling) gets 413.
     4. An empty body gets 400.
   - **The token:** `INBOX_TOKEN`, a new required setting of at least 32 characters, compared in constant time with `secretMatches`, as `AGENT_TOKEN` is in `src/server/agent/router.ts`. This differs on purpose from Kanbando, whose inbox tokens are issued and revoked from `/console`: Mail Ledger has one forwarder and already keeps its agent token in settings.
   - **No sender check here.** Gating happens in processing, so mail from someone not on the list is still accepted, then logged and discarded (R3).
2. **Raw storage.** The raw message goes in `ATTACHMENT_STAGING_DIR/inbound/`, never into the database. R19 forbids file content in the database, and a raw forward carries its attachments.
   - **Write first, insert second.** Write the whole file under a fresh UUID name first. Then insert the row, with `raw_file` naming the file, using "on conflict on `message_key` do nothing". A duplicate or a failed insert deletes the file it has just written. The worker therefore never sees a row whose file is incomplete.
   - **Message key:** `mid:<Message-ID>`, else `sha256:<hex of the raw bytes>`.
   - **The answer:** `202 {"id", "duplicate"}` at once. A redelivery answers with the existing row's id and `duplicate: true`, and changes nothing.
   - **Deleting raw files:** a raw file is deleted whenever its row becomes `completed` or `failed`, by any path. That includes `reconcileExpiredLeases` in `src/server/inbound/repository.ts`, which today fails rows in SQL alone.
   - **The start-up sweep:** `sweepOrphans` in `src/server/ingest/staging.ts` deletes every entry in the staging directory that isn't a staged attachment. Make it skip `inbound/`. Add a sweep of `inbound/` that deletes raw files whose row is completed, failed or missing.
3. **The worker** (the existing loop in `src/server/ingest/worker.ts`): it reads the row's raw file and parses it. Rename its settings to `INBOUND_POLL_MS`, `INBOUND_WORKER_DISABLED` and `INBOUND_TRACE`.
4. **Parsing:** `mailparser`'s `simpleParser`, at version `^3.10.0`, as in Kanbando.
   - **Headers** (the R13 envelope, R12's custom header fields, and the From used for gating) come from `headerLines`, in order. Split each at its first colon, unfold it, and decode encoded words with `libmime`. `libmime` is already installed as `mailparser`'s dependency: declare it in `package.json`.
   - **Body:**
     - Use the text/plain part when the message has one.
     - For HTML-only mail, run the app's own `src/server/ingest/html-text.ts` over `mail.html`. Never use the text `mailparser` makes from HTML: it wraps at 80 columns and turns `<hr>` into dashes, which breaks the Outlook marker (a line of underscores) in `forwarded.ts`.
     - Check which of the two `mailparser` gave you.
   - **No quote stripping.** Don't strip quoted replies. Kanbando's `stripQuotedReply` would cut the forwarded block and break R9's thread count.
   - **Attachments:** read `filename`, `size`, `contentType`, `contentId` and `contentDisposition`. D2's embedded-image rule needs both of the last two: under 100 KB is recorded only, 100 KB or more is staged.
   - **Forwarded as attachment:**
     - An attachment of type `message/rfc822` is parsed again for the original's headers.
     - `mailparser` merges a `message/rfc822` part with `inline` disposition into the text instead of listing it as an attachment. Such a forward must still be recognised as format `attached`, have its original's headers read, and have its `.eml` recorded (R10).
   - **`extractForwarded`** stays a pure function, now over the parsed message.
5. **Two changed columns:**
   - `forwarded_at` becomes `received_at`.
   - `emails.gmail_message_id` becomes `message_key`.
6. **The sender check** is built as in section 3.2.
7. **Getting mail to the endpoint** is documentation only: a README part that replaces Parts 4 and 5.
   - For Cloudflare, include Kanbando's worker from its `INBOX_SETUP.md` §4, with `INBOX_URL`, `INBOX_TOKEN` and an optional `FALLBACK_EMAIL`.
   - Add the one paragraph on parse services and their adapters (section 3.1).

**From Kanbando's inbox, read:**

- `server/inbox/route.ts`
- `server/inbox/message.ts`
- `INBOX_SETUP.md`

**Do not take:**

- its JSON or plain-text body types
- its model extraction or subject directives
- its `INBOX_ALLOWED_SENDERS`
- its dropping of attachments: the brief's attachment section wins (P4)
- `stripQuotedReply`
- its issued `/console` tokens
- anything in `server/gmail/`, its webhook, or its Gmail-named settings

## 7. Tests

T1 to T4 stay required. Tests change here only because P5 changes the requirement, which I approve. **No test is weakened or dropped.**

- **Fixtures:** all ten cases in `tests/fixtures/forwards/synthetic.ts` become raw `.eml`, with the same cases and the same expectations. Add a forward sent as an attachment with `inline` disposition. Fixtures that pass through the sender check are signed with the test key.
- **The route:**
  - 401 before the body is read
  - 400 with no type, 415, 413, and 400 for an empty body
  - 202, and the duplicate
- **The sender check:**
  - an aligned DKIM pass, and a DMARC pass
  - a failure, which becomes `not_allowed`
  - a temporary error, which is retried
  - a forged `Authentication-Results`, which is ignored
- **Storage and the worker:**
  - the oldest row goes first
  - retry, and failure at 5 attempts
  - lease reclaim, deleting the raw file when it fails a row
  - the raw file deleted on completion and on failure
  - no orphan file after a duplicate or a failed insert
  - the sweep keeping the raw files of live rows
- **Migration `0004`** on a database holding Gmail-era rows: pending, completed and `not_addressed`.
- **End to end**, in the test server with the injected resolver:
  1. Post a signed `.eml` to `/api/inbox`.
  2. Check the email is recorded and its attachment staged.
  3. Check the Mac agent collects and confirms it (T4).
  4. Re-post the same message and get `duplicate: true`.

  A live forward through the real receiver is mine to do after setup; list it as unverified.

`npm run check` must pass with no `GOOGLE_*` or `GMAIL_*` variable set anywhere, CI included. Stop anything you start and check with `ps`.

## 8. Done when

- `src/server/gmail/` and `src/server/webhooks/gmail-pubsub*` no longer exist, and `npm ls googleapis google-auth-library` finds nothing.
- This search:
  ```bash
  grep -rniE 'googleapis|google-auth|pubsub|pub/sub|users\.watch|history_?id|refresh_?token|GOOGLE_|GMAIL_|mx\.google' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.history /Users/Rich/core/personal-projects/personalemailmanager
  ```
  finds matches only in:
  - build-log history
  - the brief's P3, P5 and C2 note
  - the architecture document's superseded notes
  - migrations `0001` and `0004`, and the `0004` test
- Every other `gmail` or `google` match is on the forward-from list in section 5.
- The README has no Gmail-account or Google Cloud step, and `.railway/railway.ts` has no `gmail-watch` service.
- `npm run check` passes, including the end-to-end test.

## 9. Report to me

- **What changed:** what you removed, changed and built, every file with its full absolute path.
- **Evidence:** the `npm run check` summary and the end-to-end test's actual responses.
- **Unverified:** anything you couldn't check, marked as unverified.
- **For me to do by hand:**
  - Set `INBOX_TOKEN` on Railway.
  - Remove any `GOOGLE_*` or `GMAIL_*` variables and any `gmail-watch` service already created on Railway.
  - Delete the Google Cloud project, OAuth client and Pub/Sub topic, and the inbound Gmail account, if I made them while following README Parts 4 and 5.
  - Set up the receiver.
  - Pull or delete `/Users/Rich/kanban-local1`.
