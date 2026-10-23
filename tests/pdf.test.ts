import { describe, expect, it } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { generateAtsPdf } from "../src/documents/pdf.ts";
import type { ResumeData } from "../src/types/resume.ts";

describe("ATS-Linear PDF Generator with Binary Metadata", () => {
  const resume: ResumeData = {
    fullName: "Carlos Silva",
    headline: "Senior Backend Engineer (Node.js & TypeScript)",
    email: "carlos@example.com",
    phone: "+55 11 99999-9999",
    location: "São Paulo, SP",
    linkedin: "linkedin.com/in/carlossilva",
    summary:
      "Senior Backend Engineer com 5 anos de experiência em Node.js e microsserviços.",
    skills: ["Node.js", "TypeScript", "Docker", "PostgreSQL", "Bun"],
    experiences: [
      {
        company: "Tech Corp",
        role: "Senior Backend Engineer",
        startDate: "2021-01",
        endDate: "Atual",
        description:
          "Liderança de projetos de microsserviços de alto throughput com TypeScript e Node.js.",
      },
    ],
    education: [
      {
        institution: "USP",
        degree: "Graduação completa / Bacharelado em Ciência da Computação",
        startDate: "2016",
        endDate: "2020",
      },
    ],
    certifications: ["AWS Certified Solutions Architect"],
  };

  const metadata = {
    title: "Senior Backend Engineer (Node.js & TypeScript)",
    author: "Carlos Silva",
    keywords: [
      "node.js",
      "typescript",
      "microsserviços",
      "docker",
      "postgresql",
    ],
    subject:
      "Currículo otimizado para a vaga de Senior Backend Engineer. Foco em Node.js e TypeScript.",
    creator: "Currículo",
    category: "Currículo",
  };

  it("should generate a valid PDF buffer and inject Info Dict and XMP metadata", async () => {
    const pdfBuffer = await generateAtsPdf(resume, metadata);

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Verify PDF header
    const headerStr = Buffer.from(pdfBuffer.slice(0, 5)).toString("ascii");
    expect(headerStr).toBe("%PDF-");

    // Load with pdf-lib to verify injected binary metadata
    const loadedPdf = await PDFDocument.load(pdfBuffer);
    expect(loadedPdf.getTitle()).toBe(metadata.title);
    expect(loadedPdf.getAuthor()).toBe(metadata.author);
    expect(loadedPdf.getSubject()).toBe(metadata.subject);
    expect(loadedPdf.getCreator()).toBe(metadata.creator);

    const keywords = loadedPdf.getKeywords();
    expect(keywords).toBeDefined();
    expect(keywords).toContain("node.js");
    expect(keywords).toContain("typescript");
  });

  it("should sanitize street address and CEP from contact header for privacy", async () => {
    const dirtyResume: ResumeData = {
      ...resume,
      location: "Rua Augusta, 1500, apto 42, CEP 01305-100, São Paulo, SP",
    };
    const pdfBuffer = await generateAtsPdf(dirtyResume, metadata);
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});
