import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Connection pool.
 *
 * Production: any managed PostgreSQL (Supabase / Neon / RDS / self hosted).
 * Development: set DEV_DB=true and the API boots an embedded PGlite instance
 * (real PostgreSQL, compiled to WASM) so the app runs with no external service.
 */

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of Date objects,
// which would otherwise be rendered in the server's local timezone.
types.setTypeParser(1082, (value: string) => value);
// BIGINT counts come back as strings; numbers are safe for our row counts.
types.setTypeParser(20, (value: string) => Number(value));

let pool: Pool | null = null;
let embedded: { stop: () => Promise<void> } | null = null;

const connectionString = process.env.DATABASE_URL || "";

function sslFor(url: string): false | { rejectUnauthorized: boolean } {
  if (/sslmode=(disable|allow)/i.test(url)) return false;
  if (/sslmode=(require|prefer|verify-ca|verify-full)/i.test(url)) {
    // Managed providers terminate TLS with certs pg does not ship roots for.
    return { rejectUnauthorized: false };
  }
  // localhost / docker-compose style URLs do not use TLS
  if (/@(localhost|127\.0\.0\.1|\[::1\])/i.test(url)) return false;
  return { rejectUnauthorized: false };
}

/**
 * Throws if something (usually a running API in another terminal) already
 * listens on the embedded database port.
 */
async function assertPortFree(port: number): Promise<void> {
  const net = await import("node:net");
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use — the embedded database can only be opened by one ` +
              "process at a time.\n" +
              "      Stop the running API (Ctrl-C in its terminal) and try again.\n" +
              "      Commands such as db:migrate, db:seed and db:demo must run while the API is stopped.",
          ),
        );
      } else {
        reject(err);
      }
    });
    probe.once("listening", () => {
      probe.close(() => resolve());
    });
    probe.listen(port, "127.0.0.1");
  });
}

export function isEmbeddedDb(): boolean {
  return embedded !== null;
}

/** Boots the embedded database when DEV_DB=true. Safe to call twice. */
export async function initDatabase(): Promise<void> {
  if (pool) return;

  if (String(process.env.DEV_DB).toLowerCase() === "true") {
    const { PGlite } = await import("@electric-sql/pglite");
    const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
    const port = Number(process.env.DEV_DB_PORT || 5432);
    const dataDir = path.resolve(process.cwd(), ".data", "pglite");

    // PGlite allows only ONE process to own a data directory. Two processes
    // writing the same files corrupts it, so refuse early with a clear message
    // instead of failing later with an opaque WASM error.
    await assertPortFree(port);

    // PGlite will not create nested directories itself.
    await fs.mkdir(path.dirname(dataDir), { recursive: true });

    const db = await PGlite.create({ dataDir });
    const server = new PGLiteSocketServer({
      db,
      port,
      host: "127.0.0.1",
      maxConnections: 20,
    });
    await server.start();
    embedded = {
      stop: async () => {
        await server.stop();
        await db.close();
      },
    };
    console.log(`[db] embedded PostgreSQL (PGlite) on 127.0.0.1:${port} - ${dataDir}`);

    pool = new Pool({
      host: "127.0.0.1",
      port,
      user: "postgres",
      database: "postgres",
      max: 4,
    });
  } else {
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy backend/.env.example to backend/.env, " +
          "or set DEV_DB=true to use the embedded development database.",
      );
    }
    pool = new Pool({
      connectionString,
      ssl: sslFor(connectionString),
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: "medcore-hms",
      statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT || 15_000),
    });
  }

  pool.on("error", (err) => {
    console.error("[db] idle client error", err.message);
  });

  await pool.query("SELECT 1");
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (embedded) {
    await embedded.stop();
    embedded = null;
  }
}

function getPool(): Pool {
  if (!pool) throw new Error("Database not initialised - call initDatabase() first");
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(sql, params as never[]);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Runs `fn` inside a transaction, rolling back on any thrown error. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection already broken */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Generates a human friendly sequential reference, e.g. APT-2026-00042. */
export async function nextReference(
  table: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const row = await one<{ n: string | null }>(
    `SELECT max(split_part(reference, '-', 3))::int AS n FROM ${table} WHERE reference LIKE $1`,
    [like],
  );
  const next = Number(row?.n || 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(5, "0")}`;
}
