import { beforeEach, describe, expect, it } from "bun:test";
import { createApp } from "../src/api/routes.ts";
import { resetDbForTesting } from "../src/db/index.ts";
import { tailorResumeWithAiOption } from "../src/services/aiTailorService.ts";
import {
  checkClaudeAvailable,
  getClaudeApiKey,
  getClaudeModel,
  isClaudeConfigured,
} from "../src/services/claudeService.ts";
import { generateCoverLetter } from "../src/services/coverLetterService.ts";
import { generateKnockoutAnswerWithMeta } from "../src/services/knockoutAnswerService.ts";
import {
  checkOpenRouterAvailable,
  getOpenRouterApiKey,
  getOpenRouterModel,
  isOpenRouterConfigured,
} from "../src/services/openRouterService.ts";
import type { ResumeData } from "../src/types/resume.ts";

describe("OpenRouter & Anthropic Claude LLM Integration & Graceful Fallback", () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  const mockResume: ResumeData = {
    fullName: "Lucas Mendonça",
    headline: "Senior Cloud & Backend Engineer",
    email: "lucas@exemplo.com",
    summary:
      "Engenheiro de Software com 7 anos de experiência em arquitetura de microsserviços, TypeScript, Node.js e AWS.",
    skills: ["TypeScript", "Node.js", "AWS", "Docker", "PostgreSQL"],
    experiences: [
      {
        company: "TechScale",
        role: "Senior Backend Engineer",
        startDate: "2021",
        endDate: "Atual",
        description:
          "Liderança na migração para arquitetura orientada a eventos com aumento de 40% em throughput.",
      },
    ],
    education: [
      {
        institution: "USP",
        degree: "Bacharelado em Ciência da Computação",
        startDate: "2014",
        endDate: "2018",
      },
    ],
  };

  const mockJob = {
    title: "Senior Backend Engineer",
    company: "CloudCore",
    rawDescription:
      "Buscamos Senior Backend Engineer com domínio de TypeScript, Node.js e AWS.",
    keywords: [
      { term: "TypeScript", count: 4, tfidf: 1.3, stem: "typescript" },
      { term: "Node.js", count: 3, tfidf: 1.1, stem: "nodejs" },
      { term: "AWS", count: 3, tfidf: 1.0, stem: "aws" },
    ],
    language: "pt" as const,
  };

  it("should return default configurations for OpenRouter and Claude", () => {
    expect(getOpenRouterModel()).toBe("anthropic/claude-3.5-sonnet");
    expect(typeof isOpenRouterConfigured()).toBe("boolean");
    expect(typeof getOpenRouterApiKey()).toBe("string");

    expect(getClaudeModel()).toBe("claude-3-5-sonnet-20241022");
    expect(typeof isClaudeConfigured()).toBe("boolean");
    expect(typeof getClaudeApiKey()).toBe("string");
  });

  it("should check OpenRouter and Claude availability gracefully without throwing", async () => {
    const openRouterStatus = await checkOpenRouterAvailable();
    expect(openRouterStatus).toBeDefined();
    expect(typeof openRouterStatus.available).toBe("boolean");
    expect(typeof openRouterStatus.configured).toBe("boolean");
    expect(openRouterStatus.model).toBeDefined();

    const claudeStatus = await checkClaudeAvailable();
    expect(claudeStatus).toBeDefined();
    expect(typeof claudeStatus.available).toBe("boolean");
    expect(typeof claudeStatus.configured).toBe("boolean");
    expect(claudeStatus.model).toBeDefined();
  });

  it("should gracefully fallback to local 7-layer engine for resume tailoring with openrouter", async () => {
    const result = await tailorResumeWithAiOption(
      mockResume,
      mockJob,
      "openrouter",
    );
    expect(result).toBeDefined();
    expect(result.tailoredResume).toBeDefined();
    expect(result.scoreAfter).toBeGreaterThanOrEqual(result.scoreBefore);
    expect(["openrouter", "local"]).toContain(result.engine);
  });

  it("should gracefully fallback to local 7-layer engine for resume tailoring with claude", async () => {
    const result = await tailorResumeWithAiOption(
      mockResume,
      mockJob,
      "claude",
    );
    expect(result).toBeDefined();
    expect(result.tailoredResume).toBeDefined();
    expect(result.scoreAfter).toBeGreaterThanOrEqual(result.scoreBefore);
    expect(["claude", "local"]).toContain(result.engine);
  });

  it("should gracefully fallback for cover letter generation with openrouter and claude", async () => {
    const clOpenRouter = await generateCoverLetter({
      profile: mockResume,
      job: mockJob,
      tone: "Técnico & Direto",
      engine: "openrouter",
    });
    expect(clOpenRouter).toBeDefined();
    expect(clOpenRouter.content.length).toBeGreaterThan(100);
    expect(["openrouter", "local"]).toContain(clOpenRouter.engineUsed);

    const clClaude = await generateCoverLetter({
      profile: mockResume,
      job: mockJob,
      tone: "Executivo",
      engine: "claude",
    });
    expect(clClaude).toBeDefined();
    expect(clClaude.content.length).toBeGreaterThan(100);
    expect(["claude", "local"]).toContain(clClaude.engineUsed);
  });

  it("should gracefully fallback for knockout questions with openrouter and claude", async () => {
    const resOpenRouter = await generateKnockoutAnswerWithMeta({
      questionText: "Qual sua experiência prática com microsserviços?",
      job: {
        title: mockJob.title,
        company: mockJob.company,
        topKeywords: mockJob.keywords,
      },
      profile: mockResume,
      preferredEngine: "openrouter",
    });
    expect(resOpenRouter).toBeDefined();
    expect(resOpenRouter.answer.length).toBeGreaterThan(10);

    const resClaude = await generateKnockoutAnswerWithMeta({
      questionText: "Qual sua experiência com AWS e testes automatizados?",
      job: {
        title: mockJob.title,
        company: mockJob.company,
        topKeywords: mockJob.keywords,
      },
      profile: mockResume,
      preferredEngine: "claude",
    });
    expect(resClaude).toBeDefined();
    expect(resClaude.answer.length).toBeGreaterThan(10);
  });

  it("should expose OpenRouter and Claude status in /api/health and /api/config", async () => {
    const app = createApp();

    const configRes = await app.request("/api/config");
    expect(configRes.status).toBe(200);
    const configData = await configRes.json();
    expect(configData).toHaveProperty("hasOpenRouterKey");
    expect(configData).toHaveProperty("openrouter");
    expect(configData).toHaveProperty("hasClaudeKey");
    expect(configData).toHaveProperty("claude");

    const healthRes = await app.request("/api/health");
    expect(healthRes.status).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData).toHaveProperty("hasOpenRouterKey");
    expect(healthData).toHaveProperty("openrouter");
    expect(healthData).toHaveProperty("hasClaudeKey");
    expect(healthData).toHaveProperty("claude");
  });
});
