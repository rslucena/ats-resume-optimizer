import { isExcludedSkillTerm } from "../nlp/tfidf.ts";
import { auditAtsScore } from "../optimizer/scorer.ts";
import type { JobInput, TailoredResumeResult } from "../optimizer/tailor.ts";
import {
  ACRONYM_MAP,
  deduplicateSummary,
  enhanceEducation,
  formatKeyword,
  isProhibitedSoftSkill,
  tailorResume,
  weaveKeywordsIntoExperiences,
} from "../optimizer/tailor.ts";
import type { ResumeData } from "../types/resume.ts";
import { sanitizeResumeUtf8 } from "../utils/encoding.ts";
import { getEnvKey } from "../utils/env.ts";
import { sanitizeLocation } from "./cvExtractor.ts";
import { callOllamaGenerate } from "./ollamaService.ts";

export type TailorEngine = "gemini" | "ollama" | "local";

export interface AiTailoredResumeResult extends TailoredResumeResult {
  engine: TailorEngine;
}

interface GeminiTailorResponse {
  headline?: string;
  summary?: string;
  skills?: string[];
  experiences?: Array<{
    company?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
}

/**
 * Main tailored resume generator with AI option (Gemini, Ollama or local deterministic).
 */
export async function tailorResumeWithAiOption(
  masterResume: ResumeData,
  job: JobInput,
  useAi: boolean | TailorEngine = false,
): Promise<AiTailoredResumeResult> {
  const engineChoice: TailorEngine =
    typeof useAi === "string" ? useAi : useAi ? "gemini" : "local";

  if (engineChoice === "local") {
    const local = await tailorResume(masterResume, job);
    return { ...local, engine: "local" };
  }

  if (engineChoice === "ollama") {
    try {
      const ollamaResult = await callOllamaTailor(masterResume, job);
      if (ollamaResult) {
        return { ...ollamaResult, engine: "ollama" };
      }
    } catch (err) {
      console.warn(
        "[AI Tailor] Falha no Ollama. Recorrendo ao motor determinístico local:",
        err,
      );
    }
    const fallback = await tailorResume(masterResume, job);
    return { ...fallback, engine: "local" };
  }

  // Default AI: Gemini 1.5 Flash
  const apiKey = getEnvKey("GEMINI_API_KEY");
  if (!apiKey) {
    console.warn(
      "[AI Tailor] GEMINI_API_KEY ausente no .env. Recorrendo ao motor determinístico local.",
    );
    const local = await tailorResume(masterResume, job);
    return { ...local, engine: "local" };
  }

  try {
    const aiResult = await callGeminiTailor(masterResume, job, apiKey);
    if (aiResult) {
      return { ...aiResult, engine: "gemini" };
    }
  } catch (err) {
    console.warn(
      "[AI Tailor] Falha na chamada da API Gemini. Recorrendo ao motor determinístico local:",
      err,
    );
  }

  const fallback = await tailorResume(masterResume, job);
  return { ...fallback, engine: "local" };
}

/**
 * Invokes Ollama local LLM for offline resume tailoring.
 */
export async function callOllamaTailor(
  master: ResumeData,
  job: JobInput,
): Promise<TailoredResumeResult | null> {
  try {
    const lang = job.language || "pt";
    const prompt = buildGeminiTailorPrompt(master, job, lang);
    const rawText = await callOllamaGenerate({
      prompt,
      formatJson: true,
      system:
        "Você é um especialista em ATS. Retorne EXCLUSIVAMENTE um objeto JSON válido, sem comentários ou blocos adicionais.",
      timeoutMs: 30000,
    });

    const parsedJson = extractJsonFromText(rawText) as GeminiTailorResponse;
    if (!parsedJson?.summary || !Array.isArray(parsedJson.experiences)) {
      console.warn(
        "[AI Tailor] Estrutura JSON retornada pelo Ollama é inválida:",
        rawText,
      );
      return null;
    }

    return mergeGeminiOutputWithMaster(master, job, parsedJson, lang);
  } catch (e) {
    console.warn("[AI Tailor] Erro na execução de callOllamaTailor:", e);
    return null;
  }
}

/**
 * Calls Gemini 1.5 Flash generateContent with strict anti-hallucination prompt
 * and structured JSON response formatting.
 */
export async function callGeminiTailor(
  master: ResumeData,
  job: JobInput,
  apiKey: string,
): Promise<TailoredResumeResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000); // 18s abort timeout

  try {
    const lang = job.language || "pt";
    const prompt = buildGeminiTailorPrompt(master, job, lang);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2500,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(
        `[AI Tailor] Gemini retornou status ${res.status}:`,
        errText,
      );
      return null;
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsedJson = extractJsonFromText(rawText) as GeminiTailorResponse;
    if (!parsedJson?.summary || !Array.isArray(parsedJson.experiences)) {
      console.warn(
        "[AI Tailor] Estrutura JSON retornada pelo Gemini é inválida:",
        rawText,
      );
      return null;
    }

    return mergeGeminiOutputWithMaster(master, job, parsedJson, lang);
  } catch (e) {
    console.warn("[AI Tailor] Erro na execução de callGeminiTailor:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Builds the comprehensive prompt for Gemini with strict ATS and non-hallucination rules.
 */
export function buildGeminiTailorPrompt(
  master: ResumeData,
  job: JobInput,
  lang: "pt" | "en",
): string {
  const keywordsList = job.keywords.map((k) => k.term).slice(0, 15);
  const masterJson = JSON.stringify(
    {
      headline: master.headline,
      summary: master.summary,
      skills: master.skills,
      experiences: master.experiences.map((e) => ({
        company: e.company,
        role: e.role,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })),
    },
    null,
    2,
  );

  if (lang === "en") {
    return `You are a Principal Software Engineer and ATS (Applicant Tracking Systems) Resume Optimization Specialist.
Your task is to tailor the candidate's Master CV specifically for the target job opportunity.

TARGET JOB DETAILS:
- Title: ${job.title}
- Company: ${job.company}
- Target Keywords (TF-IDF): ${keywordsList.join(", ")}
- Job Description:
"""
${job.rawDescription.slice(0, 2500)}
"""

CANDIDATE MASTER CV (TRUTH MATRIX):
${masterJson}

STRICT ARCHITECTURAL DIRECTIVES:
1. ZERO HALLUCINATION (STRICTEST RULE):
   - You MUST NOT invent any companies, roles, graduation degrees, dates, certifications, metrics, or technologies not grounded in the Master CV.
   - Retain the exact companies and dates from the candidate's actual experiences.
2. HARD SKILLS & KEYWORDS ALIGNMENT:
   - Weave the job's high-value technical keywords organically into the experience bullet points.
   - Do NOT create artificial labels like "Core Stack:" or "Tech Stack & Practices:". Everything must read as natural accomplishments.
3. FIRST-LINE EXECUTIVE RULE:
   - For the most recent experience, rewrite the first bullet to be a dense, high-impact executive summary combining role, core stack, and product scope.
4. ACTION VERBS & QUANTIFIABLE METRICS:
   - Use strong past/present action verbs (Architected, Engineered, Optimized, Spearheaded).
   - Preserve existing metrics (% latency reductions, scale, user volume). Remove generic soft skills ("team player", "proactive", "good communication").
5. OUTPUT JSON FORMAT (MANDATORY):
   Return ONLY a valid JSON object matching this schema:
   {
     "headline": "Targeted professional headline aligned with the job",
     "summary": "2-3 dense paragraphs of organic professional summary",
     "skills": ["Skill1", "Skill2", ...],
     "experiences": [
       {
         "company": "Original company name",
         "role": "Targeted/standardized role title",
         "startDate": "Original start date",
         "endDate": "Original end date",
         "description": "Multi-line bullet points starting with - detailing accomplishments"
       }
     ]
   }`;
  }

  return `Você é um Arquiteto de Software Sênior e Especialista em Engenharia de ATS (Applicant Tracking Systems) e Otimização de Currículos Técnicos.
Sua missão é otimizar o Master CV do candidato especificamente para a vaga alvo.

DADOS DA VAGA ALVO:
- Título: ${job.title}
- Empresa: ${job.company}
- Palavras-chave Prioritárias (TF-IDF): ${keywordsList.join(", ")}
- Descrição da Vaga:
"""
${job.rawDescription.slice(0, 2500)}
"""

MASTER CV DO CANDIDATO (MATRIZ DA VERDADE):
${masterJson}

DIRETRIZES TÉCNICAS RÍGIDAS:
1. ZERO ALUCINAÇÃO (REGRA ABSOLUTA):
   - É ESTRITAMENTE PROIBIDO inventar empresas, cargos, datas, certificações, métricas numéricas ou ferramentas que não existam no Master CV do candidato.
   - Mantenha rigorosamente as empresas e períodos de atuação originais.
2. ALINHAMENTO ORGÂNICO DE HARD SKILLS:
   - Incorpore as palavras-chave prioritárias da vaga (${keywordsList.slice(0, 8).join(", ")}) de maneira orgânica e fluida dentro dos bullets de realização.
   - NUNCA insira marcadores artificiais ou cabeçalhos robóticos como "Core Stack & Especialidades:" ou "Stack técnica & Práticas:". O texto deve fluir como realizações de engenharia naturais.
3. REGRA DA 1ª LINHA (RESUMO EXECUTIVO):
   - Na experiência mais recente, formule o primeiro bullet como uma linha de impacto executivo combinando cargo, escopo técnico alinhado à vaga e entrega de valor.
4. VERBOS DE AÇÃO E RESULTADOS MENSURÁVEIS:
   - Use verbos fortes de engenharia ("Arquitetei", "Liderei", "Otimizei", "Estruturei", "Implementei").
   - Destaque as métricas já existentes no currículo. Elimine termos vazios de soft skills ("proativo", "boa comunicação", "dedicado").
5. SAÍDA EM JSON PURO (OBRIGATÓRIO):
   Retorne ESTRITAMENTE um objeto JSON válido seguindo esta estrutura:
   {
     "headline": "Título profissional alinhado à vaga",
     "summary": "Resumo profissional persuasivo em 2 a 3 parágrafos sem rótulos artificiais",
     "skills": ["Habilidade 1", "Habilidade 2", ...],
     "experiences": [
       {
         "company": "Nome da empresa original",
         "role": "Cargo original ou ligeiramente refinado",
         "startDate": "Data original",
         "endDate": "Data original",
         "description": "Texto em bullets (- ...) com realizações técnicas e verbos de impacto"
       }
     ]
   }`;
}

/**
 * Merges Gemini JSON output safely with the Master CV, preserving verified data,
 * cleaning soft skills/internal terms, and computing official ATS audit scores.
 */
export function mergeGeminiOutputWithMaster(
  master: ResumeData,
  job: JobInput,
  aiData: GeminiTailorResponse,
  lang: "pt" | "en",
): TailoredResumeResult {
  const auditBefore = auditAtsScore(master, job.keywords, lang);

  // 1. Headline
  const tailoredHeadline =
    aiData.headline && aiData.headline.trim().length > 5
      ? aiData.headline.trim()
      : `${job.title} | ${master.skills.slice(0, 3).join(" • ")}`;

  // 2. Summary
  let rawTailoredSummary =
    aiData.summary && aiData.summary.trim().length > 30
      ? aiData.summary.trim()
      : master.summary;

  const expDurationRegex =
    /(\d+\s*(anos|ano|years|year))|(\d+\+?\s*(meses|months))/i;
  if (!expDurationRegex.test(rawTailoredSummary)) {
    const experienceYearsMatch =
      master.summary.match(/(\d+)\s*(anos|years)/i) ||
      master.rawText?.match(/(\d+)\s*(anos|years)/i);
    if (experienceYearsMatch) {
      const years = parseInt(experienceYearsMatch[1], 10);
      const prefix =
        lang === "pt"
          ? `${job.title} com ${years} anos de experiência sólida.`
          : `${job.title} with ${years} years of solid experience.`;
      rawTailoredSummary = `${prefix} ${rawTailoredSummary}`;
    }
  }
  const tailoredSummary = deduplicateSummary(rawTailoredSummary);

  // 3. Experiences: Map AI descriptions safely back to master experiences and weave primary keywords
  const topKeywordsList = job.keywords
    .filter((k) => !isExcludedSkillTerm(k.term))
    .slice(0, 15)
    .map((k) => k.term);
  const primaryKeywords = topKeywordsList.slice(0, 4);

  const tailoredExperiences = master.experiences.map((origExp, idx) => {
    const aiExp = aiData.experiences?.[idx];
    const desc =
      aiExp?.description && aiExp.description.trim().length > 20
        ? aiExp.description.trim()
        : origExp.description;

    const rawBullets = desc
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    const wovenBullets =
      idx === 0
        ? weaveKeywordsIntoExperiences(
            rawBullets,
            primaryKeywords,
            job.title,
            lang,
          )
        : rawBullets;

    return {
      ...origExp,
      role:
        aiExp?.role && aiExp.role.trim().length > 2
          ? aiExp.role.trim()
          : origExp.role,
      description: wovenBullets.map((b) => `- ${b}`).join("\n"),
    };
  });

  // 4. Skills: Cleaned of soft skills & internal NLP terms, mapped with canonical acronyms
  const enhancedSkillsSet = new Set<string>();

  // Add top job keywords
  for (const kw of topKeywordsList) {
    if (!isProhibitedSoftSkill(kw) && !isExcludedSkillTerm(kw)) {
      const formatted = ACRONYM_MAP[kw.toLowerCase()] || formatKeyword(kw);
      enhancedSkillsSet.add(formatted);
    }
  }

  // Add AI suggested skills
  if (Array.isArray(aiData.skills)) {
    for (const skill of aiData.skills) {
      if (!isProhibitedSoftSkill(skill) && !isExcludedSkillTerm(skill)) {
        const formatted =
          ACRONYM_MAP[skill.toLowerCase()] || formatKeyword(skill);
        enhancedSkillsSet.add(formatted);
      }
    }
  }

  // Preserve master's technical skills
  for (const skill of master.skills) {
    if (!isProhibitedSoftSkill(skill) && !isExcludedSkillTerm(skill)) {
      const formatted =
        ACRONYM_MAP[skill.toLowerCase()] || formatKeyword(skill);
      enhancedSkillsSet.add(formatted);
    }
  }

  const tailoredResume: ResumeData = sanitizeResumeUtf8({
    ...master,
    location: sanitizeLocation(master.location),
    headline: tailoredHeadline,
    summary: tailoredSummary,
    skills: Array.from(enhancedSkillsSet),
    experiences: tailoredExperiences,
    education: enhanceEducation(master.education, lang),
  });

  const auditAfter = auditAtsScore(tailoredResume, job.keywords, lang);

  const metadata = sanitizeResumeUtf8({
    title: job.title,
    author: master.fullName,
    keywords: topKeywordsList,
    subject: `Currículo otimizado com IA (Gemini 1.5 Flash) para a vaga de ${job.title} na empresa ${job.company}.`,
    creator: "Currículo (Gemini ATS Engine)",
    category: "Currículo",
  });

  return {
    tailoredResume,
    scoreBefore: auditBefore.overallScore,
    scoreAfter: auditAfter.overallScore,
    auditBefore,
    auditAfter,
    metadata,
  };
}

/**
 * Extracts and parses JSON from text, handling potential code block delimiters.
 */
export function extractJsonFromText(
  text: string,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {}
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}
