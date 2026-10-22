import natural from "natural";
import { getStopwords } from "./stopwords.ts";
import { stemWord } from "./stemmer.ts";
import type { SupportedLanguage } from "./language.ts";
import { sanitizeUtf8, stripJobBoilerplate, ungluePunctuation } from "../utils/encoding.ts";

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

// Internal NLP / ATS terms that must NEVER leak into candidate skills or keywords
export const INTERNAL_NLP_BLACKLIST = new Set([
  "tfidf", "tf-idf", "tf idf", "tf", "idf",
  "algoritmo", "algoritmos", "algorithm", "algorithms",
  "parser", "parsers", "parsing", "parse",
  "score", "scores", "scoring",
  "ats", "audit", "auditoria", "nlp", "matcher", "ranking", "rank",
  "stemmer", "stemming", "token", "tokens", "tokenizer",
  "vector", "vetor", "cosine", "density", "densidade"
]);

// Strict exclusion list for generic corporate nouns, abstract business buzzwords, and HR/job posting boilerplate
export const GENERIC_CORPORATE_BLACKLIST = new Set([
  // Substantivos comuns corporativos, benefícios e domínios abstratos
  "saúde", "saude", "solução", "soluções", "solucao", "solucoes",
  "requisição", "requisições", "requisicao", "requisicoes",
  "integração", "integrações", "integracao", "integracoes",
  "aplicação", "aplicações", "aplicacao", "aplicacoes",
  "solicitação", "solicitações", "solicitacao", "solicitacoes",
  "atribuição", "atribuições", "atribuicao", "atribuicoes",
  "correção", "correções", "correcao", "correcoes",
  "revisão", "revisões", "revisao", "revisoes",
  "discussão", "discussões", "discussao", "discussoes",
  "operação", "operações", "operacao", "operacoes",
  "reunião", "reuniões", "reuniao", "reunioes",
  "padrão", "padrões", "padrao", "padroes",
  "contribuição", "contribuições", "contribuicao", "contribuicoes",
  "inovação", "inovações", "inovacao", "inovacoes",
  "estratégia", "estratégias", "estrategia", "estrategias",
  "negócio", "negócios", "negocio", "negocios",
  "produto", "produtos", "serviço", "serviços", "servico", "servicos",
  "cliente", "clientes", "marca", "marcas", "mercado", "mercados",
  "ambiente", "ambientes", "processo", "processos", "etapa", "etapas",
  "comunicação", "comunicacao", "evolução", "evolucao",
  "construção", "construcao", "abordagem", "abordagens",
  "qualidade", "qualidades", "desafio", "desafios", "impacto", "impactos",
  "resultado", "resultados", "cultura", "aprendizado",
  "capacitação", "capacitacao", "treinamento", "treinamentos",
  "transparência", "transparencia", "diversidade",
  "benefício", "benefícios", "beneficio", "beneficios",
  "salário", "salários", "salario", "salarios", "remuneração", "remuneracao",
  "contratação", "contratações", "contratacao", "contratacoes",
  "candidatura", "candidaturas", "candidato", "candidata", "candidatos", "candidatas",
  "entrevista", "entrevistas", "inscrição", "inscrições", "inscricao", "inscricoes",
  "presencial", "híbrido", "hibrido", "remoto",
  "horário", "horários", "horario", "horarios", "seguro", "seguros", "plano", "planos",
  "auxílio", "auxílios", "auxilio", "auxilios", "vale", "vales", "folga", "folgas", "férias", "ferias",
  "terapia", "terapias", "consulta", "consultas", "desconto", "descontos",
  "concessionária", "concessionárias", "concessionaria", "concessionarias",
  "bem-estar", "bem estar", "vida", "apoio", "futuro", "empresa", "empresas",
  "gerenciamento", "gerenciar", "gestão", "gestao", "liderança", "lideranca",
  "proposta", "propostas", "meta", "metas", "objetivo", "objetivos", "propósito", "proposito",
  "demanda", "demandas", "atividade", "atividades", "oportunidade", "oportunidades",
  "colaborador", "colaboradores", "colaboradora", "colaboradoras", "equipe", "equipes", "time", "times",
  "experiência", "experiencia", "conhecimento", "requisito", "requisitos", "diferencial",
  
  // Termos comuns em português identificados em vagas que NÃO são tecnologia
  "comércio", "comercio", "questão", "questões", "questao", "questoes",
  "preferência", "preferencia", "preferências", "preferencias",
  "milhão", "milhões", "milhao", "milhoes",
  "posição", "posições", "posicao", "posicoes",
  "relação", "relações", "relacao", "relacoes",
  "país", "pais", "internet", "anúncio", "anúncios", "anuncio", "anuncios",
  "rotina", "rotinas", "impasse", "impasses", "causa", "causas", "pessoa", "pessoas",

  // English corporate & HR buzzwords
  "health", "solution", "solutions", "request", "requests",
  "integration", "integrations", "application", "applications",
  "solicitation", "solicitations", "assignment", "assignments",
  "fix", "fixes", "correction", "corrections", "review", "reviews",
  "discussion", "discussions", "operation", "operations", "meeting", "meetings",
  "pattern", "patterns", "contribution", "contributions",
  "innovation", "innovations", "strategy", "strategies", "business", "businesses",
  "product", "products", "service", "services", "client", "clients",
  "customer", "customers", "brand", "brands", "market", "markets",
  "environment", "environments", "process", "processes", "step", "steps",
  "communication", "evolution", "construction", "approach", "approaches",
  "quality", "challenge", "challenges", "impact", "impacts",
  "result", "results", "culture", "learning", "training",
  "transparency", "diversity", "benefit", "benefits",
  "salary", "salaries", "compensation", "hiring", "hirings",
  "interview", "interviews", "onboarding", "hybrid", "remote", "onsite",
  "schedule", "schedules", "insurance", "plan", "plans", "vacation", "vacations",
  "discount", "discounts", "wellness", "wellbeing", "life", "support"
]);

