import { beforeEach, describe, expect, it } from "bun:test";
import { createApp } from "../src/api/routes.ts";
import { getDb, resetDbForTesting } from "../src/db/index.ts";
import { masterProfilesTable } from "../src/db/schema.ts";

describe("Hono REST API Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    resetDbForTesting();
    app = createApp();
  });

  it("should return healthy status and system config", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(typeof json.hasGeminiKey).toBe("boolean");

    const configRes = await app.request("/api/config");
    expect(configRes.status).toBe(200);
    const configJson = await configRes.json();
    expect(typeof configJson.hasGeminiKey).toBe("boolean");
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
            description: "Desenvolvimento de APIs de alta performance.",
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
        certifications: [],
      }),
    });
    expect(putRes.status).toBe(200);

    // 3. GET /api/profile should now return the saved profile
    const getRes2 = await app.request("/api/profile");
    const getJson2 = await getRes2.json();
    expect(getJson2.profile.fullName).toBe("Carlos Silva");

    // 4. POST /api/profile/reprocess should reprocess saved rawText
    const db = getDb();
    await db.update(masterProfilesTable).set({
      rawText:
        "Page 1 of 6\nCarlos Silva\nSenior Engineer\ncarlos@test.com\n\nResumo\nDev com 5 anos.\n\nExperiência\nTech Corp\nEngineer\n2021 - Atual\nCoding\n\nFormação acadêmica\nUSP\nCiência da Computação (2016 - 2020)",
    });

    const reprocessRes = await app.request("/api/profile/reprocess", {
      method: "POST",
    });
    expect(reprocessRes.status).toBe(200);
    const reprocessJson = await reprocessRes.json();
    expect(reprocessJson.success).toBe(true);
    expect(reprocessJson.profile.fullName).toBe("Carlos Silva");
    expect(JSON.stringify(reprocessJson.profile)).not.toContain("Page 1 of 6");
  });

  it("should create, list, and tailor a job", async () => {
    // Setup master profile first
    const db = getDb();
    await db.insert(masterProfilesTable).values({
      id: "master-default",
      fullName: "Carlos Silva",
      headline: "Senior Backend Engineer",
      email: "carlos@example.com",
      summary:
        "Senior Backend Engineer com 5 anos de experiência em Node.js e TypeScript.",
      skills: JSON.stringify(["Node.js", "TypeScript", "SQL"]),
      experiences: JSON.stringify([
        {
          company: "Tech",
          role: "Developer",
          startDate: "2021",
          endDate: "Atual",
          description: "Desenvolvimento de APIs em Node.js.",
        },
      ]),
      education: JSON.stringify([
        {
          institution: "USP",
          degree: "Ciência da Computação",
          startDate: "2016",
          endDate: "2020",
        },
      ]),
      certifications: JSON.stringify([]),
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
        rawDescription:
          "Vaga para Senior Backend Engineer com foco em Node.js, TypeScript e Docker.",
      }),
    });
    expect(postJobRes.status).toBe(201);
    const createdJob = await postJobRes.json();
    expect(createdJob.job.id).toBeDefined();
    expect(createdJob.job.topKeywords.length).toBeGreaterThan(0);

    const jobId = createdJob.job.id;

    // 2. POST /api/jobs/:id/tailor
    const tailorRes = await app.request(`/api/jobs/${jobId}/tailor`, {
      method: "POST",
    });
    expect(tailorRes.status).toBe(200);
    const tailorData = await tailorRes.json();
    expect(tailorData.scoreAfter).toBeGreaterThanOrEqual(
      tailorData.scoreBefore,
    );
    expect(tailorData.tailoredResume.headline).toContain(
      "Senior Backend Engineer",
    );

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

    // 5. GET /api/jobs/:id/download/txt
    const txtRes = await app.request(`/api/jobs/${jobId}/download/txt`);
    expect(txtRes.status).toBe(200);
    expect(txtRes.headers.get("Content-Type")).toContain("text/plain");
    const txtText = await txtRes.text();
    expect(txtText).toContain("CARLOS SILVA");
    expect(txtText).toContain("RESUMO PROFISSIONAL");
    expect(txtText).toContain("EXPERIÊNCIA PROFISSIONAL");

    // 6. GET /api/jobs/:id/download/md
    const mdRes = await app.request(`/api/jobs/${jobId}/download/md`);
    expect(mdRes.status).toBe(200);
    expect(mdRes.headers.get("Content-Type")).toContain("text/markdown");
    const mdText = await mdRes.text();
    expect(mdText).toContain("# Carlos Silva");
    expect(mdText).toContain("## Resumo Profissional");

    // 7. GET /api/jobs/:id/download/json
    const jsonRes = await app.request(`/api/jobs/${jobId}/download/json`);
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get("Content-Type")).toContain("application/json");
    const jsonResumeData = await jsonRes.json();
    expect(jsonResumeData.basics.name).toBe("Carlos Silva");
    expect(jsonResumeData.work.length).toBeGreaterThan(0);
  });

  it("should delete a job and its associated tailored resume and knockout questions", async () => {
    // 1. Create a job
    const createRes = await app.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Frontend Engineer",
        company: "Vercel",
        jobUrl: "https://vercel.com/jobs/fe",
        status: "SAVED",
        rawDescription: "Looking for a React and Next.js frontend engineer.",
      }),
    });
    expect(createRes.status).toBe(201);
    const { job } = await createRes.json();

    // 2. Add a knockout question
    const kqRes = await app.request(`/api/jobs/${job.id}/knockout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionText: "Você possui experiência com Next.js?",
      }),
    });
    expect(kqRes.status).toBe(201);

    // Verify job exists in GET /api/jobs
    const listRes = await app.request("/api/jobs");
    const listData = await listRes.json();
    expect(listData.jobs.some((j: { id: string }) => j.id === job.id)).toBe(
      true,
    );

    // 3. DELETE /api/jobs/:id
    const delRes = await app.request(`/api/jobs/${job.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);
    const delData = await delRes.json();
    expect(delData.success).toBe(true);

    // 4. Verify job is removed
    const listResAfter = await app.request("/api/jobs");
    const listDataAfter = await listResAfter.json();
    expect(
      listDataAfter.jobs.some((j: { id: string }) => j.id === job.id),
    ).toBe(false);

    // 5. Knockout questions should also be removed
    const kqListRes = await app.request(`/api/jobs/${job.id}/knockout`);
    const kqListData = await kqListRes.json();
    expect(kqListData.questions.length).toBe(0);
  });
});
