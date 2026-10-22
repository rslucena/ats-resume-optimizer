import type { ResumeData } from "../types/resume.ts";
import { sanitizeLocation } from "../services/cvExtractor.ts";
import { formatDateRange } from "../utils/dateFormat.ts";
import { sanitizeResumeUtf8 } from "../utils/encoding.ts";

export function generateAtsMarkdown(rawResume: ResumeData): string {
  const resume = sanitizeResumeUtf8(rawResume);
  const lines: string[] = [];

  // Header
  lines.push(`# ${resume.fullName}`);
  if (resume.headline) {
    lines.push(`**${resume.headline}**`);
  }
  lines.push("");

  const cleanLocation = sanitizeLocation(resume.location);
  const contacts: string[] = [];
  if (resume.email) contacts.push(`[${resume.email}](mailto:${resume.email})`);
  if (resume.phone) contacts.push(resume.phone);
  if (cleanLocation) contacts.push(cleanLocation);
  if (resume.linkedin) contacts.push(`[LinkedIn](${resume.linkedin})`);
  if (resume.github) contacts.push(`[GitHub](${resume.github})`);
  if (resume.portfolio) contacts.push(`[Portfolio](${resume.portfolio})`);

  if (contacts.length > 0) {
    lines.push(contacts.join(" | "));
    lines.push("");
  }

  // Resumo
  if (resume.summary) {
    lines.push("## Resumo Profissional");
    lines.push("");
    lines.push(resume.summary);
    lines.push("");
  }

  // Experiências
  if (resume.experiences && resume.experiences.length > 0) {
    lines.push("## Experiência Profissional");
    lines.push("");
    for (const exp of resume.experiences) {
      const dates = formatDateRange(exp.startDate, exp.endDate);
      const title = dates ? `### ${exp.role} — ${exp.company} *(${dates})*` : `### ${exp.role} — ${exp.company}`;
      lines.push(title);
      lines.push("");
      const bullets = (exp.description || "")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);
      for (const bullet of bullets) {
        const text = bullet.replace(/^[•\-\*]\s*/, "");
        lines.push(`- ${text}`);
      }
      lines.push("");
    }
  }

  // Formação
  if (resume.education && resume.education.length > 0) {
    lines.push("## Formação Acadêmica");
    lines.push("");
    for (const edu of resume.education) {
      const dates = formatDateRange(edu.startDate, edu.endDate);
      const line = dates ? `- **${edu.degree}** — ${edu.institution} *(${dates})*` : `- **${edu.degree}** — ${edu.institution}`;
      lines.push(line);
    }
    lines.push("");
  }

  // Habilidades
  if (resume.skills && resume.skills.length > 0) {
    lines.push("## Habilidades Técnicas");
    lines.push("");
    lines.push(resume.skills.map(s => `\`${s}\``).join(" • "));
    lines.push("");
  }

  // Certificações
  if (resume.certifications && resume.certifications.length > 0) {
    lines.push("## Certificações");
    lines.push("");
    for (const cert of resume.certifications) {
      lines.push(`- ${cert}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
