import type { ResumeData, AtsAuditResult, ExperienceItem } from "../types/resume.ts";
import type { ExtractedKeyword } from "../nlp/tfidf.ts";
import { CANONICAL_TECH_ENTITIES, formatTechEntity, isInternalNlpTerm, isExcludedSkillTerm } from "../nlp/tfidf.ts";
import { sanitizeLocation } from "../services/cvExtractor.ts";
import { formatDate } from "../utils/dateFormat.ts";
import type { SupportedLanguage } from "../nlp/language.ts";
import { auditAtsScore } from "./scorer.ts";
import { sanitizeUtf8, sanitizeResumeUtf8 } from "../utils/encoding.ts";

/**
 * Deduplicates paragraphs and sentences within an optimized summary.
 * Eliminates repeated text blocks, repeated sentences, and back-to-back concatenated duplicates,
 * ensuring the summary is unique, organic, and fluid.
 */
export function deduplicateSummary(text: string): string {
  if (!text) return "";
  const sanitized = sanitizeUtf8(text);

  // 1. Check if the entire string consists of two identical halves concatenated together
  const trimmed = sanitized.trim();
  const halfLen = Math.floor(trimmed.length / 2);
  if (halfLen >= 15) {
    const firstHalf = trimmed.slice(0, halfLen).trim();
    const secondHalf = trimmed.slice(halfLen).trim();
    if (firstHalf === secondHalf) {
      return firstHalf;
    }
  }

  // 2. Split by paragraphs / newlines
  const rawParagraphs = sanitized
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean);

  const seenParagraphs = new Set<string>();
  const uniqueParagraphs: string[] = [];
  const globalSeenSentences = new Set<string>();

  for (const para of rawParagraphs) {
    const normPara = para.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "").trim();
    if (seenParagraphs.has(normPara)) continue;
    seenParagraphs.add(normPara);

    // Sentence-level deduplication within each paragraph
    const sentences = para.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    const uniqueSentences: string[] = [];

    for (const sent of sentences) {
      const normSent = sent.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").trim();
      if (normSent.length > 15 && globalSeenSentences.has(normSent)) {
        continue;
      }
      if (normSent.length > 15) {
        globalSeenSentences.add(normSent);
      }
      uniqueSentences.push(sent);
    }

    const cleanPara = uniqueSentences.join(" ").trim();
    if (cleanPara) {
      uniqueParagraphs.push(cleanPara);
    }
  }

  return uniqueParagraphs.join("\n\n").trim();
}

export interface TailoredResumeResult {
  tailoredResume: ResumeData;
  scoreBefore: number;
  scoreAfter: number;
  auditBefore: AtsAuditResult;
  auditAfter: AtsAuditResult;
  metadata: {
    title: string;
    author: string;
    keywords: string[];
    subject: string;
    creator: string;
    category: string;
  };
}

export interface JobInput {
  title: string;
  company: string;
  rawDescription: string;
  keywords: ExtractedKeyword[];
  language?: SupportedLanguage;
}

export const ACRONYM_MAP: Record<string, string> = {
  "typescript": "TypeScript (TS)",
  "node.js": "Node.js (NodeJS)",
  "nodejs": "Node.js (NodeJS)",
  "javascript": "JavaScript (JS)",
  "ci/cd": "CI/CD (Integração Contínua / Continuous Integration)",
  "aws": "AWS (Amazon Web Services)",
  "gcp": "GCP (Google Cloud Platform)",
  "k8s": "Kubernetes (K8s)",
  "kubernetes": "Kubernetes (K8s)",
  "sql": "SQL (Structured Query Language)",
  "rest": "REST (RESTful APIs)",
  "docker": "Docker (Containers)"
};

export const SOFT_SKILLS_PROHIBITED = new Set([
  "proativo", "proativa", "proatividade", "proactive",
  "trabalho em equipe", "trabalhador em equipe", "team player", "teamwork",
  "comunicação", "comunicacao", "communication", "boa comunicação",
  "liderança", "leadership", "gestão de pessoas",
  "organização", "organizacao", "organization",
  "resolução de problemas", "problem solving",
  "autodidata", "self-starter", "dedicado", "dedicada",
  "dinâmico", "dinâmica", "dynamic",
  "comprometimento", "comprometido",
  "pontualidade", "pontual",
  "ética", "etica", "ethics",
  "criatividade", "criativo", "criativa", "creative", "creativity",
  "relacionamento interpessoal", "interpersonal skills",
  "adaptabilidade", "adaptável", "adaptable", "adaptability",
  "pensamento crítico", "critical thinking",
  "orientado a resultados", "foco em resultados", "facilidade de aprendizado"
]);