export function isInternalNlpTerm(term: string): boolean {
  if (!term) return false;
  const clean = term.toLowerCase().trim();
  const normalized = clean.replace(/[^a-z0-9]/g, "");
  return INTERNAL_NLP_BLACKLIST.has(clean) || INTERNAL_NLP_BLACKLIST.has(normalized);
}

export function isGenericCorporateTerm(term: string): boolean {
  if (!term) return false;
  const clean = term.toLowerCase().trim();
  const normalized = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  return GENERIC_CORPORATE_BLACKLIST.has(clean) || GENERIC_CORPORATE_BLACKLIST.has(normalized);
}

export function isExcludedSkillTerm(term: string): boolean {
  return isInternalNlpTerm(term) || isGenericCorporateTerm(term);
}

/**
 * Detects tokens with anomalous alphanumeric combinations (e.g. "contratação6contratação" or "gupy2etapa")
 * while preserving legitimate short tech acronyms (k8s, i18n, l10n, p2p, s3, ec2, sha256, etc.).
 */
export function isAnomalousAlphanumeric(token: string): boolean {
  if (!token) return false;
  const lower = token.toLowerCase();
  if (["k8s", "i18n", "l10n", "p2p", "b2b", "b2c", "c2c", "w3c", "oauth2", "ipv4", "ipv6", "sha256", "sha512", "md5", "mp3", "h2", "s3", "ec2"].includes(lower)) {
    return false;
  }
  // Word with digit sandwiched between letters where at least one part has length >= 2
  if (/[a-zA-ZÀ-ÿ]{2,}\d+[a-zA-ZÀ-ÿ]+|[a-zA-ZÀ-ÿ]+\d+[a-zA-ZÀ-ÿ]{2,}/.test(token)) {
    return true;
  }
  return false;
}

