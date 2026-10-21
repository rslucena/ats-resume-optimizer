import type { ResumeData, AtsAuditResult } from "../types/resume.ts";
import type { ExtractedKeyword } from "../nlp/tfidf.ts";
import type { SupportedLanguage } from "../nlp/language.ts";
import { stemWord } from "../nlp/stemmer.ts";

export function auditAtsScore(
  resume: ResumeData,
  jobKeywords: ExtractedKeyword[],
  lang: SupportedLanguage = "pt"
): AtsAuditResult {
  const recommendations: string[] = [];

  // 1. Formatting & Structure Score (Max 30)
  let formattingScore = 0;
  if (resume.fullName && resume.fullName.trim().length > 2) formattingScore += 5;
  if (resume.email && resume.email.includes("@")) formattingScore += 5;
  if (resume.summary && resume.summary.trim().length > 30) {
    formattingScore += 5;
  } else {
    recommendations.push("Amplie o resumo profissional para ao menos 3 a 4 sentenças densas.");
  }

  if (Array.isArray(resume.skills) && resume.skills.length >= 4) {
    formattingScore += 5;
  } else {
    recommendations.push("Adicione ao menos 5 hard skills relevantes na seção de Habilidades.");
  }

  if (Array.isArray(resume.experiences) && resume.experiences.length > 0) {
    formattingScore += 5;
  } else {
    recommendations.push("Inclua experiências profissionais com cargo, empresa e período.");
  }

  if (Array.isArray(resume.education) && resume.education.length > 0) {
    formattingScore += 5;
  } else {
    recommendations.push("Adicione sua formação acadêmica completa.");
  }

  // Combine entire text for full document analysis
  const expText = resume.experiences.map(e => `${e.role} ${e.company} ${e.description}`).join(" ");
  const eduText = resume.education.map(e => `${e.degree} ${e.institution}`).join(" ");
  const skillsText = resume.skills.join(" ");
  const fullDocumentText = `${resume.fullName} ${resume.headline} ${resume.summary} ${skillsText} ${expText} ${eduText}`.toLowerCase();

  // 2. Keyword Match Analysis (Max 35)
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  const keywordDensity: Record<string, number> = {};

  for (const kw of jobKeywords) {
    const term = kw.term.toLowerCase();
    const stem = kw.stem.toLowerCase();

    // Check count in full document
    const escapedTerm = term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedTerm}\\b`, "gi");
    const matches = fullDocumentText.match(regex);
    const count = matches ? matches.length : 0;
    keywordDensity[term] = count;

    // Direct match or stem match
    const stemRegex = new RegExp(`\\b${stem}`, "gi");
    const hasStemMatch = stemRegex.test(fullDocumentText);

    if (count > 0 || hasStemMatch) {
      matchedKeywords.push(kw.term);
    } else {
      missingKeywords.push(kw.term);
    }
  }

  const keywordCoverageRatio = jobKeywords.length > 0 ? matchedKeywords.length / jobKeywords.length : 1;
  const keywordScore = Number((keywordCoverageRatio * 35).toFixed(1));

  if (missingKeywords.length > 0) {
    recommendations.push(`Palavras-chave ausentes da vaga: ${missingKeywords.slice(0, 5).join(", ")}`);
  }

  // 3. Density & Positional Weights (Max 20)
  let densityScore = 0;
  const summaryLower = (resume.summary || "").toLowerCase();

  // Weight 3 (Summary): Check if at least 2 top keywords appear in summary
  const summaryMatches = jobKeywords.filter(kw => {
    const term = kw.term.toLowerCase();
    return summaryLower.includes(term) || (kw.stem && summaryLower.includes(kw.stem));
  });
  if (summaryMatches.length >= 3) {
    densityScore += 7;
  } else if (summaryMatches.length >= 1) {
    densityScore += 4;
    recommendations.push("Inclua mais das top keywords diretamente no Resumo Profissional (peso 3 do ATS).");
  } else {
    recommendations.push("O Resumo Profissional não possui as palavras-chave principais da vaga.");
  }

  // Weight 2 (First Line Rule in Experiences)
  const firstExp = resume.experiences[0];
  if (firstExp && firstExp.description) {
    const firstLine = firstExp.description.split("\n")[0].toLowerCase();
    const firstLineMatches = jobKeywords.filter(kw => firstLine.includes(kw.term.toLowerCase()) || firstLine.includes(kw.stem));
    if (firstLineMatches.length >= 2) {
      densityScore += 7;
    } else if (firstLineMatches.length >= 1) {
      densityScore += 4;
      recommendations.push("Reforce a primeira linha da sua experiência mais recente com a tecnologia principal e cargo da vaga.");
    } else {
      recommendations.push("Regra da Primeira Linha: abra sua experiência principal com um resumo executivo citando as tecnologias da vaga.");
    }
  }

  // Repetition balance (skills section & frequency balance)
  if (matchedKeywords.length >= 3) {
    densityScore += 6;
  } else if (matchedKeywords.length >= 1) {
    densityScore += 3;
  }

  // 4. Entity Compliance Shield (Max 15)
  let entityScore = 0;

  // Experience variation (e.g., "5 anos ... 60+ meses" or explicit duration)
  const expDurationRegex = /(\d+\s*(anos|ano|years|year))|(\d+\+?\s*(meses|months))/i;
  if (expDurationRegex.test(fullDocumentText)) {
    entityScore += 5;
  } else {
    recommendations.push("Adicione tempo explícito de atuação (ex: '5 anos de experiência (60+ meses de atuação)').");
  }

  // Degree variations
  const degreeRegex = /(gradua[çc][ãa]o|bacharelado|ensino\s+superior|bachelor|degree|licenciatura|p[óo]s-gradua[çc][ãa]o)/i;
  if (degreeRegex.test(eduText) || degreeRegex.test(fullDocumentText)) {
    entityScore += 5;
  } else {
    recommendations.push("Padronize a formação acadêmica usando variações reconhecidas pelo regex do ATS (Graduação / Bacharelado).");
  }

  // Acronym + spelled out variations (e.g. Node.js (NodeJS), TypeScript (TS), CI/CD)
  const acronymRegex = /\b(ts|js|ci\/cd|nodejs|aws|gcp|rest|sql)\b/i;
  if (acronymRegex.test(fullDocumentText)) {
    entityScore += 5;
  } else {
    entityScore += 2;
  }

  const overallScore = Math.min(
    100,
    Math.round(formattingScore + keywordScore + densityScore + entityScore)
  );

  return {
    overallScore,
    breakdown: {
      formatting: formattingScore,
      keywords: keywordScore,
      density: densityScore,
      entityCompliance: entityScore
    },
    matchedKeywords,
    missingKeywords,
    keywordDensity,
    recommendations
  };
}