export function isProhibitedSoftSkill(skill: string): boolean {
  const lower = skill.toLowerCase().trim();
  if (SOFT_SKILLS_PROHIBITED.has(lower)) return true;
  return Array.from(SOFT_SKILLS_PROHIBITED).some(prohibited => 
    lower === prohibited || (lower.length > 5 && prohibited.includes(lower))
  );
}

export function formatKeyword(term: string): string {
  if (!term) return "";
  const lower = term.toLowerCase().trim();
  if (CANONICAL_TECH_ENTITIES[lower]) {
    return CANONICAL_TECH_ENTITIES[lower];
  }
  return formatTechEntity(term);
}

function isRecentExperience(exp: ExperienceItem): boolean {
  const yearMatch = (exp.startDate || "").match(/\b(20\d{2}|19\d{2})\b/);
  if (!yearMatch) return false;
  const startYear = parseInt(yearMatch[1], 10);
  const currentYear = new Date().getFullYear();
  return (currentYear - startYear) <= 8;
}

export function weaveKeywordsIntoExperiences(
  rawBullets: string[],
  primaryKeywords: string[],
  jobTitle: string,
  lang: "pt" | "en"
): string[] {
  if (rawBullets.length === 0) {
    const k1 = primaryKeywords.slice(0, 2).join(lang === "pt" ? " e " : " and ") || (lang === "pt" ? "Node.js e TypeScript" : "Node.js and TypeScript");
    const k2 = primaryKeywords.slice(2, 4).join(lang === "pt" ? " e " : " and ") || (lang === "pt" ? "testes automatizados e CI/CD" : "automated testing and CI/CD");
    if (lang === "pt") {
      return [
        `Liderança técnica e desenvolvimento em ${k1}, garantindo alta disponibilidade e resiliência de microsserviços.`,
        `Otimização de rotinas e esteiras de integração contínua com ${k2}, reduzindo latência e aumentando throughput.`
      ];
    } else {
      return [
        `Technical leadership and development in ${k1}, driving high availability and microservices resilience.`,
        `Optimization of backend routines and CI/CD pipelines with ${k2}, reducing latency and increasing throughput.`
      ];
    }
  }

  const bullets = [...rawBullets];
  const combinedText = bullets.join(" ").toLowerCase();

  // Identify primary keywords missing from the candidate's existing bullets
  const missing = primaryKeywords.filter(k => !combinedText.includes(k.toLowerCase()));
  if (missing.length === 0) {
    return bullets;
  }

  const topMissing = missing.slice(0, 2);
  const remainingMissing = missing.slice(2);

  // Weave top missing keywords naturally as a complete, independent sentence
  if (topMissing.length > 0) {
    const b0 = bullets[0].trim();
    const conj = lang === "pt" ? " e " : " and ";
    const cleanBullet = /[.!?]$/.test(b0) ? b0 : `${b0}.`;
    const addition = lang === "pt"
      ? ` Atuação com foco em arquitetura escalável, resiliência e engenharia de software aplicada a ${topMissing.join(conj)}.`
      : ` Hands-on development with focus on scalable architecture, resilience, and software engineering with ${topMissing.join(conj)}.`;
    bullets[0] = `${cleanBullet}${addition}`;
  }

  // Weave remaining missing keywords naturally into an impact/infra/database bullet (or 2nd bullet) as an independent sentence
  if (remainingMissing.length > 0) {
    let targetIdx = bullets.findIndex((b, idx) => 
      idx > 0 && /impacto|resultado|otimiz|banco|dados|infra|cloud|performance|latência|database|cache/i.test(b)
    );
    if (targetIdx === -1) {
      targetIdx = bullets.length > 1 ? 1 : 0;
    }
    const targetBullet = bullets[targetIdx].trim();
    const conj = lang === "pt" ? " e " : " and ";
    const cleanTarget = /[.!?]$/.test(targetBullet) ? targetBullet : `${targetBullet}.`;
    const addition = lang === "pt"
      ? ` Implementação de práticas de alta disponibilidade, testes e integração contínua com ${remainingMissing.join(conj)}.`
      : ` Implementation of high availability practices, testing, and continuous delivery with ${remainingMissing.join(conj)}.`;
    bullets[targetIdx] = `${cleanTarget}${addition}`;
  }

  return bullets;
}

