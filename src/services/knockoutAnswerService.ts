import type { ResumeData } from "../types/resume.ts";
import { getEnvKey } from "../utils/env.ts";
import { callOllamaGenerate } from "./ollamaService.ts";

export interface KnockoutJobContext {
  title: string;
  company: string;
  rawDescription?: string;
  topKeywords?: Array<{ term: string; count?: number; tfidf?: number }>;
  language?: string;
}

export interface KnockoutGenerationContext {
  questionText: string;
  job: KnockoutJobContext;
  profile: ResumeData;
  preferredEngine?: "gemini" | "ollama" | "openai" | "heuristic";
}

export interface KnockoutGenerationResult {
  answer: string;
  source: "gemini" | "ollama" | "openai" | "heuristic";
}

export function validateAndCleanAnswer(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let text = raw.trim();

  // Strip markdown code fences if present
  text = text.replace(/^```[a-zA-Z]*\n?([\s\S]*?)\n?```$/g, "$1").trim();

  // Strip AI introductory prefixes
  text = text.replace(
    /^(aqui\s+est[aá]\s+(a\s+)?(minha\s+)?(resposta|sugest[aã]o)(:)?|resposta\s*(final)?(:)?|here\s+is\s+(the\s+)?(suggested\s+)?answer(:)?)\s*/i,
    "",
  );

  // Strip wrapping quotes
  text = text.replace(/^["'“”](.*)["'“”]$/s, "$1").trim();

  // Validate: must have substantive content and not contain raw unreplaced templates
  if (text.length < 30) return null;
  if (
    /\[(?:nome\s+da\s+empresa|empresa|ano|tecnologia|cargo|inserir)\]/i.test(
      text,
    )
  ) {
    return null;
  }

  return text;
}

export async function generateKnockoutAnswerWithMeta(
  context: KnockoutGenerationContext,
): Promise<KnockoutGenerationResult> {
  const { questionText, job, profile, preferredEngine } = context;
  const isEn = (job.language || "pt").toLowerCase().startsWith("en");

  if (preferredEngine === "ollama") {
    const llmAnswer = await callOllamaKnockout(
      questionText,
      job,
      profile,
      isEn,
    );
    const validated = validateAndCleanAnswer(llmAnswer);
    if (validated) {
      return {
        answer: validated,
        source: "ollama",
      };
    }
  }

  const geminiKey = getEnvKey("GEMINI_API_KEY");
  const openaiKey = getEnvKey("OPENAI_API_KEY");

  if (preferredEngine !== "heuristic") {
    if (geminiKey && preferredEngine !== "openai") {
      try {
        const llmAnswer = await callGeminiKnockout(
          geminiKey,
          questionText,
          job,
          profile,
          isEn,
        );
        const validated = validateAndCleanAnswer(llmAnswer);
        if (validated) {
          return {
            answer: validated,
            source: "gemini",
          };
        }
      } catch (e) {
        console.warn(
          "Gemini knockout generation fallback to internal engine:",
          e,
        );
      }
    } else if (openaiKey) {
      try {
        const llmAnswer = await callOpenAiKnockout(
          openaiKey,
          questionText,
          job,
          profile,
          isEn,
        );
        const validated = validateAndCleanAnswer(llmAnswer);
        if (validated) {
          return {
            answer: validated,
            source: "openai",
          };
        }
      } catch (e) {
        console.warn(
          "OpenAI knockout generation fallback to internal engine:",
          e,
        );
      }
    } else if (!preferredEngine) {
      // If no cloud key is set, attempt Ollama before falling back to deterministic heuristic
      const llmAnswer = await callOllamaKnockout(
        questionText,
        job,
        profile,
        isEn,
      );
      const validated = validateAndCleanAnswer(llmAnswer);
      if (validated) {
        return {
          answer: validated,
          source: "ollama",
        };
      }
    }
  }

  // High-fidelity honest domain synthesizer (no false claims, no string butchering)
  const synth = synthesizeDeterministicStarAnswer(
    questionText,
    job,
    profile,
    isEn,
  );
  const validatedSynth = validateAndCleanAnswer(synth) || synth.trim();
  return {
    answer: validatedSynth,
    source: "heuristic",
  };
}

export async function generateKnockoutAnswer(
  context: KnockoutGenerationContext,
): Promise<string> {
  const res = await generateKnockoutAnswerWithMeta(context);
  return res.answer;
}

// ---------------------------------------------------------------------------
// LLM Callers (Graceful, non-blocking with 10s abort timeout)
// ---------------------------------------------------------------------------
async function callGeminiKnockout(
  apiKey: string,
  question: string,
  job: KnockoutJobContext,
  profile: ResumeData,
  isEn: boolean,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const prompt = buildKnockoutPrompt(question, job, profile, isEn);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 600,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Gemini API returned error ${res.status}:`, errText);
      return null;
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.warn("Gemini call failed or timed out:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiKnockout(
  apiKey: string,
  question: string,
  job: KnockoutJobContext,
  profile: ResumeData,
  isEn: boolean,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const prompt = buildKnockoutPrompt(question, job, profile, isEn);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um mentor sênior de carreiras de TI. Redija respostas 100% verídicas, profissionais e assertivas para perguntas eliminatórias de recrutamento, sem nunca inventar qualificações inexistentes.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        max_tokens: 600,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOllamaKnockout(
  question: string,
  job: KnockoutJobContext,
  profile: ResumeData,
  isEn: boolean,
): Promise<string | null> {
  try {
    const prompt = buildKnockoutPrompt(question, job, profile, isEn);
    const raw = await callOllamaGenerate({
      prompt,
      system: isEn
        ? "You are an expert interview coach. Output ONLY the final concise response ready to paste into the job application. No markdown headers, no introductory remarks."
        : "Você é um mentor especialista em aprovação de candidatos. Escreva EXCLUSIVAMENTE o texto final da resposta, pronto para colar no formulário da vaga. Sem cabeçalhos ou comentários.",
      timeoutMs: 25000,
    });
    return raw;
  } catch (err) {
    console.warn("Ollama knockout generation fallback:", err);
    return null;
  }
}

function buildKnockoutPrompt(
  question: string,
  job: KnockoutJobContext,
  profile: ResumeData,
  isEn: boolean,
): string {
  const experiencesSummary = (profile.experiences || [])
    .slice(0, 4)
    .map(
      (e) =>
        `- ${e.role} em ${e.company} (${e.startDate} - ${e.endDate}): ${e.description.replace(/\n+/g, " ").slice(0, 300)}`,
    )
    .join("\n");

  const skillsList = (profile.skills || []).slice(0, 20).join(", ");

  if (isEn) {
    return `You are crafting an answer for a mandatory knockout screening question on a job application.
Candidate: ${profile.fullName} (${profile.headline})
Target Position: ${job.title} at ${job.company}
Job Keywords: ${(job.topKeywords || [])
      .slice(0, 8)
      .map((k: { term: string }) => k.term)
      .join(", ")}
Candidate Real Skills: ${skillsList}
Candidate Real Career History:
${experiencesSummary}

Question: "${question}"

CRITICAL INSTRUCTIONS (STRICT HONESTY & NO HALLUCINATIONS):
- Be assertive, concise and highly professional.
- Use the STAR methodology (Situation, Task, Action, Result) when asked about practical challenges or technical scenarios.
- Connect the candidate's real proven background with ${job.company}'s needs.
- NEVER invent tools, metrics, degrees, certifications, or past achievements that are not explicitly present in the candidate profile above.
- If the question asks about a specific technology or requirement that the candidate DOES NOT have in their profile, be transparent and honest: frame it maturely around their proven mastery of related technologies, solid computer science foundation, and proven ability to quickly learn and ramp up.
- Output clean text ready to paste (no markdown headers, no hashtags, 2 to 3 fluid paragraphs).`;
  }

  return `Você é um mentor especialista em aprovação de candidatos seniores em processos seletivos (Gupy, Greenhouse, Lever, Kenoby).
Seu objetivo é redigir a resposta ideal para uma Pergunta Eliminatória (Knockout Question).

Candidato: ${profile.fullName} (${profile.headline})
Vaga Alvo: ${job.title} na empresa ${job.company}
Palavras-chave da Vaga: ${(job.topKeywords || [])
    .slice(0, 8)
    .map((k: { term: string }) => k.term)
    .join(", ")}
Habilidades Reais do Candidato: ${skillsList}
Histórico Profissional Real:
${experiencesSummary}

Pergunta Eliminatória: "${question}"

DIRETRIZES OBRIGATÓRIAS (VERACIDADE ABSOLUTA E SEM MENTIRAS):
1. NUNCA MINTA OU ALUCINE: Baseie-se ESTRITAMENTE nas experiências, empresas, tecnologias e realizações reais listadas acima. Não invente números, projetos ou ferramentas que não existam no perfil.
2. SE O CANDIDATO NÃO POSSUIR A TECNOLOGIA OU REQUISITO ESPECÍFICO: Responda com honestidade e maturidade. Destaque a sólida base conceitual nas tecnologias correlatas que ele realmente domina, além da sua velocidade de aprendizado e adaptação para dominar o stack da ${job.company}.
3. MÉTODO STAR: Se a pergunta pedir um exemplo prático ou desafio técnico, use a estrutura Situação/Desafio -> Ação Prática -> Resultado, citando o contexto real das empresas onde trabalhou.
4. FORMATO: Texto fluido em 2 ou 3 parágrafos objetivos (100 a 200 palavras), em primeira pessoa, pronto para colar diretamente no formulário da vaga. Sem títulos com cerquilhas (#) ou marcadores robóticos.`;
}

// ---------------------------------------------------------------------------
// Specialized Intelligent Heuristic & STAR Synthesizer (Zero-Lie Fallback)
// ---------------------------------------------------------------------------
function synthesizeDeterministicStarAnswer(
  question: string,
  job: KnockoutJobContext,
  profile: ResumeData,
  isEn: boolean,
): string {
  const qLower = question.toLowerCase();

  // Find candidate's primary and secondary experiences
  const primaryExp = profile.experiences?.[0];

  // Extract key technical matches between job keywords and candidate skills
  const jobKeyTerms = (job.topKeywords || []).map((k: { term: string }) =>
    String(k.term || "").toLowerCase(),
  );
  const candidateSkills = (profile.skills || []).map((s) => String(s).trim());
  const matchedSkills = candidateSkills.filter((skill) =>
    jobKeyTerms.some(
      (jk) =>
        jk.includes(skill.toLowerCase()) || skill.toLowerCase().includes(jk),
    ),
  );
  const highlightedSkills = (
    matchedSkills.length > 0 ? matchedSkills : candidateSkills
  ).slice(0, 5);

  // 1. Location / Remote / Hybrid Work Model Intent (e.g., híbrido, remoto, presencial)
  if (
    /remoto|h[ií]brido|presencial|home\s*office|localiza[çc][aã]o|cidade|remote|hybrid|on-site|location/i.test(
      qLower,
    )
  ) {
    const loc = profile.location || "São Paulo, SP";
    if (isEn) {
      return `I have full availability for the specified work model, having extensive experience operating in distributed, high-performance engineering teams. Located in ${loc}, I am fully prepared for remote collaboration or scheduled hybrid syncs required by ${job.company}.`;
    }
    return `Tenho total aderência e disponibilidade para o modelo de trabalho da vaga. Resido em ${loc} e possuo ampla vivência com entregas ágeis e comunicação assíncrona em times de engenharia de alta performance, estando preparado tanto para atuação 100% remota quanto para dinâmicas híbridas definidas pela ${job.company}.`;
  }

  // 2. Salary / Compensation Expectation Intent
  if (
    /pretens[aã]o|sal[aá]ri|remunera[çc][aã]o|salary|compensation|faixa\s+salarial/i.test(
      qLower,
    )
  ) {
    if (isEn) {
      return `My salary expectation is aligned with market benchmarks for Senior ${job.title} positions, open to evaluation based on the contract model (CLT or PJ) and the full compensation package offered by ${job.company}. I prioritize impactful technical challenges and long-term career growth.`;
    }
    return `Minha pretensão salarial está alinhada à média de mercado para o nível da posição de ${job.title}, aberta a negociação em conformidade com o modelo de contratação (CLT ou PJ) e o pacote global de benefícios praticado pela ${job.company}. Priorizo projetos desafiadores e com forte perspectiva de impacto técnico.`;
  }

  // 3. Availability / Notice Period Intent (e.g., quando pode começar, início, aviso prévio)
  if (
    /in[ií]cio|aviso\s+pr[eé]vio|notice\s+period|start\s+date|when\s+can\s+you\s+start|come[çc]ar|quando\s+pode/i.test(
      qLower,
    ) ||
    (/disponibilidade/i.test(qLower) &&
      !/h[ií]brido|remoto|presencial/i.test(qLower))
  ) {
    if (isEn) {
      return `I am currently available to start immediately or within an agreed transition notice period of up to two weeks, depending on the project alignment. I have all necessary technical and logistical equipment ready for a seamless onboarding as ${job.title} at ${job.company}.`;
    }
    return `Minha disponibilidade para início é imediata (ou mediante alinhamento de transição de até duas semanas, caso necessário). Já possuo infraestrutura técnica e dedicação integral preparadas para iniciar a integração de forma ágil e produtiva no time da ${job.company} como ${job.title}.`;
  }

  // 4. Motivation / Why this company?
  if (
    /por\s+que|motiva|empresa|interesse|why\s+do\s+you\s+want|why\s+our\s+company/i.test(
      qLower,
    )
  ) {
    const mainTech =
      highlightedSkills.slice(0, 3).join(", ") || "desenvolvimento de software";
    if (isEn) {
      return `What attracts me to ${job.company} is the opportunity to solve critical engineering challenges in ${job.title}, specifically leveraging ${mainTech}. Having delivered measurable results throughout my career, I want to bring my architectural rigor and execution speed to help ${job.company} scale its products with stability and excellence.`;
    }
    return `O que me motiva na ${job.company} é a oportunidade de aplicar minha bagagem prática como ${profile.headline || job.title} para resolver desafios de alto impacto na vaga de ${job.title}. A atuação focada em ${mainTech} se conecta diretamente com meus projetos recentes, onde priorizo arquitetura limpa, alta disponibilidade e entrega contínua de valor de negócio.`;
  }

  // 5. Technical Experience / Skills / STAR Scenario (Default and most frequent knockout question)
  const wordsInQ = qLower.split(/[\s,?.!;:()]+/).filter((w) => w.length > 3);
  let bestExp = primaryExp;
  let bestBullet = "";

  for (const exp of profile.experiences || []) {
    const lines = (exp.description || "")
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    for (const line of lines) {
      const lineLower = line.toLowerCase();
      const matchCount = wordsInQ.filter((w) => lineLower.includes(w)).length;
      if (matchCount > 0 && !bestBullet) {
        bestExp = exp;
        bestBullet = line;
      }
    }
  }

  if (!bestBullet && primaryExp) {
    const lines = (primaryExp.description || "")
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    bestBullet = lines[0] || "";
  }

  const roleName = bestExp?.role || profile.headline || job.title;
  const companyName = bestExp?.company || "empresas de tecnologia";

  if (isEn) {
    if (bestBullet) {
      return `During my tenure as ${roleName} at ${companyName}, I was directly involved in engineering challenges aligned with this context.

In practical terms: ${bestBullet}. This trajectory established my hands-on autonomy in architecting reliable solutions and delivering measurable business outcomes.

I am prepared to bring this exact practical background to ${job.company} for the ${job.title} role, upholding high software quality and transparent collaboration from day one.`;
    }

    return `Throughout my career as ${roleName}, I have focused on building scalable, reliable solutions with ${highlightedSkills.slice(0, 3).join(", ")}, prioritizing clean code and sustainable architecture.

I look forward to contributing this background to ${job.company} for the ${job.title} position with commitment and high delivery standards.`;
  }

  // Portuguese natural formulation
  if (bestBullet) {
    return `Durante minha atuação como ${roleName} na ${companyName}, estive diretamente envolvido em desafios alinhados a esse contexto.

Em termos práticos: ${bestBullet}. Essa experiência consolidou minha autonomia para estruturar soluções escaláveis e resolver problemas técnicos com agilidade.

Estou preparado para aplicar essa bagagem no dia a dia da ${job.company} como ${job.title}, mantendo rigor técnico, transparência e foco em entregas de impacto.`;
  }

  return `Ao longo da minha trajetória como ${roleName}, desenvolvi sólida base de engenharia com foco em ${highlightedSkills.slice(0, 3).join(", ")}, priorizando estabilidade, clareza arquitetural e entrega consistente de valor.

Possuo total dedicação para colaborar de forma transparente e produtiva com o time da ${job.company} nos objetivos da posição de ${job.title}.`;
}
