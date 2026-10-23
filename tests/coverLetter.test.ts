import { beforeEach, describe, expect, it } from "bun:test";
import { createApp } from "../src/api/routes.ts";
import { getDb, resetDbForTesting } from "../src/db/index.ts";
import { masterProfilesTable } from "../src/db/schema.ts";
import { generateCoverLetterDocx } from "../src/documents/coverLetterDocx.ts";
import { generateCoverLetterPdf } from "../src/documents/coverLetterPdf.ts";
import { generateDeterministicCoverLetter } from "../src/services/coverLetterService.ts";
import type { ResumeData } from "../src/types/resume.ts";

describe("Cover Letter Studio (Gerador de Carta de Apresentação)", () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  const mockProfile: ResumeData = {
    fullName: "Rodrigo Silva",
    headline: "Engenheiro de Software Sênior",
    email: "rodrigo.silva@exemplo.com",
    phone: "(11) 98765-4321",
    location: "São Paulo, SP",
    summary:
      "Engenheiro de Software com 7 anos de experiência sólida em TypeScript, Node.js e microsserviços.",
    skills: ["TypeScript", "Node.js", "Docker", "PostgreSQL", "Kafka", "AWS"],
    experiences: [
      {
        company: "Tech Global Labs",
        role: "Senior Software Engineer",
        startDate: "2021",
        endDate: "Atual",
        description:
          "Liderou arquitetura de microsserviços em Node.js e TypeScript com redução de 40% na latência.",
      },
    ],
    education: [
      {
        institution: "USP",
        degree: "Bacharelado em Ciência da Computação",
        startDate: "2016",
        endDate: "2020",
      },
    ],
  };

  const mockJob = {
    title: "Senior Backend Developer",
    company: "Fintech Inovadora",
    rawDescription:
      "Buscamos Senior Backend Developer com forte vivência em Node.js, TypeScript e Kafka.",
    topKeywords: [
      { term: "Node.js", count: 4 },
      { term: "TypeScript", count: 3 },
      { term: "Kafka", count: 2 },
      { term: "PostgreSQL", count: 2 },
    ],
    language: "pt",
  };

  it("should generate deterministic cover letter in PT-BR with zero hallucinations", () => {
    const letter = generateDeterministicCoverLetter(
      mockProfile,
      mockJob,
      "Técnico & Direto",
      false,
    );

    expect(letter).toContain("Fintech Inovadora");
    expect(letter).toContain("Senior Backend Developer");
    expect(letter).toContain("Rodrigo Silva");
    expect(letter).toContain("Tech Global Labs");
    expect(letter).toContain("Node.js");
    expect(letter).toContain("TypeScript");
    expect(letter).toContain("rodrigo.silva@exemplo.com");
  });

  it("should generate deterministic cover letter in English when job is in English", () => {
    const enJob = {
      ...mockJob,
      title: "Staff Platform Engineer",
      company: "CloudScale Inc",
      language: "en",
    };

    const letter = generateDeterministicCoverLetter(
      mockProfile,
      enJob,
      "Executivo",
      true,
    );

    expect(letter).toContain("Dear CloudScale Inc Hiring Team");
    expect(letter).toContain("Staff Platform Engineer");
    expect(letter).toContain("Rodrigo Silva");
    expect(letter).toContain("Tech Global Labs");
    expect(letter).toContain("Sincerely,");
  });

  it("should generate distinctly different content for each tone and handle lowercase strings", () => {
    const tecnico = generateDeterministicCoverLetter(
      mockProfile,
      mockJob,
      "tecnico",
      false,
    );
    const executivo = generateDeterministicCoverLetter(
      mockProfile,
      mockJob,
      "executivo",
      false,
    );
    const entusiasta = generateDeterministicCoverLetter(
      mockProfile,
      mockJob,
      "entusiasta",
      false,
    );

    // Ensure all 3 letters are completely distinct
    expect(tecnico).not.toBe(executivo);
    expect(executivo).not.toBe(entusiasta);
    expect(tecnico).not.toBe(entusiasta);

    // Verify key tone-specific language
    expect(tecnico).toContain("excelência técnica");
    expect(executivo).toContain("liderança de tecnologia");
    expect(entusiasta).toContain("entusiasmo");
  });

  it("should generate valid PDF buffer for cover letter with metadata", async () => {
    const letterText = generateDeterministicCoverLetter(
      mockProfile,
      mockJob,
      "Técnico & Direto",
      false,
    );

    const pdfBytes = await generateCoverLetterPdf({
      profile: mockProfile,
      content: letterText,
      metadata: {
        title: "Carta de Apresentação — Senior Backend Developer",
        author: mockProfile.fullName,
        subject: "Candidatura",
        keywords: ["TypeScript", "Node.js"],
        creator: "ATS Resume Optimizer",
      },
    });

    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(1000);
    // PDF Magic bytes %PDF-
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8");
    expect(header).toBe("%PDF-");
  });

  it("should generate valid DOCX buffer with openXML properties", async () => {
    const letterText = generateDeterministicCoverLetter(
      mockProfile,
      mockJob,
      "Técnico & Direto",
      false,
    );

    const docxBuffer = await generateCoverLetterDocx({
      profile: mockProfile,
      content: letterText,
      metadata: {
        title: "Carta de Apresentação",
        author: mockProfile.fullName,
        subject: "Candidatura",
        keywords: ["TypeScript", "Node.js"],
        creator: "ATS Resume Optimizer",
      },
    });

    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.length).toBeGreaterThan(2000);
    // DOCX is a zip archive starting with PK\x03\x04
    expect(docxBuffer[0]).toBe(0x50);
    expect(docxBuffer[1]).toBe(0x4b);
  });

  it("should retrieve, regenerate, and edit cover letters via REST API", async () => {
    const app = createApp();
    const db = getDb();

    // Setup master profile
    await db.insert(masterProfilesTable).values({
      id: "master-default",
      fullName: mockProfile.fullName,
      headline: mockProfile.headline,
      email: mockProfile.email,
      phone: mockProfile.phone,
      location: mockProfile.location,
      summary: mockProfile.summary,
      skills: JSON.stringify(mockProfile.skills),
      experiences: JSON.stringify(mockProfile.experiences),
      education: JSON.stringify(mockProfile.education),
      certifications: JSON.stringify([]),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create a job
    const createJobRes = await app.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: mockJob.title,
        company: mockJob.company,
        rawDescription: mockJob.rawDescription,
        status: "SAVED",
      }),
    });
    const { job } = await createJobRes.json();
    expect(job?.id).toBeDefined();

    // 1. GET auto-generates cover letter if none exists
    const getRes = await app.request(`/api/jobs/${job.id}/cover-letter`);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.coverLetter).toBeDefined();
    expect(getData.coverLetter.content).toContain(mockJob.company);

    // 2. POST regenerate with executive tone
    const genRes = await app.request(
      `/api/jobs/${job.id}/cover-letter/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone: "Executivo",
          engine: "local",
        }),
      },
    );
    expect(genRes.status).toBe(200);
    const genData = await genRes.json();
    expect(genData.coverLetter.tone).toBe("Executivo");
    expect(genData.coverLetter.content).toContain(mockJob.company);

    // 3. PUT manual edit
    const customText =
      "Texto de carta de apresentação customizado manualmente pelo candidato.";
    const putRes = await app.request(`/api/jobs/${job.id}/cover-letter`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: customText,
      }),
    });
    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.coverLetter.content).toBe(customText);

    // 4. Download routes
    const pdfRes = await app.request(
      `/api/jobs/${job.id}/download/cover-letter/pdf`,
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("Content-Type")).toBe("application/pdf");

    const docxRes = await app.request(
      `/api/jobs/${job.id}/download/cover-letter/docx`,
    );
    expect(docxRes.status).toBe(200);
    expect(docxRes.headers.get("Content-Type")).toContain("wordprocessingml");

    const txtRes = await app.request(
      `/api/jobs/${job.id}/download/cover-letter/txt`,
    );
    expect(txtRes.status).toBe(200);
    const txtBody = await txtRes.text();
    expect(txtBody).toBe(customText);
  });
});
