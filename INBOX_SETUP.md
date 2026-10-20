# The inbox: mail (and notes) into tasks, without a mail provider

The board takes messages at one address on its own API, `POST /api/inbox`. Whatever receives mail for your domain only has to make that one HTTP call, so it can be a Cloudflare email worker, an inbound-parse service, a forward rule, a phone shortcut or a script, and any of them can replace any other. Nothing in the board depends on a mail provider's API. The Gmail pipeline (`GMAIL_PUBSUB_SETUP.md`) still works and feeds the same queue; it is no longer required.

## 1. Issue an inbox token

Open `/console`, enter the developer secret, give the token a label (for example `Cloudflare mail`) and press **Inbox token**. It is shown once. It starts with `kbi_`, is sent as `Authorization: Bearer <token>`, and opens `POST /api/inbox` and nothing else: it cannot read the board. Revoke it from the same page.

## 2. Post a message

Three bodies are taken, chosen by `Content-Type`.

A raw email, as a mail receiver has it:

```sh
curl -X POST https://board.example.com/api/inbox \
  -H "Authorization: Bearer kbi_..." \
  -H "Content-Type: message/rfc822" \
  --data-binary @message.eml
```

A note, whose first line is the subject:

```sh
printf 'Book the dentist !high\nBefore the end of the month.\n' | curl -X POST https://board.example.com/api/inbox \
  -H "Authorization: Bearer kbi_..." \
  -H "Content-Type: text/plain" \
  --data-binary @-
```

JSON, for anything that is not an email at all:

```sh
curl -X POST https://board.example.com/api/inbox \
  -H "Authorization: Bearer kbi_..." \
  -H "Content-Type: application/json" \
  -d '{"subject":"Book the dentist !high","text":"Before the end of the month.","from":"rich@example.com","messageId":"any-id-of-yours"}'
```

Every field of the JSON is optional except that there must be a subject or some text. `from` is checked against the allowed senders (below); `messageId` makes a resend of the same message a no-op.

The answer is `202 {"id": 12, "duplicate": false}` as soon as the message is queued; the task appears within the worker's next poll (15 seconds by default). A redelivery of the same message, which every forwarder does sooner or later, answers `202` with the same `id` and `"duplicate": true` and changes nothing. A raw email is keyed by its `Message-ID`; anything without one by a digest of sender, subject and text.

Refusals: `400` for an empty message, `403` for a sender not on the allowed list, `413` for a body over 10 MB, `415` for any other `Content-Type`, and `401` without a live inbox token.

## 3. What becomes of it

The message is read one of two ways, chosen by `INBOX_EXTRACTION`:

- **`plain`**: one task. The subject is the title, the text the description. No model is involved.
- **`llm`**: the existing LangGraph extraction asks OpenAI to find the tasks in the prose, which may split an epic into a parent and child tasks. Needs `OPENAI_API_KEY`.

Unset, it is `llm` when `OPENAI_API_KEY` is set and `plain` otherwise. It applies to every inbound message, the Gmail pipeline's included.

In either mode the subject may carry directives, which are removed from the title and always win:

| In the subject | Effect |
|---|---|
| `!low`, `!normal`, `!high`, `!critical` | The task's priority |
| `@backlog`, `@in-progress`, `@waiting_on_others` | The stage, by name, with `-` or `_` standing for a space; an unknown name falls back to Backlog |

`Book the dentist !high @in-progress` becomes the task "Book the dentist", high priority, in the In Progress column. A `!word` that is not a priority, and the `@` of an email address, are left alone.

From a raw email only the headers and the text body are kept, with any quoted reply under it cut off; HTML-only mail is converted to text; attachments are not kept.

## 4. Route your domain's mail to it

The board runs on Railway, which exposes only its HTTP port, so it cannot be the mail exchanger for your domain itself. Something has to accept SMTP for the address and forward the message over HTTPS. Because the board owns the contract, these are interchangeable.

### Cloudflare Email Routing (no mailbox, no provider account)

If the domain's DNS is on Cloudflare: **Email → Email Routing**, enable it, add a custom address such as `tasks@example.com`, and set its action to **Send to a Worker** with this worker. Bind `INBOX_URL` (`https://board.example.com/api/inbox`) as a variable, `INBOX_TOKEN` as a secret, and optionally `FALLBACK_EMAIL`, a verified destination address, for mail the board could not take.

```js
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).arrayBuffer();
    const res = await fetch(env.INBOX_URL, {
      method: 'POST',
      headers: {
        'content-type': 'message/rfc822',
        authorization: `Bearer ${env.INBOX_TOKEN}`,
      },
      body: raw,
    });
    if (res.ok) return;
    // 4xx: the board refused it on purpose (a sender not on the list, an
    // empty message); nothing to retry. Anything else: keep the mail.
    if (res.status >= 500 && env.FALLBACK_EMAIL) {
      await message.forward(env.FALLBACK_EMAIL);
      return;
    }
    message.setReject(`The board's inbox answered ${res.status}`);
  },
};
```

### An inbound-parse service

Postmark, Mailgun, SendGrid and SES can each receive mail for a domain and forward the raw message (or a JSON rendering of it) to a URL. Point one at `POST /api/inbox` with the token in the `Authorization` header and `message/rfc822` as the body; where a service only posts its own JSON, a few lines of adapter turn it into the JSON above.

### A mailbox you already have

Any mail client or host can forward to the routed address, which replaces an API integration with a forward rule. Forwarded mail arrives from the forwarder's address or yours, so put that on the allowed list, not the original senders.

## 5. Settings

| Variable | Required | Description |
|---|---|---|
| `INBOX_ALLOWED_SENDERS` | No | Addresses and domains, separated by commas or spaces (`rich@example.com, @work.test, other.test`), that mail may come from. Empty allows every sender. A message that names no sender at all (a note, JSON without `from`) is allowed on the token alone |
| `INBOX_EXTRACTION` | No | `plain` or `llm`, as above |
| `GMAIL_INBOUND_WORKER_DISABLED` | No | Must not be `true`: the same worker processes the inbox's queue |
| `GMAIL_INBOUND_POLL_MS` | No | How often the worker looks for a queued message (default 15000) |
| `GMAIL_INBOUND_TRACE` | No | `true` to log each step of processing, inbox messages included |

The queue is the `inbound_email_processing` table. Each message is worked at most five times, under a ten-minute lease, and then marked failed with the reason; a row records the tasks it created.
