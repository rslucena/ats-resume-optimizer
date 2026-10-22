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

  it("should sanitize LinkedIn PDF exports, stripping Page markers, grouping education, and preventing fake companies", () => {
    const rawLinkedinExport = `
      Page 1 of 6
      Carlos Eduardo Pereira
      Senior Backend Engineer | IA | PHP | TypeScript | Cloud
      carlos.pereira@example.com | 11988887777 | São Paulo, Brasil
      www.linkedin.com/in/carlospereira (LinkedIn)
      github.com/carlospereira (GitHub)

      Contact
      Top Skills
      Node.js
      TypeScript

      Resumo
      Sou Backend Engineer Especialista, com mais de 15 anos de experiência.
      sem enrolação. Uso principalmente Node.js e PHP, mas também trabalho com Redis e Docker.

      Experiência
      Chamleo
      Principal Backend Engineer
      setembro de 2019 - outubro de 2024 (5 anos 2 meses)
      São Paulo, Brasil
      Supervisiono e desenvolvo uma plataforma de alta performance para o mercado financeiro.
      Reduzi o tempo de resposta em ~70% com a implementação de cache distribuído em Redis.
      Page 2 of 6
      Tecnologias e Arquitetura: Especialização em microsserviços com Node.js e PHP.

      Academia do Psicólogo
      Full-stack Developer | Senior
      julho de 2017 - agosto de 2022 (5 anos 2 meses)
      São Paulo e Região, Brasil
      Responsável pelo gerenciamento e análise constante de aplicações WEB.

      M&W Comunicação Integrada
      Full-stack Developer | Pleno
      março de 2013 - setembro de 2014 (1 ano 7 meses)
      Jundiaí - SP
      Desenvolvimento de portais em PHP e MySQL.

      Formação acadêmica
      Universidad Europea del Atlántico
      Máster en Dirección Estratégica en Ingeniería de Software, Tecnologia da
      Informação · (maio de 2023 - maio de 2025)
      Page 5 of 6
      Anhanguera Educacional
      Bachelor's degree, Computer Science · (2011 - 2014)
      Centro Universitário Senac
      Computer Technician, Computer and Support Services · (2009 - 2009)
      Page 6 of 6
    `;

    const profile = parseMasterProfileText(rawLinkedinExport);

    // 1. Verify basic identity
    expect(profile.fullName).toBe("Carlos Eduardo Pereira");
    expect(profile.headline).toContain("Senior Backend Engineer");

    // 2. Verify Page markers are 100% removed
    const stringified = JSON.stringify(profile);
    expect(stringified).not.toMatch(/Page\s+\d+\s+of\s+\d+/i);

    // 3. Verify experiences are grouped properly and location is not a company
    expect(profile.experiences.length).toBe(3);
    expect(profile.experiences[0].company).toBe("Chamleo");
    expect(profile.experiences[0].role).toBe("Principal Backend Engineer");
    expect(profile.experiences[0].startDate).toBe("setembro de 2019");
    expect(profile.experiences[0].endDate).toBe("outubro de 2024");
    expect(profile.experiences[0].location).toBe("São Paulo, Brasil");

    expect(profile.experiences[1].company).toBe("Academia do Psicólogo");
    expect(profile.experiences[1].role).toBe("Full-stack Developer | Senior");

    expect(profile.experiences[2].company).toBe("M&W Comunicação Integrada");
    expect(profile.experiences[2].role).toBe("Full-stack Developer | Pleno");
    expect(profile.experiences[2].location).toBe("Jundiaí - SP");

    // "Jundiaí - SP" must NEVER be treated as a company
    const hasFakeJundiaiCompany = profile.experiences.some(e => e.company === "SP" || e.role === "Jundiaí");
    expect(hasFakeJundiaiCompany).toBe(false);

    // Summary lines must NOT be treated as a company
    const hasFakeSummaryExp = profile.experiences.some(e => e.role.includes("sem enrolação") || e.company.includes("sem enrolação"));
    expect(hasFakeSummaryExp).toBe(false);

    // 4. Verify education grouping
    expect(profile.education.length).toBe(3);

    expect(profile.education[0].institution).toBe("Universidad Europea del Atlántico");
    expect(profile.education[0].degree).toContain("Máster en Dirección Estratégica en Ingeniería de Software");
    expect(profile.education[0].startDate).toBe("2023");
    expect(profile.education[0].endDate).toBe("2025");

    expect(profile.education[1].institution).toBe("Anhanguera Educacional");
    expect(profile.education[1].degree).toContain("Bachelor's degree, Computer Science");
    expect(profile.education[1].startDate).toBe("2011");
    expect(profile.education[1].endDate).toBe("2014");

    expect(profile.education[2].institution).toBe("Centro Universitário Senac");
    expect(profile.education[2].degree).toContain("Computer Technician");

    // No fake "Instituição de Ensino" default
    const hasFakeInstitution = profile.education.some(ed => ed.institution === "Instituição de Ensino" && ed.degree.includes("Page"));
    expect(hasFakeInstitution).toBe(false);
  });

  it("should cleanly split unseparated date strings without punctuation (e.g. setembro de 2019 outubro de 2024)", () => {
    const rawCvWithUnseparatedDates = `
      Carlos Eduardo Pereira
      Senior Backend Engineer
      carlos@example.com | 11999999999 | São Paulo, Brasil

      Experiência
      Chamleo
      Principal Backend Engineer
      setembro de 2019 outubro de 2024
      Supervisão de plataforma de alta performance.
    `;

    const profile = parseMasterProfileText(rawCvWithUnseparatedDates);
    expect(profile.experiences.length).toBe(1);
    expect(profile.experiences[0].company).toBe("Chamleo");
    expect(profile.experiences[0].startDate).toBe("setembro de 2019");
    expect(profile.experiences[0].endDate).toBe("outubro de 2024");
  });
});
