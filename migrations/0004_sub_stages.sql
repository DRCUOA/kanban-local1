-- sub_stages table (matches shared/schema.ts); was never included in earlier SQL migrations.
CREATE TABLE "sub_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"stage_id" integer NOT NULL,
	"name" text NOT NULL,
	"tag" text NOT NULL,
	"bg_class" text NOT NULL,
	"opacity" integer NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "sub_stages" ADD CONSTRAINT "sub_stages_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;
