import { getEnvKey } from "../utils/env.ts";

export interface ClaudeStatus {
  available: boolean;
  configured: boolean;
  model: string;
}

export interface ClaudeGenerateOptions {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export function isClaudeConfigured(): boolean {
  const key = getEnvKey("ANTHROPIC_API_KEY") || getEnvKey("CLAUDE_API_KEY");
  return !!key && key.trim().length > 0;
}

export function getClaudeApiKey(): string {
  return getEnvKey("ANTHROPIC_API_KEY") || getEnvKey("CLAUDE_API_KEY") || "";
}

export function getClaudeModel(): string {
  return (
    getEnvKey("ANTHROPIC_MODEL") ||
    getEnvKey("CLAUDE_MODEL") ||
    "claude-3-5-sonnet-20241022"
  );
}

/**
 * Checks if Anthropic Claude API is configured.
 */
export async function checkClaudeAvailable(): Promise<ClaudeStatus> {
  const configured = isClaudeConfigured();
  const selectedModel = getClaudeModel();

  if (!configured) {
    return {
      available: false,
      configured: false,
      model: selectedModel,
    };
  }

  return {
    available: true,
    configured: true,
    model: selectedModel,
  };
}

/**
 * Calls Anthropic Messages API with the given prompt and options.
 */
export async function callClaudeGenerate(
  options: ClaudeGenerateOptions,
): Promise<string> {
  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY ou CLAUDE_API_KEY não configurada no arquivo .env",
    );
  }

  const model = options.model || getClaudeModel();
  const maxTokens = options.maxTokens ?? 4096;
  const timeoutMs = options.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const payload: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: options.prompt }],
  };

  if (options.system) {
    payload.system = options.system;
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Anthropic Claude HTTP ${res.status}: ${errBody}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const textBlock = data?.content?.find((item) => item.type === "text");
    const content = textBlock?.text?.trim();

    if (!content) {
      throw new Error("Resposta de texto vazia retornada pela API do Claude");
    }

    return content;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
