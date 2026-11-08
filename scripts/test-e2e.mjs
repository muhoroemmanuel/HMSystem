#!/usr/bin/env node
/**
 * End-to-end test runner.
 *
 * Boots a disposable database, seeds it, starts the API, runs the frontend
 * interaction tests against it, then tears everything down. Used by CI and by
 * `npm run test:e2e` locally, so both behave identically.
 *
 * The whole run is throwaway: it uses its own data directory and port, and
 * removes them afterwards, so it never touches a developer's real database.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const frontend = path.join(root, "frontend");

const API_PORT = Number(process.env.TEST_API_PORT || 4001);
const DB_PORT = Number(process.env.TEST_DB_PORT || 5433);
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;

// A directory of its own: the run must never be able to touch the database a
// developer has open in another terminal.
const TEST_DB_DIR = path.join("..", ".tmp-e2e", "pglite");

const config = {
  NODE_ENV: "test",
  DEV_DB: "true",
  DEV_DB_DIR: TEST_DB_DIR,
  DEV_DB_PORT: String(DB_PORT),
  PORT: String(API_PORT),
  JWT_SECRET: "test-only-secret-value-not-used-in-production-000000",
  ADMIN_EMAIL: "admin@medcore.ke",
  ADMIN_PASSWORD: "Test-Admin-Password-2026",
  CLINIC_NAME: "Test Clinic",
  LOGIN_RATE_LIMIT: "1000",
  LOGIN_RATE_WINDOW_MINUTES: "15",
  BOOKING_RATE_LIMIT: "2000",
};

const env = { ...process.env, ...config };

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...env, ...extraEnv },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}`);
  }
}

function waitForPort(port, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for port ${port}`));
        } else {
          setTimeout(attempt, 500);
        }
      });
    };
    attempt();
  });
}

const testDbRoot = path.resolve(backend, "..", ".tmp-e2e");

function cleanupData(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

let api;
try {
  // Always start from an empty database so results never depend on leftovers.
  cleanupData(testDbRoot);

  console.log("\n[test:e2e] applying schema");
  run("npx", ["tsx", "src/cli/migrate.ts"], backend);

  console.log("[test:e2e] seeding roles, administrator, settings and services");
  run("npx", ["tsx", "src/cli/seed.ts"], backend);

  console.log("[test:e2e] adding test fixtures (clinicians with availability)");
  run("npx", ["tsx", "src/cli/demo.ts"], backend);

  console.log("[test:e2e] starting API");
  api = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: backend,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  api.stdout.on("data", (d) => process.stdout.write(`  ${d}`));
  api.stderr.on("data", (d) => process.stderr.write(`  ${d}`));

  await waitForPort(API_PORT);

  console.log("[test:e2e] running interaction tests\n");
  run("npx", ["vitest", "run"], frontend, {
    TEST_API_ORIGIN: API_ORIGIN,
    TEST_ADMIN_EMAIL: config.ADMIN_EMAIL,
    TEST_ADMIN_PASSWORD: config.ADMIN_PASSWORD,
  });
} catch (err) {
  console.error(`\n[test:e2e] FAILED: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (api && !api.killed) {
    api.kill("SIGKILL");
  }
  cleanupData(testDbRoot);
  console.log("[test:e2e] done");
}
