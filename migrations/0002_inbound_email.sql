CREATE TABLE "gmail_watch_cursor" (
	"mailbox" text PRIMARY KEY NOT NULL,
	"history_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_email_processing" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"gmail_message_id" text NOT NULL,
	"rfc_message_id" text,
	"history_id_seen" text,
	"recipient" text,
	"normalized_subject" text,
	"normalized_body_hash" text,
	"processing_status" text NOT NULL,
	"created_task_id" integer,
	"error_reason" text,
	"processed_at" timestamp,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"lease_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbound_provider_gmail_msg" UNIQUE("provider","gmail_message_id")
);
--> statement-breakpoint
ALTER TABLE "inbound_email_processing" ADD CONSTRAINT "inbound_email_processing_created_task_id_tasks_id_fk" FOREIGN KEY ("created_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
