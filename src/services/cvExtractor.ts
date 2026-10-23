import pdfParse from "pdf-parse";
import type {
  EducationItem,
  ExperienceItem,
  ResumeData,
} from "../types/resume.ts";
import { sanitizeResumeUtf8, sanitizeUtf8 } from "../utils/encoding.ts";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return sanitizeUtf8(data.text || "");
}

export const DATE_RANGE_REGEX =
  /(?:(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:ço|co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s*(?:de\s+)?\d{4}|\b(?:19|20)\d{2}\b|\b\d{1,2}\/\d{4}\b)(?:\s*[-–—~a]\s*|\s+)(?:(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:ço|co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s*(?:de\s+)?\d{4}|\b(?:19|20)\d{2}\b|\b\d{1,2}\/\d{4}\b|presente|present|atual|o momento|current)/i;

const LOCATION_PATTERN =
  /^([A-ZÀ-ÿ][a-zA-ZÀ-ÿ\s.-]+(?:,\s*|-|\/)\s*(?:[A-Z]{2}|Brasil|Brazil|SP|RJ|MG|RS|PR|SC|BA|PE|DF|Remoto|Remote)(?:\s*\([^)]*\))?|Remoto|Remote|São Paulo[^\n]*|Jundiaí\s*-\s*SP)$/i;

export function sanitizeRawCvText(text: string): string {
  if (!text) return "";
  return (
    sanitizeUtf8(text)
      // Remove Page X of Y and Página X de Y markers
      .replace(/(?:Page|Página)\s+\d+(?:\s+(?:of|de)\s+\d+)?/gi, "")
      // Remove standalone Page numbers e.g. "Page 1"
      .replace(/\bPage\s+\d+\b/gi, "")
      // Remove LinkedIn sidebar url annotations
      .replace(
        /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s)]+(?:\s*\((?:LinkedIn|GitHub)\))?/gi,
        "",
      )
      .replace(
        /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)]+(?:\s*\((?:LinkedIn|GitHub)\))?/gi,
        "",
      )
      // Remove common standalone sidebar header markers that leak into lines
      .replace(/\b(Top Skills|Languages|Honors-Awards)\b/gi, "")
  );
}

export function sanitizeLocation(loc?: string): string | undefined {
  if (!loc) return undefined;
  let clean = loc.trim();
  // Remove CEP or postal codes e.g. "CEP: 01234-567" or "01234-567"
  clean = clean.replace(/\bCEP\s*:?\s*\d{5}-?\d{3}\b/gi, "").trim();
  clean = clean.replace(/\b\d{5}-?\d{3}\b/g, "").trim();
  // Remove street address prefixes e.g. "Rua X, 123 - ", "Av. Y, nº 45"
  clean = clean
    .replace(
      /^(?:Rua|Av\.|Avenida|Alameda|Travessa|Rodovia|Praça)\s+[^,-]+(?:,\s*(?:nº|n°|n\.)?\s*\d+[^,-]*)?[-–—,\s]*/i,
      "",
    )
    .trim();
  // Remove trailing and leading punctuation/dashes
  clean = clean.replace(/^[-–—,\s/]+|[-–—,\s/]+$/g, "").trim();
  return clean.length > 0 ? clean : undefined;
}

export function isLocationLine(line: string): boolean {
  if (!line || line.length > 70) return false;
  const trimmed = line.trim();
  return (
    LOCATION_PATTERN.test(trimmed) ||
    /^[A-ZÀ-ÿ\s]+,\s*(?:Brasil|Brazil|[A-Z]{2})$/i.test(trimmed) ||
    /^[A-ZÀ-ÿ\s]+\s*-\s*[A-Z]{2}$/i.test(trimmed)
  );
}

