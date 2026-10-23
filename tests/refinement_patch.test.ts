import { describe, expect, it } from "bun:test";
import { createApp } from "../src/api/routes.ts";
import {
  extractKeywords,
  isExcludedSkillTerm,
  isGenericCorporateTerm,
} from "../src/nlp/tfidf.ts";
import { deduplicateSummary, tailorResume } from "../src/optimizer/tailor.ts";
import type { ResumeData } from "../src/types/resume.ts";
import { sanitizeResumeUtf8, sanitizeUtf8 } from "../src/utils/encoding.ts";

describe("Deep Bugfix & Refinement Patch: UTF-8, TF-IDF Blacklist, Summary Deduplication & UX", () => {
  // 1. UTF-8 & Accents Handling
  describe("1. Strict UTF-8 Encoding & Accent Sanitization", () => {
    it("should normalize NFD accented characters to clean NFC without corruption", () => {
      // Decomposed (NFD): "c" + combining cedilla "\u0327" -> "ç"
      const decomposed = "c\u0327oncessiona\u0301ria e integrac\u0327a\u0303o";
      const sanitized = sanitizeUtf8(decomposed);

      expect(sanitized).toBe("çoncessionária e integração");
      expect(sanitized.normalize("NFC")).toBe(sanitized);
    });

    it("should strip soft hyphens (\\u00AD), zero-width spaces, and control characters", () => {
      // Soft hyphens from web scrapers or PDF extractors: REST\u00ADful, micro\u00ADservi\u00ADços
      const dirty =
        "REST\u00ADful\u200B APIs com micro\u00ADservi\u00ADços e CI/CD";
      const cleaned = sanitizeUtf8(dirty);

      expect(cleaned).toBe("RESTful APIs com microserviços e CI/CD");
      expect(cleaned).not.toContain("\u00AD");
      expect(cleaned).not.toContain("\u200B");
    });

    it("should preserve compound technical acronyms like RESTful, CI/CD, TCP/IP, and Node.js", () => {
      const text =
        "Especialista em arquitetura RESTful, pipelines de CI/CD, protocolos TCP/IP e runtime Node.js";
      const cleaned = sanitizeUtf8(text);

      expect(cleaned).toContain("RESTful");
      expect(cleaned).toContain("CI/CD");
      expect(cleaned).toContain("TCP/IP");
      expect(cleaned).toContain("Node.js");
    });

    it("should deeply sanitize entire resume data structures", () => {
      const dirtyResume: ResumeData = {
        fullName: "Joa\u0303o da Silva\u00AD",
        headline: "Engenheiro de Soluc\u0327o\u0303es REST\u00ADful",
        email: "joao@example.com",
        summary:
          "Profissional com atuac\u0327a\u0303o em microsservic\u0327os.\u200B",
        skills: ["Node.js\u00AD", "CI\u00AD/CD", "Integrac\u0327a\u0303o"],
        experiences: [
          {
            company: "Empresa Inovac\u0327a\u0303o",
            role: "Li\u0301der Te\u0301cnico",
            startDate: "2020",
            endDate: "Atual",
            description:
              "Criac\u0327a\u0303o de APIs REST\u00ADful escalaveis com hifeni\u00ADzac\u0327a\u0303o.",
          },
        ],
        education: [
          {
            institution: "Faculdade de Cie\u0302ncias",
            degree: "Graduac\u0327a\u0303o",
            startDate: "2015",
            endDate: "2019",
          },
        ],
        certifications: ["Certificac\u0327a\u0303o Cloud"],
      };

      const sanitized = sanitizeResumeUtf8(dirtyResume);

      expect(sanitized.fullName).toBe("João da Silva");
      expect(sanitized.headline).toBe("Engenheiro de Soluções RESTful");
      expect(sanitized.summary).toBe(
        "Profissional com atuação em microsserviços.",
      );
      expect(sanitized.skills).toEqual(["Node.js", "CI/CD", "Integração"]);
      expect(sanitized.experiences[0].company).toBe("Empresa Inovação");
      expect(sanitized.experiences[0].role).toBe("Líder Técnico");
      expect(sanitized.experiences[0].description).toBe(
        "Criação de APIs RESTful escalaveis com hifenização.",
      );
      expect(sanitized.education[0].institution).toBe("Faculdade de Ciências");
      expect(sanitized.education[0].degree).toBe("Graduação");
      expect(sanitized.certifications?.[0]).toBe("Certificação Cloud");
    });
  });

  // 2. Summary Deduplication
  describe("2. Summary Deduplication (deduplicateSummary & tailorResume)", () => {
    it("should remove identical duplicate paragraphs concatenated back-to-back", () => {
      const paragraph =
        "Engenheiro de Software com mais de 7 anos de experiência em microsserviços, mensageria e PHP.";
      const duplicated = `${paragraph}\n\n${paragraph}`;

      const deduplicated = deduplicateSummary(duplicated);

      expect(deduplicated).toBe(paragraph);
      expect(deduplicated.split(paragraph).length - 1).toBe(1);
    });

    it("should detect and eliminate identical halves concatenated together", () => {
      const half =
        "Desenvolvedor Backend sênior especializado em Node.js, TypeScript e arquitetura limpa.";
      const concatenated = `${half} ${half}`;

      const deduplicated = deduplicateSummary(concatenated);

      expect(deduplicated).toBe(half);
    });

    it("should remove repeated sentences inside mixed paragraph summaries", () => {
      const text =
        "Engenheiro sênior com foco em alta performance. Atuação com Docker e Kubernetes. Engenheiro sênior com foco em alta performance. Liderança de times ágeis.";
      const result = deduplicateSummary(text);

      expect(result).toBe(
        "Engenheiro sênior com foco em alta performance. Atuação com Docker e Kubernetes. Liderança de times ágeis.",
      );
    });

    it("should guarantee that tailorResume produces a unique, fluid summary without repeated blocks", async () => {
      const baseResume: ResumeData = {
        fullName: "Maria Oliveira",
        headline: "Tech Lead Backend",
        email: "maria@example.com",
        summary:
          "Engenheira de software especialista em PHP e microsserviços escaláveis.",
        skills: ["PHP", "Microsserviços", "MySQL"],
        experiences: [
          {
            company: "Acme Corp",
            role: "Tech Lead",
            startDate: "2020",
            endDate: "Atual",
            description: "Liderança técnica e arquitetura de pagamentos.",
          },
        ],
        education: [
          {
            institution: "USP",
            degree: "Ciência da Computação",
            startDate: "2015",
            endDate: "2019",
          },
        ],
        certifications: [],
      };

      const jobInfo = {
        title: "Pessoa Desenvolvedora Backend Especialista (PHP)",
        company: "Vortx Tech",
        rawDescription:
          "Vaga para especialista PHP, CakePHP, Microsserviços e mensageria.",
        keywords: [
          { term: "php", tfidf: 4.5, count: 6, stem: "php" },
          { term: "cakephp", tfidf: 4.0, count: 4, stem: "cakephp" },
          {
            term: "microsserviços",
            tfidf: 3.5,
            count: 3,
            stem: "microsserviç",
          },
        ],
        language: "pt" as const,
      };

      const tailored = await tailorResume(baseResume, jobInfo);
      const summary = tailored.tailoredResume.summary;

      // Verify no paragraph or block repetition
      const sentences = summary
        .split(/[.!?]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 10);
      const uniqueSentences = new Set(sentences);
      expect(uniqueSentences.size).toBe(sentences.length);
      expect(summary).not.toContain("Core Stack & Especialidades:");
    });
  });

  // 3. TF-IDF Blacklist Hardening
  describe("3. TF-IDF Blacklist Hardening (Generic Corporate / HR Filtering)", () => {
    it("should flag corporate, business domain, and HR buzzwords as excluded", () => {
      const corporateTerms = [
        "saúde",
        "soluções",
        "requisições",
        "integrações",
        "concessionárias",
        "benefícios",
        "colaboradores",
        "clientes",
        "negócio",
        "demandas",
        "requisitos",
        "experiência",
        "atividades",
        "oportunidade",
        "candidato",
      ];

      for (const term of corporateTerms) {
        expect(isGenericCorporateTerm(term)).toBe(true);
        expect(isExcludedSkillTerm(term)).toBe(true);
      }
    });

    it("should NOT exclude genuine technical hard skills", () => {
      const techSkills = [
        "php",
        "cakephp",
        "node.js",
        "docker",
        "kubernetes",
        "microsserviços",
        "restful",
        "postgresql",
        "ci/cd",
        "aws",
        "fastapi",
        "typescript",
        "redis",
        "webhooks",
        "idempotência",
      ];

      for (const tech of techSkills) {
        expect(isGenericCorporateTerm(tech)).toBe(false);
        expect(isExcludedSkillTerm(tech)).toBe(false);
      }
    });

    it("should extract pure technical hard skills from a corporate job description without corporate pollution", () => {
      const rawJobDescription = `
        Sobre a vaga:
        Somos líderes em soluções para o mercado financeiro e concessionárias.
        Oferecemos plano de saúde, seguro de vida e vale refeição para todos os colaboradores.
        O candidato atuará em demandas e requisições do dia a dia, integrando clientes e parceiros de negócio.
        
        Requisitos Técnicos Obrigatórios:
        - Vivência comprovada com PHP moderno e framework CakePHP
        - Criação de APIs RESTful e arquitetura de Microsserviços
        - Conhecimento em mensageria com RabbitMQ ou Kafka
        - Banco de dados PostgreSQL e cache com Redis
        - Práticas de Docker, Kubernetes e pipelines de CI/CD na AWS
        - Idempotência e Webhooks para pagamentos
      `;

      const keywords = extractKeywords(rawJobDescription, "pt", 20);
      const extractedTerms = keywords.map((k) => k.term.toLowerCase());

      // MUST NOT contain generic corporate/HR noise
      expect(extractedTerms).not.toContain("saúde");
      expect(extractedTerms).not.toContain("soluções");
      expect(extractedTerms).not.toContain("requisições");
      expect(extractedTerms).not.toContain("integrações");
      expect(extractedTerms).not.toContain("concessionárias");
      expect(extractedTerms).not.toContain("benefícios");
      expect(extractedTerms).not.toContain("colaboradores");
      expect(extractedTerms).not.toContain("clientes");
      expect(extractedTerms).not.toContain("demandas");

      // MUST contain genuine hard skills
      expect(extractedTerms.some((t) => t.includes("php"))).toBe(true);
      expect(extractedTerms.some((t) => t.includes("microsserviços"))).toBe(
        true,
      );
      expect(extractedTerms.some((t) => t.includes("restful"))).toBe(true);
      expect(extractedTerms.some((t) => t.includes("docker"))).toBe(true);
      expect(extractedTerms.some((t) => t.includes("postgresql"))).toBe(true);
      expect(extractedTerms.some((t) => t.includes("ci/cd"))).toBe(true);
    });
  });

  // 4. UX & Export Plain Text Endpoint
  describe("4. Plain Text Export & Download HTTP Headers", () => {
    it("should serve plain text download endpoint with UTF-8 charset and RFC 5987 Content-Disposition", async () => {
      const app = createApp();

      // Seed a profile
      await app.request("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "André Çança",
          headline: "Especialista Backend",
          email: "andre@example.com",
          summary: "Especialista em PHP e microsserviços.",
          skills: ["PHP", "Docker"],
          experiences: [],
          education: [],
        }),
      });

      // Create a job
      const jobRes = await app.request("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Senior PHP Specialist",
          company: "Tech Solutions",
          rawDescription:
            "Vaga para desenvolvedor PHP e Docker com APIs RESTful.",
        }),
      });
      const jobData = await jobRes.json();
      const jobId = jobData.job.id;

      // Request TXT export
      const txtRes = await app.request(`/api/jobs/${jobId}/download/txt`);
      expect(txtRes.status).toBe(200);

      const contentType = txtRes.headers.get("content-type");
      expect(contentType).toContain("text/plain");
      expect(contentType).toContain("charset=utf-8");

      const contentDisposition = txtRes.headers.get("content-disposition");
      expect(contentDisposition).toBeDefined();
      expect(contentDisposition).toContain("filename*=");
      expect(contentDisposition).toContain("UTF-8''");

      const txtContent = await txtRes.text();
      expect(txtContent).toContain("ANDRÉ ÇANÇA");
      expect(txtContent).toContain("Senior PHP Specialist");
      expect(txtContent).toContain("PHP");
    });
  });
});
