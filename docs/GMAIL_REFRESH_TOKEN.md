# Regenerating the Gmail refresh token

Follow these steps when the app logs `invalid_grant`. This means Google
rejected the stored refresh token and you need a new one.

Common reasons a refresh token stops working:

- The OAuth consent screen is in **Testing** mode (tokens expire after 7 days).
- Someone revoked app access from the Google Account.
- The account password was changed.
- The client ID or secret was rotated without re-issuing the token.

---

## What you need before you start

- Access to the [Google Cloud Console](https://console.cloud.google.com/) for
  the project that owns the OAuth client.
- The **GOOGLE_CLIENT_ID** and **GOOGLE_CLIENT_SECRET** values currently set in
  your deployment (Railway, `.env`, etc.). You are not changing these — only the
  refresh token.
- The ability to sign in to the Gmail account the app monitors
  (the `GMAIL_MAILBOX` address).

---

## Step 1 — Open the OAuth Playground

Go to <https://developers.google.com/oauthplayground/>.

---

## Step 2 — Tell the Playground to use your own OAuth client

By default the Playground uses Google's demo client, which will not work for
your app.

1. Click the **gear icon** (⚙ OAuth 2.0 configuration) in the top-right
   corner.
2. Check **"Use your own OAuth credentials"**.
3. Paste your **GOOGLE_CLIENT_ID** into the "OAuth Client ID" field.
4. Paste your **GOOGLE_CLIENT_SECRET** into the "OAuth Client secret" field.

> If you do not know these values, find them in
> [Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
> under the OAuth 2.0 Client ID the app uses, or in your deployment's
> environment variables.

---

## Step 3 — Make sure the Playground's redirect URI is authorized

The Playground sends users back to
`https://developers.google.com/oauthplayground` after consent.
Your OAuth client must list this as an authorized redirect URI.

1. In [Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials),
   open your OAuth client.
2. Under **Authorized redirect URIs**, check that
   `https://developers.google.com/oauthplayground` is listed.
3. If it is missing, click **Add URI**, paste the URL, and save.

---

## Step 4 — Select the Gmail scope

Back in the Playground, on the left side under **Step 1 — Select & authorize
APIs**:

1. Scroll to **Gmail API v1** and expand it, or type the scope manually in the
   "Input your own scopes" box:

   ```
   https://www.googleapis.com/auth/gmail.readonly
   ```

2. Click **Authorize APIs**.

---

## Step 5 — Sign in and grant consent

1. A Google sign-in page opens. Sign in with the **Gmail account the app
   monitors** (the `GMAIL_MAILBOX` address).
2. If you see a warning that the app is unverified, click
   **Advanced → Go to \<app name\> (unsafe)**. This is expected for apps whose
   consent screen is in Testing mode.
3. Review the permissions and click **Allow** (or **Continue**).

You are redirected back to the Playground with an **authorization code**
filled in.

---

## Step 6 — Exchange the code for tokens

1. In the Playground, click **Exchange authorization code for tokens**
   (Step 2 in the left panel).
2. The Playground shows a JSON response containing `access_token` and
   `refresh_token`.
3. Copy the **refresh_token** value (the long string — do not include the
   quotes).

---

## Step 7 — Update your deployment

Replace the old `GOOGLE_REFRESH_TOKEN` with the value you just copied.

**Railway:**

1. Open your project in the [Railway dashboard](https://railway.app/dashboard).
2. Select the service that runs the server.
3. Go to **Variables**.
4. Find `GOOGLE_REFRESH_TOKEN`, click it, paste the new value, and save.
5. Railway will automatically redeploy. Wait for the new deployment to go
   healthy.

**Local `.env` file (development):**

Open `.env` and replace the line:

```
GOOGLE_REFRESH_TOKEN=<old value>
```

with:

```
GOOGLE_REFRESH_TOKEN=<new value>
```

Restart the dev server.

---

## Step 8 — Verify it works

1. Check the deployment logs. The `invalid_grant` errors should stop.
2. Send a test email that matches the Gmail filter so it gets the
   `kanbando-trigger` label.
3. Confirm the webhook fires and processes the message (look for
   `webhook.sync_completed` in the logs).

---

## Preventing this from happening again

| Problem | Fix |
|---------|-----|
| Tokens expire every 7 days | Publish the OAuth consent screen. Go to [Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) and set the publishing status to **In production** (External) or **Internal** (Workspace orgs). Published apps issue refresh tokens that do not expire on a timer. |
| User revokes access | Unavoidable — re-run this guide if it happens. |
| Password change invalidates token | Re-run this guide after any password change on the monitored account. |

---

## Quick reference

| Item | Value |
|------|-------|
| OAuth Playground URL | <https://developers.google.com/oauthplayground/> |
| Playground redirect URI (must be in your client) | `https://developers.google.com/oauthplayground` |
| Required scope | `https://www.googleapis.com/auth/gmail.readonly` |
| Env var to update | `GOOGLE_REFRESH_TOKEN` |
| Related setup doc | [`GMAIL_PUBSUB_SETUP.md`](../GMAIL_PUBSUB_SETUP.md) (sections 5 and 10) |
