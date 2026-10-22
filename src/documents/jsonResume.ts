import type { ResumeData } from "../types/resume.ts";
import { sanitizeLocation } from "../services/cvExtractor.ts";

export function generateJsonResume(resume: ResumeData): Record<string, any> {
  const cleanLocation = sanitizeLocation(resume.location);
  const profiles: Array<{ network: string; url: string }> = [];
  if (resume.linkedin) profiles.push({ network: "LinkedIn", url: resume.linkedin });
  if (resume.github) profiles.push({ network: "GitHub", url: resume.github });
  if (resume.portfolio) profiles.push({ network: "Portfolio", url: resume.portfolio });

  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: resume.fullName,
      label: resume.headline || "",
      email: resume.email,
      phone: resume.phone || "",
      summary: resume.summary || "",
      location: cleanLocation ? { address: cleanLocation } : undefined,
      profiles
    },
    work: (resume.experiences || []).map(exp => {
      const bullets = (exp.description || "")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => l.replace(/^[•\-\*]\s*/, ""));
      return {
        name: exp.company,
        position: exp.role,
        startDate: exp.startDate || "",
        endDate: exp.endDate || "",
        summary: bullets[0] || "",
        highlights: bullets
      };
    }),
    education: (resume.education || []).map(edu => ({
      institution: edu.institution,
      area: edu.degree,
      studyType: edu.degree,
      startDate: edu.startDate || "",
      endDate: edu.endDate || ""
    })),
    skills: [
      {
        name: "Habilidades Técnicas",
        level: "Senior",
        keywords: resume.skills || []
      }
    ],
    certificates: (resume.certifications || []).map(cert => ({
      name: cert
    }))
  };
}
