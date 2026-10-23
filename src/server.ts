import { serveStatic } from "@hono/bun";
import { createApp } from "./api/routes.ts";
import { DEFAULT_DB_PATH, initDb } from "./db/index.ts";

// Initialize SQLite database
initDb();

const app = createApp();

// Serve static frontend files from client/dist if exists, or public
app.use("/*", serveStatic({ root: "./public" }));
app.get("*", serveStatic({ path: "./public/index.html" }));

const port = Number(process.env.PORT) || 3000;

console.log(
  `\n🚀 ATS Resume Optimizer & Job Tracker running at: http://localhost:${port}`,
);
console.log(`📊 SQLite database connected: ${DEFAULT_DB_PATH}\n`);

export default {
  port,
  fetch: app.fetch,
};
