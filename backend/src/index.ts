import { loadEnv } from "./env";

loadEnv();

import { closeDatabase, initDatabase } from "./db";
import { createApp } from "./app";

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
      "[api] JWT_SECRET is missing or too short.\n" +
        "      Add a 32+ character random string to backend/.env\n" +
        '      Generate one: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
    process.exit(1);
  }

  await initDatabase();

  const app = createApp();
  const server = app.listen(PORT, HOST, () => {
    console.log(`[api] MedCore HMS listening on http://localhost:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received - shutting down`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[api] failed to start:", err.message);
  process.exit(1);
});
