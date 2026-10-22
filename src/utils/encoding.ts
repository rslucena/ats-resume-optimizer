/**
 * Strict UTF-8 normalization and sanitization utilities.
 * Handles Unicode Canonical Composition (NFC), strips soft hyphens (&shy;),
 * normalizes dashes, spaces, and typographical ligatures to preserve
 * accents, cedilhas, and technical terms like RESTful across all parsers,
 * database storage, and document generators (PDF, DOCX, TXT, MD, JSON).
 */

export function sanitizeUtf8(text: string): string {
  if (!text) return "";
  return text
    // 1. Unicode NFC Normalization (composes decomposed accents e.g. c + cedilla -> ç)
    .normalize("NFC")
    // 2. Remove invisible soft hyphens (\u00AD, &shy;) that break words like RESTful -> REST-ful
    .replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, "")
    // 3. Normalize non-breaking and unusual unicode spaces to standard space
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    // 4. Normalize unicode hyphens/dashes to standard hyphen '-' (preserving em-dash '—' and en-dash '–' when intentional)
    .replace(/[\u2010\u2011\u2012\u2212\uFE63\uFF0D]/g, "-")
    // 5. Expand typographical ligatures so standard font encodings (like PDFKit Helvetica) don't break
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .trim();
}

/**
 * Deep sanitizes all string fields in an object or array to ensure strict UTF-8 NFC.
 */
export function sanitizeResumeUtf8<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data === "string") {
    return sanitizeUtf8(data) as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResumeUtf8(item)) as any;
  }
  if (typeof data === "object") {
    const copy: any = {};
    for (const [key, val] of Object.entries(data as any)) {
      copy[key] = sanitizeResumeUtf8(val);
    }
    return copy;
  }
  return data;
}

/**
 * Strips Gupy and institutional HR boilerplate sections (benefits, hiring stages, legal text)
 * from job postings so that benefits like "Plano de Saúde" or process steps never contaminate
 * TF-IDF skill extraction or candidate tailoring.
 */
export function stripJobBoilerplate(rawText: string): string {
  if (!rawText) return "";
  let text = ungluePunctuation(sanitizeUtf8(rawText));

  // Markers that indicate the end of technical requirements and the start of HR boilerplate
  const cutoffRegexes = [
    /(?:^|\n|\.)\s*(?:#+\s*|-+\s*|\*+\s*)?(?:informa[çc][õo]es\s+adicionais)/i,
    /(?:^|\n|\.)\s*(?:#+\s*|-+\s*|\*+\s*)?(?:confira\s+nossos\s+benef[íi]cios|nossos\s+benef[íi]cios|benef[íi]cios\s+da\s+vaga)/i,
    /(?:^|\n|\.)\s*(?:#+\s*|-+\s*|\*+\s*)?(?:etapas?\s+do\s+processo|etapa\s+\d+\s*:\s*[a-z0-9])/i,
    /(?:^|\n|\.)\s*(?:#+\s*|-+\s*|\*+\s*)?(?:valores\s+que\s+entregamos)/i,
    /(?:^|\n|\.)\s*(?:#+\s*|-+\s*|\*+\s*)?(?:junte-se\s+a\s+n[óo]s)/i,
    /(?:^|\n|\.)\s*(?:#+\s*|-+\s*|\*+\s*)?(?:quer\s+saber\s+mais\s+sobre\s+(?:a\s+gente|n[óo]s)\??)/i,
    /(?:^|\n|\.)\s*(?:#+\s*|-+\s*|\*+\s*)?(?:erro\s+ao\s+copiar\s+link)/i,
    /(?:^|\n|\.)\s*(?:#+\s*|-+\s*|\*+\s*)?(?:ir\s+para\s+candidatura)/i,
    /(?:^|\n|\.)\s*(?:#+\s*|-+\s*|\*+\s*)?(?:compartilhe\s+ess?a\s+vaga)/i
  ];

  let earliestCutoff = text.length;

  for (const regex of cutoffRegexes) {
    const match = regex.exec(text);
    if (match && match.index !== undefined) {
      let cutoffIndex = match.index;
      // If matched marker starts with a period (e.g. from "NestJS. Informações"), keep the period on the sentence
      if (match[0].startsWith(".")) {
        cutoffIndex += 1;
      }
      // Do not cut if marker is at the very beginning (< 40 chars)
      if (cutoffIndex > 40 && cutoffIndex < earliestCutoff) {
        earliestCutoff = cutoffIndex;
      }
    }
  }

  if (earliestCutoff < text.length) {
    text = text.slice(0, earliestCutoff);
  }

  // Remove individual junk lines if any remain
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => {
      const l = line.toLowerCase();
      if (!l) return false;
      if (l.includes("erro ao copiar link")) return false;
      if (l.includes("ir para candidatura")) return false;
      if (l.includes("compartilhe essa vaga") || l.includes("compartilhe esta vaga")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

/**
 * Separates words improperly glued by a period (e.g. "Nestjs.Informações" -> "Nestjs. Informações")
 * while strictly preserving genuine technology names (Node.js, Vue.js, Nest.js, Next.js, Socket.io, ASP.NET).
 */
export function ungluePunctuation(text: string): string {
  if (!text) return "";
  return text.replace(
    /([a-zA-ZÀ-ÿ])\.([a-zA-ZÀ-ÿ]+)/g,
    (match, p1, p2) => {
      const lowerP2 = p2.toLowerCase();
      if (["js", "ts", "net", "io", "ai"].includes(lowerP2)) {
        return match; // preserve genuine tech names: Node.js, Nest.js, Vue.js, Socket.io, .NET
      }
      return `${p1}. ${p2}`;
    }
  );
}
