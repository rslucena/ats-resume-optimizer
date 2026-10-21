import pdfParse from "pdf-parse";
import type { ResumeData, ExperienceItem, EducationItem } from "../types/resume.ts";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text || "";
}

export function parseMasterProfileText(rawText: string): ResumeData {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // 1. Email
  const emailMatch = rawText.match(/[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0].trim() : "candidato@email.com";

  // 2. Phone
  const phoneMatch = rawText.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : undefined;

  // 3. Links
  const linkedinMatch = rawText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w\-_]+/i);
  const linkedin = linkedinMatch ? linkedinMatch[0].trim() : undefined;

  const githubMatch = rawText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-_]+/i);
  const github = githubMatch ? githubMatch[0].trim() : undefined;

  // 4. Full Name & Headline (Usually first 1-2 lines before contact or section headers)
  let fullName = "Nome do Candidato";
  let headline = "Engenheiro de Software";

  if (lines.length > 0) {
    const firstNonContactLine = lines.find(l => 
      !l.includes("@") && 
      !l.includes("linkedin.com") && 
      !l.includes("http") &&
      l.length < 50
    );
    if (firstNonContactLine) {
      fullName = firstNonContactLine;
    }
  }

  const headlineCandidate = lines.find(l => 
    l !== fullName && 
    !l.includes("@") && 
    !l.includes("linkedin.com") && 
    !l.includes("github.com") &&
    !l.includes("+55") &&
    (l.toLowerCase().includes("desenvolvedor") || 
     l.toLowerCase().includes("engenheiro") || 
     l.toLowerCase().includes("analista") || 
     l.toLowerCase().includes("engineer") || 
     l.toLowerCase().includes("developer") ||
     l.toLowerCase().includes("lead"))
  );
  if (headlineCandidate) {
    headline = headlineCandidate;
  }

  // 5. Section Parsing using section markers
  const sectionKeywords = [
    { key: "summary", regex: /(resumo(\s+profissional)?|summary|sobre|perfil)/i },
    { key: "experience", regex: /(experi[êe]ncia(\s+profissional)?|work\s+experience|hist[óo]rico)/i },
    { key: "education", regex: /(forma[çc][ãa]o(\s+acad[êe]mica)?|educa[çc][ãa]o|education)/i },
    { key: "skills", regex: /(habilidades(\s+t[ée]cnicas)?|skills|compet[êe]ncias)/i },
    { key: "certifications", regex: /(certifica[çc][õo]es|certifications|cursos)/i }
  ];

  const sections: Record<string, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    certifications: []
  };

  let currentSection = "summary";

  for (const line of lines) {
    // Check if this line is a section header
    const matchedKey = sectionKeywords.find(sk => {
      const match = line.match(sk.regex);
      return match && line.length < 40;
    });

    if (matchedKey) {
      currentSection = matchedKey.key;
      continue;
    }

    if (line !== fullName && line !== headline) {
      sections[currentSection]?.push(line);
    }
  }

  // Extract Summary
  const summary = sections.summary.join(" ").trim() || `${headline} com sólida experiência profissional.`;

  // Extract Skills
  const skillsText = sections.skills.join(" ");
  const skills = skillsText
    .split(/[,•\-\|\;\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 40);

  // Extract Experience
  const experiences: ExperienceItem[] = [];
  let currentExp: Partial<ExperienceItem> | null = null;

  for (const line of sections.experience) {
    // Look for role/company pattern e.g. "Cargo — Empresa (Data)" or "Empresa - Cargo"
    if (line.includes("—") || line.includes(" - ") || line.includes("–") || /\(\d{4}/.test(line)) {
      if (currentExp && currentExp.role) {
        experiences.push({
          company: currentExp.company || "Empresa",
          role: currentExp.role || "Cargo",
          startDate: currentExp.startDate || "2021",
          endDate: currentExp.endDate || "Atual",
          description: currentExp.description?.trim() || ""
        });
      }

      const parts = line.split(/[—–\-]/).map(p => p.trim());
      const role = parts[0] || "Engenheiro de Software";
      const company = parts[1]?.replace(/\(.*\)/, "").trim() || "Empresa";
      
      const dateMatch = line.match(/\((.*?)\)/);
      const dateRange = dateMatch ? dateMatch[1] : "2021 - Atual";
      const [start, end] = dateRange.split(/[\-a]/i).map(d => d.trim());

      currentExp = {
        role,
        company,
        startDate: start || "2021",
        endDate: end || "Atual",
        description: ""
      };
    } else if (currentExp) {
      currentExp.description = currentExp.description ? `${currentExp.description}\n${line}` : line;
    }
  }

  if (currentExp && currentExp.role) {
    experiences.push({
      company: currentExp.company || "Empresa",
      role: currentExp.role || "Cargo",
      startDate: currentExp.startDate || "2021",
      endDate: currentExp.endDate || "Atual",
      description: currentExp.description?.trim() || ""
    });
  }

  // Fallback experience if none was cleanly matched
  if (experiences.length === 0) {
    experiences.push({
      company: "Atuação Profissional",
      role: headline,
      startDate: "2021",
      endDate: "Atual",
      description: sections.experience.join("\n") || "Atuação em desenvolvimento de software e entregas de projetos."
    });
  }

  // Extract Education
  const education: EducationItem[] = [];
  for (const line of sections.education) {
    if (line.length > 5) {
      const parts = line.split(/[—–\-]/).map(p => p.trim());
      const degree = parts[0] || "Ensino Superior";
      const institution = parts[1]?.replace(/\(.*\)/, "").trim() || "Instituição de Ensino";
      const dateMatch = line.match(/\((.*?)\)/);
      const dateRange = dateMatch ? dateMatch[1] : "2016 - 2020";
      const [start, end] = dateRange.split(/[\-a]/i).map(d => d.trim());

      education.push({
        degree,
        institution,
        startDate: start || "2016",
        endDate: end || "2020"
      });
    }
  }

  if (education.length === 0) {
    education.push({
      degree: "Bacharelado em Ciência da Computação",
      institution: "Universidade",
      startDate: "2016",
      endDate: "2020"
    });
  }

  const certifications = sections.certifications.length > 0 
    ? sections.certifications.map(c => c.replace(/^[•\-\*]\s*/, "").trim())
    : [];

  return {
    fullName,
    headline,
    email,
    phone,
    linkedin,
    github,
    summary,
    skills: skills.length > 0 ? skills : ["TypeScript", "Node.js", "Docker", "SQL"],
    experiences,
    education,
    certifications,
    rawText
  };
}
