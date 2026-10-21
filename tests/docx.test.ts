import { describe, expect, it } from "bun:test";
import { generateAtsDocx } from "../src/documents/docx.ts";
import type { ResumeData } from "../src/types/resume.ts";

describe("ATS Word (.docx) Generator with OpenXML coreProperties", () => {
  const resume: ResumeData = {
    fullName: "Carlos Silva",
    headline: "Senior Backend Engineer (Node.js & TypeScript)",
    email: "carlos@example.com",
    phone: "+55 11 99999-9999",
    location: "São Paulo, SP",
    linkedin: "linkedin.com/in/carlossilva",
    summary: "Senior Backend Engineer com 5 anos de experiência (60+ meses de atuação sólida).",
    skills: ["Node.js (NodeJS)", "TypeScript (TS)", "Docker", "PostgreSQL", "Bun"],
    experiences: [
      {
        company: "Tech Corp",
        role: "Senior Backend Engineer",
        startDate: "2021-01",
        endDate: "Atual",
        description: "• Atuação executiva como Senior Backend Engineer entregando microsserviços."
      }
    ],
    education: [
      {
        institution: "Universidade de São Paulo",
        degree: "Graduação completa / Bacharelado em Ciência da Computação",
        startDate: "2016",
        endDate: "2020"
      }
    ],
    certifications: ["AWS Certified Solutions Architect"]
  };

  const metadata = {
    title: "Senior Backend Engineer (Node.js & TypeScript)",
    author: "Carlos Silva",
    keywords: ["node.js", "typescript", "microsserviços", "docker", "postgresql"],
    subject: "Currículo otimizado para a vaga de Senior Backend Engineer.",
    creator: "Currículo",
    category: "Currículo"
  };

  it("should generate a valid DOCX buffer with openXML coreProperties", async () => {
    const docxBuffer = await generateAtsDocx(resume, metadata);

    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.length).toBeGreaterThan(1000);

    // Verify OpenXML / ZIP magic number PK\x03\x04
    expect(docxBuffer[0]).toBe(0x50); // P
    expect(docxBuffer[1]).toBe(0x4b); // K
    expect(docxBuffer[2]).toBe(0x03);
    expect(docxBuffer[3]).toBe(0x04);
  });
});
