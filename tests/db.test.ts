import { describe, expect, it, beforeEach } from "bun:test";
import { getDb, initDb, resetDbForTesting } from "../src/db/index.ts";
import { masterProfilesTable, jobsTable, tailoredResumesTable } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";

describe("Database Schema & Persistence", () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  it("should initialize database tables and insert/retrieve master profile", async () => {
    const db = getDb();
    initDb();

    const testProfile = {
      id: "profile-1",
      fullName: "Carlos Silva",
      headline: "Senior Software Engineer",
      email: "carlos.silva@example.com",
      phone: "+55 11 99999-9999",
      location: "São Paulo, SP",
      linkedin: "linkedin.com/in/carlossilva",
      github: "github.com/carlossilva",
      portfolio: "carlossilva.dev",
      summary: "Engenheiro de software experiente com foco em Bun, Node.js e arquiteturas de alta escala.",
      skills: JSON.stringify(["TypeScript", "Bun", "Node.js", "Docker", "PostgreSQL"]),
      experiences: JSON.stringify([
        {
          company: "Tech Corp",
          role: "Senior Backend Developer",
          startDate: "2021-01",
          endDate: "Atual",
          description: "Liderança técnica e desenvolvimento de microsserviços."
        }
      ]),
      education: JSON.stringify([
        {
          institution: "Universidade de São Paulo",
          degree: "Bacharelado em Ciência da Computação",
          startDate: "2016",
          endDate: "2020"
        }
      ]),
      certifications: JSON.stringify(["AWS Certified Solutions Architect"]),
      rawText: "Texto bruto do currículo...",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.insert(masterProfilesTable).values(testProfile);

    const profiles = await db.select().from(masterProfilesTable).where(eq(masterProfilesTable.id, "profile-1"));
    expect(profiles.length).toBe(1);
    expect(profiles[0].fullName).toBe("Carlos Silva");
    expect(JSON.parse(profiles[0].skills)).toContain("TypeScript");
  });

  it("should insert, query and update job postings", async () => {
    const db = getDb();
    initDb();

    const testJob = {
      id: "job-1",
      title: "Senior Backend Engineer (Node.js & TypeScript)",
      company: "Acme Fintech",
      jobUrl: "https://acme.com/jobs/123",
      status: "SAVED" as const,
      language: "pt",
      rawDescription: "Buscamos desenvolvedor backend com sólida experiência em Node.js, TypeScript e microsserviços.",
      topKeywords: JSON.stringify([
        { term: "node.js", tfidf: 3.5, count: 5, stem: "node.js" },
        { term: "typescript", tfidf: 2.8, count: 4, stem: "typescript" }
      ]),
      notes: "Candidatura prioritária",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.insert(jobsTable).values(testJob);

    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.id, "job-1"));
    expect(jobs.length).toBe(1);
    expect(jobs[0].company).toBe("Acme Fintech");
    expect(jobs[0].status).toBe("SAVED");

    await db.update(jobsTable).set({ status: "APPLIED" }).where(eq(jobsTable.id, "job-1"));
    const updated = await db.select().from(jobsTable).where(eq(jobsTable.id, "job-1"));
    expect(updated[0].status).toBe("APPLIED");
  });
});