export function enhanceEducation(education: EducationItem[], lang: "pt" | "en"): EducationItem[] {
  let bachelorEnhanced = false;
  let masterEnhanced = false;

  return education.map(edu => {
    let enhancedDegree = edu.degree;
    const lower = edu.degree.toLowerCase();

    if (lang === "pt") {
      // Enhance Master degree ONCE
      if (!masterEnhanced && (lower.includes("máster") || lower.includes("master") || lower.includes("mestrado"))) {
        masterEnhanced = true;
        if (!lower.includes("pós-graduação") && !lower.includes("mestrado")) {
          enhancedDegree = `Pós-Graduação / Mestrado (Master's Degree) em ${edu.degree}`;
        }
      }
      // Enhance Bachelor degree ONCE
      else if (!bachelorEnhanced && (
        lower.includes("bachelor") || 
        lower.includes("bacharel") || 
        lower.includes("graduação") || 
        lower.includes("computer science") || 
        lower.includes("ciência da computação") || 
        lower.includes("sistemas de informação") || 
        lower.includes("engenharia")
      )) {
        bachelorEnhanced = true;
        if (!lower.includes("graduação completa") && !lower.includes("bacharelado")) {
          const cleanDegree = edu.degree.replace(/bacharelado em|graduação em/gi, "").trim();
          enhancedDegree = `Graduação completa / Bacharelado / Ensino Superior em ${cleanDegree}`;
        }
      }
    } else {
      // English version
      if (!masterEnhanced && (lower.includes("master") || lower.includes("máster") || lower.includes("postgraduate"))) {
        masterEnhanced = true;
        enhancedDegree = `Postgraduate / Master's Degree in ${edu.degree}`;
      } else if (!bachelorEnhanced && (lower.includes("bachelor") || lower.includes("undergraduate") || lower.includes("computer science"))) {
        bachelorEnhanced = true;
        enhancedDegree = `Bachelor's Degree / Higher Education in ${edu.degree}`;
      }
    }

    return {
      ...edu,
      degree: enhancedDegree,
      startDate: formatDate(edu.startDate, lang),
      endDate: formatDate(edu.endDate, lang)
    };
  });
}

