import { describe, expect, it } from "bun:test";
import { detectLanguage } from "../src/nlp/language.ts";
import { stemWord, getStemmer } from "../src/nlp/stemmer.ts";
import { extractKeywords, calculateTfIdfDensity } from "../src/nlp/tfidf.ts";
import { termSimilarity } from "../src/nlp/similarity.ts";

describe("Mathematical NLP & TF-IDF Extraction Engine", () => {
  it("should detect language correctly with franc", () => {
    const ptText = "Vaga para Engenheiro de Software Senior com experiência em Node.js, microsserviços e banco de dados relacional.";
    const enText = "We are seeking a Senior Backend Engineer with hands-on experience in distributed systems and cloud platforms.";

    expect(detectLanguage(ptText)).toBe("pt");
    expect(detectLanguage(enText)).toBe("en");
  });

  it("should stem words using PorterStemmerPt and PorterStemmer", () => {
    // Portuguese
    const ptStem = stemWord("trabalhando", "pt");
    expect(ptStem).toBeDefined();
    expect(ptStem.length).toBeLessThan("trabalhando".length);
    expect(stemWord("trabalhadores", "pt")).toBe(ptStem);

    // English
    const enStem = stemWord("developing", "en");
    expect(enStem).toBe("develop");
    expect(stemWord("developer", "en")).toBe("develop");
  });

  it("should extract top keywords ranked by natural.TfIdf and remove stopwords", () => {
    const jobDescription = `
      Estamos buscando Desenvolvedor Backend Senior para atuar com TypeScript, Bun e Node.js.
      O profissional irá construir microsserviços de alto desempenho, APIs RESTful e modelagem em PostgreSQL.
      Requisitos:
      - 5 anos de experiência com TypeScript e Node.js
      - Domínio em Docker e microsserviços
      - Conhecimento em CI/CD e testes automatizados
      - Banco de dados PostgreSQL e SQLite
    `;

    const keywords = extractKeywords(jobDescription, { lang: "pt", topN: 15 });
    
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.length).toBeLessThanOrEqual(15);

    const terms = keywords.map(k => k.term.toLowerCase());
    // Should include high-weight technical keywords
    expect(terms.some(t => t.includes("typescript"))).toBe(true);
    expect(terms.some(t => t.includes("node.js") || t.includes("node"))).toBe(true);
    expect(terms.some(t => t.includes("microsserviços") || t.includes("microsservicos"))).toBe(true);

    // Each keyword must have tfidf score, occurrence count and stem
    for (const kw of keywords) {
      expect(kw.tfidf).toBeGreaterThan(0);
      expect(kw.count).toBeGreaterThanOrEqual(1);
      expect(kw.stem).toBeDefined();
    }
  });

  it("should calculate term density and similarity with leven", () => {
    const text = "Node.js e TypeScript são essenciais. Node.js backend com TypeScript e Bun.";
    const density = calculateTfIdfDensity(text, ["node.js", "typescript", "bun"]);

    expect(density["node.js"]).toBe(2);
    expect(density["typescript"]).toBe(2);
    expect(density["bun"]).toBe(1);

    expect(termSimilarity("PostgreSQL", "Postgres")).toBeGreaterThan(0.7);
    expect(termSimilarity("TypeScript", "Javascript")).toBeLessThan(0.7);
  });
});
