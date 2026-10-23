import { franc } from "franc";

export type SupportedLanguage = "pt" | "en";

export function detectLanguage(text: string): SupportedLanguage {
  if (!text || text.trim().length === 0) return "pt";

  // Quick check for very clear Portuguese markers
  const ptMarkers =
    /\b(vaga|requisitos|experiência|benefícios|desenvolvedor|atuação|conhecimento|ensino|formação)\b/i;
  const enMarkers =
    /\b(responsibilities|requirements|experience|benefits|developer|engineer|skills|degree)\b/i;

  const ptMatches = (text.match(ptMarkers) || []).length;
  const enMatches = (text.match(enMarkers) || []).length;

  if (ptMatches > enMatches && ptMatches >= 2) return "pt";
  if (enMatches > ptMatches && enMatches >= 2) return "en";

  const detected = franc(text, { minLength: 10 });
  if (detected === "por") return "pt";
  if (detected === "eng") return "en";

  // Fallback to checking word characteristics
  return ptMatches >= enMatches ? "pt" : "en";
}
