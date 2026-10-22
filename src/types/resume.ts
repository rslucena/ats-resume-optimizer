export interface ExperienceItem {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface EducationItem {
  institution: string;
  degree: string;
  startDate: string;
  endDate: string;
}

export interface ResumeData {
  fullName: string;
  headline: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary: string;
  skills: string[];
  experiences: ExperienceItem[];
  education: EducationItem[];
  certifications?: string[];
  rawText?: string;
}

export interface AtsAuditResult {
  overallScore: number; // 0 - 100
  scannabilityScore: number; // 0 - 100: "Índice de Escaneabilidade & Impacto" (Humano / 6s Scan)
  technicalScore: number; // 0 - 100: "Alinhamento Técnico TF-IDF" (Robô ATS / Hard skills)
  scannabilityBreakdown: {
    structureClarity: number; // Max 30
    quantifiableMetrics: number; // Max 45
    humanReadability: number; // Max 25
    metricsFoundCount: number;
    metricsFound: string[];
  };
  breakdown: {
    formatting: number; // Max 30
    keywords: number; // Max 35
    density: number; // Max 20
    entityCompliance: number; // Max 15
  };
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordDensity: Record<string, number>;
  recommendations: string[];
}

