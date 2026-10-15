-- App-wide settings as key/value rows. First use: the AI assistant's model and
-- OpenAI API key. A secret value (the key) is stored AES-256-GCM encrypted with
-- a key derived from the SETTINGS_SECRET environment variable, never in plain
-- text, and the API never returns it.
CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
