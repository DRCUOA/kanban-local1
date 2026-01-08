#!/usr/bin/env tsx
/**
 * Test script to reproduce task update crash issue
 * 
 * This script sends rapid concurrent task updates to test for race conditions
 * in the task update endpoint that may cause server crashes or data corruption.
 * 
 * Expected behavior: Server should handle concurrent updates gracefully
 * Actual behavior: Server may crash or return errors after many rapid updates
 * 
 * Usage: tsx scripts/reproduce-task-update-crash.ts
 */

import "dotenv/config";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const CONCURRENT_REQUESTS = 30; // Number of simultaneous requests
const REQUEST_DELAY_MS = 50; // Delay between batches
const NUM_BATCHES = 3; // Number of batches to send

interface Task {
  id: number;
  title: string;
  description: string | null;
  stageId: number;
  status: string;
  priority: string;
  history: Array<{
    status: string;
    timestamp: string;
    note?: string;
  }>;
}

interface Stage {
  id: number;
  name: string;
  order: number;
}

let successCount = 0;
let errorCount = 0;
let serverCrashed = false;

async function makeRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${API_BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Request failed: ${method} ${path} - Status: ${response.status}`);
      console.error(`   Response: ${errorText}`);
      errorCount++;
      return null;
    }

    if (response.status === 204) {
      successCount++;
      return null;
    }

    const data = await response.json();
    successCount++;
    return data;
  } catch (error: any) {
    console.error(`❌ Network error: ${error.message}`);
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      serverCrashed = true;
      console.error('🔥 SERVER APPEARS TO HAVE CRASHED! 🔥');
    }
    errorCount++;
    return null;
  }
}

async function createTask(title: string, stageId: number): Promise<Task | null> {
  return makeRequest("POST", "/api/tasks", {
    title,
    description: `Test task for reproduction script`,
    stageId,
    priority: "normal",
  });
}

async function updateTask(taskId: number, updates: Partial<Task>): Promise<Task | null> {
  return makeRequest("PATCH", `/api/tasks/${taskId}`, updates);
}

async function deleteTask(taskId: number): Promise<void> {
  await makeRequest("DELETE", `/api/tasks/${taskId}`);
}

async function getStages(): Promise<Stage[]> {
  return makeRequest("GET", "/api/stages") || [];
}

async function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runConcurrentUpdates(
  taskId: number,
  count: number
): Promise<void> {
  console.log(`\n🔄 Sending ${count} concurrent updates to task ${taskId}...`);
  
  const updates = Array.from({ length: count }, (_, i) => {
    // Alternate between different update types to create conflicts
    const updateType = i % 4;
    
    switch (updateType) {
      case 0:
        return updateTask(taskId, {
          status: "in_progress",
          title: `Updated ${i}`,
        });
      case 1:
        return updateTask(taskId, {
          priority: i % 2 === 0 ? "high" : "low",
          description: `Concurrent update ${i}`,
        });
      case 2:
        return updateTask(taskId, {
          status: "backlog",
          priority: "critical",
        });
      case 3:
        return updateTask(taskId, {
          status: "done",
          title: `Batch update ${i}`,
        });
      default:
        return updateTask(taskId, { title: `Default ${i}` });
    }
  });

  await Promise.all(updates);
  console.log(`✅ Completed batch (Success: ${successCount}, Errors: ${errorCount})`);
}

async function verifyTaskIntegrity(taskId: number): Promise<boolean> {
  console.log(`\n🔍 Verifying task ${taskId} data integrity...`);
  
  const task = await makeRequest("GET", `/api/tasks`);
  if (!task) {
    console.error(`❌ Failed to fetch task list`);
    return false;
  }

  const targetTask = task.find((t: Task) => t.id === taskId);
  if (!targetTask) {
    console.error(`❌ Task ${taskId} not found after updates`);
    return false;
  }

  // Check if history is valid JSON array
  if (!Array.isArray(targetTask.history)) {
    console.error(`❌ Task history is not a valid array`);
    console.error(`   History value:`, JSON.stringify(targetTask.history));
    return false;
  }

  // Check for corrupted history entries
  for (const entry of targetTask.history) {
    if (!entry.status || !entry.timestamp) {
      console.error(`❌ Corrupted history entry found:`, JSON.stringify(entry));
      return false;
    }
  }

  console.log(`✅ Task integrity verified (${targetTask.history.length} history entries)`);
  return true;
}

async function main() {
  console.log("=".repeat(70));
  console.log("🧪 TASK UPDATE CRASH REPRODUCTION SCRIPT");
  console.log("=".repeat(70));
  console.log(`\nAPI Base URL: ${API_BASE_URL}`);
  console.log(`Concurrent requests per batch: ${CONCURRENT_REQUESTS}`);
  console.log(`Number of batches: ${NUM_BATCHES}`);
  console.log(`Delay between batches: ${REQUEST_DELAY_MS}ms`);
  console.log("\n" + "=".repeat(70));

  // Reset counters
  successCount = 0;
  errorCount = 0;
  serverCrashed = false;

  try {
    // 1. Get stages
    console.log("\n📋 Step 1: Fetching stages...");
    const stages = await getStages();
    if (!stages || stages.length === 0) {
      console.error("❌ No stages found. Please seed the database first.");
      process.exit(1);
    }
    console.log(`✅ Found ${stages.length} stages`);

    // 2. Create test task
    console.log("\n📝 Step 2: Creating test task...");
    const task = await createTask("Test Task for Crash Reproduction", stages[0].id);
    if (!task) {
      console.error("❌ Failed to create task");
      process.exit(1);
    }
    console.log(`✅ Created task ${task.id}: "${task.title}"`);

    // 3. Run multiple batches of concurrent updates
    console.log("\n⚡ Step 3: Running concurrent update batches...");
    for (let batch = 1; batch <= NUM_BATCHES; batch++) {
      console.log(`\n--- Batch ${batch}/${NUM_BATCHES} ---`);
      
      if (serverCrashed) {
        console.error("\n🔥 Aborting: Server has crashed!");
        break;
      }

      await runConcurrentUpdates(task.id, CONCURRENT_REQUESTS);
      
      if (batch < NUM_BATCHES) {
        console.log(`⏳ Waiting ${REQUEST_DELAY_MS}ms before next batch...`);
        await waitMs(REQUEST_DELAY_MS);
      }
    }

    // 4. Verify data integrity
    if (!serverCrashed) {
      const isValid = await verifyTaskIntegrity(task.id);
      if (!isValid) {
        console.error("\n❌ DATA CORRUPTION DETECTED!");
      }
    }

    // 5. Cleanup
    console.log("\n🧹 Step 4: Cleaning up...");
    await deleteTask(task.id);
    console.log(`✅ Deleted test task ${task.id}`);

    // 6. Print results
    console.log("\n" + "=".repeat(70));
    console.log("📊 RESULTS");
    console.log("=".repeat(70));
    console.log(`Total successful requests: ${successCount}`);
    console.log(`Total failed requests: ${errorCount}`);
    console.log(`Server crashed: ${serverCrashed ? "YES ❌" : "NO ✅"}`);
    
    if (serverCrashed) {
      console.log("\n🔥 CRASH REPRODUCED!");
      console.log("\nRoot Cause Analysis:");
      console.log("- The server crashed under concurrent task update load");
      console.log("- Likely cause: Race condition in updateTask() method");
      console.log("- Component: server/storage.ts - updateTask function");
      console.log("- Issue: Read-modify-write pattern on JSONB history field");
      console.log("  without proper transaction isolation or locking");
      console.log("\nDetails:");
      console.log("- Multiple concurrent updates read the same current history");
      console.log("- Each appends their status change to the history array");
      console.log("- Last write wins, causing lost history entries");
      console.log("- Potential JSONB corruption or constraint violation");
      process.exit(1);
    } else if (errorCount > 0) {
      console.log("\n⚠️  ERRORS DETECTED!");
      console.log("\nSome requests failed but server did not crash.");
      console.log("This may indicate:");
      console.log("- Transient errors under load");
      console.log("- Database connection pool exhaustion");
      console.log("- Data validation failures");
      process.exit(1);
    } else {
      console.log("\n✅ All requests succeeded!");
      console.log("\nNote: This doesn't mean there's no race condition.");
      console.log("The issue may require more concurrent requests or slower");
      console.log("database response times to manifest.");
    }

  } catch (error: any) {
    console.error("\n❌ Script failed with error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
