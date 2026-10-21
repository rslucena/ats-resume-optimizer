import { describe, expect, it } from "bun:test";
import { tailorResume } from "../src/optimizer/tailor.ts";
import type { ResumeData } from "../src/types/resume.ts";
import type { ExtractedKeyword } from "../src/nlp/tfidf.ts";

describe("7-Layer Algorithmic Resume Tailoring Engine", () => {
  const masterProfile: ResumeData = {
    fullName: "Carlos Silva",
    headline: "Desenvolvedor Backend",
    email: "carlos@example.com",
    phone: "+55 11 99999-9999",
    location: "São Paulo, SP",
    linkedin: "linkedin.com/in/carlossilva",
    summary: "Desenvolvedor backend trabalhando com desenvolvimento de sistemas e bancos de dados.",
    skills: ["JavaScript", "Node.js", "SQL", "Git"],
    experiences: [
      {
        company: "Tech Inovação",
        role: "Desenvolvedor Backend",
        startDate: "2021-01",
        endDate: "Atual",
        description: "Construção de APIs e manutenção de banco de dados."
      }
    ],
    education: [
      {
        institution: "Universidade Federal",
        degree: "Ciência da Computação",
        startDate: "2016",
        endDate: "2020"
      }
    ],
    certifications: []
  };

  const jobInfo = {
    title: "Senior Backend Engineer (Node.js & TypeScript)",
    company: "Fintech Global",
    rawDescription: `
      Estamos buscando Senior Backend Engineer para liderar o desenvolvimento de microsserviços escaláveis.
      Requisitos fundamentais:
      - 5 anos de experiência com Node.js e TypeScript
      - Microsserviços e mensageria
      - Docker, Kubernetes e CI/CD
      - Banco de dados PostgreSQL e alta performance
      - Graduação completa em Ciência da Computação ou áreas afins
    `,
    keywords: [
      { term: "node.js", tfidf: 4.2, count: 5, stem: "node.js" },
      { term: "typescript", tfidf: 3.8, count: 4, stem: "typescript" },
      { term: "microsserviços", tfidf: 3.1, count: 3, stem: "microsserviç" },
      { term: "postgresql", tfidf: 2.5, count: 2, stem: "postgresql" },
      { term: "docker", tfidf: 2.2, count: 2, stem: "docker" }
    ] as ExtractedKeyword[],
    language: "pt" as const
  };

  it("should apply all 7 layers and significantly increase ATS score", async () => {
    const result = await tailorResume(masterProfile, jobInfo);

    // Score comparison
    expect(result.scoreAfter).toBeGreaterThan(result.scoreBefore);
    expect(result.scoreAfter).toBeGreaterThanOrEqual(80);

    // Layer 1 & 2: Headline matches target job title
    expect(result.tailoredResume.headline).toContain(jobInfo.title);

    // Layer 2: First Line Rule in experience
    const firstExp = result.tailoredResume.experiences[0];
    expect(firstExp.description).toBeDefined();
    const firstLine = firstExp.description.split("\n")[0];
    expect(firstLine).toContain("Node.js");
    expect(firstLine).toContain("TypeScript");

    // Layer 3: Elimination shield (regex entity variations)
    expect(result.tailoredResume.summary).toMatch(/(anos|meses)/i);
    expect(result.tailoredResume.education[0].degree).toMatch(/(Graduação completa|Bacharelado|Ensino Superior)/i);

    // Layer 5: Regex window boundary bleed line at end of Summary
    expect(result.tailoredResume.summary).toContain("Core Stack & Especialidades:");

    // Layer 6: Document metadata is populated
    expect(result.metadata.title).toBe(jobInfo.title);
    expect(result.metadata.author).toBe(masterProfile.fullName);
    expect(result.metadata.keywords.length).toBeGreaterThan(0);
  });
});
