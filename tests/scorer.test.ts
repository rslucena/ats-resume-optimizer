import { describe, expect, it } from "bun:test";
import { auditAtsScore } from "../src/optimizer/scorer.ts";
import type { ExtractedKeyword } from "../src/nlp/tfidf.ts";
import type { ResumeData } from "../src/types/resume.ts";

describe("ATS Score Auditor", () => {
  const sampleKeywords: ExtractedKeyword[] = [
    { term: "node.js", tfidf: 3.5, count: 4, stem: "node.js" },
    { term: "typescript", tfidf: 3.2, count: 4, stem: "typescript" },
    { term: "microsserviços", tfidf: 2.5, count: 3, stem: "microsserviç" },
    { term: "docker", tfidf: 2.1, count: 2, stem: "docker" },
    { term: "postgresql", tfidf: 1.8, count: 2, stem: "postgresql" }
  ];

  it("should score a basic/unoptimized resume lower than an optimized one", () => {
    const rawResume: ResumeData = {
      fullName: "Carlos Silva",
      headline: "Desenvolvedor",
      email: "carlos@example.com",
      phone: "11999999999",
      location: "São Paulo, SP",
      linkedin: "linkedin.com/in/carlossilva",
      summary: "Profissional buscando novas oportunidades na área de TI.",
      skills: ["Java", "SQL"],
      experiences: [
        {
          company: "Empresa Antiga",
          role: "Programador",
          startDate: "2020",
          endDate: "2022",
          description: "Manutenção de sistemas legados e suporte a usuários."
        }
      ],
      education: [
        {
          institution: "Faculdade X",
          degree: "Ciência da Computação",
          startDate: "2016",
          endDate: "2020"
        }
      ],
      certifications: []
    };

    const auditRaw = auditAtsScore(rawResume, sampleKeywords, "pt");

    expect(auditRaw.overallScore).toBeLessThan(60);
    expect(auditRaw.missingKeywords.length).toBeGreaterThan(0);
    expect(auditRaw.breakdown.keywords).toBeLessThan(15);
  });

  it("should score an ATS-optimized resume high (85-100) with full keyword breakdown", () => {
    const optimizedResume: ResumeData = {
      fullName: "Carlos Silva",
      headline: "Senior Backend Engineer (Node.js & TypeScript)",
      email: "carlos@example.com",
      phone: "+55 11 99999-9999",
      location: "São Paulo, SP",
      linkedin: "linkedin.com/in/carlossilva",
      summary: "Senior Backend Engineer com 5 anos de experiência (60+ meses de atuação sólida desde 2021) especializado em Node.js (NodeJS), TypeScript (TS), microsserviços e PostgreSQL. Foco em arquiteturas escaláveis com Docker e microsserviços.",
      skills: ["Node.js", "TypeScript", "Microsserviços", "Docker", "PostgreSQL", "Bun", "CI/CD"],
      experiences: [
        {
          company: "Tech Corp",
          role: "Senior Backend Engineer (Node.js & TypeScript)",
          startDate: "2021-01",
          endDate: "Atual",
          description: "Atuação como Senior Backend Engineer entregando microsserviços de alto throughput com Node.js, TypeScript e PostgreSQL, reduzindo latência em 40% com Docker."
        }
      ],
      education: [
        {
          institution: "Universidade de São Paulo",
          degree: "Graduação completa / Bacharelado / Ensino Superior em Ciência da Computação",
          startDate: "2016",
          endDate: "2020"
        }
      ],
      certifications: ["AWS Certified Solutions Architect"]
    };

    const auditOptimized = auditAtsScore(optimizedResume, sampleKeywords, "pt");

    expect(auditOptimized.overallScore).toBeGreaterThanOrEqual(80);
    expect(auditOptimized.breakdown.formatting).toBeGreaterThanOrEqual(25);
    expect(auditOptimized.breakdown.keywords).toBeGreaterThanOrEqual(25);
    expect(auditOptimized.breakdown.entityCompliance).toBeGreaterThanOrEqual(10);
    expect(auditOptimized.matchedKeywords.length).toBeGreaterThanOrEqual(4);
  });
});
