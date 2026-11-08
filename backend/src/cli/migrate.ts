import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../env";

loadEnv();

import { closeDatabase, initDatabase, query } from "../db";

/**
 * Applies db/schema.sql. Safe to run repeatedly: every statement is
 * `CREATE ... IF NOT EXISTS` / `CREATE OR REPLACE`.
 */
async function main() {
  await initDatabase();

  const schemaPath = path.resolve(__dirname, "../../db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  console.log("[migrate] applying db/schema.sql");
  await query(sql);

  const tables = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log(`[migrate] ok - ${tables.length} tables ready:`);
  console.log("  " + tables.map((t) => t.table_name).join(", "));

  await closeDatabase();
}

main().catch(async (err) => {
  console.error("[migrate] failed:", err.message);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