export const ABSTRACT_TECH_CONCEPTS = new Set([
  "escalabilidade", "scalability",
  "concorrência", "concorrencia", "concurrency",
  "multithreading", "assíncrono", "assincrono", "async",
  "mensageria", "messaging",
  "observabilidade", "observability",
  "idempotência", "idempotencia", "idempotency",
  "alta disponibilidade", "high availability",
  "segurança", "seguranca", "security"
]);

// Canonical tech entities database with precise casing (> 250 verified engineering technologies)
export const CANONICAL_TECH_ENTITIES: Record<string, string> = {
  // 1. Languages & Runtimes
  "typescript": "TypeScript",
  "ts": "TypeScript",
  "javascript": "JavaScript",
  "js": "JavaScript",
  "node.js": "Node.js",
  "nodejs": "Node.js",
  "node": "Node.js",
  "bun": "Bun",
  "deno": "Deno",
  "python": "Python",
  "java": "Java",
  "golang": "Go",
  "go": "Go",
  "rust": "Rust",
  "php": "PHP",
  "c#": "C#",
  "csharp": "C#",
  "c++": "C++",
  "cpp": "C++",
  ".net": ".NET",
  "dotnet": ".NET",
  "ruby": "Ruby",
  "kotlin": "Kotlin",
  "swift": "Swift",
  "scala": "Scala",
  "elixir": "Elixir",
  "clojure": "Clojure",
  "r": "R",
  "sql": "SQL",
  "html": "HTML",
  "html5": "HTML5",
  "css": "CSS",
  "css3": "CSS3",
  "sass": "SASS",
  "scss": "SCSS",
  "bash": "Bash",
  "shell": "Shell",
  "powershell": "PowerShell",

  // 2. Frameworks & Backend Runtimes
  "nestjs": "NestJS",
  "nest.js": "NestJS",
  "nest": "NestJS",
  "express": "Express",
  "express.js": "Express",
  "fastify": "Fastify",
  "hono": "Hono",
  "spring": "Spring Boot",
  "spring boot": "Spring Boot",
  "springboot": "Spring Boot",
  "django": "Django",
  "flask": "Flask",
  "fastapi": "FastAPI",
  "laravel": "Laravel",
  "symfony": "Symfony",
  "cakephp": "CakePHP",
  "asp.net": "ASP.NET",
  "ruby on rails": "Ruby on Rails",
  "rails": "Ruby on Rails",
  "gin": "Gin",
  "fiber": "Fiber",
  "echo": "Echo",
  "quarkus": "Quarkus",
  "micronaut": "Micronaut",
  "ktor": "Ktor",

  // 3. Frontend & Mobile Frameworks
  "react": "React",
  "react.js": "React",
  "reactjs": "React",
  "react native": "React Native",
  "next.js": "Next.js",
  "nextjs": "Next.js",
  "vue.js": "Vue.js",
  "vuejs": "Vue.js",
  "vue": "Vue.js",
  "nuxt": "Nuxt.js",
  "nuxt.js": "Nuxt.js",
  "angular": "Angular",
  "angularjs": "Angular",
  "svelte": "Svelte",
  "sveltekit": "SvelteKit",
  "ionic": "Ionic",
  "flutter": "Flutter",
  "tailwind": "Tailwind CSS",
  "tailwind css": "Tailwind CSS",
  "bootstrap": "Bootstrap",
  "styled-components": "Styled-Components",
  "material ui": "Material-UI",
  "wordpress": "WordPress",

  // 4. APIs, Protocols & Connectivity
  "graphql": "GraphQL",
  "rest": "REST",
  "restful": "RESTful APIs",
  "restful apis": "RESTful APIs",
  "rest api": "REST APIs",
  "rest apis": "REST APIs",
  "grpc": "gRPC",
  "webhooks": "Webhooks",
  "webhook": "Webhooks",
  "websockets": "WebSockets",
  "websocket": "WebSockets",
  "soap": "SOAP",
  "json": "JSON",
  "xml": "XML",
  "openapi": "OpenAPI",
  "swagger": "Swagger",
  "tcp/ip": "TCP/IP",
  "http": "HTTP",
  "http/2": "HTTP/2",
  "http/3": "HTTP/3",
  "mqtt": "MQTT",
  "amqp": "AMQP",

  // 5. Architecture, Paradigms & Core Patterns
  "microsserviços": "Microsserviços",
  "microsservicos": "Microsserviços",
  "microservices": "Microsserviços",
  "microserviços": "Microsserviços",
  "sistemas distribuídos": "Sistemas Distribuídos",
  "sistemas distribuidos": "Sistemas Distribuídos",
  "distributed systems": "Sistemas Distribuídos",
  "event-driven": "Event-Driven",
  "event driven": "Event-Driven",
  "clean architecture": "Clean Architecture",
  "arquitetura limpa": "Clean Architecture",
  "ddd": "DDD",
  "domain-driven design": "DDD",
  "tdd": "TDD",
  "test-driven development": "TDD",
  "bdd": "BDD",
  "solid": "SOLID",
  "design patterns": "Design Patterns",
  "padrões de projeto": "Design Patterns",
  "padroes de projeto": "Design Patterns",
  "idempotência": "Idempotência",
  "idempotencia": "Idempotência",
  "idempotency": "Idempotência",
  "alta disponibilidade": "Alta Disponibilidade",
  "high availability": "Alta Disponibilidade",
  "escalabilidade": "Escalabilidade",
  "scalability": "Escalabilidade",
  "concorrência": "Concorrência",
  "concorrencia": "Concorrência",
  "multithreading": "Multithreading",
  "assíncrono": "Assíncrono",
  "async/await": "Async/Await",
  "cqrs": "CQRS",
  "event sourcing": "Event Sourcing",

  // 6. DevOps, Containers & Cloud Providers
  "docker": "Docker",
  "kubernetes": "Kubernetes",
  "k8s": "Kubernetes",
  "helm": "Helm",
  "terraform": "Terraform",
  "ansible": "Ansible",
  "ci/cd": "CI/CD",
  "cicd": "CI/CD",
  "jenkins": "Jenkins",
  "github actions": "GitHub Actions",
  "gitlab ci": "GitLab CI",
  "argo cd": "Argo CD",
  "argocd": "Argo CD",
  "aws": "AWS",
  "amazon web services": "AWS",
  "aws ecs": "AWS ECS",
  "ecs": "AWS ECS",
  "aws eks": "AWS EKS",
  "eks": "AWS EKS",
  "aws lambda": "AWS Lambda",
  "lambda": "AWS Lambda",
  "s3": "S3",
  "aws s3": "S3",
  "sqs": "SQS",
  "aws sqs": "SQS",
  "sns": "SNS",
  "aws sns": "SNS",
  "cloudwatch": "CloudWatch",
  "aws rds": "AWS RDS",
  "rds": "AWS RDS",
  "ec2": "EC2",
  "aws ec2": "EC2",
  "google cloud": "Google Cloud (GCP)",
  "gcp": "Google Cloud (GCP)",
  "google cloud (gcp)": "Google Cloud (GCP)",
  "pub/sub": "Pub/Sub",
  "pubsub": "Pub/Sub",
  "azure": "Azure",
  "digitalocean": "DigitalOcean",
  "digital ocean": "DigitalOcean",
  "vercel": "Vercel",
  "cloudflare": "Cloudflare",
  "linux": "Linux",
  "ubuntu": "Ubuntu",
  "debian": "Debian",
  "nginx": "Nginx",
  "apache": "Apache",

  // 7. Messaging & Event Streaming
  "kafka": "Kafka",
  "apache kafka": "Kafka",
  "rabbitmq": "RabbitMQ",
  "mensageria": "Mensageria",
  "messaging": "Mensageria",
  "activemq": "ActiveMQ",
  "nats": "NATS",
  "zeromq": "ZeroMQ",

  // 8. Databases, Caches & ORMs
  "postgresql": "PostgreSQL",
  "postgres": "PostgreSQL",
  "mysql": "MySQL",
  "sqlite": "SQLite",
  "mongodb": "MongoDB",
  "mongo": "MongoDB",
  "redis": "Redis",
  "dynamodb": "DynamoDB",
  "elasticsearch": "Elasticsearch",
  "clickhouse": "ClickHouse",
  "cassandra": "Cassandra",
  "scylladb": "ScyllaDB",
  "neo4j": "Neo4j",
  "mariadb": "MariaDB",
  "oracle": "Oracle",
  "sql server": "SQL Server",
  "banco de dados relacional": "Banco de Dados Relacional",
  "relational database": "Banco de Dados Relacional",
  "nosql": "NoSQL",
  "prisma": "Prisma",
  "drizzle": "Drizzle",
  "drizzle orm": "Drizzle",
  "typeorm": "TypeORM",
  "sequelize": "Sequelize",
  "hibernate": "Hibernate",
  "mongoose": "Mongoose",
  "knex": "Knex.js",
  "flyway": "Flyway",
  "liquibase": "Liquibase",

  // 9. Observability & Monitoring
  "observabilidade": "Observabilidade",
  "observability": "Observabilidade",
  "opentelemetry": "OpenTelemetry",
  "otel": "OpenTelemetry",
  "prometheus": "Prometheus",
  "grafana": "Grafana",
  "datadog": "Datadog",
  "new relic": "New Relic",
  "newrelic": "New Relic",
  "elk": "ELK Stack",
  "kibana": "Kibana",
  "jaeger": "Jaeger",
  "sentry": "Sentry",
  "loki": "Loki",
  "tempo": "Tempo",

  // 10. Testing & Quality Assurance
  "testes unitários": "Testes Unitários",
  "testes unitarios": "Testes Unitários",
  "unit tests": "Testes Unitários",
  "unit testing": "Testes Unitários",
  "testes de integração": "Testes de Integração",
  "testes de integracao": "Testes de Integração",
  "integration tests": "Testes de Integração",
  "testes automatizados": "Testes Automatizados",
  "automated testing": "Testes Automatizados",
  "automated tests": "Testes Automatizados",
  "jest": "Jest",
  "vitest": "Vitest",
  "playwright": "Playwright",
  "cypress": "Cypress",
  "selenium": "Selenium",
  "mocha": "Mocha",
  "chai": "Chai",
  "phpunit": "PHPUnit",
  "junit": "JUnit",
  "pytest": "pytest",
  "k6": "k6",
  "postman": "Postman",
  "sonarqube": "SonarQube",

  // 11. Methodologies & Developer Tools
  "scrum": "Scrum",
  "kanban": "Kanban",
  "agile": "Agile",
  "ágil": "Agile",
  "metodologia ágil": "Agile",
  "metodologias ágeis": "Agile",
  "jira": "Jira",
  "confluence": "Confluence",
  "git": "Git",
  "github": "GitHub",
  "gitlab": "GitLab",
  "bitbucket": "Bitbucket",
  "code review": "Code Review",
  "ci": "CI/CD",
  "cd": "CI/CD",
  "twilio": "Twilio",
  "sendgrid": "SendGrid",
  "saas": "SaaS",
  "paas": "PaaS",
  "iaas": "IaaS",

  // 12. Security & Identity
  "segurança": "Segurança",
  "seguranca": "Segurança",
  "security": "Segurança",
  "oauth": "OAuth2",
  "oauth2": "OAuth2",
  "jwt": "JWT",
  "saml": "SAML",
  "sso": "SSO",
  "iam": "IAM",
  "mfa": "MFA",
  "rbac": "RBAC",
  "owasp": "OWASP",
  "criptografia": "Criptografia",
  "cryptography": "Criptografia",
  "ssl/tls": "SSL/TLS",
  "tls": "SSL/TLS",
  "ssl": "SSL/TLS",
  "https": "HTTPS"
};

