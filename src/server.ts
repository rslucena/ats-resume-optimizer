import { createApp } from "./api/routes.ts";
import { initDb } from "./db/index.ts";
import { serveStatic } from "hono/bun";

// Initialize SQLite database
initDb("ats_tracker.sqlite");

const app = createApp();

// Serve static frontend files from client/dist if exists, or public
app.use("/*", serveStatic({ root: "./public" }));
app.get("*", serveStatic({ path: "./public/index.html" }));

const port = Number(process.env.PORT) || 3000;

console.log(`\n🚀 ATS Resume Optimizer & Job Tracker running at: http://localhost:${port}`);
console.log(`📊 SQLite database connected: ats_tracker.sqlite\n`);

export default {
  port,
  fetch: app.fetch
};
