import { describe, expect, it } from "bun:test";
import { extractKeywords } from "../src/nlp/tfidf.ts";
import { tailorResume } from "../src/optimizer/tailor.ts";
import { reflowExperienceLines } from "../src/services/cvExtractor.ts";
import type { ResumeData } from "../src/types/resume.ts";
import {
  stripJobBoilerplate,
  ungluePunctuation,
} from "../src/utils/encoding.ts";

describe("Root-Cause Fix Validation: Deliver IT (Gupy) Real Job & Paragraph Reflow", () => {
  const rawDeliverItJobText = `
    Desenvolvedor Backend Sênior - NodeJS/Java/Python
    Deliver IT - Porto Alegre, RS (Híbrido)

    Descrição da vaga:
    Estamos em busca de uma Pessoa Desenvolvedora Backend Sênior com experiência comprovada em NodeJS, Java e Python.
    Você atuará em sistemas de missão crítica lidando com milhões de transações diárias no comércio digital,
    resolvendo questões de escalabilidade, posições em filas e relações entre sistemas parceiros.
    Temos preferência por pessoas focadas em soluções limpas e código resiliente.

    Requisitos e qualificações:
    - Sólida experiência com Node.js, NestJS, Java e Python
    - Criação de APIs GraphQL e RESTful escaláveis
    - Arquitetura de Microsserviços e Mensageria com Kafka e RabbitMQ
    - Práticas de TDD (Test-Driven Development) e Clean Architecture
    - Orquestração de containers com Docker e Kubernetes
    - Infraestrutura como código com Terraform na AWS
    - Vivência com NestJS.Informações adicionais

    CONFIRA NOSSOS BENEFÍCIOS:
    - Plano de Saúde e Odontológico Bradesco Saúde Top Nacional
    - Vale Alimentação e Refeição flexível (Flash)
    - Auxílio Home Office e Seguro de Vida
    - Acesso a plataformas de saúde mental e bem-estar (Gympass)

    Etapas do processo:
    Etapa 1: Cadastro
    Etapa 2: Bate-papo inicial com Gente & Gestão
    Etapa 3: Entrevista Técnica
    Etapa 4: Validação Cultural
    Etapa 5: Oferta
    Etapa 6: Contratação6ContrataçãoJUNTE-SE A NÓS!
    Quer saber mais sobre a gente? Erro ao copiar link. Ir para candidatura.
  `;

  it("1. should cleanly strip Gupy boilerplate and benefits before tokenization", () => {
    const stripped = stripJobBoilerplate(rawDeliverItJobText);

    expect(stripped).toContain("Desenvolvedor Backend Sênior");
    expect(stripped).toContain("Terraform na AWS");

    // Must strip benefits and Gupy hiring stages
    expect(stripped).not.toContain("CONFIRA NOSSOS BENEFÍCIOS");
    expect(stripped).not.toContain("Plano de Saúde");
    expect(stripped).not.toContain("Bradesco Saúde");
    expect(stripped).not.toContain("Etapas do processo");
    expect(stripped).not.toContain("Contratação6ContrataçãoJUNTE-SE");
    expect(stripped).not.toContain("Erro ao copiar link");
  });

  it("2. should unglue glued punctuation without breaking technology extensions", () => {
    const glued =
      "Experiência com NestJS.Informações adicionais e Node.js em produção com Socket.io e ASP.NET";
    const unglued = ungluePunctuation(glued);

    expect(unglued).toContain("NestJS. Informações adicionais");
    expect(unglued).toContain("Node.js");
    expect(unglued).toContain("Socket.io");
    expect(unglued).toContain("ASP.NET");
  });

  it("3. should extract genuine technical keywords and reject common Portuguese nouns and Gupy junk", () => {
    const keywords = extractKeywords(rawDeliverItJobText, {
      lang: "pt",
      topN: 15,
    });
    const extractedTerms = keywords.map((k) => k.term);
    const extractedLower = extractedTerms.map((t) => t.toLowerCase());

    // 1. MUST INCLUDE real hard technologies from Deliver IT JD
    expect(
      extractedTerms.some((t) => t === "Node.js" || t.includes("Node")),
    ).toBe(true);
    expect(extractedTerms.some((t) => t === "Java")).toBe(true);
    expect(extractedTerms.some((t) => t === "Python")).toBe(true);
    expect(extractedTerms.some((t) => t === "Terraform")).toBe(true);
    expect(extractedTerms.some((t) => t === "Kafka")).toBe(true);
    expect(extractedTerms.some((t) => t === "AWS")).toBe(true);
    expect(extractedTerms.some((t) => t === "Docker")).toBe(true);
    expect(extractedTerms.some((t) => t === "Kubernetes")).toBe(true);
    expect(extractedTerms.some((t) => t === "GraphQL")).toBe(true);
    expect(extractedTerms.some((t) => t === "NestJS")).toBe(true);
    expect(extractedTerms.some((t) => t === "TDD")).toBe(true);
    expect(extractedTerms.some((t) => t === "Microsserviços")).toBe(true);

    // 2. MUST NEVER INCLUDE corporate noise, common Portuguese nouns or Gupy junk
    expect(extractedLower).not.toContain("saúde");
    expect(extractedLower).not.toContain("saude");
    expect(extractedLower).not.toContain("soluções");
    expect(extractedLower).not.toContain("comércio");
    expect(extractedLower).not.toContain("questões");
    expect(extractedLower).not.toContain("preferência");
    expect(extractedLower).not.toContain("milhões");
    expect(extractedLower).not.toContain("posições");
    expect(extractedLower).not.toContain("relações");
    expect(extractedLower).not.toContain("nestjs.informações");
    expect(extractedLower).not.toContain("informações");
    expect(extractedLower).not.toContain("contratação6contrataçãojunte-se");
  });

  it("4. should reflow broken visual PDF lines into cohesive single sentences/bullets", () => {
    const brokenPdfLines = [
      "• Liderança técnica na equipe de engenharia do Grupo FCamara, atuando na arquitetura de microsserviços e",
      "escrevendo código que precisa funcionar em",
      "produção — sem enrolação.",
      "• Implementação de microsserviços em Node.js e NestJS com banco",
      "- MySQL.",
      "• Implementação de mensageria com Apache Kafka para processamento assíncrono.",
    ];

    const reflowed = reflowExperienceLines(brokenPdfLines);

    // Expecting 3 full bullets, not 6 broken fragments
    expect(reflowed.length).toBe(3);

    // The first bullet must be fully united without sentence cuts
    expect(reflowed[0]).toBe(
      "• Liderança técnica na equipe de engenharia do Grupo FCamara, atuando na arquitetura de microsserviços e escrevendo código que precisa funcionar em produção — sem enrolação.",
    );

    // The second bullet unites the continuation line with MySQL
    expect(reflowed[1]).toBe(
      "• Implementação de microsserviços em Node.js e NestJS com banco MySQL.",
    );

    // Third bullet remains intact
    expect(reflowed[2]).toBe(
      "• Implementação de mensageria com Apache Kafka para processamento assíncrono.",
    );
  });

  it("5. should tailor resume cleanly without injecting phrases in the middle of sentences", async () => {
    const baseCandidate: ResumeData = {
      fullName: "Rodrigo Silva",
      headline: "Desenvolvedor Backend Sênior",
      email: "rodrigo@example.com",
      summary:
        "Desenvolvedor backend sênior com vasta experiência em engenharia de software.",
      skills: ["Node.js", "Java", "Docker", "SQL"],
      experiences: [
        {
          company: "Grupo FCamara",
          role: "Desenvolvedor Backend Sênior",
          startDate: "2020",
          endDate: "Atual",
          description:
            "Liderança técnica atuando na arquitetura de microsserviços e escrevendo código que precisa funcionar em produção — sem enrolação.",
        },
      ],
      education: [
        {
          institution: "Universidade",
          degree: "Ciência da Computação",
          startDate: "2015",
          endDate: "2019",
        },
      ],
      certifications: [],
    };

    const keywords = extractKeywords(rawDeliverItJobText, {
      lang: "pt",
      topN: 15,
    });
    const tailored = await tailorResume(baseCandidate, {
      title: "Desenvolvedor Backend Sênior - NodeJS/Java/Python",
      company: "Deliver IT",
      rawDescription: rawDeliverItJobText,
      keywords,
      language: "pt",
    });

    const tailoredExp = tailored.tailoredResume.experiences[0];
    const desc = tailoredExp.description;

    // Must NOT inject words in the middle of a sentence (e.g. "funcionar em com foco em")
    expect(desc).not.toMatch(/funcionar\s+em\s+com\s+foco/i);
    expect(desc).not.toContain("em com foco em arquitetura");

    // Injected keywords must be in a complete, grammatically independent sentence
    expect(desc).toMatch(/\.\s+Atuação com foco em arquitetura escalável/);
    expect(desc).toContain("produção — sem enrolação.");
  });
});
