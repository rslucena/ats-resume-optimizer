import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.ts";

export const DEFAULT_DB_PATH = process.env.DB_PATH || "data/ats_tracker.sqlite";

let sqliteDb: Database | null = null;
let drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(dbPath = DEFAULT_DB_PATH) {
  if (!sqliteDb || !drizzleDb) {
    if (dbPath !== ":memory:") {
      const dir = dirname(resolve(dbPath));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    sqliteDb = new Database(dbPath);
    sqliteDb.exec("PRAGMA journal_mode = WAL;");
    sqliteDb.exec("PRAGMA foreign_keys = ON;");
    drizzleDb = drizzle(sqliteDb, { schema });
  }
  return drizzleDb;
}

export function initDb(dbPath = DEFAULT_DB_PATH) {
  const db = getDb(dbPath);
  if (!sqliteDb) return db;

  // Auto-create tables if they don't exist
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS master_profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      headline TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      location TEXT,
      linkedin TEXT,
      github TEXT,
      portfolio TEXT,
      summary TEXT NOT NULL,
      skills TEXT NOT NULL,
      experiences TEXT NOT NULL,
      education TEXT NOT NULL,
      certifications TEXT NOT NULL,
      raw_text TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      job_url TEXT,
      status TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'pt',
      raw_description TEXT NOT NULL,
      top_keywords TEXT NOT NULL,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tailored_resumes (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      tailored_title TEXT NOT NULL,
      tailored_summary TEXT NOT NULL,
      tailored_skills TEXT NOT NULL,
      tailored_experiences TEXT NOT NULL,
      tailored_education TEXT NOT NULL,
      score_before REAL NOT NULL,
      score_after REAL NOT NULL,
      keywords_achieved TEXT NOT NULL,
      keywords_missing TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knockout_questions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      candidate_answer TEXT,
      ai_suggested_answer TEXT,
      status TEXT NOT NULL DEFAULT 'Pendente',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_knockout_job_id ON knockout_questions(job_id);
  `);

  return db;
}

export function resetDbForTesting() {
  if (sqliteDb) {
    sqliteDb.close();
  }
  sqliteDb = new Database(":memory:");
  sqliteDb.exec("PRAGMA foreign_keys = ON;");
  drizzleDb = drizzle(sqliteDb, { schema });
  initDb(":memory:");
}
