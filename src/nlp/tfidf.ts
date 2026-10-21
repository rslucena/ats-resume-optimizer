import natural from "natural";
import { getStopwords } from "./stopwords.ts";
import { stemWord } from "./stemmer.ts";
import type { SupportedLanguage } from "./language.ts";

export interface ExtractedKeyword {
  term: string;
  tfidf: number;
  count: number;
  stem: string;
}

export interface ExtractKeywordOptions {
  lang?: SupportedLanguage;
  topN?: number;
}

// Known common compound tech terms to preserve before single-word tokenization
const COMPOUND_TECH_TERMS = [
  "node.js",
  "next.js",
  "vue.js",
  "react.js",
  "ci/cd",
  "restful apis",
  "rest api",
  "banco de dados",
  "machine learning",
  "deep learning",
  "cloud computing",
  "infraestrutura como código",
  "infrastructure as code",
  "sql server",
  "testes automatizados",
  "automated tests",
  "design patterns"
];

export function extractKeywords(text: string, options: ExtractKeywordOptions = {}): ExtractedKeyword[] {
  const lang = options.lang || "pt";
  const topN = options.topN || 15;
  const stopwords = getStopwords(lang);

  if (!text || text.trim().length === 0) return [];

  const lowerText = text.toLowerCase();
  const foundCompounds: Record<string, number> = {};

  // Check compound tech terms
  for (const compound of COMPOUND_TECH_TERMS) {
    const escaped = compound.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) {
      foundCompounds[compound] = matches.length;
    }
  }

  // Tokenize words, preserving unicode letters, digits, and tech symbols
  const words = lowerText
    .replace(/[^\p{L}\p{N}\s.+#\/-]/gu, " ")
    .split(/\s+/)
    .map(w => w.trim().replace(/^[\.\-\/]+|[\.\-\/]+$/g, ""))
    .filter(w => w.length > 1);

  // Build document for natural.TfIdf
  const tfidf = new natural.TfIdf();
  tfidf.addDocument(lowerText);

  // Term frequency map
  const termCounts: Record<string, number> = { ...foundCompounds };

  for (const word of words) {
    if (stopwords.has(word)) continue;
    if (word.length <= 2 && !["go", "c", "r", "ui", "ux", "ts", "js", "ai"].includes(word)) continue;
    if (/^\d+$/.test(word)) continue; // purely numeric

    termCounts[word] = (termCounts[word] || 0) + 1;
  }

  const results: ExtractedKeyword[] = [];
  const seenStems = new Set<string>();

  for (const [term, count] of Object.entries(termCounts)) {
    const stem = stemWord(term, lang);
    let score = 0;
    tfidf.tfidfs(term, (i, measure) => {
      score = measure;
    });

    // If tfidf measure was 0 (e.g. for compound phrases not directly tokenized by natural), compute a normalized score
    if (score === 0) {
      score = count * 1.5;
    }

    results.push({
      term,
      tfidf: Number(score.toFixed(3)),
      count,
      stem
    });
  }

  // Sort descending by TF-IDF score, then by count
  results.sort((a, b) => b.tfidf - a.tfidf || b.count - a.count);

  // Deduplicate very close stems to keep variety
  const filtered: ExtractedKeyword[] = [];
  for (const kw of results) {
    if (filtered.length >= topN) break;
    if (!seenStems.has(kw.stem) || COMPOUND_TECH_TERMS.includes(kw.term)) {
      seenStems.add(kw.stem);
      filtered.push(kw);
    }
  }

  return filtered;
}

export function calculateTfIdfDensity(text: string, terms: string[]): Record<string, number> {
  const lowerText = text.toLowerCase();
  const density: Record<string, number> = {};

  for (const term of terms) {
    const cleanTerm = term.toLowerCase().trim();
    if (!cleanTerm) continue;

    const escaped = cleanTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    const matches = lowerText.match(regex);
    density[cleanTerm] = matches ? matches.length : 0;
  }

  return density;
}
