# ⚡ ATS Resume Optimizer & Job Tracker (Bun + TypeScript + SQLite)

Aplicação Full-Stack **local-first** desenvolvida para **Controle de Candidaturas** e **Otimização Algorítmica de Currículos**, aplicando engenharia reversa nas regras de parsers e extratores de ATS corporativos (*Workday, Taleo, Greenhouse, Lever, Gupy, SAP SuccessFactors*).

![ATS Resume Optimizer & Job Tracker - Workbench](screenshot_demo.png)

---

## 🚀 Destaques da Arquitetura & Tech Stack

- **Runtime Ultrarrápido:** [Bun](https://bun.sh) com motor HTTP nativo via [Hono](https://hono.dev).
- **Banco de Dados Local-First:** `bun:sqlite` nativo sobre [Drizzle ORM](https://orm.drizzle.team) com inicialização e migração automática de tabelas.
- **Motor Matemático de NLP & Texto:**
  - `natural`: Utilizando especificamente `natural.TfIdf` para cálculo real de densidade de termos e `PorterStemmerPt` / `PorterStemmer` para radicais morfológicos.
  - `franc`: Detecção automática do idioma da vaga (Português PT-BR vs. Inglês EN) adaptando stopwords e stemmers dinamicamente.
  - `leven`: Medição de proximidade lexical e tolerância a variações de termos.
- **Extração & Geração de Documentos Binários:**
  - `pdf-parse`: Leitura e extração do texto do PDF Base.
  - `pdfkit` + `pdf-lib`: Geração de PDF com layout linear ATS (sem tabelas, sem caixas de texto que quebram o fluxo de leitura) + injeção binária de **XMP Metadata** e **Info Dictionary**.
  - `docx`: Geração de documento Microsoft Word com metadados nativos OpenXML (`coreProperties`).
- **Scraping de Vagas:** `cheerio` para extração limpa de descrições de páginas web com fallback resiliente para colagem manual.
- **Frontend SPA:** Interface moderna Dark Mode de alto contraste (seguindo diretrizes `minimalist-ui` e `design-taste-frontend`), visualização interativa de densidade TF-IDF, comparação lado a lado (Master CV vs. Tailored CV) e download direto de `.pdf` e `.docx`.

---

## 🧠 As 7 Camadas Algorítmicas de Otimização ATS

Ao personalizar um currículo para uma vaga, o motor cruza o `master_profile` aplicando:

1. **Alinhamento de Densidade via `natural.TfIdf`:**
   - **Resumo Profissional:** Repete as top keywords de **2x a 3x**.
   - **Título do Cargo:** Iguala ao título da vaga e repete de **2x a 2.5x** ao longo do CV.
   - **Experiências Profissionais:** Insere as *hard skills* com repetição contextualizada de **2x**.
   - **Habilidades:** Garante presença balanceada de **1.5x a 2x** no documento.
   - **Educação:** Repete o requisito de escolaridade ao menos **1x**.

2. **Pesos de Seção e Regra da Primeira Linha:**
   - **Peso 3 (Máximo):** Resumo e Objetivo Profissional.
   - **Peso 2 (Alto):** Título do Cargo e a **PRIMEIRA LINHA** de cada experiência profissional, reescrita como um resumo executivo denso cravando cargo, tecnologia e resultado.
   - **Peso 1 (Médio):** Bullets secundários e listagem de skills.

3. **Blindagem contra Corte Eliminatório (Entity Extraction & Stemming):**
   - Variações explícitas de tempo de experiência: *"5 anos de experiência (60+ meses de atuação sólida e comprovada desde 2021)"*.
   - Variações de formação: *"Graduação completa / Bacharelado / Ensino Superior em..."*.
   - Siglas + Extenso: *"Node.js (NodeJS)"*, *"TypeScript (TS)"*, *"CI/CD (Integração Contínua)"*, *"Kubernetes (K8s)"*.

4. **Otimização de Espaço Vetorial (NLP Embeddings):**
   - Substituição de termos genéricos por vocabulário técnico denso do cluster da stack (*throughput, microsserviços escaláveis, APIs RESTful, observabilidade, alta disponibilidade*).

5. **Exploração do Bug de Janela Regex (Boundary Bleed):**
   - Injeção estratégica no final do Resumo Profissional (colado na quebra da seção de Experiências) contendo os 4 requisitos mais pesados da vaga (*"Core Stack & Especialidades: ..."*).

6. **Injeção de Metadados Ocultos no Binário (`pdf-lib` e `docx`):**
   - Gravação interna no Info Dictionary e XMP stream:
     - `Title` (`dc:title`): Título exato da vaga.
     - `Author` (`dc:creator`): Nome completo do candidato.
     - `Keywords` (`cp:keywords`): Lista separada por vírgula com as top keywords TF-IDF.
     - `Subject` (`cp:description`): Mini-resumo espelhando a vaga.
     - `Creator` / `Category`: `"Currículo"`.
   - Idêntica gravação nas `coreProperties` do arquivo `.docx`.

7. **Auditor de Score ATS Local (Antes vs. Depois):**
   - Cálculo em tempo real de uma nota matemática de **0 a 100** com visualização comparativa e chips de frequência para ajuste antes de baixar.

---

## 🛠️ Como Executar

### 1. Pré-requisito
- [Bun](https://bun.sh) instalado (versão 1.2+ ou 1.4+).

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

Acesse no seu navegador: **`http://localhost:3000`**

---

## 📁 Estrutura de Arquivos

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
│   │   └── pdf.ts          # Gerador PDFKit linear + injeção binária XMP com pdf-lib
│   ├── nlp/
│   │   ├── language.ts     # Detecção PT-BR / EN com franc
│   │   ├── similarity.ts   # Proximidade léxica com leven
│   │   ├── stemmer.ts      # Stemmers com PorterStemmerPt e PorterStemmer
│   │   ├── stopwords.ts    # Stopwords técnicas PT / EN
│   │   └── tfidf.ts        # Motor matemático natural.TfIdf
│   ├── optimizer/
│   │   ├── scorer.ts       # Auditor de pontuação ATS (0 a 100)
│   │   └── tailor.ts       # Motor algorítmico das 7 camadas de ATS
│   ├── services/
│   │   ├── cvExtractor.ts  # Extração de texto de PDF e estruturação de perfil
│   │   └── jobScraper.ts   # Scraping e parsing de vagas com cheerio
│   ├── types/
│   │   └── resume.ts       # Tipagens TypeScript compartilhadas
│   └── server.ts           # Servidor Bun.serve + Hono
└── tests/                  # Suíte completa de testes automatizados com bun test
```
