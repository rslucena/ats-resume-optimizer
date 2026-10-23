import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { getDb } from "../db/index.ts";
import {
  coverLettersTable,
  jobsTable,
  knockoutQuestionsTable,
  masterProfilesTable,
  tailoredResumesTable,
} from "../db/schema.ts";
import { generateCoverLetterDocx } from "../documents/coverLetterDocx.ts";
import { generateCoverLetterPdf } from "../documents/coverLetterPdf.ts";
import { generateAtsDocx } from "../documents/docx.ts";
import { generateJsonResume } from "../documents/jsonResume.ts";
import { generateAtsMarkdown } from "../documents/markdown.ts";
import { generateAtsPdf } from "../documents/pdf.ts";
import { generateAtsPlainText } from "../documents/txt.ts";
import { detectLanguage, type SupportedLanguage } from "../nlp/language.ts";
import { extractKeywords } from "../nlp/tfidf.ts";
import { auditAtsScore } from "../optimizer/scorer.ts";
import { deduplicateSummary, tailorResume } from "../optimizer/tailor.ts";
import {
  type TailorEngine,
  tailorResumeWithAiOption,
} from "../services/aiTailorService.ts";
import {
  checkClaudeAvailable,
  isClaudeConfigured,
} from "../services/claudeService.ts";
import {
  type CoverLetterEngine,
  type CoverLetterTone,
  generateCoverLetter,
  normalizeCoverLetterTone,
} from "../services/coverLetterService.ts";
import {
  extractTextFromPdf,
  parseMasterProfileText,
} from "../services/cvExtractor.ts";
import { scrapeJobUrl } from "../services/jobScraper.ts";
import { generateKnockoutAnswerWithMeta } from "../services/knockoutAnswerService.ts";
import { checkOllamaAvailable } from "../services/ollamaService.ts";
import {
  checkOpenRouterAvailable,
  isOpenRouterConfigured,
} from "../services/openRouterService.ts";
import type { ExperienceItem, ResumeData } from "../types/resume.ts";
import {
  sanitizeResumeUtf8,
  sanitizeUtf8,
  stripJobBoilerplate,
} from "../utils/encoding.ts";
import { getEnvKey } from "../utils/env.ts";

