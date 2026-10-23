import { getEnvKey } from "../utils/env.ts";

export interface OpenRouterStatus {
  available: boolean;
  configured: boolean;
  model: string;
}

export interface OpenRouterGenerateOptions {
  prompt: string;
  system?: string;
  model?: string;
  formatJson?: boolean;
  timeoutMs?: number;
}

export function isOpenRouterConfigured(): boolean {
  const key = getEnvKey("OPENROUTER_API_KEY");
  return !!key && key.trim().length > 0;
}

export function getOpenRouterApiKey(): string {
  return getEnvKey("OPENROUTER_API_KEY") || "";
}

export function getOpenRouterModel(): string {
  return getEnvKey("OPENROUTER_MODEL") || "anthropic/claude-3.5-sonnet";
}

/**
 * Checks if OpenRouter API is configured and responds to requests.
 */
export async function checkOpenRouterAvailable(): Promise<OpenRouterStatus> {
  const configured = isOpenRouterConfigured();
  const selectedModel = getOpenRouterModel();

  if (!configured) {
    return {
      available: false,
      configured: false,
      model: selectedModel,
    };
  }

  const apiKey = getOpenRouterApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/rslucena/ats-resume-optimizer",
        "X-Title": "ATS Resume Optimizer",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return {
      available: res.ok,
      configured: true,
      model: selectedModel,
    };
  } catch (_e) {
    clearTimeout(timeout);
    return {
      available: false,
      configured: true,
      model: selectedModel,
    };
  }
}

/**
 * Calls OpenRouter chat completions API with the given prompt and options.
 */
export async function callOpenRouterGenerate(
  options: OpenRouterGenerateOptions,
): Promise<string> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY não configurada no arquivo .env");
  }

  const model = options.model || getOpenRouterModel();
  const timeoutMs = options.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const messages: Array<{ role: string; content: string }> = [];
  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: options.prompt });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/rslucena/ats-resume-optimizer",
        "X-Title": "ATS Resume Optimizer",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        ...(options.formatJson
          ? { response_format: { type: "json_object" } }
          : {}),
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`OpenRouter HTTP ${res.status}: ${errBody}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Resposta vazia retornada pela API do OpenRouter");
    }

    return content;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