// Known technical acronyms (2 to 5 characters) that are explicitly allowed
export const KNOWN_TECH_ACRONYMS = new Set([
  "api", "apis", "sdk", "sdks", "orm", "cli", "gui", "etl", "saas", "paas", "iaas", "cms", "crm", "erp", "dms", "iot", "ai", "ml", "llm",
  "sso", "iam", "jwt", "saml", "mfa", "rbac", "owasp", "ddd", "tdd", "bdd", "solid", "grpc", "ci/cd", "ci", "cd", "sql", "nosql",
  "aws", "gcp", "azure", "k8s", "i18n", "l10n", "p2p", "b2b", "rest", "soap", "json", "xml", "uuid", "crud", "rpc", "tcp/ip",
  "http", "http/2", "http/3", "mqtt", "amqp", "ssl/tls", "tls", "ssl", "ssh", "dns", "cdn", "vpc", "vpn"
]);

/**
 * Strict Tech-First check: a word or phrase is only recognized if it exists in CANONICAL_TECH_ENTITIES
 * or is a recognized technology acronym. All common Portuguese and corporate nouns are rejected.
 */
export function isRecognizedTechEntity(term: string): boolean {
  if (!term) return false;
  const clean = term.toLowerCase().trim();
  const normalized = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (CANONICAL_TECH_ENTITIES[clean] || CANONICAL_TECH_ENTITIES[normalized]) {
    return true;
  }
  if (KNOWN_TECH_ACRONYMS.has(clean) || KNOWN_TECH_ACRONYMS.has(normalized)) {
    return true;
  }
  return false;
}

