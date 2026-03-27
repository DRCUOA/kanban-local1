# Gmail + Pub/Sub setup (outside the repo)

Step-by-step checklist for: GCP Pub/Sub + OIDC (`GMAIL_PUBSUB_AUDIENCE`), Gmail label `kanbando-trigger` + filter, `users.watch` + renewal, OAuth refresh token with Gmail scopes, and `GMAIL_LABEL_ID`.

---

## 0. Prerequisites

- A **Google Cloud project** (billing enabled if your org requires it for Pub/Sub).
- The **kanban app** reachable at a stable **HTTPS** URL (production Pub/Sub will not call plain `localhost`; use a tunnel only for testing).
- **Admin access** to the **Gmail account** that receives trigger mail.

---

## 1. Google Cloud: enable APIs

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select your project.
2. Go to **APIs & Services → Library**.
3. Enable:
   - **Google Cloud Pub/Sub API**
   - **Gmail API**

---

## 2. Create a Pub/Sub topic

1. **Pub/Sub → Topics → Create topic**.
2. Example topic ID: `gmail-notifications`.
3. Copy the **full topic resource name**, e.g.  
   `projects/YOUR_PROJECT_ID/topics/gmail-notifications`  
   (needed for `users.watch`).

---

## 3. Allow Gmail to publish to the topic

Gmail push uses Google’s Gmail API service account as the publisher.

1. Open **Pub/Sub → Topics** → your topic → **Permissions** (or IAM on that topic).
2. **Grant access**:
   - **Principal:** `gmail-api-push@system.gserviceaccount.com`
   - **Role:** **Pub/Sub Publisher** (`roles/pubsub.publisher`)
3. Save.

If this is missing, Gmail cannot publish watch notifications to your topic.

---

## 4. Create a push subscription (OIDC → your webhook)

Your server verifies the OIDC JWT **audience** against **`GMAIL_PUBSUB_AUDIENCE`**. It must match the **exact HTTPS URL** of the webhook (including path; no accidental trailing-slash mismatch).

1. Choose the public URL, e.g.  
   `https://api.example.com/api/webhooks/gmail-pubsub`
2. **Pub/Sub → Subscriptions → Create subscription**:
   - **Delivery type:** Push
   - **Endpoint URL:** that full HTTPS URL
   - **Enable authentication (OIDC):**
     - Use a **service account** in your project (create one if needed).
     - **Audience:** the same string as the endpoint URL, e.g.  
       `https://api.example.com/api/webhooks/gmail-pubsub`
3. Attach the subscription to your topic from step 2.

Set in your app environment:

```bash
GMAIL_PUBSUB_AUDIENCE=https://api.example.com/api/webhooks/gmail-pubsub
```

---

## 5. OAuth consent screen + OAuth client (refresh token)

1. **APIs & Services → OAuth consent screen**  
   Configure app name, support email, and **scopes** (next section). Add **test users** if the app is External and in testing.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Type: **Web application** (or **Desktop** if you only use a local script to obtain tokens).
   - For a Web client, add **Authorized redirect URIs** required by your OAuth tool (e.g. OAuth Playground or a local callback).
3. Save **Client ID** and **Client secret** → **`GOOGLE_CLIENT_ID`** and **`GOOGLE_CLIENT_SECRET`**.

### Scopes (Gmail)

Request scopes that cover **watch**, **history**, **messages.get**, and **labels.list**. A typical starting point:

- `https://www.googleapis.com/auth/gmail.readonly`

Confirm against [Gmail API documentation](https://developers.google.com/gmail/api/auth/scopes) for `users.watch` and your operations; add another scope only if the API returns **insufficientPermissions**.

### Obtain a refresh token

1. Use [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) or a small local OAuth script:
   - Use your client ID/secret (Playground can be configured for custom OAuth credentials).
   - Request the scopes above.
   - Complete the consent flow and exchange the code for tokens.
2. Copy the **refresh token** → **`GOOGLE_REFRESH_TOKEN`**.
3. Set **`GMAIL_MAILBOX`** to the monitored address (e.g. `you@gmail.com`).

**Re-authentication:** If the user revokes access or you change scopes, repeat the flow and update **`GOOGLE_REFRESH_TOKEN`**.

---

## 6. Gmail: label `kanbando-trigger` + filter

In the **Gmail web UI**:

1. **Settings → See all settings → Labels → Create new label**  
   - Name: **`kanbando-trigger`**
2. **Filters and Blocked Addresses → Create a new filter**  
   - Example: **To** = `trigger-bando@yourdomain.com` (or your real trigger address).
   - **Apply the label:** `kanbando-trigger`
   - Optionally skip Inbox / mark read.
3. Save.

---

## 7. Set `GMAIL_LABEL_ID` (API id, not the display name)

Gmail API uses internal ids (e.g. `Label_...`), not the string `kanbando-trigger`.

1. Call **`users.labels.list`** with `userId=me` (same OAuth / refresh token as the app).
2. Find the label whose **name** is `kanbando-trigger`.
3. Copy the **`id`** field.

Set:

```bash
GMAIL_LABEL_ID=Label_xxxxxxxxxxxxxxxx
```

---

## 8. Register `users.watch`

Call Gmail API **`users.watch`** once to start push notifications:

- `userId`: `me`
- `topicName`: full Pub/Sub topic from step 2, e.g.  
  `projects/YOUR_PROJECT_ID/topics/gmail-notifications`
- `labelIds`: `[GMAIL_LABEL_ID]` only (label-scoped watch)

Use `curl` with a short-lived access token from the refresh token, or a tiny script with `googleapis`.

---

## 9. Renew `users.watch` (~every 7 days)

`users.watch` **expires** after roughly **7 days**. Before expiry, call **`users.watch` again** with the same `topicName` and `labelIds`.

Options:

- **Cron** on your server or a bastion host  
- **Google Cloud Scheduler** hitting a secured HTTPS endpoint that runs the same `watch` call  
- Any other scheduler you already use

If watch lapses, re-register with step 8.

---

## 10. Environment variables (summary)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Refresh token from OAuth |
| `GMAIL_MAILBOX` | Monitored Gmail address |
| `GMAIL_LABEL_ID` | Label id from `users.labels.list` |
| `GMAIL_PUBSUB_AUDIENCE` | Exact webhook URL (OIDC `aud`) |
| `OPENAI_API_KEY` | LLM for task extraction |

Optional: `GMAIL_TRIGGER_RECIPIENT`, `GMAIL_INBOUND_WORKER_DISABLED`, `GMAIL_INBOUND_POLL_MS`, `GMAIL_PUBSUB_SKIP_VERIFY` (dev only — blocked in production).

Apply DB migrations / `db:push` so `gmail_watch_cursor` and `inbound_email_processing` exist before relying on the pipeline.

---

## 11. Sanity checks

1. Send mail that matches the filter; confirm the **`kanbando-trigger`** label is applied in Gmail.
2. In **Pub/Sub → Subscriptions**, verify push deliveries (or inspect errors).
3. Confirm the app logs show webhook activity and, after the worker runs, tasks created when `OPENAI_API_KEY` is set.

---

## 12. Official references

- [Gmail API push notifications](https://developers.google.com/gmail/api/guides/push)
- [`users.watch`](https://developers.google.com/gmail/api/reference/rest/v1/users/watch)
- [Authenticate push subscriptions (Pub/Sub)](https://cloud.google.com/pubsub/docs/push#authentication)