function splitDateRange(str: string): [string, string] {
  const clean = str.replace(/\(.*?\)/g, "").trim();
  let parts = clean
    .split(/\s*[-–—~]\s*|\s+a\s+|\s+to\s+|\s+até\s+/i)
    .map((s) => s.trim());
  if (parts.length === 1) {
    const twoDatesMatch = clean.match(
      /^(.+?\b(?:19\d\d|20\d\d))\s+(.+?\b(?:19\d\d|20\d\d|\batual\b|\bpresente?\b))$/i,
    );
    if (twoDatesMatch) {
      parts = [twoDatesMatch[1].trim(), twoDatesMatch[2].trim()];
    }
  }
  return [parts[0] || "2021", parts[1] || "Atual"];
}

/**
 * Unites broken visual PDF lines into cohesive grammatical sentences / paragraphs.
 * If line 1 does not end with terminal punctuation (or ends with a connective / hyphen),
 * and line 2 starts with lowercase or continues the clause, joins them into a single bullet.
 */
export function reflowExperienceLines(rawLines: string[]): string[] {
  if (!rawLines || rawLines.length === 0) return [];

  const reflowed: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    if (reflowed.length === 0) {
      reflowed.push(line);
      continue;
    }

    const prevIdx = reflowed.length - 1;
    const prevLine = reflowed[prevIdx].trim();

    // Check if current line starts with explicit bullet marker
    const isExplicitBullet = /^[•*\-–—]\s+/.test(line);

    // Check if previous line ended with terminal punctuation (. ! ? : ;)
    const prevEndsWithTerminal = /[.!?:;]$/.test(prevLine);

    // Clean text without bullet marker to inspect first word
    const textWithoutBullet = isExplicitBullet
      ? line.replace(/^[•*\-–—]\s+/, "")
      : line;

    // Check if starts with lowercase
    const startsWithLowercase = /^[a-zà-ÿ]/.test(textWithoutBullet);

    // Check if previous line ended with a hyphen indicating word wrap (e.g. "desenvolvi-")
    const prevEndsWithHyphen = /[a-zA-ZÀ-ÿ]-$/.test(prevLine);

    // Check if previous line ends with a preposition / connector / comma
    const prevEndsWithConnector =
      /[,]$|\b(em|de|com|para|por|e|ou|que|do|da|dos|das|no|na|nos|nas|in|with|for|to|and|or|by|of|at|sem|sobre|sob)$/i.test(
        prevLine,
      );

    // Check if line is a short continuation fragment (e.g. "- MySQL.") when previous line did not finish with terminal punctuation
    const isShortContinuation =
      !prevEndsWithTerminal && textWithoutBullet.split(/\s+/).length <= 4;

    // Should we merge current line into prevLine?
    const shouldMerge =
      prevEndsWithHyphen ||
      prevEndsWithConnector ||
      (startsWithLowercase && !prevEndsWithTerminal) ||
      (!prevEndsWithTerminal && !isExplicitBullet) ||
      isShortContinuation;

    if (shouldMerge) {
      if (prevEndsWithHyphen) {
        reflowed[prevIdx] = prevLine.slice(0, -1) + textWithoutBullet;
      } else {
        reflowed[prevIdx] = `${prevLine} ${textWithoutBullet}`;
      }
    } else {
      reflowed.push(line);
    }
  }

  return reflowed;
}