export function formatTechEntity(term: string): string {
  if (!term) return "";
  const lower = term.toLowerCase().trim();
  const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (CANONICAL_TECH_ENTITIES[lower]) {
    return CANONICAL_TECH_ENTITIES[lower];
  }
  if (CANONICAL_TECH_ENTITIES[normalized]) {
    return CANONICAL_TECH_ENTITIES[normalized];
  }
  if (KNOWN_TECH_ACRONYMS.has(lower) || KNOWN_TECH_ACRONYMS.has(normalized)) {
    return term.toUpperCase();
  }

  // Word capitalizer supporting hyphens and slashes
  return term
    .split(/\s+/)
    .map(w => {
      if (w.includes("-")) {
        return w.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-");
      }
      if (w.includes("/")) {
        return w.split("/").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("/");
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function extractKeywords(
  text: string,
  optionsOrLang: ExtractKeywordOptions | SupportedLanguage = {},
  maybeTopN?: number
): ExtractedKeyword[] {
  let lang: SupportedLanguage = "pt";
  let topN = 15;

  if (typeof optionsOrLang === "string") {
    lang = optionsOrLang;
    if (typeof maybeTopN === "number") topN = maybeTopN;
  } else if (typeof optionsOrLang === "object") {
    if (optionsOrLang.lang) lang = optionsOrLang.lang;
    if (optionsOrLang.topN) topN = optionsOrLang.topN;
  }

  const stopwords = getStopwords(lang);

  if (!text || text.trim().length === 0) return [];

  // 1. Sanitize text with strict UTF-8 & strip Gupy boilerplate
  const cleanInput = stripJobBoilerplate(sanitizeUtf8(text));

  // 2. Unglue words joined by punctuation (e.g. "Nestjs.Informações" -> "Nestjs. Informações")
  const unglued = ungluePunctuation(cleanInput);

  // 3. Remove punctuation except characters used in technology names (. + # / -)
  const normalizedPunctuation = unglued.replace(
    /(?<!\b(?:node|vue|next|react|nest|ember|backbone|express|three|chart|moment|d3|web|asp))\.(?!\b(?:js|ts|net|org|com|io|ai)\b)/gi,
    " "
  );

  const lowerText = normalizedPunctuation.toLowerCase();
  const foundCompounds: Record<string, number> = {};

  // Check known compound tech terms first (e.g. "Clean Architecture", "Spring Boot", "RESTful APIs", "AWS ECS")
  for (const compound of Object.keys(CANONICAL_TECH_ENTITIES)) {
    if (compound.includes(" ") || compound.includes(".") || compound.includes("/")) {
      const escaped = compound.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`(?<=\\b|\\s|^)${escaped}(?=\\b|\\s|$)`, "gi");
      const matches = lowerText.match(regex);
      if (matches && matches.length > 0) {
        foundCompounds[compound] = matches.length;
      }
    }
  }

  // Tokenize single words
  const words = lowerText
    .replace(/[^\p{L}\p{N}\s.+#\/-]/gu, " ")
    .split(/\s+/)
    .map(w => w.trim().replace(/^[\.\-\/]+|[\.\-\/]+$/g, ""))
    .filter(w => w.length > 1);

  // Build TF-IDF document
  const tfidf = new natural.TfIdf();
  tfidf.addDocument(lowerText);

  // Term count map
  const termCounts: Record<string, number> = { ...foundCompounds };

  for (const word of words) {
    if (stopwords.has(word) || isExcludedSkillTerm(word)) continue;
    if (isAnomalousAlphanumeric(word)) continue;
    // Disallow purely numeric words
    if (/^\d+$/.test(word)) continue;
    // Disallow short words unless explicit tech acronym
    if (word.length <= 2 && !["go", "c", "r", "ui", "ux", "ts", "js", "ai"].includes(word)) continue;

    // Strict Tech-First NER Filter: term MUST be a recognized tech entity or tech acronym
    if (!isRecognizedTechEntity(word)) continue;

    termCounts[word] = (termCounts[word] || 0) + 1;
  }

  const results: ExtractedKeyword[] = [];
  const seenStems = new Set<string>();

  for (const [rawTerm, count] of Object.entries(termCounts)) {
    if (stopwords.has(rawTerm) || isExcludedSkillTerm(rawTerm)) continue;
    if (isAnomalousAlphanumeric(rawTerm)) continue;

    // Strict Tech-First NER Filter
    if (!isRecognizedTechEntity(rawTerm)) continue;

    const stem = stemWord(rawTerm, lang);

    let score = 0;
    tfidf.tfidfs(rawTerm, (_, measure) => {
      score = measure;
    });

    if (score === 0) {
      score = count * 1.5;
    }

    // Boost known real technical entities (concrete tools/languages prioritized over abstract concepts)
    const isTechEntity = CANONICAL_TECH_ENTITIES[rawTerm] !== undefined;
    if (isTechEntity) {
      if (ABSTRACT_TECH_CONCEPTS.has(rawTerm.toLowerCase())) {
        score *= 2.0;
      } else {
        score *= 4.5;
      }
    }

    const canonicalTerm = CANONICAL_TECH_ENTITIES[rawTerm] || formatTechEntity(rawTerm);

    results.push({
      term: canonicalTerm,
      tfidf: Number(score.toFixed(3)),
      count,
      stem
    });
  }

  // Combine entries that map to the same canonical term (e.g. node.js, nodejs, node -> Node.js)
  const canonicalMap = new Map<string, ExtractedKeyword>();
  for (const item of results) {
    const key = item.term.toLowerCase();
    if (canonicalMap.has(key)) {
      const existing = canonicalMap.get(key)!;
      existing.count += item.count;
      existing.tfidf = Number(Math.max(existing.tfidf, item.tfidf).toFixed(3));
    } else {
      canonicalMap.set(key, { ...item });
    }
  }

  const combinedResults = Array.from(canonicalMap.values());
  // Sort descending: by TF-IDF score, then by count
  combinedResults.sort((a, b) => b.tfidf - a.tfidf || b.count - a.count);

  // Deduplicate very close stems
  const filtered: ExtractedKeyword[] = [];
  for (const kw of combinedResults) {
    if (filtered.length >= topN) break;
    const lower = kw.term.toLowerCase();
    if (!seenStems.has(kw.stem) || CANONICAL_TECH_ENTITIES[lower]) {
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
    const regex = new RegExp(`(?<=\\b|\\s|^)${escaped}(?=\\b|\\s|$)`, "gi");
    const matches = lowerText.match(regex);
    density[cleanTerm] = matches ? matches.length : 0;
  }

  return density;
}
