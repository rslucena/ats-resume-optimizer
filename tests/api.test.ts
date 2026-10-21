import { describe, expect, it, beforeEach } from "bun:test";
import { createApp } from "../src/api/routes.ts";
import { resetDbForTesting, getDb } from "../src/db/index.ts";
import { masterProfilesTable } from "../src/db/schema.ts";

describe("Hono REST API Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    resetDbForTesting();
    app = createApp();
  });

  it("should return healthy status", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
  });

  it("should handle master profile CRUD", async () => {
    // 1. Initial GET should return null or 404
    const getRes = await app.request("/api/profile");
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.profile).toBeNull();

    // 2. PUT /api/profile to save profile
    const putRes = await app.request("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Carlos Silva",
        headline: "Senior Backend Engineer",
        email: "carlos@example.com",
        phone: "+55 11 99999-9999",
        location: "São Paulo, SP",
        linkedin: "linkedin.com/in/carlossilva",
        summary: "Engenheiro de software experiente em Bun e Node.js.",
        skills: ["TypeScript", "Bun", "Node.js", "Docker"],
        experiences: [
          {
            company: "Tech Corp",
            role: "Backend Engineer",
            startDate: "2021",
            endDate: "Atual",
            description: "Desenvolvimento de APIs de alta performance."
          }
        ],
        education: [
          {
            institution: "USP",
            degree: "Bacharelado em Ciência da Computação",
            startDate: "2016",
            endDate: "2020"
          }
        ],
        certifications: []
      })
    });
    expect(putRes.status).toBe(200);

    // 3. GET /api/profile should now return the saved profile
    const getRes2 = await app.request("/api/profile");
    const getJson2 = await getRes2.json();
    expect(getJson2.profile.fullName).toBe("Carlos Silva");
  });

  it("should create, list, and tailor a job", async () => {
    // Setup master profile first
    const db = getDb();
    await db.insert(masterProfilesTable).values({
      id: "master-default",
      fullName: "Carlos Silva",
      headline: "Senior Backend Engineer",
      email: "carlos@example.com",
      summary: "Senior Backend Engineer com 5 anos de experiência em Node.js e TypeScript.",
      skills: JSON.stringify(["Node.js", "TypeScript", "SQL"]),
      experiences: JSON.stringify([
        {
          company: "Tech",
          role: "Developer",
          startDate: "2021",
          endDate: "Atual",
          description: "Desenvolvimento de APIs em Node.js."
        }
      ]),
      education: JSON.stringify([
        {
          institution: "USP",
          degree: "Ciência da Computação",
          startDate: "2016",
          endDate: "2020"
        }
      ]),
      certifications: JSON.stringify([]),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // 1. POST /api/jobs
    const postJobRes = await app.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Senior Backend Engineer",
        company: "Acme",
        jobUrl: "https://acme.com/job/1",
        status: "SAVED",
        rawDescription: "Vaga para Senior Backend Engineer com foco em Node.js, TypeScript e Docker."
      })
    });
    expect(postJobRes.status).toBe(201);
    const createdJob = await postJobRes.json();
    expect(createdJob.job.id).toBeDefined();
    expect(createdJob.job.topKeywords.length).toBeGreaterThan(0);

    const jobId = createdJob.job.id;

    // 2. POST /api/jobs/:id/tailor
    const tailorRes = await app.request(`/api/jobs/${jobId}/tailor`, {
      method: "POST"
    });
    expect(tailorRes.status).toBe(200);
    const tailorData = await tailorRes.json();
    expect(tailorData.scoreAfter).toBeGreaterThanOrEqual(tailorData.scoreBefore);
    expect(tailorData.tailoredResume.headline).toContain("Senior Backend Engineer");

    // 3. GET /api/jobs/:id/download/pdf
    const pdfRes = await app.request(`/api/jobs/${jobId}/download/pdf`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("Content-Type")).toBe("application/pdf");
    const pdfBlob = await pdfRes.arrayBuffer();
    expect(pdfBlob.byteLength).toBeGreaterThan(1000);

    // 4. GET /api/jobs/:id/download/docx
    const docxRes = await app.request(`/api/jobs/${jobId}/download/docx`);
    expect(docxRes.status).toBe(200);
    expect(docxRes.headers.get("Content-Type")).toContain("wordprocessingml");
    const docxBlob = await docxRes.arrayBuffer();
    expect(docxBlob.byteLength).toBeGreaterThan(1000);
  });
});
