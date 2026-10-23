import { beforeEach, describe, expect, it } from "bun:test";
import { createApp } from "../src/api/routes.ts";
import { resetDbForTesting } from "../src/db/index.ts";
import { tailorResumeWithAiOption } from "../src/services/aiTailorService.ts";
import { generateKnockoutAnswerWithMeta } from "../src/services/knockoutAnswerService.ts";
import {
  checkOllamaAvailable,
  getOllamaBaseUrl,
  getOllamaModel,
} from "../src/services/ollamaService.ts";
import type { ResumeData } from "../src/types/resume.ts";

describe("Ollama Local LLM Integration & Graceful Offline Fallback", () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  const mockResume: ResumeData = {
    fullName: "Marina Santos",
    headline: "Engenheira de Software Full Stack",
    email: "marina@exemplo.com",
    summary:
      "Engenheira de Software com 5 anos de experiência prática em TypeScript, React e Node.js.",
    skills: ["TypeScript", "React", "Node.js", "Docker", "PostgreSQL"],
    experiences: [
      {
        company: "Inovação SA",
        role: "Software Engineer",
        startDate: "2022",
        endDate: "Atual",
        description:
          "Desenvolvimento de microsserviços em Node.js com aumento de 30% em throughput.",
      },
    ],
    education: [
      {
        institution: "UNICAMP",
        degree: "Bacharelado em Engenharia de Computação",
        startDate: "2017",
        endDate: "2021",
      },
    ],
  };

  const mockJob = {
    title: "Senior Full Stack Engineer",
    company: "ScaleTech",
    rawDescription:
      "Buscamos Senior Full Stack Engineer com domínio de TypeScript, React e Node.js.",
    keywords: [
      { term: "TypeScript", count: 3, tfidf: 1.2, stem: "typescript" },
      { term: "React", count: 3, tfidf: 1.1, stem: "react" },
      { term: "Node.js", count: 2, tfidf: 1.0, stem: "nodejs" },
    ],
    language: "pt" as const,
  };

  it("should return default base URL and model configuration", () => {
    const url = getOllamaBaseUrl();
    expect(url).toContain("http");
    const model = getOllamaModel();
    expect(model).toBeDefined();
    expect(typeof model).toBe("string");
  });

  it("should check Ollama availability gracefully without throwing even if offline", async () => {
    const status = await checkOllamaAvailable();
    expect(status).toBeDefined();
    expect(typeof status.available).toBe("boolean");
    expect(Array.isArray(status.models)).toBe(true);
    expect(status.selectedModel).toBeDefined();
  });

  it("should fallback gracefully to deterministic 7-layer engine when Ollama is offline or fails", async () => {
    const result = await tailorResumeWithAiOption(
      mockResume,
      mockJob,
      "ollama",
    );

    expect(result).toBeDefined();
    expect(result.tailoredResume).toBeDefined();
    expect(result.scoreAfter).toBeGreaterThanOrEqual(result.scoreBefore);
    // When offline, engine falls back to local
    expect(["ollama", "local"]).toContain(result.engine);
  });

  it("should fallback gracefully for knockout questions when Ollama is requested", async () => {
    const result = await generateKnockoutAnswerWithMeta({
      questionText: "Qual sua experiência prática com TypeScript e Node.js?",
      job: {
        title: mockJob.title,
        company: mockJob.company,
        topKeywords: mockJob.keywords,
      },
      profile: mockResume,
      preferredEngine: "ollama",
    });

    expect(result).toBeDefined();
    expect(result.answer.length).toBeGreaterThan(30);
    expect(["ollama", "heuristic"]).toContain(result.source);
  });

  it("should expose Ollama status in /api/health and /api/config", async () => {
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ollama).toBeDefined();
    expect(typeof data.ollama.available).toBe("boolean");

    const configRes = await app.request("/api/config");
    expect(configRes.status).toBe(200);
    const configData = await configRes.json();
    expect(configData.ollama).toBeDefined();
  });
});
