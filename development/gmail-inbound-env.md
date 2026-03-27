# Gmail inbound email → Kanban (v1)

Operational environment variables (see `server/gmail/` and `server/webhooks/gmail-pubsub.ts`).

## Required for Gmail API + worker

- `GOOGLE_CLIENT_ID` — OAuth client ID
- `GOOGLE_CLIENT_SECRET` — OAuth client secret
- `GOOGLE_REFRESH_TOKEN` — refresh token for the **single** monitored mailbox (re-run OAuth if scopes change or refresh is revoked)
- `GMAIL_MAILBOX` — email address of the monitored account (must match Pub/Sub notification `emailAddress` if omitted there)
- `GMAIL_LABEL_ID` — Gmail label id for `kanbando-trigger` (used by `users.history.list` and recovery `messages.list`)

## Pub/Sub push webhook

- `GMAIL_PUBSUB_AUDIENCE` — exact HTTPS URL of the push endpoint (OIDC `aud` claim), e.g. `https://your-host/api/webhooks/gmail-pubsub`

## Optional

- `GMAIL_TRIGGER_RECIPIENT` — if set, worker skips task creation unless `To` contains this substring
- `GMAIL_INBOUND_WORKER_DISABLED` — set to `true` to disable the in-process poller
- `GMAIL_INBOUND_POLL_MS` — poll interval (default `15000`)
- `GMAIL_PUBSUB_SKIP_VERIFY` — set to `true` to skip OIDC verification (development only)

## LLM (task extraction)

- `OPENAI_API_KEY` — required for LangGraph structured extraction (`gpt-4o-mini`)

## GCP (outside the app)

Configure Pub/Sub topic, push subscription with OIDC to `GMAIL_PUBSUB_AUDIENCE`, and grant Gmail `gmail-api-push@system.gserviceaccount.com` publish on the topic. Run `users.watch` on the label with renewal before expiry (~7 days).
