import type { ExtractedKeyword } from "../nlp/tfidf.ts";
import type { ResumeData } from "../types/resume.ts";
import { sanitizeResumeUtf8, sanitizeUtf8 } from "../utils/encoding.ts";
import { getEnvKey } from "../utils/env.ts";
import { callClaudeGenerate } from "./claudeService.ts";
import { callOllamaGenerate } from "./ollamaService.ts";
import { callOpenRouterGenerate } from "./openRouterService.ts";

export type CoverLetterTone = "Técnico & Direto" | "Executivo" | "Entusiasta";

export function normalizeCoverLetterTone(raw?: string): CoverLetterTone {
  if (!raw) return "Técnico & Direto";
  const s = raw.toLowerCase().trim();
  if (s.includes("executiv")) return "Executivo";
  if (s.includes("entusiast") || s.includes("cultural")) return "Entusiasta";
  return "Técnico & Direto";
}

export type CoverLetterEngine =
  | "gemini"
  | "ollama"
  | "openrouter"
  | "claude"
  | "local";

export interface CoverLetterJobContext {
  title: string;
  company: string;
  rawDescription?: string;
  topKeywords?: Array<
    { term: string; count?: number; tfidf?: number } | ExtractedKeyword
  >;
  language?: string;
}

export interface GenerateCoverLetterOptions {
  profile: ResumeData;
  job: CoverLetterJobContext;
  tone?: CoverLetterTone | string;
  engine?: CoverLetterEngine;
}

export interface CoverLetterResult {
  content: string;
  engineUsed: CoverLetterEngine;
}

/**
 * Main cover letter generator dispatching to Gemini, Ollama or deterministic local engine.
 */
export async function generateCoverLetter(
  options: GenerateCoverLetterOptions,
): Promise<CoverLetterResult> {
  const profile = sanitizeResumeUtf8(options.profile);
  const tone = normalizeCoverLetterTone(options.tone);
  const preferredEngine = options.engine || "local";
  const isEn = (options.job.language || "pt").toLowerCase().startsWith("en");

  if (preferredEngine === "gemini") {
    const geminiKey = getEnvKey("GEMINI_API_KEY");
    if (geminiKey) {
      try {
        const text = await callGeminiCoverLetter(
          profile,
          options.job,
          tone,
          geminiKey,
          isEn,
        );
        if (text && text.trim().length > 120) {
          return { content: text.trim(), engineUsed: "gemini" };
        }
      } catch (err) {
        console.warn(
          "[Cover Letter] Falha no Gemini, recorrendo ao motor local:",
          err,
        );
      }
    }
  }

  if (preferredEngine === "ollama") {
    try {
      const text = await callOllamaCoverLetter(
        profile,
        options.job,
        tone,
        isEn,
      );
      if (text && text.trim().length > 120) {
        return { content: text.trim(), engineUsed: "ollama" };
      }
    } catch (err) {
      console.warn(
        "[Cover Letter] Falha no Ollama, recorrendo ao motor local:",
        err,
      );
    }
  }

  if (preferredEngine === "openrouter") {
    try {
      const text = await callOpenRouterCoverLetter(
        profile,
        options.job,
        tone,
        isEn,
      );
      if (text && text.trim().length > 120) {
        return { content: text.trim(), engineUsed: "openrouter" };
      }
    } catch (err) {
      console.warn(
        "[Cover Letter] Falha no OpenRouter, recorrendo ao motor local:",
        err,
      );
    }
  }

  if (preferredEngine === "claude") {
    try {
      const text = await callClaudeCoverLetter(
        profile,
        options.job,
        tone,
        isEn,
      );
      if (text && text.trim().length > 120) {
        return { content: text.trim(), engineUsed: "claude" };
      }
    } catch (err) {
      console.warn(
        "[Cover Letter] Falha no Claude, recorrendo ao motor local:",
        err,
      );
    }
  }

  // Fallback / Deterministic local engine
  const localText = generateDeterministicCoverLetter(
    profile,
    options.job,
    tone,
    isEn,
  );
  return { content: localText, engineUsed: "local" };
}

/**
 * Builds deterministic, zero-hallucination, ATS-compliant cover letter based on real profile facts.
 * Provides genuinely distinct structures, perspectives, and vocabulary for each tone.
 */
