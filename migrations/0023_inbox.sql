-- The inbox (server/inbox, INBOX_SETUP.md): mail for the board arrives at
-- POST /api/inbox from whatever receives it for the domain, so the queue holds
-- the message itself rather than a pointer into Gmail. The key that makes a
-- redelivery a no-op is per provider: the Gmail message id for 'gmail' rows,
-- the RFC Message-ID (or a digest of the content) for 'inbox' rows. The unique
-- constraint keeps its name and now covers the renamed column.
ALTER TABLE "inbound_email_processing" RENAME COLUMN "gmail_message_id" TO "message_key";
--> statement-breakpoint
ALTER TABLE "inbound_email_processing" ADD COLUMN "sender" text;
--> statement-breakpoint
ALTER TABLE "inbound_email_processing" ADD COLUMN "subject" text;
--> statement-breakpoint
ALTER TABLE "inbound_email_processing" ADD COLUMN "body_text" text;
--> statement-breakpoint
-- A third credential the developer console issues: an inbox token, a bearer
-- token that opens POST /api/inbox and nothing else.
ALTER TABLE "access_devices" DROP CONSTRAINT IF EXISTS "access_devices_kind_valid";
--> statement-breakpoint
ALTER TABLE "access_devices" ADD CONSTRAINT "access_devices_kind_valid" CHECK ("kind" IN ('device', 'export-token', 'inbox-token'));
