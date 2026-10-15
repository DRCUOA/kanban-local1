-- Access control (replicates stageboard-pilot's access codes, architecture §7 there).
--
-- One row per credential the developer console issues:
--   kind 'device'        an access code a person types once per browser. It
--                        binds to the first browser that uses it (by the digest
--                        of that browser's HttpOnly key cookie) and is trusted
--                        for 90 days from admission; typing it again renews.
--   kind 'export-token'  a read-only bearer token for GET /api/export, for the
--                        scheduled briefing agent, which has no browser.
-- Neither code nor token is stored: only an HMAC-SHA-256 digest under the
-- deployment's CODE_HASH_KEY. Revoking sets revoked_at; rows are never reused.
CREATE TABLE IF NOT EXISTS "access_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL DEFAULT 'device',
	"label" text NOT NULL,
	"code_hash" text NOT NULL,
	"issued_at" timestamp NOT NULL DEFAULT now(),
	"admitted_at" timestamp,
	"browser_key_hash" text,
	"first_seen_at" timestamp,
	"last_seen_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "access_devices_code_hash_unique" UNIQUE ("code_hash"),
	CONSTRAINT "access_devices_kind_valid" CHECK ("kind" IN ('device', 'export-token')),
	CONSTRAINT "access_devices_label_length" CHECK (char_length("label") BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_devices_browser_key_idx" ON "access_devices" ("browser_key_hash");
