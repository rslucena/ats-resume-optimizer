import { describe, expect, it } from "bun:test";
import { parseMasterProfileText } from "../src/services/cvExtractor.ts";
import { extractJobFromHtml } from "../src/services/jobScraper.ts";

describe("CV Extraction & Job HTML Parser", () => {
  it("should parse raw resume text into structured ResumeData", () => {
    const rawResume = `
      Mariana Souza
      Desenvolvedora Frontend Senior
      mariana.souza@email.com | +55 11 98888-8888 | São Paulo, SP
      LinkedIn: linkedin.com/in/marianasouza | GitHub: github.com/marianasouza

      RESUMO PROFISSIONAL
      Engenheira de software com 6 anos de experiência em React, TypeScript e Next.js.
      Apaixonada por arquiteturas acessíveis e performance web.

      EXPERIÊNCIA PROFISSIONAL
      Frontend Lead — Tech Solutions (2022 - Atual)
      • Liderança técnica de squad frontend construindo dashboards em Next.js e TypeScript.
      • Redução do bundle size em 35% e melhoria nos Core Web Vitals.

      Engenheira Frontend — Inovação Digital (2019 - 2022)
      • Desenvolvimento de SPAs com React, Redux e Styled Components.

      FORMAÇÃO ACADÊMICA
      Bacharelado em Sistemas de Informação — FIAP (2015 - 2019)

      HABILIDADES TÉCNICAS
      React, TypeScript, Next.js, Tailwind CSS, Jest, GraphQL, Docker

      CERTIFICAÇÕES
      Meta Certified Frontend Developer
    `;

    const profile = parseMasterProfileText(rawResume);

    expect(profile.fullName).toBe("Mariana Souza");
    expect(profile.email).toBe("mariana.souza@email.com");
    expect(profile.phone).toBe("+55 11 98888-8888");
    expect(profile.summary).toContain("6 anos de experiência");
    expect(profile.skills).toContain("React");
    expect(profile.skills).toContain("TypeScript");
    expect(profile.experiences.length).toBeGreaterThanOrEqual(1);
    expect(profile.education.length).toBeGreaterThanOrEqual(1);
    expect(profile.education[0].institution).toContain("FIAP");
  });

  it("should extract job information from HTML using Cheerio", () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Senior Backend Engineer - Nubank Careers</title>
          <meta property="og:title" content="Senior Backend Engineer" />
          <meta property="og:site_name" content="Nubank" />
        </head>
        <body>
          <header><nav>Home | Jobs</nav></header>
          <main>
            <h1>Senior Backend Engineer</h1>
            <div class="company-name">Nubank</div>
            <div class="job-description">
              <p>Estamos buscando uma pessoa Engenheira de Software Senior para nosso time de pagamentos.</p>
              <h3>Requisitos</h3>
              <ul>
                <li>Experiência com Clojure, Go ou Java</li>
                <li>Conhecimento sólido em microsserviços e Kafka</li>
                <li>Docker, Kubernetes e AWS</li>
              </ul>
            </div>
          </main>
          <footer>Copyright 2026</footer>
        </body>
      </html>
    `;

    const extracted = extractJobFromHtml(sampleHtml, "https://nubank.careers/job/123");

    expect(extracted.title).toContain("Senior Backend Engineer");
    expect(extracted.company).toContain("Nubank");
    expect(extracted.description).toContain("Clojure, Go ou Java");
    expect(extracted.description).toContain("microsserviços e Kafka");
    // Should NOT include nav or footer junk
    expect(extracted.description).not.toContain("Copyright 2026");
  });
});