export function createApp() {
  const app = new Hono();

  app.use("*", cors());

  // Healthcheck & System Config
  app.get("/api/health", async (c) => {
    const [ollama, openrouter, claude] = await Promise.all([
      checkOllamaAvailable(),
      checkOpenRouterAvailable(),
      checkClaudeAvailable(),
    ]);
    return c.json({
      status: "ok",
      hasGeminiKey: !!getEnvKey("GEMINI_API_KEY"),
      hasOpenRouterKey: isOpenRouterConfigured(),
      openrouter,
      hasClaudeKey: isClaudeConfigured(),
      claude,
      ollama,
      timestamp: Date.now(),
    });
  });

  app.get("/api/config", async (c) => {
    const [ollama, openrouter, claude] = await Promise.all([
      checkOllamaAvailable(),
      checkOpenRouterAvailable(),
      checkClaudeAvailable(),
    ]);
    return c.json({
      hasGeminiKey: !!getEnvKey("GEMINI_API_KEY"),
      hasOpenRouterKey: isOpenRouterConfigured(),
      openrouter,
      hasClaudeKey: isClaudeConfigured(),
      claude,
      ollama,
    });
  });

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
      rawText: p.rawText || undefined,
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
      rawText:
        body.rawText !== undefined
          ? body.rawText
          : existing.length > 0
            ? existing[0].rawText
            : null,
      updatedAt: Date.now(),
    };

    if (existing.length > 0) {
      await db
        .update(masterProfilesTable)
        .set(dataToSave)
        .where(eq(masterProfilesTable.id, profileId));
    } else {
      await db.insert(masterProfilesTable).values({
        ...dataToSave,
        createdAt: Date.now(),
      });
    }

    return c.json({ success: true, profile: body });
  });

  // 3. Master Profile PDF Upload
  app.post(
    "/api/profile/upload",
    bodyLimit({
      maxSize: 10 * 1024 * 1024, // 10MB
      onError: (c) =>
        c.json({ error: "Arquivo PDF excede o limite de 10MB." }, 413),
    }),
    async (c) => {
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
        updatedAt: Date.now(),
      };

      if (existing.length > 0) {
        await db
          .update(masterProfilesTable)
          .set(dataToSave)
          .where(eq(masterProfilesTable.id, profileId));
      } else {
        await db.insert(masterProfilesTable).values({
          ...dataToSave,
          createdAt: Date.now(),
        });
      }

      return c.json({ success: true, profile: parsedProfile });
    },
  );

  // 3.1. Master Profile Reprocess (Re-runs clean parser on stored rawText)
  app.post("/api/profile/reprocess", async (c) => {
    const db = getDb();
    const existing = await db.select().from(masterProfilesTable).limit(1);
    if (existing.length === 0) {
      return c.json(
        { error: "Nenhum Master CV cadastrado para reprocessar" },
        404,
      );
    }

    const current = existing[0];
    const rawText = current.rawText;
    if (!rawText || rawText.trim().length === 0) {
      return c.json(
        {
          error:
            "Texto original do CV não encontrado no banco de dados. Faça upload do PDF novamente.",
        },
        400,
      );
    }

    const parsedProfile = parseMasterProfileText(rawText);

    const dataToSave = {
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
      updatedAt: Date.now(),
    };

    await db
      .update(masterProfilesTable)
      .set(dataToSave)
      .where(eq(masterProfilesTable.id, current.id));

    return c.json({ success: true, profile: parsedProfile });
  });

  // 4. Jobs List GET
  app.get("/api/jobs", async (c) => {
    const db = getDb();
    const jobs = await db
      .select()
      .from(jobsTable)
      .orderBy(desc(jobsTable.createdAt));

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
          tailored:
            tailored.length > 0
              ? {
                  id: tailored[0].id,
                  scoreBefore: tailored[0].scoreBefore,
                  scoreAfter: tailored[0].scoreAfter,
                  tailoredTitle: tailored[0].tailoredTitle,
                  updatedAt: tailored[0].updatedAt,
                }
              : null,
        };
      }),
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
      return c.json(
        { error: "Título e descrição da vaga são obrigatórios" },
        400,
      );
    }

    const cleanDesc = stripJobBoilerplate(sanitizeUtf8(body.rawDescription));
    const cleanTitle = sanitizeUtf8(body.title);
    const cleanCompany = sanitizeUtf8(body.company || "Empresa Confidencial");
    const lang = detectLanguage(cleanDesc);
    const keywords = extractKeywords(cleanDesc, { lang, topN: 15 });

    const newJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: cleanTitle,
      company: cleanCompany,
      jobUrl: body.jobUrl || null,
      status: body.status || "SAVED",
      language: lang,
      rawDescription: cleanDesc,
      topKeywords: JSON.stringify(keywords),
      notes: body.notes ? sanitizeUtf8(body.notes) : null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const db = getDb();
    await db.insert(jobsTable).values(newJob);

    return c.json(
      {
        success: true,
        job: {
          ...newJob,
          topKeywords: keywords,
        },
      },
      201,
    );
  });

  // 6. Job Update PUT
  app.put("/api/jobs/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<Partial<typeof jobsTable.$inferInsert>>();

    const db = getDb();
    const existing = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, id))
      .limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Vaga não encontrada" }, 404);
    }

    let topKeywordsStr = existing[0].topKeywords;
    let language: SupportedLanguage =
      (existing[0].language as SupportedLanguage) || "pt";

    if (body.rawDescription !== undefined) {
      const cleanDesc = stripJobBoilerplate(
        sanitizeUtf8(body.rawDescription || ""),
      );
      language = detectLanguage(cleanDesc);
      const keywords = extractKeywords(cleanDesc, {
        lang: language,
        topN: 15,
      });
      topKeywordsStr = JSON.stringify(keywords);
      body.rawDescription = cleanDesc;
    }

    if (body.title) body.title = sanitizeUtf8(body.title);
    if (body.company) body.company = sanitizeUtf8(body.company);

    await db
      .update(jobsTable)
      .set({
        ...body,
        language,
        topKeywords: topKeywordsStr,
        updatedAt: Date.now(),
      })
      .where(eq(jobsTable.id, id));

    return c.json({ success: true });
  });

  // 7. Job Delete DELETE
  app.delete("/api/jobs/:id", async (c) => {
    const id = c.req.param("id");
    const db = getDb();
    await db.delete(coverLettersTable).where(eq(coverLettersTable.jobId, id));
    await db
      .delete(knockoutQuestionsTable)
      .where(eq(knockoutQuestionsTable.jobId, id));
    await db
      .delete(tailoredResumesTable)
      .where(eq(tailoredResumesTable.jobId, id));
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
        keywords,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao raspar URL. Por favor, cole a descrição manualmente.";
      return c.json(
        {
          error:
            message ||
            "Erro ao raspar URL. Por favor, cole a descrição manualmente.",
          fallbackNeeded: true,
        },
        422,
      );
    }
  });

  // 9. Tailor Job Resume POST
  app.post("/api/jobs/:id/tailor", async (c) => {
    const id = c.req.param("id");
    const db = getDb();

    // Fetch Job
    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, id))
      .limit(1);
    if (jobs.length === 0) return c.json({ error: "Vaga não encontrada" }, 404);
    const job = jobs[0];

    // Fetch Master Profile
    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) {
      return c.json(
        { error: "Cadastre seu currículo base antes de personalizar." },
        400,
      );
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
      rawText: p.rawText || undefined,
    };

    const keywords = JSON.parse(job.topKeywords || "[]");

    let engineChoice: TailorEngine = "local";
    try {
      const body = await c.req.json();
      if (body) {
        if (typeof body.engine === "string") {
          engineChoice = body.engine as TailorEngine;
        } else if (body.useAi === true) {
          engineChoice = "gemini";
        }
      }
    } catch {}

    // Run optimization (Gemini, Ollama or local deterministic 7-layer engine)
    const tailored = await tailorResumeWithAiOption(
      masterResume,
      {
        title: job.title,
        company: job.company,
        rawDescription: job.rawDescription,
        keywords,
        language: (job.language as SupportedLanguage) || "pt",
      },
      engineChoice,
    );

    // Save in DB
    const existingTailored = await db
      .select()
      .from(tailoredResumesTable)
      .where(eq(tailoredResumesTable.jobId, job.id))
      .limit(1);

    const dataToSave = {
      id:
        existingTailored.length > 0
          ? existingTailored[0].id
          : `tailored-${Date.now()}`,
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
      updatedAt: Date.now(),
    };

    if (existingTailored.length > 0) {
      await db
        .update(tailoredResumesTable)
        .set(dataToSave)
        .where(eq(tailoredResumesTable.id, dataToSave.id));
    } else {
      await db.insert(tailoredResumesTable).values({
        ...dataToSave,
        createdAt: Date.now(),
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
    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, id))
      .limit(1);
    if (jobs.length === 0) return c.json({ error: "Vaga não encontrada" }, 404);
    const job = jobs[0];

    const sanitizedResume = sanitizeResumeUtf8({
      ...body.tailoredResume,
      summary: deduplicateSummary(body.tailoredResume.summary || ""),
    });

    const keywords = JSON.parse(job.topKeywords || "[]");
    const audit = auditAtsScore(
      sanitizedResume,
      keywords,
      (job.language as SupportedLanguage) || "pt",
    );

    const existing = await db
      .select()
      .from(tailoredResumesTable)
      .where(eq(tailoredResumesTable.jobId, id))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(tailoredResumesTable)
        .set({
          tailoredTitle: sanitizedResume.headline,
          tailoredSummary: sanitizedResume.summary,
          tailoredSkills: JSON.stringify(sanitizedResume.skills),
          tailoredExperiences: JSON.stringify(sanitizedResume.experiences),
          tailoredEducation: JSON.stringify(sanitizedResume.education),
          scoreAfter: audit.overallScore,
          keywordsAchieved: JSON.stringify(audit.matchedKeywords),
          keywordsMissing: JSON.stringify(audit.missingKeywords),
          updatedAt: Date.now(),
        })
        .where(eq(tailoredResumesTable.id, existing[0].id));
    }

    return c.json({
      success: true,
      scoreAfter: audit.overallScore,
      auditAfter: audit,
    });
  });

  // 11. Knockout Questions GET
  app.get("/api/jobs/:id/knockout", async (c) => {
    const jobId = c.req.param("id");
    const db = getDb();
    const questions = await db
      .select()
      .from(knockoutQuestionsTable)
      .where(eq(knockoutQuestionsTable.jobId, jobId))
      .orderBy(knockoutQuestionsTable.createdAt);
    return c.json({ questions });
  });

  // 12. Knockout Questions POST
  app.post("/api/jobs/:id/knockout", async (c) => {
    const jobId = c.req.param("id");
    const body = await c.req.json<{ questionText: string }>();
    if (!body.questionText?.trim()) {
      return c.json({ error: "O texto da pergunta é obrigatório" }, 400);
    }
    const db = getDb();
    const newId = `kq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newRow = {
      id: newId,
      jobId,
      questionText: body.questionText.trim(),
      candidateAnswer: null,
      aiSuggestedAnswer: null,
      status: "Pendente",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.insert(knockoutQuestionsTable).values(newRow);
    return c.json({ success: true, question: newRow }, 201);
  });

  // 13. Knockout Questions PUT
  app.put("/api/jobs/:id/knockout/:qid", async (c) => {
    const qid = c.req.param("qid");
    const body =
      await c.req.json<Partial<typeof knockoutQuestionsTable.$inferInsert>>();
    const db = getDb();
    const existing = await db
      .select()
      .from(knockoutQuestionsTable)
      .where(eq(knockoutQuestionsTable.id, qid))
      .limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Pergunta não encontrada" }, 404);
    }
    await db
      .update(knockoutQuestionsTable)
      .set({
        ...body,
        updatedAt: Date.now(),
      })
      .where(eq(knockoutQuestionsTable.id, qid));
    const updated = await db
      .select()
      .from(knockoutQuestionsTable)
      .where(eq(knockoutQuestionsTable.id, qid))
      .limit(1);
    return c.json({ success: true, question: updated[0] });
  });

  // 14. Knockout Questions DELETE
  app.delete("/api/jobs/:id/knockout/:qid", async (c) => {
    const qid = c.req.param("qid");
    const db = getDb();
    await db
      .delete(knockoutQuestionsTable)
      .where(eq(knockoutQuestionsTable.id, qid));
    return c.json({ success: true });
  });

  // 15. Knockout Questions Generate Answer POST
  app.post("/api/jobs/:id/knockout/:qid/generate", async (c) => {
    const jobId = c.req.param("id");
    const qid = c.req.param("qid");
    const db = getDb();

    const qList = await db
      .select()
      .from(knockoutQuestionsTable)
      .where(eq(knockoutQuestionsTable.id, qid))
      .limit(1);
    if (qList.length === 0)
      return c.json({ error: "Pergunta não encontrada" }, 404);
    const question = qList[0];

    const jList = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (jList.length === 0)
      return c.json({ error: "Vaga não encontrada" }, 404);
    const job = jList[0];

    const pList = await db.select().from(masterProfilesTable).limit(1);
    if (pList.length === 0)
      return c.json({ error: "Master CV não encontrado" }, 400);
    const p = pList[0];

    const masterProfile: ResumeData = {
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
    };

    const keywords = JSON.parse(job.topKeywords || "[]");

    let preferredEngine:
      | "gemini"
      | "ollama"
      | "openrouter"
      | "claude"
      | "openai"
      | "local"
      | "heuristic"
      | undefined;
    try {
      const body = await c.req.json().catch(() => ({}));
      if (body?.engine) {
        preferredEngine = body.engine;
      }
    } catch {}

    const genResult = await generateKnockoutAnswerWithMeta({
      questionText: question.questionText,
      job: {
        title: job.title,
        company: job.company,
        rawDescription: job.rawDescription,
        topKeywords: keywords,
        language: job.language,
      },
      profile: masterProfile,
      preferredEngine,
    });

    const finalAnswer = genResult.answer;

    await db
      .update(knockoutQuestionsTable)
      .set({
        aiSuggestedAnswer: finalAnswer,
        candidateAnswer: finalAnswer,
        updatedAt: Date.now(),
      })
      .where(eq(knockoutQuestionsTable.id, qid));

    const updated = await db
      .select()
      .from(knockoutQuestionsTable)
      .where(eq(knockoutQuestionsTable.id, qid))
      .limit(1);

    return c.json({
      success: true,
      question: updated[0],
      engineSource: genResult.source,
    });
  });

  // Helper to build robust RFC 5987 UTF-8 Content-Disposition
  function buildContentDisposition(rawFilename: string): string {
    const cleanFilename = sanitizeUtf8(rawFilename);
    const asciiFallback = cleanFilename
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "_");
    const encoded = encodeURIComponent(cleanFilename);
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
  }

  // Helper to resolve tailored resume data cleanly
  async function resolveResumeForExport(jobId: string): Promise<{
    resume: ResumeData;
    job: typeof jobsTable.$inferSelect;
    profile: typeof masterProfilesTable.$inferSelect;
  } | null> {
    const db = getDb();
    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (jobs.length === 0) return null;
    const job = jobs[0];

    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) return null;
    const p = profiles[0];

    const tailoredList = await db
      .select()
      .from(tailoredResumesTable)
      .where(eq(tailoredResumesTable.jobId, jobId))
      .limit(1);

    let resumeToRender: ResumeData;
    if (tailoredList.length > 0) {
      const t = tailoredList[0];
      const cleanSummary = deduplicateSummary(
        (t.tailoredSummary || "")
          .replace(/\n*Core Stack & Especialidades:.*$/is, "")
          .replace(/\n*Core Stack & Specialties:.*$/is, "")
          .trim(),
      );

      const rawExps = JSON.parse(
        t.tailoredExperiences || "[]",
      ) as ExperienceItem[];
      const cleanExperiences = rawExps.map((exp: ExperienceItem) => ({
        ...exp,
        description: (exp.description || "")
          .split("\n")
          .filter(
            (l: string) =>
              !l.toLowerCase().includes("stack técnica & práticas") &&
              !l.toLowerCase().includes("tecnologias e práticas aplicadas") &&
              !l.toLowerCase().includes("core stack &"),
          )
          .join("\n"),
      }));

      resumeToRender = sanitizeResumeUtf8({
        fullName: p.fullName,
        headline: t.tailoredTitle,
        email: p.email,
        phone: p.phone || undefined,
        location: p.location || undefined,
        linkedin: p.linkedin || undefined,
        github: p.github || undefined,
        portfolio: p.portfolio || undefined,
        summary: cleanSummary,
        skills: JSON.parse(t.tailoredSkills),
        experiences: cleanExperiences,
        education: JSON.parse(t.tailoredEducation),
        certifications: JSON.parse(p.certifications || "[]"),
      });
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
        certifications: JSON.parse(p.certifications || "[]"),
      };
      const tailoredResult = await tailorResume(baseResume, {
        title: job.title,
        company: job.company,
        rawDescription: job.rawDescription,
        keywords,
        language: (job.language as SupportedLanguage) || "pt",
      });
      resumeToRender = sanitizeResumeUtf8(tailoredResult.tailoredResume);
    }

    return { resume: resumeToRender, job, profile: p };
  }

  // 11. Download Tailored DOCX (Word - OpenXML ATS Recomendado ⭐)
  app.get("/api/jobs/:id/download/docx", async (c) => {
    const id = c.req.param("id");
    const data = await resolveResumeForExport(id);
    if (!data) return c.text("Vaga ou perfil não encontrado", 404);

    const { resume, job, profile } = data;
    const keywords = JSON.parse(job.topKeywords || "[]");
    const metadata = {
      title: job.title,
      author: profile.fullName,
      keywords: keywords.map((k: { term: string }) => k.term),
      subject: `Currículo otimizado para ${job.title} na ${job.company}`,
      creator: "Currículo",
      category: "Currículo",
    };

    const docxBuffer = await generateAtsDocx(resume, metadata);
    const sanitizedName = sanitizeUtf8(profile.fullName).replace(/\s+/g, "_");

    return new Response(docxBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": buildContentDisposition(
          `${sanitizedName}_Curriculo_ATS.docx`,
        ),
      },
    });
  });

  // 12. Download Tailored PDF (Linear com Metadados XMP)
  app.get("/api/jobs/:id/download/pdf", async (c) => {
    const id = c.req.param("id");
    const data = await resolveResumeForExport(id);
    if (!data) return c.text("Vaga ou perfil não encontrado", 404);

    const { resume, job, profile } = data;
    const keywords = JSON.parse(job.topKeywords || "[]");
    const metadata = {
      title: job.title,
      author: profile.fullName,
      keywords: keywords.map((k: { term: string }) => k.term),
      subject: `Currículo otimizado para ${job.title} na ${job.company}`,
      creator: "Currículo",
      category: "Currículo",
    };

    const pdfBytes = await generateAtsPdf(resume, metadata);
    const sanitizedName = sanitizeUtf8(profile.fullName).replace(/\s+/g, "_");

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(
          `${sanitizedName}_Curriculo_ATS.pdf`,
        ),
      },
    });
  });

  // 13. Download Tailored Plain Text (.txt UTF-8)
  app.get("/api/jobs/:id/download/txt", async (c) => {
    const id = c.req.param("id");
    const data = await resolveResumeForExport(id);
    if (!data) return c.text("Vaga ou perfil não encontrado", 404);

    const { resume, profile } = data;
    const txtContent = generateAtsPlainText(resume);
    const sanitizedName = sanitizeUtf8(profile.fullName).replace(/\s+/g, "_");

    return new Response(txtContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": buildContentDisposition(
          `${sanitizedName}_Curriculo_ATS.txt`,
        ),
      },
    });
  });

  // 14. Download Tailored Markdown (.md)
  app.get("/api/jobs/:id/download/md", async (c) => {
    const id = c.req.param("id");
    const data = await resolveResumeForExport(id);
    if (!data) return c.text("Vaga ou perfil não encontrado", 404);

    const { resume, profile } = data;
    const mdContent = generateAtsMarkdown(resume);
    const sanitizedName = sanitizeUtf8(profile.fullName).replace(/\s+/g, "_");

    return new Response(mdContent, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": buildContentDisposition(
          `${sanitizedName}_Curriculo_ATS.md`,
        ),
      },
    });
  });

  // 15. Download Tailored JSON Resume (.json)
  app.get("/api/jobs/:id/download/json", async (c) => {
    const id = c.req.param("id");
    const data = await resolveResumeForExport(id);
    if (!data) return c.text("Vaga ou perfil não encontrado", 404);

    const { resume, profile } = data;
    const jsonResumeObj = generateJsonResume(resume);
    const sanitizedName = sanitizeUtf8(profile.fullName).replace(/\s+/g, "_");

    return new Response(JSON.stringify(jsonResumeObj, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": buildContentDisposition(
          `${sanitizedName}_Curriculo_ATS.json`,
        ),
      },
    });
  });

  // =========================================================================
  // COVER LETTER STUDIO ENDPOINTS
  // =========================================================================

  // 16. Cover Letter GET (Retrieve or auto-create)
  app.get("/api/jobs/:id/cover-letter", async (c) => {
    const jobId = c.req.param("id");
    const db = getDb();

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (jobs.length === 0) return c.json({ error: "Vaga não encontrada" }, 404);
    const job = jobs[0];

    const existing = await db
      .select()
      .from(coverLettersTable)
      .where(eq(coverLettersTable.jobId, jobId))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ coverLetter: existing[0] });
    }

    // Auto-generate initial cover letter if master profile exists
    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) {
      return c.json({ coverLetter: null });
    }
    const p = profiles[0];
    const masterProfile: ResumeData = {
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
    };

    const keywords = JSON.parse(job.topKeywords || "[]");
    const generated = await generateCoverLetter({
      profile: masterProfile,
      job: {
        title: job.title,
        company: job.company,
        rawDescription: job.rawDescription,
        topKeywords: keywords,
        language: job.language,
      },
      tone: "Técnico & Direto",
      engine: "local",
    });

    const newRecord = {
      id: `cl-${Date.now()}`,
      jobId,
      content: generated.content,
      tone: "Técnico & Direto",
      engine: generated.engineUsed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.insert(coverLettersTable).values(newRecord);
    return c.json({ coverLetter: newRecord });
  });

  // 17. Cover Letter Generate/Regenerate POST
  app.post("/api/jobs/:id/cover-letter/generate", async (c) => {
    const jobId = c.req.param("id");
    const db = getDb();

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (jobs.length === 0) return c.json({ error: "Vaga não encontrada" }, 404);
    const job = jobs[0];

    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) {
      return c.json({ error: "Master CV não encontrado" }, 400);
    }
    const p = profiles[0];
    const masterProfile: ResumeData = {
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
    };

    let tone: CoverLetterTone = "Técnico & Direto";
    let engine: CoverLetterEngine = "local";
    try {
      const body = await c.req.json().catch(() => ({}));
      if (body?.tone) tone = normalizeCoverLetterTone(body.tone);
      if (body?.engine) engine = body.engine;
    } catch {}

    const keywords = JSON.parse(job.topKeywords || "[]");
    const result = await generateCoverLetter({
      profile: masterProfile,
      job: {
        title: job.title,
        company: job.company,
        rawDescription: job.rawDescription,
        topKeywords: keywords,
        language: job.language,
      },
      tone,
      engine,
    });

    const existing = await db
      .select()
      .from(coverLettersTable)
      .where(eq(coverLettersTable.jobId, jobId))
      .limit(1);

    const now = Date.now();
    let savedLetter: typeof coverLettersTable.$inferSelect;

    if (existing.length > 0) {
      await db
        .update(coverLettersTable)
        .set({
          content: result.content,
          tone,
          engine: result.engineUsed,
          updatedAt: now,
        })
        .where(eq(coverLettersTable.id, existing[0].id));
      savedLetter = {
        ...existing[0],
        content: result.content,
        tone,
        engine: result.engineUsed,
        updatedAt: now,
      };
    } else {
      savedLetter = {
        id: `cl-${now}`,
        jobId,
        content: result.content,
        tone,
        engine: result.engineUsed,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(coverLettersTable).values(savedLetter);
    }

    return c.json({
      success: true,
      coverLetter: savedLetter,
      engineUsed: result.engineUsed,
    });
  });

  // 18. Cover Letter Save/Edit PUT
  app.put("/api/jobs/:id/cover-letter", async (c) => {
    const jobId = c.req.param("id");
    const db = getDb();
    const body = await c.req.json<{
      content: string;
      tone?: string;
    }>();

    if (!body || typeof body.content !== "string") {
      return c.json({ error: "Conteúdo da carta inválido" }, 400);
    }

    const existing = await db
      .select()
      .from(coverLettersTable)
      .where(eq(coverLettersTable.jobId, jobId))
      .limit(1);

    const now = Date.now();
    if (existing.length > 0) {
      await db
        .update(coverLettersTable)
        .set({
          content: sanitizeUtf8(body.content),
          tone: body.tone
            ? normalizeCoverLetterTone(body.tone)
            : existing[0].tone,
          updatedAt: now,
        })
        .where(eq(coverLettersTable.id, existing[0].id));
    } else {
      await db.insert(coverLettersTable).values({
        id: `cl-${now}`,
        jobId,
        content: sanitizeUtf8(body.content),
        tone: normalizeCoverLetterTone(body.tone),
        engine: "local",
        createdAt: now,
        updatedAt: now,
      });
    }

    const updated = await db
      .select()
      .from(coverLettersTable)
      .where(eq(coverLettersTable.jobId, jobId))
      .limit(1);

    return c.json({ success: true, coverLetter: updated[0] });
  });

  // 19. Download Cover Letter PDF
  app.get("/api/jobs/:id/download/cover-letter/pdf", async (c) => {
    const jobId = c.req.param("id");
    const db = getDb();

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (jobs.length === 0) return c.text("Vaga não encontrada", 404);
    const job = jobs[0];

    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) return c.text("Perfil não encontrado", 404);
    const p = profiles[0];

    const masterProfile: ResumeData = {
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
    };

    const letters = await db
      .select()
      .from(coverLettersTable)
      .where(eq(coverLettersTable.jobId, jobId))
      .limit(1);

    let content = "";
    if (letters.length > 0 && letters[0].content) {
      content = letters[0].content;
    } else {
      const generated = await generateCoverLetter({
        profile: masterProfile,
        job: {
          title: job.title,
          company: job.company,
          rawDescription: job.rawDescription,
          topKeywords: JSON.parse(job.topKeywords || "[]"),
          language: job.language,
        },
      });
      content = generated.content;
    }

    const pdfBytes = await generateCoverLetterPdf({
      profile: masterProfile,
      content,
      metadata: {
        title: `Carta de Apresentação — ${job.title} — ${job.company}`,
        author: masterProfile.fullName,
        subject: `Candidatura à vaga de ${job.title} na ${job.company}`,
        keywords: [
          job.title,
          job.company,
          "Cover Letter",
          "Carta de Apresentação",
        ],
        creator: "ATS Resume Optimizer & Job Tracker (Cover Letter Studio)",
      },
    });

    const safeName = sanitizeUtf8(masterProfile.fullName).replace(/\s+/g, "_");
    const safeCompany = sanitizeUtf8(job.company).replace(/\s+/g, "_");

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(
          `${safeName}_Carta_Apresentacao_${safeCompany}.pdf`,
        ),
      },
    });
  });

  // 20. Download Cover Letter DOCX
  app.get("/api/jobs/:id/download/cover-letter/docx", async (c) => {
    const jobId = c.req.param("id");
    const db = getDb();

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (jobs.length === 0) return c.text("Vaga não encontrada", 404);
    const job = jobs[0];

    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) return c.text("Perfil não encontrado", 404);
    const p = profiles[0];

    const masterProfile: ResumeData = {
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
    };

    const letters = await db
      .select()
      .from(coverLettersTable)
      .where(eq(coverLettersTable.jobId, jobId))
      .limit(1);

    let content = "";
    if (letters.length > 0 && letters[0].content) {
      content = letters[0].content;
    } else {
      const generated = await generateCoverLetter({
        profile: masterProfile,
        job: {
          title: job.title,
          company: job.company,
          rawDescription: job.rawDescription,
          topKeywords: JSON.parse(job.topKeywords || "[]"),
          language: job.language,
        },
      });
      content = generated.content;
    }

    const docxBuffer = await generateCoverLetterDocx({
      profile: masterProfile,
      content,
      metadata: {
        title: `Carta de Apresentação — ${job.title} — ${job.company}`,
        author: masterProfile.fullName,
        subject: `Candidatura à vaga de ${job.title} na ${job.company}`,
        keywords: [
          job.title,
          job.company,
          "Cover Letter",
          "Carta de Apresentação",
        ],
        creator: "ATS Resume Optimizer & Job Tracker (Cover Letter Studio)",
      },
    });

    const safeName = sanitizeUtf8(masterProfile.fullName).replace(/\s+/g, "_");
    const safeCompany = sanitizeUtf8(job.company).replace(/\s+/g, "_");

    return new Response(docxBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": buildContentDisposition(
          `${safeName}_Carta_Apresentacao_${safeCompany}.docx`,
        ),
      },
    });
  });

  // 21. Download Cover Letter TXT
  app.get("/api/jobs/:id/download/cover-letter/txt", async (c) => {
    const jobId = c.req.param("id");
    const db = getDb();

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (jobs.length === 0) return c.text("Vaga não encontrada", 404);
    const job = jobs[0];

    const profiles = await db.select().from(masterProfilesTable).limit(1);
    if (profiles.length === 0) return c.text("Perfil não encontrado", 404);
    const p = profiles[0];

    const letters = await db
      .select()
      .from(coverLettersTable)
      .where(eq(coverLettersTable.jobId, jobId))
      .limit(1);

    const content = letters[0]?.content || "";
    const safeName = sanitizeUtf8(p.fullName).replace(/\s+/g, "_");
    const safeCompany = sanitizeUtf8(job.company).replace(/\s+/g, "_");

    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": buildContentDisposition(
          `${safeName}_Carta_Apresentacao_${safeCompany}.txt`,
        ),
      },
    });
  });

  return app;
}
