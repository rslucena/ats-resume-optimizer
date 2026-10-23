import { sanitizeLocation } from "../services/cvExtractor.ts";
import type { ResumeData } from "../types/resume.ts";
import { formatDateRange } from "../utils/dateFormat.ts";
import { sanitizeResumeUtf8 } from "../utils/encoding.ts";

export function generateAtsPlainText(rawResume: ResumeData): string {
  const resume = sanitizeResumeUtf8(rawResume);
  const lines: string[] = [];

  // Candidate Name & Headline
  lines.push(resume.fullName.toUpperCase());
  if (resume.headline) {
    lines.push(resume.headline);
  }
  lines.push("");

  // Contact Info
  const cleanLocation = sanitizeLocation(resume.location);
  const contactParts = [
    resume.email,
    resume.phone,
    cleanLocation,
    resume.linkedin,
    resume.github,
    resume.portfolio,
  ].filter(Boolean);

  if (contactParts.length > 0) {
    lines.push(contactParts.join(" | "));
    lines.push("");
  }

  // 1. Resumo Profissional
  if (resume.summary) {
    lines.push("RESUMO PROFISSIONAL");
    lines.push("-------------------");
    lines.push(resume.summary);
    lines.push("");
  }

  // 2. Experiência Profissional
  if (resume.experiences && resume.experiences.length > 0) {
    lines.push("EXPERIÊNCIA PROFISSIONAL");
    lines.push("------------------------");
    for (const exp of resume.experiences) {
      const dates = formatDateRange(exp.startDate, exp.endDate);
      const header = dates
        ? `${exp.role} — ${exp.company} (${dates})`
        : `${exp.role} — ${exp.company}`;
      lines.push(header);
      const bullets = (exp.description || "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      for (const bullet of bullets) {
        const text = bullet.replace(/^[•\-*]\s*/, "");
        lines.push(`• ${text}`);
      }
      lines.push("");
    }
  }

  // 3. Formação Acadêmica
  if (resume.education && resume.education.length > 0) {
    lines.push("FORMAÇÃO ACADÊMICA");
    lines.push("------------------");
    for (const edu of resume.education) {
      const dates = formatDateRange(edu.startDate, edu.endDate);
      const line = dates
        ? `${edu.degree} — ${edu.institution} (${dates})`
        : `${edu.degree} — ${edu.institution}`;
      lines.push(line);
    }
    lines.push("");
  }

  // 4. Habilidades Técnicas
  if (resume.skills && resume.skills.length > 0) {
    lines.push("HABILIDADES TÉCNICAS");
    lines.push("--------------------");
    lines.push(resume.skills.join(" • "));
    lines.push("");
  }

  // 5. Certificações
  if (resume.certifications && resume.certifications.length > 0) {
    lines.push("CERTIFICAÇÕES");
    lines.push("-------------");
    for (const cert of resume.certifications) {
      lines.push(`• ${cert}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