export async function tailorResume(
  master: ResumeData,
  job: JobInput
): Promise<TailoredResumeResult> {
  const lang = job.language || "pt";
  const cleanMaster = sanitizeResumeUtf8(master);

  // Audit Before Optimization
  const auditBefore = auditAtsScore(cleanMaster, job.keywords, lang);

  // Extract top job keywords with canonical tech casing, filtering out internal NLP terms and generic corporate terms
  const topKeywordsList = job.keywords
    .filter(k => !isExcludedSkillTerm(k.term))
    .slice(0, 10)
    .map(k => formatKeyword(k.term));
  const primaryKeywords = topKeywordsList.slice(0, 4);

  // 1. Título do Cargo & Headline
  const tailoredHeadline = `${job.title} | Especialista em ${primaryKeywords.slice(0, 3).join(" • ")}`;

  // 2. Layer 3: Entity Extraction Shield for Experience and Education
  const experienceYearsMatch = cleanMaster.summary.match(/(\d+)\s*(anos|years)/i) || 
                               cleanMaster.rawText?.match(/(\d+)\s*(anos|years)/i);
  const years = experienceYearsMatch ? parseInt(experienceYearsMatch[1], 10) : 5;
  const months = years * 12;
  const startYear = new Date().getFullYear() - years;

  const entityShieldDuration = lang === "pt"
    ? `${years} anos de experiência (${months}+ meses de atuação sólida e comprovada desde ${startYear})`
    : `${years}+ years of solid experience (${months}+ months of proven industry track record since ${startYear})`;

  // 3. Layer 1 & 4: Professional Summary with Vector Space Optimization (Clean, organic flow, deduplicated)
  const vectorTerms = lang === "pt"
    ? "arquiteturas escaláveis, APIs RESTful de alto throughput, resiliência de microsserviços, modelagem de dados otimizada e testes automatizados"
    : "scalable architectures, high-throughput RESTful APIs, microservices resilience, optimized database modeling, and automated testing";

  const formattedKeywords = primaryKeywords.map(k => ACRONYM_MAP[k.toLowerCase()] || k).join(", ");

  const rawSummary = lang === "pt"
    ? `${job.title} com ${entityShieldDuration}. Especialista no ecossistema de ${formattedKeywords}, com foco na construção de ${vectorTerms}. Histórico consistente na entrega de soluções de alta disponibilidade, observabilidade e integração contínua.`
    : `${job.title} with ${entityShieldDuration}. Specialized across ${formattedKeywords}, focusing on ${vectorTerms}. Proven track record delivering high availability, observability, and robust CI/CD pipelines.`;

  const tailoredSummary = deduplicateSummary(rawSummary);

  // 4. Layer 2: Section Weights & Natural Keyword Weaving for Experiences
  const tailoredExperiences = cleanMaster.experiences.map((exp, idx) => {
    // Clean original bullets: remove any existing artificial tags
    const rawBullets = (exp.description || "")
      .split("\n")
      .map(b => b.trim())
      .filter(b => 
        b.length > 0 && 
        !b.toLowerCase().includes("atuação executiva") && 
        !b.toLowerCase().includes("executive role as") &&
        !b.toLowerCase().includes("utilização de") &&
        !b.toLowerCase().includes("stack técnica & práticas") &&
        !b.toLowerCase().includes("tecnologias e práticas aplicadas") &&
        !b.toLowerCase().includes("core stack &") &&
        !isProhibitedSoftSkill(b)
      );

    let bullets: string[] = [];

    if (idx === 0) {
      // Natural and invisible keyword weaving for the most recent / target experience
      bullets = weaveKeywordsIntoExperiences(rawBullets, primaryKeywords, job.title, lang);
    } else {
      // For older experiences: Keep original text 100% clean, authentic, and concise!
      bullets = [...rawBullets];
    }

    const fullDescription = bullets
      .map(b => b.startsWith("•") || b.startsWith("-") ? b : `• ${b}`)
      .join("\n");

    return {
      ...exp,
      role: idx === 0 ? job.title : exp.role,
      startDate: formatDate(exp.startDate, lang),
      endDate: formatDate(exp.endDate, lang),
      description: fullDescription
    };
  });

  // 5. Layer 3: Clean Degree & Education Regex Entity Shield
  const tailoredEducation = enhanceEducation(cleanMaster.education, lang);

  // 6. Skills Section with Acronyms + Canonical Casing (Filtered from soft skills AND corporate/NLP exclusion terms)
  const enhancedSkillsSet = new Set<string>();
  
  // Add job's top keywords first
  for (const kw of topKeywordsList) {
    if (!isProhibitedSoftSkill(kw) && !isExcludedSkillTerm(kw)) {
      const formatted = ACRONYM_MAP[kw.toLowerCase()] || formatKeyword(kw);
      enhancedSkillsSet.add(formatted);
    }
  }

  // Preserve candidate's existing technical skills (excluding soft skills and excluded terms)
  for (const skill of cleanMaster.skills) {
    if (!isProhibitedSoftSkill(skill) && !isExcludedSkillTerm(skill)) {
      const formatted = ACRONYM_MAP[skill.toLowerCase()] || formatKeyword(skill);
      enhancedSkillsSet.add(formatted);
    }
  }

  const tailoredSkills = Array.from(enhancedSkillsSet);

  // Assembled tailored resume (Privacy Safe: City, State only, UTF-8 sanitized)
  const tailoredResume: ResumeData = sanitizeResumeUtf8({
    ...cleanMaster,
    location: sanitizeLocation(cleanMaster.location),
    headline: tailoredHeadline,
    summary: tailoredSummary,
    skills: tailoredSkills,
    experiences: tailoredExperiences,
    education: tailoredEducation
  });

  // 7. Layer 6: Injected Binary Metadata
  const metadata = sanitizeResumeUtf8({
    title: job.title,
    author: cleanMaster.fullName,
    keywords: topKeywordsList,
    subject: `Currículo otimizado para a vaga de ${job.title} na empresa ${job.company}. Foco em ${primaryKeywords.join(", ")}.`,
    creator: "Currículo",
    category: "Currículo"
  });

  // 8. Audit After Optimization
  const auditAfter = auditAtsScore(tailoredResume, job.keywords, lang);

  return {
    tailoredResume,
    scoreBefore: auditBefore.overallScore,
    scoreAfter: auditAfter.overallScore,
    auditBefore,
    auditAfter,
    metadata
  };
}
