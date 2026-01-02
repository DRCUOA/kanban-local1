import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addEnhancedTaskFields() {
  console.log("🚀 Adding enhanced task fields...");

  try {
    // Add new columns with defaults for backward compatibility
    await db.execute(sql`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'backlog';
    `);
    console.log("✅ Added status column");

    await db.execute(sql`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'normal';
    `);
    console.log("✅ Added priority column");

    await db.execute(sql`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "effort" integer;
    `);
    console.log("✅ Added effort column");

    await db.execute(sql`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "due_date" timestamp;
    `);
    console.log("✅ Added due_date column");

    await db.execute(sql`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
    `);
    console.log("✅ Added updated_at column");

    await db.execute(sql`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb;
    `);
    console.log("✅ Added tags column");

    await db.execute(sql`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "parent_task_id" integer;
    `);
    console.log("✅ Added parent_task_id column");

    await db.execute(sql`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "recurrence" text DEFAULT 'none';
    `);
    console.log("✅ Added recurrence column");

    await db.execute(sql`
      ALTER TABLE "tasks" 
      ADD COLUMN IF NOT EXISTS "history" jsonb DEFAULT '[]'::jsonb;
    `);
    console.log("✅ Added history column");

    // Add foreign key constraint for parent_task_id
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'tasks_parent_task_id_tasks_id_fk'
        ) THEN
          ALTER TABLE "tasks" 
          ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" 
          FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log("✅ Added parent_task_id foreign key constraint");

    // Initialize history for existing tasks based on their stage
    // Map stages to status (this is a best-guess mapping)
    await db.execute(sql`
      UPDATE "tasks" 
      SET "history" = jsonb_build_array(
        jsonb_build_object(
          'status', 
          CASE 
            WHEN "stage_id" = (SELECT id FROM stages WHERE name ILIKE '%done%' OR name ILIKE '%complete%' LIMIT 1) THEN 'done'
            WHEN "stage_id" = (SELECT id FROM stages WHERE name ILIKE '%progress%' OR name ILIKE '%doing%' LIMIT 1) THEN 'in_progress'
            ELSE 'backlog'
          END,
          'timestamp', "created_at"::text
        )
      )
      WHERE "history" IS NULL OR "history" = '[]'::jsonb;
    `);
    console.log("✅ Initialized history for existing tasks");

    // Set updated_at to created_at for existing tasks
    await db.execute(sql`
      UPDATE "tasks" 
      SET "updated_at" = "created_at" 
      WHERE "updated_at" IS NULL;
    `);
    console.log("✅ Set updated_at for existing tasks");

    console.log("\n✅ All enhanced task fields added successfully!");
  } catch (error) {
    console.error("❌ Error adding enhanced task fields:", error);
    throw error;
  }
}

addEnhancedTaskFields()
  .then(() => {
    console.log("\n✨ Migration complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration failed:", error);
    process.exit(1);
  });