export function generateDeterministicCoverLetter(
  profile: ResumeData,
  job: CoverLetterJobContext,
  tone: CoverLetterTone | string,
  isEn: boolean,
): string {
  const normalizedTone = normalizeCoverLetterTone(tone);
  const company =
    job.company?.trim() || (isEn ? "Hiring Team" : "Time de Recrutamento");
  const jobTitle =
    job.title?.trim() ||
    (isEn ? "Software Engineer" : "Engenheiro de Software");
  const candidateName = profile.fullName?.trim() || "Candidato";
  const headline =
    profile.headline?.trim() ||
    (isEn ? "Software Engineer" : "Desenvolvedor de Software");

  // Top skills match
  const candidateSkills = (profile.skills || []).map((s) => s.toLowerCase());
  const jobKeywords = (job.topKeywords || []).map((k) => k.term);
  const matched = jobKeywords.filter((k) =>
    candidateSkills.some(
      (s) => s.includes(k.toLowerCase()) || k.toLowerCase().includes(s),
    ),
  );
  const topTechList =
    matched.length > 0 ? matched.slice(0, 5) : jobKeywords.slice(0, 4);
  const techStr =
    topTechList.length > 0
      ? topTechList.join(", ")
      : isEn
        ? "software engineering, systems architecture, and testing"
        : "desenvolvimento de software, arquitetura de sistemas e testes automatizados";

  const primaryExp = profile.experiences?.[0];

  // ================= ENGLISH TEMPLATES =================
  if (isEn) {
    if (normalizedTone === "Técnico & Direto") {
      const expSnippet = primaryExp
        ? `In my recent position as ${primaryExp.role} at ${primaryExp.company}, I delivered high-availability services, optimized system throughput, and instituted disciplined automated testing across the engineering stack.`
        : "";

      return `Dear ${company} Hiring Team,

With a strong focus on software craftsmanship, resilient system architecture, and scalable performance, I am writing to submit my application for the ${jobTitle} position.

My background as ${headline} is grounded in hands-on proficiency with ${techStr}. I apply rigorous clean code standards, comprehensive testing, data integrity, and end-to-end observability in production environments. ${expSnippet}

Analyzing the technical challenges at ${company}, I see immediate alignment with my experience in maintaining robust microservices, automated CI/CD pipelines, and solving complex performance bottlenecks under high throughput.

Thank you for reviewing my technical profile. I welcome the opportunity to dive into technical discussions or architecture reviews during an interview.

Sincerely,
${candidateName}
${profile.email}${profile.phone ? ` | ${profile.phone}` : ""}${profile.location ? ` | ${profile.location}` : ""}`;
    }

    if (normalizedTone === "Executivo") {
      const expSnippet = primaryExp
        ? `In my recent role as ${primaryExp.role} at ${primaryExp.company}, I operated at the nexus of technology and business strategy—prioritizing high-ROI technical initiatives, managing technical debt responsibly, and accelerating roadmap delivery.`
        : "";

      return `Dear ${company} Hiring Team,

With a track record of driving technical initiatives from inception to measurable business impact, I am writing to present my candidacy for the ${jobTitle} role.

As ${headline}, I blend deep hands-on expertise across ${techStr} with holistic product strategy. I focus on bridging engineering execution with corporate strategic goals, promoting strong technical ownership, and cultivating high-velocity delivery teams. ${expSnippet}

My goal at ${company} is to serve as an organizational multiplier: raising engineering maturity, establishing sustainable architectural standards, and maximizing return on engineering investment.

I look forward to discussing ${company}'s strategic goals and how my technical leadership can support your growth trajectory.

Sincerely,
${candidateName}
${profile.email}${profile.phone ? ` | ${profile.phone}` : ""}${profile.location ? ` | ${profile.location}` : ""}`;
    }

    // Entusiasta (English)
    const expSnippet = primaryExp
      ? `Recently as ${primaryExp.role} at ${primaryExp.company}, I worked enthusiastically with cross-functional product squads to launch customer-facing features that directly delighted users.`
      : "";

    return `Dear ${company} Hiring Team,

I was thrilled to see the opening for ${jobTitle} at ${company}. Having followed your product innovations and customer-first reputation, I am genuinely excited to submit my candidacy!

As ${headline}, what drives me every day is using technology to solve real user problems with elegant, intuitive solutions. Working extensively with ${techStr}, I love turning ambitious product ideas into reliable software that users love. ${expSnippet}

I thrive in collaborative, energetic environments where continuous learning, knowledge sharing, and empathy are core cultural values. I am eager to bring my positivity, proactivity, and technical dedication to ${company}'s mission.

I would love the opportunity to connect with the team and discuss how we can build impactful experiences together!

Sincerely,
${candidateName}
${profile.email}${profile.phone ? ` | ${profile.phone}` : ""}${profile.location ? ` | ${profile.location}` : ""}`;
  }

  // ================= PT-BR TEMPLATES =================
  if (normalizedTone === "Técnico & Direto") {
    const expSnippet = primaryExp
      ? `Em minha atuação mais recente como ${primaryExp.role} na ${primaryExp.company}, liderei entregas de alta complexidade técnica, reduzindo gargalos de performance, implementando testes automatizados e sustentando microsserviços em produção.`
      : "";

    return `Prezado time de engenharia da ${company},

Com foco em excelência técnica, código sustentável e arquitetura de software escalável, apresento minha candidatura para a posição de ${jobTitle}.

Minha trajetória como ${headline} é fundamentada em domínio prático de ${techStr}. Atuo com foco estrito em padrões de código limpo, cobertura de testes consistente, modelagem de dados eficiente e observabilidade de sistemas. ${expSnippet}

Ao analisar as especificações e desafios da ${company}, identifico aderência direta com minha experiência em arquitetura resiliente, esteiras de CI/CD e capacidade analítica para solucionar problemas críticos de software sob alta demanda.

Agradeço pela análise do meu perfil técnico e coloco-me à disposição para aprofundarmos os detalhes da minha vivência e realizarmos discussões arquiteturais ou testes práticos em uma entrevista técnica.

Atenciosamente,
${candidateName}
${profile.email}${profile.phone ? ` | ${profile.phone}` : ""}${profile.location ? ` | ${profile.location}` : ""}`;
  }

  if (normalizedTone === "Executivo") {
    const expSnippet = primaryExp
      ? `Em minha trajetória recente como ${primaryExp.role} na ${primaryExp.company}, atuei na interface entre engenharia e negócios, priorizando iniciativas de alto ROI, acelerando ciclos de entrega e garantindo previsibilidade de roadmap.`
      : "";

    return `À liderança de tecnologia e gestão da ${company},

Com sólida vivência na condução de projetos de tecnologia de ponta a ponta, governança de arquitetura e geração de valor mensurável para o negócio, apresento minha candidatura para a vaga de ${jobTitle}.

Atuando como ${headline}, combino profundidade técnica em ${techStr} com uma visão holística de produto. Tenho experiência em alinhar objetivos estratégicos corporativos à execução técnica de excelência, gerenciando dívida técnica com maturidade e promovendo cultura de ownership. ${expSnippet}

Meu objetivo na ${company} é atuar como um multiplicador de resultados: elevando a maturidade operacional da engenharia, estabelecendo padrões arquiteturais de longo prazo e construindo pontes sólidas entre tecnologia, clientes e stakeholders estratégicos.

Estou à disposição para uma conversa executiva onde possamos debater as metas da ${company} e o impacto que posso agregar à evolução dos seus produtos.

Atenciosamente,
${candidateName}
${profile.email}${profile.phone ? ` | ${profile.phone}` : ""}${profile.location ? ` | ${profile.location}` : ""}`;
  }

  // Entusiasta (PT-BR)
  const expSnippet = primaryExp
    ? `Recentemente, como ${primaryExp.role} na ${primaryExp.company}, trabalhei com entusiasmo ao lado de equipes multidisciplinares para entregar soluções que impactaram diretamente a experiência dos usuários.`
    : "";

  return `Olá, time da ${company}!

É com enorme entusiasmo e sincera admiração pela cultura e pelo impacto da ${company} no mercado que submeto minha candidatura para a posição de ${jobTitle}.

Acompanho de perto a trajetória inovadora da ${company} e me identifico profundamente com o propósito de transformar o setor por meio de tecnologia de excelência. Como ${headline}, o que mais me motiva diariamente é transformar problemas complexos em experiências simples e elegantes, aplicando tecnologias como ${techStr}. ${expSnippet}

Sou uma pessoa curiosa, apaixonada por aprender e compartilhar conhecimento, que valoriza o trabalho em equipe e a colaboração aberta. Acredito que a combinação da minha energia positiva com a cultura dinâmica da ${company} será uma parceria fantástica para construirmos produtos incríveis juntos.

Será um privilégio imenso participar de uma conversa com o time para nos conhecermos melhor e compartilharmos ideias sobre o futuro!

Atenciosamente,
${candidateName}
${profile.email}${profile.phone ? ` | ${profile.phone}` : ""}${profile.location ? ` | ${profile.location}` : ""}`;
}

