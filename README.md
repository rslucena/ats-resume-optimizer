# ATS Resume Optimizer & Job Tracker

[![CI](https://github.com/rslucena/ats-resume-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/rslucena/ats-resume-optimizer/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-50%20passed-brightgreen?style=flat-square)](https://github.com/rslucena/ats-resume-optimizer)
[![Runtime](https://img.shields.io/badge/runtime-Bun%20v1.2+-black?style=flat-square&logo=bun)](https://bun.sh)
[![Language](https://img.shields.io/badge/language-TypeScript-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

Aplicação Full-Stack local-first desenvolvida para Controle de Candidaturas e Otimização Algorítmica de Currículos, aplicando engenharia reversa nas regras de parsers e extratores de ATS corporativos (Workday, Taleo, Greenhouse, Lever, Gupy, SAP SuccessFactors).

![ATS Resume Optimizer & Job Tracker - Workbench](screenshot_demo.png)

---

## Por que Local-First?

| Característica | ATS Resume Optimizer | Plataformas SaaS Tradicionais |
| :--- | :--- | :--- |
| Privacidade | 100% Local (SQLite em disco) | Dados enviados para servidores de terceiros |
| Modelo de Custo | Gratuito e Open-Source (MIT) | Mensalidades recorrentes e limites de exportação |
| Motor de Otimização | Algorítmico (TF-IDF + NER Técnico) | Geração opaca por LLM sem auditoria de densidade |
| Formatação ATS | PDFKit Linear + DOCX OpenXML | Modelos visuais complexos rejeitados por parsers |
| Rastreabilidade | Banco SQLite auditável via SQL | Dados presos em plataformas fechadas |

---

## Destaques da Arquitetura & Tech Stack

- Runtime: Bun com motor HTTP nativo via Hono.
- Banco de Dados Local-First: bun:sqlite nativo sobre Drizzle ORM com inicialização e migração automática de tabelas.
- Motor Matemático de NLP & Texto:
  - natural: natural.TfIdf para cálculo real de densidade de termos e PorterStemmerPt / PorterStemmer para radicais morfológicos.
  - franc: Detecção automática do idioma da vaga (Português PT-BR vs. Inglês EN) adaptando stopwords e stemmers dinamicamente.
  - leven: Medição de proximidade lexical e tolerância a variações de termos.
  - Tech-First NER: Dicionário canônico com mais de 250 tecnologias de engenharia de software, garantindo peso zero para substantivos comuns.
- Extração & Geração de Documentos Binários:
  - pdf-parse: Leitura e extração do texto do PDF Base com reflow de quebras de linha visuais.
  - pdfkit + pdf-lib: Geração de PDF com layout linear ATS (sem tabelas ou caixas de texto flutuantes) com injeção binária de XMP Metadata e Info Dictionary.
  - docx: Geração de documento Microsoft Word com metadados nativos OpenXML (coreProperties).
- Scraping de Vagas: cheerio com sanitização de espaçamento HTML e corte de seções institucionais (benefícios e etapas de contratação).
- Frontend SPA: Interface industrial Dark Mode de alto contraste (seguindo diretrizes minimalist-ui e design-taste-frontend), visualização interativa de densidade TF-IDF, comparação lado a lado (Master CV vs. Tailored CV) e download direto de PDF e DOCX.

---

## As 7 Camadas Algorítmicas de Otimização ATS

Ao personalizar um currículo para uma vaga, o motor cruza o master_profile aplicando:

1. Alinhamento de Densidade via natural.TfIdf:
   - Resumo Profissional: Repete as top keywords de 2x a 3x.
   - Título do Cargo: Iguala ao título da vaga e repete de 2x a 2.5x ao longo do CV.
   - Experiências Profissionais: Insere as hard skills com repetição contextualizada de 2x.
   - Habilidades: Garante presença balanceada de 1.5x a 2x no documento.
   - Educação: Repete o requisito de escolaridade ao menos 1x.

2. Pesos de Seção e Regra da Primeira Linha:
   - Peso 3 (Máximo): Resumo e Objetivo Profissional.
   - Peso 2 (Alto): Título do Cargo e a primeira linha de cada experiência profissional, reescrita como um resumo executivo denso cravando cargo, tecnologia e resultado.
   - Peso 1 (Médio): Bullets secundários e listagem de skills.

3. Blindagem contra Corte Eliminatório (Entity Extraction & Stemming):
   - Variações explícitas de tempo de experiência: "5 anos de experiência (60+ meses de atuação sólida e comprovada desde 2021)".
   - Variações de formação: "Graduação completa / Bacharelado / Ensino Superior em...".
   - Siglas + Extenso: "Node.js (NodeJS)", "TypeScript (TS)", "CI/CD (Integração Contínua)", "Kubernetes (K8s)".

4. Otimização de Espaço Vetorial (NLP Embeddings):
   - Substituição de termos genéricos por vocabulário técnico denso do cluster da stack (throughput, microsserviços escaláveis, APIs RESTful, observabilidade, alta disponibilidade).

5. Exploração do Bug de Janela Regex (Boundary Bleed):
   - Injeção estratégica no final do Resumo Profissional (colado na quebra da seção de Experiências) contendo os requisitos mais pesados da vaga ("Core Stack & Especialidades: ...").

6. Injeção de Metadados Ocultos no Binário (pdf-lib e docx):
   - Gravação interna no Info Dictionary e XMP stream:
     - Title (dc:title): Título exato da vaga.
     - Author (dc:creator): Nome do candidato.
     - Keywords (cp:keywords): Lista separada por vírgula com as top keywords TF-IDF.
     - Subject (cp:description): Mini-resumo espelhando a vaga.
     - Creator / Category: "Currículo".
   - Idêntica gravação nas coreProperties do arquivo .docx.

7. Auditor de Score ATS Local (Antes vs. Depois):
   - Cálculo em tempo real de uma nota matemática de 0 a 100 com visualização comparativa e chips de frequência para ajuste antes de baixar.

---

## Como Executar

### 1. Pré-requisito
- Bun instalado (versão 1.2+ ou 1.4+).

### 2. Instalação das dependências
```bash
bun install
```

### 3. Rodar os Testes Automatizados
```bash
bun test
```

### 4. Iniciar o Servidor de Desenvolvimento
```bash
bun run dev
```

Acesse no navegador: `http://localhost:3000`

---

## Estrutura de Arquivos

```
├── public/                 # Interface SPA Dark Mode (HTML, CSS e JS modular)
├── screenshot_demo.png     # Screenshot da bancada de trabalho
├── src/
│   ├── api/
│   │   └── routes.ts       # Rotas REST Hono (Upload, Jobs, Tailoring, Download)
│   ├── db/
│   │   ├── index.ts        # Conexão bun:sqlite e auto-migrações Drizzle
│   │   └── schema.ts       # Schemas SQLite (master_profiles, jobs, tailored_resumes)
│   ├── documents/
│   │   ├── docx.ts         # Gerador DOCX com openXML coreProperties
│   │   ├── jsonResume.ts   # Exportação no padrão JSON Resume
│   │   ├── markdown.ts     # Exportação em Markdown formatado
│   │   ├── pdf.ts          # Gerador PDFKit linear + injeção binária XMP com pdf-lib
│   │   └── txt.ts          # Exportação em texto puro UTF-8
│   ├── nlp/
│   │   ├── language.ts     # Detecção PT-BR / EN com franc
│   │   ├── similarity.ts   # Proximidade léxica com leven
│   │   ├── stemmer.ts      # Stemmers com PorterStemmerPt e PorterStemmer
│   │   ├── stopwords.ts    # Stopwords técnicas PT / EN
│   │   └── tfidf.ts        # Motor matemático natural.TfIdf e Tech-First NER
│   ├── optimizer/
│   │   ├── scorer.ts       # Auditor de pontuação ATS (0 a 100)
│   │   └── tailor.ts       # Motor algorítmico das 7 camadas de ATS
│   ├── services/
│   │   ├── cvExtractor.ts  # Extração de texto de PDF, reflow de parágrafos e estruturação
│   │   └── jobScraper.ts   # Scraping e parsing de vagas com cheerio e corte de boilerplate
│   ├── types/
│   │   └── resume.ts       # Tipagens TypeScript compartilhadas
│   ├── utils/
│   │   ├── dateFormat.ts   # Formatação e normalização de datas
│   │   └── encoding.ts     # Sanitização UTF-8, descolagem de pontuação e limpeza de boilerplate
│   └── server.ts           # Servidor Bun.serve + Hono
└── tests/                  # Suíte completa de testes automatizados com bun test
```

---

## Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.
