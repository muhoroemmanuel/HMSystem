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

/**
 * Strips query parameters that belong to a connection pooler rather than to
 * PostgreSQL itself.
 *
 * Supabase shows connection strings containing `pgbouncer=true` and
 * `connection_limit=1`. `pg` forwards unrecognised query parameters to the
 * server as startup parameters, and PostgreSQL rejects those with
 * "unsupported startup parameter" - so pasting Supabase's string verbatim
 * fails to connect. Pool size is configured on this side instead.
 */
function cleanConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of ["pgbouncer", "connection_limit", "pool_timeout", "connect_timeout"]) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

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
 * Claims sole ownership of a database directory.
 *
 * The embedded database is a set of files. Two processes writing them at once
 * corrupts the store, and the damage is not obvious until much later. A port
 * check is not enough: on Windows a port can be reserved by the OS (Hyper-V and
 * WinNAT reserve ranges), and two copies configured with different ports would
 * both open the same files. A lock file does not depend on either.
 */
async function acquireDataDirLock(dataDir: string): Promise<void> {
  const lockPath = path.join(dataDir, "owner.lock");

  const readOwner = async (): Promise<number | null> => {
    try {
      const raw = await fs.readFile(lockPath, "utf8");
      const pid = Number(raw.trim());
      return Number.isInteger(pid) && pid > 0 ? pid : null;
    } catch {
      return null;
    }
  };

  const isAlive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      // EPERM means the process exists but belongs to someone else.
      return (err as NodeJS.ErrnoException).code === "EPERM";
    }
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await fs.writeFile(lockPath, String(process.pid), { flag: "wx" });
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }

    const owner = await readOwner();
    if (owner && owner !== process.pid && isAlive(owner)) {
      throw new Error(
        `This database is already open in another process (pid ${owner}).\n` +
          "      The embedded database can only be used by one process at a time.\n" +
          "      Stop the running API (Ctrl-C in its terminal) and try again.\n" +
          "      db:migrate, db:seed and db:demo must run while the API is stopped.",
      );
    }

    // The previous owner died without cleaning up. Take the lock over.
    await fs.rm(lockPath, { force: true });
  }

  throw new Error(`Could not lock the database directory: ${dataDir}`);
}

/**
 * True when a port can be bound on loopback. Some Windows installations reserve
 * ports (Hyper-V / WinNAT), which surfaces as EACCES rather than EADDRINUSE.
 */
async function portIsAvailable(port: number): Promise<boolean> {
  const net = await import("node:net");
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

/**
 * Chooses the port for the embedded database.
 *
 * The port is internal — nothing outside this process connects to it — so any
 * free port will do. If the configured one is unusable but was set explicitly
 * by the user, that is an error worth reporting rather than silently ignoring.
 */
async function chooseDbPort(): Promise<number> {
  const configured = process.env.DEV_DB_PORT ? Number(process.env.DEV_DB_PORT) : null;

  if (configured && (await portIsAvailable(configured))) return configured;

  // Nothing outside this process connects to the embedded database, so a fixed
  // port is a convenience rather than a requirement. If it is unusable - a
  // local Postgres, or a range Windows has reserved - take a free one instead
  // of blocking a first run. The lock file, not the port, is what guarantees
  // a directory is opened only once.
  const net = await import("node:net");
  const fallback = await new Promise<number | null>((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(null));
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : null;
      srv.close(() => resolve(port));
    });
  });

  if (!fallback) {
    throw new Error(
      configured
        ? `DEV_DB_PORT=${configured} is unavailable and no free port could be found.`
        : "Could not find a free port for the embedded database.",
    );
  }

  if (configured) {
    console.log(
      `[db] DEV_DB_PORT=${configured} is not usable on this machine; using ${fallback} instead.`,
    );
  }
  return fallback;
}

/**
 * Claims sole ownership of a database directory.
 *
 * The embedded database is a set of files. Two processes writing them at once
 * corrupts the store, and the damage is not obvious until much later. A port
 * check is not enough: on Windows a port can be reserved by the OS (Hyper-V and
 * WinNAT reserve ranges), and two copies configured with different ports would
 * both open the same files. A lock file does not depend on either.
 */
export function isEmbeddedDb(): boolean {
  return embedded !== null;
}

/** Boots the embedded database when DEV_DB=true. Safe to call twice. */
export async function initDatabase(): Promise<void> {
  if (pool) return;

  if (String(process.env.DEV_DB).toLowerCase() === "true") {
    const { PGlite } = await import("@electric-sql/pglite");
    const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
    const port = await chooseDbPort();
    // DEV_DB_DIR lets the e2e runner use a directory of its own, so a test run
    // can never touch the database a developer is working against.
    const dataDir = process.env.DEV_DB_DIR
      ? path.resolve(process.cwd(), process.env.DEV_DB_DIR)
      : path.resolve(process.cwd(), ".data", "pglite");

    // PGlite will not create nested directories itself.
    await fs.mkdir(dataDir, { recursive: true });

    // PGlite allows only ONE process to own a data directory. Two processes
    // writing the same files corrupts it, so claim it before opening it.
    await acquireDataDirLock(dataDir);

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
        await fs.rm(path.join(dataDir, "owner.lock"), { force: true }).catch(() => undefined);
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
        "No database is configured.\n" +
          "      backend/.env is missing, or it does not set DATABASE_URL.\n" +
          "      For local development, create the file from the template - it already\n" +
          "      sets DEV_DB=true, which needs no database server:\n" +
          "        PowerShell:  Copy-Item backend/.env.example backend/.env\n" +
          "        macOS/Linux: cp backend/.env.example backend/.env",
      );
    }
    const url = cleanConnectionString(connectionString);
    pool = new Pool({
      connectionString: url,
      ssl: sslFor(url),
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
