import { describe, expect, it, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { createApp } from "../src/api/routes.ts";
import { getDb, resetDbForTesting } from "../src/db/index.ts";
import { masterProfilesTable, jobsTable, tailoredResumesTable } from "../src/db/schema.ts";
import {
  tailorResumeWithAiOption,
  buildGeminiTailorPrompt,
  mergeGeminiOutputWithMaster,
  extractJsonFromText
} from "../src/services/aiTailorService.ts";
import type { ResumeData } from "../types/resume.ts";
import type { JobInput } from "../optimizer/tailor.ts";

describe("Gemini AI Tailoring Service & Fallback Architecture", () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  const mockMasterResume: ResumeData = {
    fullName: "Rodrigo Silva",
    headline: "Senior Software Engineer",
    email: "rodrigo@example.com",
    location: "São Paulo, SP",
    summary: "Engenheiro de Software com 8 anos de experiência em microsserviços e sistemas distribuídos.",
    skills: ["TypeScript", "Node.js", "Docker", "PostgreSQL", "AWS"],
    experiences: [
      {
        company: "TechFin",
        role: "Senior Backend Engineer",
        startDate: "2021",
        endDate: "Atual",
        description: "- Arquitetei microsserviços escaláveis em Node.js e TypeScript atendendo 500k requisições diárias.\n- Reduzi latência em 35% com caching em Redis."
      }
    ],
    education: [
      {
        institution: "USP",
        degree: "Bacharelado em Ciência da Computação",
        startDate: "2015",
        endDate: "2019"
      }
    ]
  };

  const mockJob: JobInput = {
    title: "Staff Backend Engineer",
    company: "Nubank",
    language: "pt",
    rawDescription: "Buscamos Engenheiro Backend Staff com sólida vivência em microsserviços, TypeScript, Node.js e AWS.",
    keywords: [
      { term: "typescript", count: 4, tfidf: 3.5, stem: "typescript" },
      { term: "node.js", count: 4, tfidf: 3.2, stem: "node.js" },
      { term: "microsserviços", count: 3, tfidf: 2.8, stem: "microsserviç" },
      { term: "aws", count: 2, tfidf: 2.1, stem: "aws" }
    ]
  };

  it("should extract JSON correctly from raw text and markdown-fenced blocks", () => {
    const raw = '{"headline":"Staff Engineer","summary":"Resumo executivo","skills":["Go","AWS"]}';
    expect(extractJsonFromText(raw)?.headline).toBe("Staff Engineer");

    const fenced = 'Aqui está a resposta:\n```json\n{"headline":"Staff Lead","summary":"Resumo","skills":["Rust"]}\n```';
    expect(extractJsonFromText(fenced)?.headline).toBe("Staff Lead");

    const messy = 'Preâmbulo qualquer... {"headline":"Architect","summary":"OK"} pós-âmbulo';
    expect(extractJsonFromText(messy)?.headline).toBe("Architect");
  });

  it("should construct prompt containing strict zero-hallucination rules and job keywords", () => {
    const promptPt = buildGeminiTailorPrompt(mockMasterResume, mockJob, "pt");
    expect(promptPt).toContain("ZERO ALUCINAÇÃO");
    expect(promptPt).toContain("Nubank");
    expect(promptPt).toContain("Staff Backend Engineer");
    expect(promptPt).toContain("typescript");

    const promptEn = buildGeminiTailorPrompt(mockMasterResume, { ...mockJob, language: "en" }, "en");
    expect(promptEn).toContain("ZERO HALLUCINATION");
    expect(promptEn).toContain("Target Keywords");
  });

  it("should merge Gemini output safely without hallucinating degrees or companies", () => {
    const geminiOutput = {
      headline: "Staff Backend Engineer | TypeScript • Node.js • AWS",
      summary: "Staff Backend Engineer com 8 anos de experiência em microsserviços, TypeScript e Node.js para soluções de alta performance.",
      skills: ["TypeScript", "Node.js", "Docker", "AWS", "proativo", "comunicação", "Tf-idf"], // Should filter soft skills and internal terms
      experiences: [
        {
          company: "Tentativa de mudar empresa", // Should be ignored in favor of master
          role: "Staff Backend Engineer",
          description: "- Liderei arquitetura de microsserviços em Node.js com redução de 35% em latência."
        }
      ]
    };

    const result = mergeGeminiOutputWithMaster(mockMasterResume, mockJob, geminiOutput, "pt");

    expect(result.tailoredResume.headline).toBe("Staff Backend Engineer | TypeScript • Node.js • AWS");
    expect(result.tailoredResume.experiences[0].company).toBe("TechFin"); // Retained original master company
    expect(result.tailoredResume.experiences[0].role).toBe("Staff Backend Engineer");
    expect(result.tailoredResume.education[0].institution).toBe("USP"); // Retained original education
    // Soft skills and internal terms must be filtered out
    expect(result.tailoredResume.skills.some(s => s.toLowerCase().includes("proativo"))).toBe(false);
    expect(result.tailoredResume.skills.some(s => s.toLowerCase() === "tf-idf")).toBe(false);
    expect(result.scoreAfter).toBeGreaterThanOrEqual(result.scoreBefore);
  });

  it("should fall back to local deterministic engine when useAi is false", async () => {
    const result = await tailorResumeWithAiOption(mockMasterResume, mockJob, false);
    expect(result.engine).toBe("local");
    expect(result.tailoredResume.headline).toBeDefined();
    expect(result.scoreAfter).toBeGreaterThanOrEqual(result.scoreBefore);
  });

  it("should gracefully fall back to local engine when GEMINI_API_KEY is not set", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await tailorResumeWithAiOption(mockMasterResume, mockJob, true);
      expect(result.engine).toBe("local");
      expect(result.scoreAfter).toBeGreaterThanOrEqual(result.scoreBefore);
    } finally {
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it("should support useAi payload in POST /api/jobs/:id/tailor and persist correctly", async () => {
    const app = createApp();
    const db = getDb();

    // Setup master profile & job
    await db.insert(masterProfilesTable).values({
      id: "master-ai-test",
      fullName: "Rodrigo Silva",
      headline: "Senior Software Engineer",
      email: "rodrigo@example.com",
      summary: "Engenheiro de Software com sólida vivência em microsserviços.",
      skills: JSON.stringify(["Node.js", "TypeScript", "AWS"]),
      experiences: JSON.stringify([
        {
          company: "TechFin",
          role: "Senior Backend Engineer",
          startDate: "2021",
          endDate: "Atual",
          description: "Arquitetei microsserviços em Node.js e TypeScript."
        }
      ]),
      education: JSON.stringify([
        { institution: "USP", degree: "Ciência da Computação", startDate: "2015", endDate: "2019" }
      ]),
      certifications: JSON.stringify([]),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await db.insert(jobsTable).values({
      id: "job-ai-1",
      title: "Senior Node.js Developer",
      company: "Acme",
      status: "SAVED",
      language: "pt",
      rawDescription: "Buscamos especialista em Node.js e TypeScript.",
      topKeywords: JSON.stringify([
        { term: "node.js", count: 3, tfidf: 3.1, stem: "node.js" },
        { term: "typescript", count: 3, tfidf: 2.9, stem: "typescript" }
      ]),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // 1. Tailor with useAi: false
    const resLocal = await app.request("/api/jobs/job-ai-1/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useAi: false })
    });
    expect(resLocal.status).toBe(200);
    const dataLocal = await resLocal.json();
    expect(dataLocal.engine).toBe("local");
    expect(dataLocal.scoreAfter).toBeGreaterThan(50);

    // 2. Tailor with useAi: true (falls back safely if no key, or runs AI)
    const resAi = await app.request("/api/jobs/job-ai-1/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useAi: true })
    });
    expect(resAi.status).toBe(200);
    const dataAi = await resAi.json();
    expect(["gemini", "local"]).toContain(dataAi.engine);

    // Verify DB persistence
    const saved = await db.select().from(tailoredResumesTable).where(eq(tailoredResumesTable.jobId, "job-ai-1")).limit(1);
    expect(saved.length).toBe(1);
    expect(saved[0].scoreAfter).toBeGreaterThan(50);
  });
});
