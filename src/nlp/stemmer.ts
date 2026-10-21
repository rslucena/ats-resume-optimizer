import natural from "natural";
import type { SupportedLanguage } from "./language.ts";

export function getStemmer(lang: SupportedLanguage) {
  return lang === "pt" ? natural.PorterStemmerPt : natural.PorterStemmer;
}

export function stemWord(word: string, lang: SupportedLanguage = "pt"): string {
  if (!word) return "";
  const cleaned = word.toLowerCase().trim();
  const stemmer = getStemmer(lang);
  return stemmer.stem(cleaned);
}
