import type { ResumeData, AtsAuditResult } from "../types/resume.ts";
import type { ExtractedKeyword } from "../nlp/tfidf.ts";
import type { SupportedLanguage } from "../nlp/language.ts";
import { auditAtsScore } from "./scorer.ts";

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

const ACRONYM_MAP: Record<string, string> = {
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

export async function tailorResume(
  master: ResumeData,
  job: JobInput
): Promise<TailoredResumeResult> {
  const lang = job.language || "pt";

  // Audit Before Optimization
  const auditBefore = auditAtsScore(master, job.keywords, lang);

  // Extract top job keywords
  const topKeywordsList = job.keywords.slice(0, 10).map(k => k.term);
  const primaryKeywords = topKeywordsList.slice(0, 4);

  // 1. Título do Cargo & Headline
  const tailoredHeadline = `${job.title} | Especialista em ${primaryKeywords.slice(0, 3).map(k => capitalize(k)).join(" • ")}`;

  // 2. Layer 3: Entity Extraction Shield for Experience and Education
  const experienceYearsMatch = master.summary.match(/(\d+)\s*(anos|years)/i) || 
                               master.rawText?.match(/(\d+)\s*(anos|years)/i);
  const years = experienceYearsMatch ? parseInt(experienceYearsMatch[1], 10) : 5;
  const months = years * 12;
  const startYear = new Date().getFullYear() - years;

  const entityShieldDuration = lang === "pt"
    ? `${years} anos de experiência (${months}+ meses de atuação sólida e comprovada desde ${startYear})`
    : `${years}+ years of solid experience (${months}+ months of proven industry track record since ${startYear})`;

  // 3. Layer 1 & 4: Professional Summary with Vector Space Optimization
  const vectorTerms = lang === "pt"
    ? "arquiteturas escaláveis, APIs RESTful de alto throughput, resiliência de microsserviços, modelagem de dados otimizada e testes automatizados"
    : "scalable architectures, high-throughput RESTful APIs, microservices resilience, optimized database modeling, and automated testing";

  const formattedKeywords = primaryKeywords.map(k => ACRONYM_MAP[k.toLowerCase()] || capitalize(k)).join(", ");

  // Layer 5: Regex Window Boundary Bleed line at the exact end of Summary
  const bleedLine = lang === "pt"
    ? `Core Stack & Especialidades: ${primaryKeywords.map(k => capitalize(k)).join(" • ")}.`
    : `Core Stack & Specialties: ${primaryKeywords.map(k => capitalize(k)).join(" • ")}.`;

  const tailoredSummary = lang === "pt"
    ? `${job.title} com ${entityShieldDuration}. Especialista no ecossistema de ${formattedKeywords}, com foco na construção de ${vectorTerms}. Histórico consistente na entrega de soluções de alta disponibilidade, observabilidade e integração contínua.\n\n${bleedLine}`
    : `${job.title} with ${entityShieldDuration}. Specialized across ${formattedKeywords}, focusing on ${vectorTerms}. Proven track record delivering high availability, observability, and robust CI/CD pipelines.\n\n${bleedLine}`;

  // 4. Layer 2: Section Weights & "First Line Rule" for Experiences
  const tailoredExperiences = master.experiences.map((exp, idx) => {
    // If it's the most recent / primary experience, craft a dense executive first line
    const primaryTechs = primaryKeywords.map(k => capitalize(k)).join(", ");
    const executiveFirstLine = lang === "pt"
      ? `Atuação executiva como ${job.title} liderando projetos críticos em ${primaryTechs}, otimizando throughput e garantindo confiabilidade de sistemas.`
      : `Executive role as ${job.title} driving mission-critical projects using ${primaryTechs}, optimizing throughput and system reliability.`;

    const remainingBullets = exp.description
      ? exp.description
          .split("\n")
          .filter(line => line.trim().length > 0 && !line.toLowerCase().includes("atuação executiva"))
      : [];

    // Contextualize hard skills into existing bullets
    const enhancedBullets = remainingBullets.map(bullet => {
      if (topKeywordsList.length > 2 && !bullet.toLowerCase().includes(topKeywordsList[1])) {
        return `${bullet} Utilização de ${capitalize(topKeywordsList[1])} e práticas de engenharia moderna.`;
      }
      return bullet;
    });

    const fullDescription = [executiveFirstLine, ...enhancedBullets].join("\n• ");

    return {
      ...exp,
      role: idx === 0 ? job.title : exp.role,
      description: fullDescription.startsWith("• ") ? fullDescription : `• ${fullDescription}`
    };
  });

  // 5. Layer 3: Degree & Education regex entity shield
  const tailoredEducation = master.education.map(edu => {
    let enhancedDegree = edu.degree;
    if (lang === "pt") {
      if (!enhancedDegree.toLowerCase().includes("graduação completa") && !enhancedDegree.toLowerCase().includes("bacharelado")) {
        enhancedDegree = `Graduação completa / Bacharelado / Ensino Superior em ${edu.degree.replace(/bacharelado em|graduação em/gi, "").trim()}`;
      }
    } else {
      if (!enhancedDegree.toLowerCase().includes("bachelor")) {
        enhancedDegree = `Bachelor's Degree / Higher Education in ${edu.degree}`;
      }
    }
    return {
      ...edu,
      degree: enhancedDegree
    };
  });

  // 6. Skills Section with Acronyms + Extended variants
  const enhancedSkillsSet = new Set<string>();
  
  // Add job's top keywords first
  for (const kw of topKeywordsList) {
    const formatted = ACRONYM_MAP[kw.toLowerCase()] || capitalize(kw);
    enhancedSkillsSet.add(formatted);
  }

  // Preserve candidate's existing skills
  for (const skill of master.skills) {
    const formatted = ACRONYM_MAP[skill.toLowerCase()] || skill;
    enhancedSkillsSet.add(formatted);
  }

  const tailoredSkills = Array.from(enhancedSkillsSet);

  // Assembled tailored resume
  const tailoredResume: ResumeData = {
    ...master,
    headline: tailoredHeadline,
    summary: tailoredSummary,
    skills: tailoredSkills,
    experiences: tailoredExperiences,
    education: tailoredEducation
  };

  // 7. Layer 6: Injected Binary Metadata
  const metadata = {
    title: job.title,
    author: master.fullName,
    keywords: topKeywordsList,
    subject: `Currículo otimizado para a vaga de ${job.title} na empresa ${job.company}. Foco em ${primaryKeywords.join(", ")}.`,
    creator: "Currículo",
    category: "Currículo"
  };

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

function capitalize(str: string): string {
  if (!str) return "";
  if (str.includes(".")) return str; // keep node.js / vue.js formatting
  return str.charAt(0).toUpperCase() + str.slice(1);
}