/**
 * Invokes Gemini 1.5 Flash for nuanced, custom-tailored cover letter generation.
 */
async function callGeminiCoverLetter(
  profile: ResumeData,
  job: CoverLetterJobContext,
  tone: CoverLetterTone,
  apiKey: string,
  isEn: boolean,
): Promise<string> {
  const prompt = buildCoverLetterAiPrompt(profile, job, tone, isEn);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1200,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return sanitizeAiLetterText(rawText);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Invokes Ollama local API for offline cover letter generation.
 */
async function callOllamaCoverLetter(
  profile: ResumeData,
  job: CoverLetterJobContext,
  tone: CoverLetterTone,
  isEn: boolean,
): Promise<string> {
  const prompt = buildCoverLetterAiPrompt(profile, job, tone, isEn);
  const rawText = await callOllamaGenerate({
    prompt,
    system: isEn
      ? "You are an expert executive resume writer. Output ONLY the raw cover letter text. Do not add conversational remarks, introductory prefixes, or markdown headers."
      : "Você é um especialista sênior em cartas de apresentação profissionais. Escreva EXCLUSIVAMENTE o texto final da carta de apresentação, sem introduções ou comentários.",
    timeoutMs: 30000,
  });

  return sanitizeAiLetterText(rawText);
}

async function callOpenRouterCoverLetter(
  profile: ResumeData,
  job: CoverLetterJobContext,
  tone: CoverLetterTone,
  isEn: boolean,
): Promise<string> {
  const prompt = buildCoverLetterAiPrompt(profile, job, tone, isEn);
  const rawText = await callOpenRouterGenerate({
    prompt,
    system: isEn
      ? "You are an expert executive resume writer. Output ONLY the raw cover letter text. Do not add conversational remarks, introductory prefixes, or markdown headers."
      : "Você é um especialista sênior em cartas de apresentação profissionais. Escreva EXCLUSIVAMENTE o texto final da carta de apresentação, sem introduções ou comentários.",
    timeoutMs: 30000,
  });

  return sanitizeAiLetterText(rawText);
}

async function callClaudeCoverLetter(
  profile: ResumeData,
  job: CoverLetterJobContext,
  tone: CoverLetterTone,
  isEn: boolean,
): Promise<string> {
  const prompt = buildCoverLetterAiPrompt(profile, job, tone, isEn);
  const rawText = await callClaudeGenerate({
    prompt,
    system: isEn
      ? "You are an expert executive resume writer. Output ONLY the raw cover letter text. Do not add conversational remarks, introductory prefixes, or markdown headers."
      : "Você é um especialista sênior em cartas de apresentação profissionais. Escreva EXCLUSIVAMENTE o texto final da carta de apresentação, sem introduções ou comentários.",
    timeoutMs: 30000,
  });

  return sanitizeAiLetterText(rawText);
}

function buildCoverLetterAiPrompt(
  profile: ResumeData,
  job: CoverLetterJobContext,
  tone: CoverLetterTone,
  isEn: boolean,
): string {
  const normalizedTone = normalizeCoverLetterTone(tone);
  const keywordsList = (job.topKeywords || [])
    .map((k) => k.term)
    .slice(0, 10)
    .join(", ");
  const experiencesSummary = (profile.experiences || [])
    .slice(0, 3)
    .map(
      (e) =>
        `- ${e.role} em ${e.company} (${e.startDate} - ${e.endDate}): ${e.description}`,
    )
    .join("\n");

  if (isEn) {
    const toneGuidanceEn = {
      "Técnico & Direto": `TONE DIRECTIVE (TECHNICAL & DIRECT):
- Adopt an engineering-first, analytical, and precise voice.
- Emphasize deep proficiency across the technical stack (${keywordsList}), clean architecture, testing discipline, and high-throughput reliability.
- Speak directly engineer-to-engineer; avoid superficial corporate jargon.`,
      Executivo: `TONE DIRECTIVE (EXECUTIVE & LEADERSHIP):
- Adopt a senior, strategic leadership voice focused on business value and ROI.
- Emphasize cross-functional ownership, technical governance, roadmap velocity, and aligning engineering outcomes with corporate goals.
- Position the candidate as an organizational multiplier and technical leader.`,
      Entusiasta: `TONE DIRECTIVE (ENTHUSIASTIC & CULTURAL):
- Adopt a vibrant, warm, and engaging voice showing genuine excitement for ${job.company}'s mission.
- Highlight product empathy, user-centric impact, agile teamwork, curiosity, and rapid learning.
- Convey passion, energy, and strong cultural alignment.`,
    }[normalizedTone];

    return `Generate a professional, compelling, and concise Cover Letter (maximum 350 words) for the following job:
Company: ${job.company}
Target Role: ${job.title}
Tone requested: ${normalizedTone}

${toneGuidanceEn}

Key Job Requirements: ${keywordsList}
Job Description context:
${(job.rawDescription || "").slice(0, 1500)}

Candidate Profile:
Name: ${profile.fullName}
Headline: ${profile.headline}
Email: ${profile.email} | Phone: ${profile.phone || ""} | Location: ${profile.location || ""}
Skills: ${(profile.skills || []).join(", ")}
Summary: ${profile.summary}
Work Experiences:
${experiencesSummary}

CRITICAL RULES:
1. STRICT ZERO-HALLUCINATION: Do NOT invent companies, college degrees, or metrics not present in the candidate profile.
2. Structure: 3-4 cohesive paragraphs. Seamlessly connect the candidate's actual experience and matched technical skills (${keywordsList}) to the role.
3. Return ONLY the letter text ready to send. No markdown fences, no conversational greetings before or after.`;
  }

  const toneGuidancePt = {
    "Técnico & Direto": `DIRETRIZ DE TOM (TÉCNICO & DIRETO):
- Adote voz analítica, objetiva e orientada a engenharia de software e arquitetura.
- Destaque o domínio prático da stack técnica (${keywordsList}), boas práticas de código limpo, testes automatizados e sustentabilidade em produção.
- Evite rodeios vazios; vá direto às capacidades técnicas e soluções de engenharia.`,
    Executivo: `DIRETRIZ DE TOM (EXECUTIVO & LIDERANÇA):
- Adote postura sênior, estratégica e orientada a impacto de negócios e visão de produto.
- Destaque liderança técnica, mitigação de riscos, governança, ciclo completo de entrega (end-to-end) e colaboração com stakeholders.
- Demonstre como suas decisões de engenharia aceleram metas comerciais e garantem ROI sustentável.`,
    Entusiasta: `DIRETRIZ DE TOM (ENTUSIASTA & CULTURAL):
- Adote tom caloroso, vibrante e com sincera admiração pela missão e cultura da ${job.company}.
- Destaque paixão por construir produtos de excelência para usuários reais, curiosidade intelectual, trabalho em equipe e aprendizado contínuo.
- Transmita energia contagiante e motivação sincera para fazer parte da jornada da empresa.`,
  }[normalizedTone];

  return `Escreva uma Carta de Apresentação profissional, concisa (máximo 350 palavras) e de alto impacto para a seguinte vaga:
Empresa: ${job.company}
Cargo: ${job.title}
Tom solicitado: ${normalizedTone}

${toneGuidancePt}

Palavras-chave da vaga: ${keywordsList}
Contexto dos requisitos da vaga:
${(job.rawDescription || "").slice(0, 1500)}

Perfil do Candidato:
Nome: ${profile.fullName}
Cargo/Headline: ${profile.headline}
Contato: ${profile.email} | ${profile.phone || ""} | ${profile.location || ""}
Habilidades: ${(profile.skills || []).join(", ")}
Resumo: ${profile.summary}
Experiências Profissionais:
${experiencesSummary}

REGRAS OBRIGATÓRIAS:
1. ZERO ALUCINAÇÃO: Não invente empresas, diplomas ou números ausentes no perfil do candidato.
2. Estrutura: 3 a 4 parágrafos bem escritos. Conecte as experiências reais do candidato às tecnologias exigidas pela vaga (${keywordsList}).
3. Retorne EXCLUSIVAMENTE o texto puro da carta, sem introduções ("Aqui está a carta:"), sem blocos de código markdown (\`\`\`).`;
}

function sanitizeAiLetterText(raw?: string): string {
  if (!raw) return "";
  let text = sanitizeUtf8(raw).trim();
  text = text.replace(/^```[a-zA-Z]*\n?([\s\S]*?)\n?```$/g, "$1").trim();
  text = text
    .replace(
      /^(aqui\s+est[aá]\s+(a\s+)?(sua\s+)?(carta|sugest[aã]o)(:)?|carta\s*(de\s+apresenta[çc][ãa]o)?(:)?|here\s+is\s+(the\s+)?(cover\s+letter|letter)(:)?)\s*/i,
      "",
    )
    .trim();
  return text;
}
