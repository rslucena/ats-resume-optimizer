import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDb } from "../db/index.ts";
import { masterProfilesTable, jobsTable, tailoredResumesTable } from "../db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { detectLanguage } from "../nlp/language.ts";
import { extractKeywords } from "../nlp/tfidf.ts";
import { tailorResume } from "../optimizer/tailor.ts";
import { auditAtsScore } from "../optimizer/scorer.ts";
import { generateAtsPdf } from "../documents/pdf.ts";
import { generateAtsDocx } from "../documents/docx.ts";
import { extractTextFromPdf, parseMasterProfileText } from "../services/cvExtractor.ts";
import { scrapeJobUrl } from "../services/jobScraper.ts";
import type { ResumeData } from "../types/resume.ts";

export function createApp() {
  const app = new Hono();

  app.use("*", cors());

  // Healthcheck
  app.get("/api/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

  // 1. Master Profile GET
  app.get("/api/profile", async (c) => {
    const db = getDb();
    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) {
      return c.json({ profile: null });
    }

    const p = profiles[0];
    const structured: ResumeData = {
      fullName: p.fullName,
      headline: p.headline,
      email: p.email,
      phone: p.phone || undefined,
      location: p.location || undefined,
      linkedin: p.linkedin || undefined,
      github: p.github || undefined,
      portfolio: p.portfolio || undefined,
      summary: p.summary,
      skills: JSON.parse(p.skills || "[]"),
      experiences: JSON.parse(p.experiences || "[]"),
      education: JSON.parse(p.education || "[]"),
      certifications: JSON.parse(p.certifications || "[]"),
      rawText: p.rawText || undefined
    };

    return c.json({ profile: structured, id: p.id });
  });

  // 2. Master Profile PUT
  app.put("/api/profile", async (c) => {
    const db = getDb();
    const body = await c.req.json<ResumeData>();

    const existing = await db.select().from(masterProfilesTable).limit(1);
    const profileId = existing.length > 0 ? existing[0].id : "master-default";

    const dataToSave = {
      id: profileId,
      fullName: body.fullName || "Nome do Candidato",
      headline: body.headline || "Desenvolvedor de Software",
      email: body.email || "candidato@email.com",
      phone: body.phone || null,
      location: body.location || null,
      linkedin: body.linkedin || null,
      github: body.github || null,
      portfolio: body.portfolio || null,
      summary: body.summary || "",
      skills: JSON.stringify(body.skills || []),
      experiences: JSON.stringify(body.experiences || []),
      education: JSON.stringify(body.education || []),
      certifications: JSON.stringify(body.certifications || []),
      rawText: body.rawText || null,
      updatedAt: Date.now()
    };

    if (existing.length > 0) {
      await db.update(masterProfilesTable).set(dataToSave).where(eq(masterProfilesTable.id, profileId));
    } else {
      await db.insert(masterProfilesTable).values({
        ...dataToSave,
        createdAt: Date.now()
      });
    }

    return c.json({ success: true, profile: body });
  });

  // 3. Master Profile PDF Upload
  app.post("/api/profile/upload", async (c) => {
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return c.json({ error: "Nenhum arquivo PDF fornecido" }, 400);
    }

    const arrayBuffer = await (file as Blob).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const rawText = await extractTextFromPdf(buffer);
    const parsedProfile = parseMasterProfileText(rawText);

    const db = getDb();
    const existing = await db.select().from(masterProfilesTable).limit(1);
    const profileId = existing.length > 0 ? existing[0].id : "master-default";

    const dataToSave = {
      id: profileId,
      fullName: parsedProfile.fullName,
      headline: parsedProfile.headline,
      email: parsedProfile.email,
      phone: parsedProfile.phone || null,
      location: parsedProfile.location || null,
      linkedin: parsedProfile.linkedin || null,
      github: parsedProfile.github || null,
      portfolio: parsedProfile.portfolio || null,
      summary: parsedProfile.summary,
      skills: JSON.stringify(parsedProfile.skills),
      experiences: JSON.stringify(parsedProfile.experiences),
      education: JSON.stringify(parsedProfile.education),
      certifications: JSON.stringify(parsedProfile.certifications || []),
      rawText,
      updatedAt: Date.now()
    };

    if (existing.length > 0) {
      await db.update(masterProfilesTable).set(dataToSave).where(eq(masterProfilesTable.id, profileId));
    } else {
      await db.insert(masterProfilesTable).values({
        ...dataToSave,
        createdAt: Date.now()
      });
    }

    return c.json({ success: true, profile: parsedProfile });
  });

  // 4. Jobs List GET
  app.get("/api/jobs", async (c) => {
    const db = getDb();
    const jobs = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt));

    const enriched = await Promise.all(
      jobs.map(async (job) => {
        const tailored = await db
          .select()
          .from(tailoredResumesTable)
          .where(eq(tailoredResumesTable.jobId, job.id))
          .limit(1);

        return {
          ...job,
          topKeywords: JSON.parse(job.topKeywords || "[]"),
          tailored: tailored.length > 0 ? {
            id: tailored[0].id,
            scoreBefore: tailored[0].scoreBefore,
            scoreAfter: tailored[0].scoreAfter,
            tailoredTitle: tailored[0].tailoredTitle,
            updatedAt: tailored[0].updatedAt
          } : null
        };
      })
    );

    return c.json({ jobs: enriched });
  });

  // 5. Job Create POST
  app.post("/api/jobs", async (c) => {
    const body = await c.req.json<{
      title: string;
      company: string;
      jobUrl?: string;
      status?: "SAVED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED";
      rawDescription: string;
      notes?: string;
    }>();

    if (!body.title || !body.rawDescription) {
      return c.json({ error: "Título e descrição da vaga são obrigatórios" }, 400);
    }

    const lang = detectLanguage(body.rawDescription);
    const keywords = extractKeywords(body.rawDescription, { lang, topN: 15 });

    const newJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: body.title,
      company: body.company || "Empresa Confidencial",
      jobUrl: body.jobUrl || null,
      status: body.status || "SAVED",
      language: lang,
      rawDescription: body.rawDescription,
      topKeywords: JSON.stringify(keywords),
      notes: body.notes || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const db = getDb();
    await db.insert(jobsTable).values(newJob);

    return c.json({
      success: true,
      job: {
        ...newJob,
        topKeywords: keywords
      }
    }, 201);
  });

  // 6. Job Update PUT
  app.put("/api/jobs/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<Partial<typeof jobsTable.$inferInsert>>();

    const db = getDb();
    const existing = await db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Vaga não encontrada" }, 404);
    }

    let topKeywordsStr = existing[0].topKeywords;
    let language = existing[0].language;

    if (body.rawDescription && body.rawDescription !== existing[0].rawDescription) {
      language = detectLanguage(body.rawDescription);
      const keywords = extractKeywords(body.rawDescription, { lang: language as any, topN: 15 });
      topKeywordsStr = JSON.stringify(keywords);
    }

    await db.update(jobsTable).set({
      ...body,
      language,
      topKeywords: topKeywordsStr,
      updatedAt: Date.now()
    }).where(eq(jobsTable.id, id));

    return c.json({ success: true });
  });

  // 7. Job Delete DELETE
  app.delete("/api/jobs/:id", async (c) => {
    const id = c.req.param("id");
    const db = getDb();
    await db.delete(jobsTable).where(eq(jobsTable.id, id));
    return c.json({ success: true });
  });

  // 8. Extract Job from URL POST
  app.post("/api/jobs/extract-url", async (c) => {
    const { url } = await c.req.json<{ url: string }>();
    if (!url) {
      return c.json({ error: "URL não fornecida" }, 400);
    }

    try {
      const scraped = await scrapeJobUrl(url);
      const lang = detectLanguage(scraped.description);
      const keywords = extractKeywords(scraped.description, { lang, topN: 15 });

      return c.json({
        title: scraped.title,
        company: scraped.company,
        description: scraped.description,
        language: lang,
        keywords
      });
    } catch (err: any) {
      return c.json({
        error: err.message || "Erro ao raspar URL. Por favor, cole a descrição manualmente.",
        fallbackNeeded: true
      }, 422);
    }
  });

  // 9. Tailor Job Resume POST
  app.post("/api/jobs/:id/tailor", async (c) => {
    const id = c.req.param("id");
    const db = getDb();

    // Fetch Job
    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
    if (jobs.length === 0) return c.json({ error: "Vaga não encontrada" }, 404);
    const job = jobs[0];

    // Fetch Master Profile
    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) {
      return c.json({ error: "Cadastre seu currículo base antes de personalizar." }, 400);
    }
    const p = profiles[0];

    const masterResume: ResumeData = {
      fullName: p.fullName,
      headline: p.headline,
      email: p.email,
      phone: p.phone || undefined,
      location: p.location || undefined,
      linkedin: p.linkedin || undefined,
      github: p.github || undefined,
      portfolio: p.portfolio || undefined,
      summary: p.summary,
      skills: JSON.parse(p.skills || "[]"),
      experiences: JSON.parse(p.experiences || "[]"),
      education: JSON.parse(p.education || "[]"),
      certifications: JSON.parse(p.certifications || "[]"),
      rawText: p.rawText || undefined
    };

    const keywords = JSON.parse(job.topKeywords || "[]");

    // Run 7-layer optimization
    const tailored = await tailorResume(masterResume, {
      title: job.title,
      company: job.company,
      rawDescription: job.rawDescription,
      keywords,
      language: job.language as any
    });

    // Save in DB
    const existingTailored = await db
      .select()
      .from(tailoredResumesTable)
      .where(eq(tailoredResumesTable.jobId, job.id))
      .limit(1);

    const dataToSave = {
      id: existingTailored.length > 0 ? existingTailored[0].id : `tailored-${Date.now()}`,
      jobId: job.id,
      tailoredTitle: tailored.tailoredResume.headline,
      tailoredSummary: tailored.tailoredResume.summary,
      tailoredSkills: JSON.stringify(tailored.tailoredResume.skills),
      tailoredExperiences: JSON.stringify(tailored.tailoredResume.experiences),
      tailoredEducation: JSON.stringify(tailored.tailoredResume.education),
      scoreBefore: tailored.scoreBefore,
      scoreAfter: tailored.scoreAfter,
      keywordsAchieved: JSON.stringify(tailored.auditAfter.matchedKeywords),
      keywordsMissing: JSON.stringify(tailored.auditAfter.missingKeywords),
      updatedAt: Date.now()
    };

    if (existingTailored.length > 0) {
      await db.update(tailoredResumesTable).set(dataToSave).where(eq(tailoredResumesTable.id, dataToSave.id));
    } else {
      await db.insert(tailoredResumesTable).values({
        ...dataToSave,
        createdAt: Date.now()
      });
    }

    return c.json(tailored);
  });

  // 10. Update Tailored Resume Text PUT (Inline editor)
  app.put("/api/jobs/:id/tailor", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{
      tailoredResume: ResumeData;
    }>();

    const db = getDb();
    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
    if (jobs.length === 0) return c.json({ error: "Vaga não encontrada" }, 404);
    const job = jobs[0];

    const keywords = JSON.parse(job.topKeywords || "[]");
    const audit = auditAtsScore(body.tailoredResume, keywords, job.language as any);

    const existing = await db.select().from(tailoredResumesTable).where(eq(tailoredResumesTable.jobId, id)).limit(1);
    if (existing.length > 0) {
      await db.update(tailoredResumesTable).set({
        tailoredTitle: body.tailoredResume.headline,
        tailoredSummary: body.tailoredResume.summary,
        tailoredSkills: JSON.stringify(body.tailoredResume.skills),
        tailoredExperiences: JSON.stringify(body.tailoredResume.experiences),
        tailoredEducation: JSON.stringify(body.tailoredResume.education),
        scoreAfter: audit.overallScore,
        keywordsAchieved: JSON.stringify(audit.matchedKeywords),
        keywordsMissing: JSON.stringify(audit.missingKeywords),
        updatedAt: Date.now()
      }).where(eq(tailoredResumesTable.id, existing[0].id));
    }

    return c.json({ success: true, scoreAfter: audit.overallScore, auditAfter: audit });
  });

  // 11. Download Tailored PDF
  app.get("/api/jobs/:id/download/pdf", async (c) => {
    const id = c.req.param("id");
    const db = getDb();

    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
    if (jobs.length === 0) return c.text("Vaga não encontrada", 404);
    const job = jobs[0];

    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) return c.text("Perfil não encontrado", 404);
    const p = profiles[0];

    const tailoredList = await db.select().from(tailoredResumesTable).where(eq(tailoredResumesTable.jobId, id)).limit(1);

    let resumeToRender: ResumeData;
    if (tailoredList.length > 0) {
      const t = tailoredList[0];
      resumeToRender = {
        fullName: p.fullName,
        headline: t.tailoredTitle,
        email: p.email,
        phone: p.phone || undefined,
        location: p.location || undefined,
        linkedin: p.linkedin || undefined,
        github: p.github || undefined,
        portfolio: p.portfolio || undefined,
        summary: t.tailoredSummary,
        skills: JSON.parse(t.tailoredSkills),
        experiences: JSON.parse(t.tailoredExperiences),
        education: JSON.parse(t.tailoredEducation),
        certifications: JSON.parse(p.certifications || "[]")
      };
    } else {
      // Tailor now
      const keywords = JSON.parse(job.topKeywords || "[]");
      const baseResume: ResumeData = {
        fullName: p.fullName,
        headline: p.headline,
        email: p.email,
        phone: p.phone || undefined,
        location: p.location || undefined,
        linkedin: p.linkedin || undefined,
        github: p.github || undefined,
        portfolio: p.portfolio || undefined,
        summary: p.summary,
        skills: JSON.parse(p.skills || "[]"),
        experiences: JSON.parse(p.experiences || "[]"),
        education: JSON.parse(p.education || "[]"),
        certifications: JSON.parse(p.certifications || "[]")
      };
      const tailoredResult = await tailorResume(baseResume, {
        title: job.title,
        company: job.company,
        rawDescription: job.rawDescription,
        keywords,
        language: job.language as any
      });
      resumeToRender = tailoredResult.tailoredResume;
    }

    const keywords = JSON.parse(job.topKeywords || "[]");
    const metadata = {
      title: job.title,
      author: p.fullName,
      keywords: keywords.map((k: any) => k.term),
      subject: `Currículo otimizado para ${job.title} na ${job.company}`,
      creator: "Currículo",
      category: "Currículo"
    };

    const pdfBytes = await generateAtsPdf(resumeToRender, metadata);
    const sanitizedName = p.fullName.replace(/\s+/g, "_");

    return new Response(pdfBytes as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizedName}_Curriculo_ATS.pdf"`
      }
    });
  });

  // 12. Download Tailored DOCX
  app.get("/api/jobs/:id/download/docx", async (c) => {
    const id = c.req.param("id");
    const db = getDb();

    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
    if (jobs.length === 0) return c.text("Vaga não encontrada", 404);
    const job = jobs[0];

    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) return c.text("Perfil não encontrado", 404);
    const p = profiles[0];

    const tailoredList = await db.select().from(tailoredResumesTable).where(eq(tailoredResumesTable.jobId, id)).limit(1);

    let resumeToRender: ResumeData;
    if (tailoredList.length > 0) {
      const t = tailoredList[0];
      resumeToRender = {
        fullName: p.fullName,
        headline: t.tailoredTitle,
        email: p.email,
        phone: p.phone || undefined,
        location: p.location || undefined,
        linkedin: p.linkedin || undefined,
        github: p.github || undefined,
        portfolio: p.portfolio || undefined,
        summary: t.tailoredSummary,
        skills: JSON.parse(t.tailoredSkills),
        experiences: JSON.parse(t.tailoredExperiences),
        education: JSON.parse(t.tailoredEducation),
        certifications: JSON.parse(p.certifications || "[]")
      };
    } else {
      const keywords = JSON.parse(job.topKeywords || "[]");
      const baseResume: ResumeData = {
        fullName: p.fullName,
        headline: p.headline,
        email: p.email,
        phone: p.phone || undefined,
        location: p.location || undefined,
        linkedin: p.linkedin || undefined,
        github: p.github || undefined,
        portfolio: p.portfolio || undefined,
        summary: p.summary,
        skills: JSON.parse(p.skills || "[]"),
        experiences: JSON.parse(p.experiences || "[]"),
        education: JSON.parse(p.education || "[]"),
        certifications: JSON.parse(p.certifications || "[]")
      };
      const tailoredResult = await tailorResume(baseResume, {
        title: job.title,
        company: job.company,
        rawDescription: job.rawDescription,
        keywords,
        language: job.language as any
      });
      resumeToRender = tailoredResult.tailoredResume;
    }

    const keywords = JSON.parse(job.topKeywords || "[]");
    const metadata = {
      title: job.title,
      author: p.fullName,
      keywords: keywords.map((k: any) => k.term),
      subject: `Currículo otimizado para ${job.title} na ${job.company}`,
      creator: "Currículo",
      category: "Currículo"
    };

    const docxBuffer = await generateAtsDocx(resumeToRender, metadata);
    const sanitizedName = p.fullName.replace(/\s+/g, "_");

    return new Response(docxBuffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${sanitizedName}_Curriculo_ATS.docx"`
      }
    });
  });

  return app;
}
