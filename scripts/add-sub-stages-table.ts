import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addSubStagesTable() {
  const client = await pool.connect();
  try {
    console.log("Creating sub_stages table...");
    
    // Check if table exists
    const checkResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name='sub_stages'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log("✅ Sub-stages table already exists");
    } else {
      await client.query(`
        CREATE TABLE "sub_stages" (
          "id" serial PRIMARY KEY NOT NULL,
          "stage_id" integer NOT NULL,
          "name" text NOT NULL,
          "tag" text NOT NULL,
          "bg_class" text NOT NULL,
          "opacity" integer NOT NULL,
          "order" integer NOT NULL,
          "created_at" timestamp DEFAULT now(),
          CONSTRAINT "sub_stages_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action
        )
      `);
      console.log("✅ Sub-stages table created successfully");
    }
    
    // Verify
    const verifyResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='sub_stages'
      ORDER BY ordinal_position
    `);
    
    console.log("\nSub-stages table columns:");
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addSubStagesTable();
