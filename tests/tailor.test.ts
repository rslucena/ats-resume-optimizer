import { describe, expect, it } from "bun:test";
import type { ExtractedKeyword } from "../src/nlp/tfidf.ts";
import { tailorResume } from "../src/optimizer/tailor.ts";
import type { ResumeData } from "../src/types/resume.ts";

describe("7-Layer Algorithmic Resume Tailoring Engine", () => {
  const masterProfile: ResumeData = {
    fullName: "Carlos Silva",
    headline: "Desenvolvedor Backend",
    email: "carlos@example.com",
    phone: "+55 11 99999-9999",
    location: "São Paulo, SP",
    linkedin: "linkedin.com/in/carlossilva",
    summary:
      "Desenvolvedor backend trabalhando com desenvolvimento de sistemas e bancos de dados.",
    skills: ["JavaScript", "Node.js", "SQL", "Git"],
    experiences: [
      {
        company: "Tech Inovação",
        role: "Desenvolvedor Backend",
        startDate: "2021-01",
        endDate: "Atual",
        description: "Construção de APIs e manutenção de banco de dados.",
      },
    ],
    education: [
      {
        institution: "Universidade Federal",
        degree: "Ciência da Computação",
        startDate: "2016",
        endDate: "2020",
      },
    ],
    certifications: [],
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
      { term: "docker", tfidf: 2.2, count: 2, stem: "docker" },
    ] as ExtractedKeyword[],
    language: "pt" as const,
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
    expect(result.tailoredResume.education[0].degree).toMatch(
      /(Graduação completa|Bacharelado|Ensino Superior)/i,
    );

    // Layer 5: Summary flows organically without artificial "Core Stack & Especialidades" label
    expect(result.tailoredResume.summary).not.toContain(
      "Core Stack & Especialidades:",
    );
    expect(result.tailoredResume.summary).toContain("Node.js");
    expect(result.tailoredResume.summary).toContain("TypeScript");

    // Dates are formatted cleanly as Mês YYYY
    expect(firstExp.startDate).toBe("Jan 2021");

    // Layer 6: Document metadata is populated
    expect(result.metadata.title).toBe(jobInfo.title);
    expect(result.metadata.author).toBe(masterProfile.fullName);
    expect(result.metadata.keywords.length).toBeGreaterThan(0);
  });

  it("should NOT repeat artificial suffixes, should NOT inject executive lines into ancient roles, and should NOT contain Page markers", async () => {
    const profileWithAncientExp: ResumeData = {
      ...masterProfile,
      experiences: [
        {
          company: "Chamleo",
          role: "Principal Backend Engineer",
          startDate: "2020",
          endDate: "Atual",
          description:
            "Supervisão e desenvolvimento de plataforma de alta performance.\nRedução de latência em 70%.",
        },
        {
          company: "Mindworks Informática",
          role: "Web Developer",
          startDate: "2010",
          endDate: "2012",
          description: "Diagramação de layout e manutenção web.",
        },
      ],
      education: [
        {
          institution: "Universidad Europea del Atlántico",
          degree: "Máster en Software",
          startDate: "2023",
          endDate: "2025",
        },
        {
          institution: "Anhanguera",
          degree: "Ciência da Computação",
          startDate: "2011",
          endDate: "2014",
        },
      ],
    };

    const result = await tailorResume(profileWithAncientExp, jobInfo);

    // 1. No repetitive phrase spam
    const fullText = JSON.stringify(result.tailoredResume);
    expect(fullText).not.toContain("Utilização de ");
    expect(fullText).not.toMatch(/Page\s+\d+\s+of\s+\d+/i);

    // 2. Keywords woven naturally into existing bullets (no artificial labels)
    const exp0 = result.tailoredResume.experiences[0];
    const exp1 = result.tailoredResume.experiences[1];

    expect(exp0.description).not.toContain("Stack técnica & Práticas:");
    expect(exp0.description).not.toContain("Tecnologias e Práticas aplicadas:");
    expect(exp0.description).toContain("Node.js");
    expect(exp0.description).toContain("TypeScript");

    // Ancient experience (> 8 years ago) must remain clean without artificial tags
    expect(exp1.description).not.toContain("Stack técnica & Práticas:");
    expect(exp1.description).toContain(
      "Diagramação de layout e manutenção web.",
    );

    // 3. Education has clean single variation
    const edu0 = result.tailoredResume.education[0];
    const edu1 = result.tailoredResume.education[1];

    expect(edu0.degree).toContain("Pós-Graduação / Mestrado");
    expect(edu0.degree).not.toContain("Graduação completa / Bacharelado");

    expect(edu1.degree).toContain("Graduação completa / Bacharelado");
    expect(edu1.degree).not.toContain("Pós-Graduação / Mestrado");
  });

  it("should NEVER allow internal NLP engineering terms to leak into technical skills", async () => {
    const jobWithNlpTerms = {
      ...jobInfo,
      keywords: [
        { term: "node.js", tfidf: 4.2, count: 5, stem: "node.js" },
        { term: "tf-idf", tfidf: 3.9, count: 4, stem: "tfidf" },
        { term: "algoritmo", tfidf: 3.5, count: 3, stem: "algorit" },
        { term: "parser", tfidf: 3.2, count: 3, stem: "parse" },
        { term: "score", tfidf: 2.8, count: 2, stem: "scor" },
        { term: "typescript", tfidf: 2.5, count: 2, stem: "typescript" },
      ],
    };

    const profileWithNlpSkills: ResumeData = {
      ...masterProfile,
      skills: [
        "JavaScript",
        "Tf-idf",
        "Algoritmo",
        "Parser",
        "Score",
        "TypeScript",
      ],
    };

    const result = await tailorResume(profileWithNlpSkills, jobWithNlpTerms);

    const skillsLower = result.tailoredResume.skills.map((s) =>
      s.toLowerCase(),
    );
    expect(skillsLower).not.toContain("tf-idf");
    expect(skillsLower).not.toContain("tfidf");
    expect(skillsLower).not.toContain("algoritmo");
    expect(skillsLower).not.toContain("parser");
    expect(skillsLower).not.toContain("score");

    expect(skillsLower.some((s) => s.includes("typescript"))).toBe(true);
    expect(skillsLower.some((s) => s.includes("node.js"))).toBe(true);
  });
});
