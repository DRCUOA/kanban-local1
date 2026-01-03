import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addColorColumn() {
  const client = await pool.connect();
  try {
    console.log("Adding color column to stages table...");
    
    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='stages' AND column_name='color'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log("✅ Color column already exists");
    } else {
      await client.query('ALTER TABLE stages ADD COLUMN color text');
      console.log("✅ Color column added successfully");
    }
    
    // Verify
    const verifyResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='stages'
    `);
    
    console.log("\nCurrent stages table columns:");
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

addColorColumn();