export function parseMasterProfileText(rawText: string): ResumeData {
  const sanitized = sanitizeRawCvText(rawText);
  const lines = sanitized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Email
  const emailMatch = rawText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0].trim() : "candidato@email.com";

  // 2. Phone
  const phoneMatch = rawText.match(
    /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/,
  );
  const phone = phoneMatch ? phoneMatch[0].trim() : undefined;

  // 2.1 Location (Privacy Safe: City, State only)
  const locationCandidate = lines.find(
    (l) => isLocationLine(l) && !l.includes("@") && !l.includes("http"),
  );
  const location = sanitizeLocation(locationCandidate);

  // 3. Links
  const linkedinMatch = rawText.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w\-_]+/i,
  );
  const linkedin = linkedinMatch ? linkedinMatch[0].trim() : undefined;

  const githubMatch = rawText.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-_]+/i,
  );
  const github = githubMatch ? githubMatch[0].trim() : undefined;

  // 4. Candidate Full Name & Headline
  let fullName = "Nome do Candidato";
  let headline = "Engenheiro de Software";

  if (lines.length > 0) {
    const firstNonContactLine = lines.find(
      (l) =>
        !l.includes("@") &&
        !l.includes("linkedin.com") &&
        !l.includes("http") &&
        !l.toLowerCase().includes("contact") &&
        l.length < 50,
    );
    if (firstNonContactLine) {
      fullName = firstNonContactLine;
    }
  }

  const headlineCandidate = lines.find(
    (l) =>
      l !== fullName &&
      !l.includes("@") &&
      !l.includes("linkedin.com") &&
      !l.includes("github.com") &&
      !l.includes("+55") &&
      !isLocationLine(l) &&
      (l.toLowerCase().includes("desenvolvedor") ||
        l.toLowerCase().includes("engenheiro") ||
        l.toLowerCase().includes("analista") ||
        l.toLowerCase().includes("engineer") ||
        l.toLowerCase().includes("developer") ||
        l.toLowerCase().includes("lead") ||
        l.toLowerCase().includes("specialist") ||
        l.toLowerCase().includes("especialista")),
  );
  if (headlineCandidate) {
    headline = headlineCandidate;
  }

  // 5. Section Parsing using section markers
  const sectionKeywords = [
    {
      key: "summary",
      regex: /^(resumo(\s+profissional)?|summary|sobre|perfil)$/i,
    },
    {
      key: "experience",
      regex:
        /^(experi[êe]ncia(\s+profissional)?|work\s+experience|hist[óo]rico)$/i,
    },
    {
      key: "education",
      regex: /^(forma[çc][ãa]o(\s+acad[êe]mica)?|educa[çc][ãa]o|education)$/i,
    },
    {
      key: "skills",
      regex:
        /^(habilidades(\s+t[ée]cnicas)?|skills|compet[êe]ncias|top\s+skills)$/i,
    },
    {
      key: "certifications",
      regex: /^(certifica[çc][õo]es|certifications|cursos)$/i,
    },
  ];

  const sections: Record<string, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    certifications: [],
  };

  const preambleLines: string[] = [];
  let currentSection = "preamble";

  for (const line of lines) {
    // Check if line matches section header
    const matchedKey = sectionKeywords.find((sk) => sk.regex.test(line));

    if (matchedKey) {
      currentSection = matchedKey.key;
      continue;
    }

    if (line !== fullName && line !== headline) {
      if (currentSection === "preamble") {
        preambleLines.push(line);
      } else {
        sections[currentSection]?.push(line);
      }
    }
  }

  // 6. Parse Experiences
  const experiences: ExperienceItem[] = [];
  const expLines = sections.experience;
  let idx = 0;
  const unassignedIntroLines: string[] = [];

  while (idx < expLines.length) {
    const line = expLines[idx];

    // Case 1: Standard inline format: "Cargo — Empresa (Data)" or "Empresa - Cargo (Data)"
    const inlineMatch = line.match(/^(.+?)\s*[—–-]\s*(.+?)\s*\((.+?)\)$/);
    if (inlineMatch && DATE_RANGE_REGEX.test(inlineMatch[3])) {
      const role = inlineMatch[1].trim();
      const company = inlineMatch[2].trim();
      const [start, end] = splitDateRange(inlineMatch[3]);

      idx++;
      const descLines: string[] = [];
      while (idx < expLines.length) {
        const next = expLines[idx];
        const nextInline = next.match(/^(.+?)\s*[—–-]\s*(.+?)\s*\((.+?)\)$/);
        if (nextInline && DATE_RANGE_REGEX.test(nextInline[3])) break;
        if (
          idx + 1 < expLines.length &&
          DATE_RANGE_REGEX.test(expLines[idx + 1])
        )
          break;
        if (
          idx + 2 < expLines.length &&
          DATE_RANGE_REGEX.test(expLines[idx + 2])
        )
          break;
        descLines.push(next);
        idx++;
      }

      experiences.push({
        role,
        company,
        startDate: start,
        endDate: end,
        description: reflowExperienceLines(descLines).join("\n"),
      });
      continue;
    }

    // Case 2: Multi-line LinkedIn format (Company \n Role \n Date line \n Location? \n Description)
    let foundDateIdx = -1;
    if (DATE_RANGE_REGEX.test(line)) {
      foundDateIdx = idx;
    } else if (
      idx + 1 < expLines.length &&
      DATE_RANGE_REGEX.test(expLines[idx + 1])
    ) {
      foundDateIdx = idx + 1;
    } else if (
      idx + 2 < expLines.length &&
      DATE_RANGE_REGEX.test(expLines[idx + 2])
    ) {
      foundDateIdx = idx + 2;
    }

    if (foundDateIdx !== -1) {
      let company = "Empresa";
      let role = "Cargo";
      const dateLine = expLines[foundDateIdx];

      if (foundDateIdx === idx) {
        role = "Engenheiro de Software";
      } else if (foundDateIdx === idx + 1) {
        role = expLines[idx];
      } else if (foundDateIdx === idx + 2) {
        company = expLines[idx];
        role = expLines[idx + 1];
      }

      const [start, end] = splitDateRange(dateLine);

      let nextIdx = foundDateIdx + 1;
      let expLocation: string | undefined;
      if (nextIdx < expLines.length && isLocationLine(expLines[nextIdx])) {
        expLocation = expLines[nextIdx];
        nextIdx++;
      }

      const descLines: string[] = [];
      while (nextIdx < expLines.length) {
        const next = expLines[nextIdx];
        const nextInline = next.match(/^(.+?)\s*[—–-]\s*(.+?)\s*\((.+?)\)$/);
        if (nextInline && DATE_RANGE_REGEX.test(nextInline[3])) break;
        if (
          nextIdx + 1 < expLines.length &&
          DATE_RANGE_REGEX.test(expLines[nextIdx + 1])
        )
          break;
        if (
          nextIdx + 2 < expLines.length &&
          DATE_RANGE_REGEX.test(expLines[nextIdx + 2])
        )
          break;
        descLines.push(next);
        nextIdx++;
      }

      experiences.push({
        company,
        role,
        startDate: start,
        endDate: end,
        location: expLocation,
        description: reflowExperienceLines(descLines).join("\n"),
      });

      idx = nextIdx;
      continue;
    }

    // Lines that appear before the first real experience belong to summary/intro
    if (experiences.length === 0) {
      unassignedIntroLines.push(line);
    }

    idx++;
  }

  // Fallback experience if none matched
  if (experiences.length === 0) {
    experiences.push({
      company: "Atuação Profissional",
      role: headline,
      startDate: "2021",
      endDate: "Atual",
      description:
        sections.experience.join("\n") ||
        "Atuação em desenvolvimento de software e entregas de projetos.",
    });
  }

  // 7. Parse Summary (incorporating unassigned intro lines or non-contact preamble)
  let summaryLines = [...sections.summary, ...unassignedIntroLines];
  if (summaryLines.length === 0 && preambleLines.length > 0) {
    summaryLines = preambleLines.filter(
      (l) =>
        !l.includes("@") &&
        !l.includes("linkedin.com") &&
        !l.includes("github.com") &&
        !l.includes("+55") &&
        !isLocationLine(l) &&
        !/^(contact|top skills|languages|certifications)$/i.test(l),
    );
  }
  const summary =
    summaryLines.join(" ").trim() ||
    `${headline} com sólida experiência profissional.`;

  // 8. Parse Education (grouping multi-line LinkedIn items and inline items)
  const education: EducationItem[] = [];
  let currentInst = "";
  let degreeBuffer: string[] = [];

  for (const line of sections.education) {
    // Case A: Inline format "Degree — Institution (Dates)"
    const inlineEdu = line.match(/^(.+?)\s*[—–-]\s*(.+?)\s*\((.*?)\)$/);
    if (inlineEdu) {
      const part1 = inlineEdu[1].trim();
      const part2 = inlineEdu[2].trim();
      const [start, end] = splitDateRange(inlineEdu[3]);

      let degree = part1;
      let institution = part2;
      if (
        /universidade|faculdade|instituto|senac|fiap|usp|unicamp|puc|escola|college/i.test(
          part1,
        ) &&
        !/universidade|faculdade|instituto|senac|fiap|usp|unicamp|puc|escola|college/i.test(
          part2,
        )
      ) {
        institution = part1;
        degree = part2;
      }

      education.push({
        degree,
        institution,
        startDate: start || "2016",
        endDate: end || "2020",
      });
      continue;
    }

    // Case B: LinkedIn multi-line: Institution \n Degree · (Dates)
    const dateMatch = line.match(
      /\((?:(?:\w+\s+de\s+)?(\d{4})|\b(\d{4})\b)\s*[-–—~a]\s*(?:(?:\w+\s+de\s+)?(\d{4})|\b(\d{4})\b|presente|present|atual)\)/i,
    );

    if (dateMatch) {
      const cleanDegreeLine = line.replace(/·?\s*\((.*?)\)/, "").trim();
      if (cleanDegreeLine) degreeBuffer.push(cleanDegreeLine);
      const fullDegree = degreeBuffer.join(" ").trim() || "Graduação";

      const startYear = dateMatch[1] || dateMatch[2] || "2016";
      const endYear = dateMatch[3] || dateMatch[4] || "2020";

      education.push({
        institution: currentInst || "Instituição de Ensino",
        degree: fullDegree,
        startDate: startYear,
        endDate: endYear,
      });

      currentInst = "";
      degreeBuffer = [];
    } else {
      if (!currentInst) {
        currentInst = line;
      } else {
        degreeBuffer.push(line);
      }
    }
  }

  // Separate formal academic education from short courses/certifications (< 360h)
  const formalEducation: EducationItem[] = [];
  const extractedCourses: string[] = [];

  for (const edu of education) {
    const combined = `${edu.degree} ${edu.institution}`.toLowerCase();
    const isCertificationOrShortCourse =
      combined.includes("certification") ||
      combined.includes("certificação") ||
      combined.includes("certificado") ||
      combined.includes("bootcamp") ||
      combined.includes("nanodegree") ||
      combined.includes("curso livre") ||
      combined.includes("treinamento");

    if (isCertificationOrShortCourse) {
      extractedCourses.push(
        `${edu.degree} — ${edu.institution} (${edu.startDate})`,
      );
    } else {
      formalEducation.push(edu);
    }
  }

  // Fallback education if none parsed
  if (formalEducation.length === 0) {
    formalEducation.push({
      degree: "Bacharelado em Ciência da Computação",
      institution: "Universidade",
      startDate: "2016",
      endDate: "2020",
    });
  }

  // 9. Skills
  const skillsText = sections.skills.join(" ");
  const skills = skillsText
    .split(/[,•\-|;\n]/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 1 &&
        s.length < 40 &&
        !isLocationLine(s) &&
        s.toLowerCase() !== fullName.toLowerCase(),
    );

  // 10. Certifications (Filtering out candidate name, page remnants or locations, plus short courses)
  const certifications = [
    ...sections.certifications.map((c) => c.replace(/^[•\-*]\s*/, "").trim()),
    ...extractedCourses,
  ].filter(
    (c) =>
      c.length > 3 &&
      !c.toLowerCase().includes("page ") &&
      c.toLowerCase() !== fullName.toLowerCase() &&
      c.toLowerCase() !== "brasil" &&
      c.toLowerCase() !== "brazil",
  );

  return sanitizeResumeUtf8({
    fullName,
    headline,
    email,
    phone,
    location,
    linkedin,
    github,
    summary,
    skills:
      skills.length > 0 ? skills : ["TypeScript", "Node.js", "Docker", "SQL"],
    experiences,
    education: formalEducation,
    certifications,
    rawText: sanitized,
  });
}
