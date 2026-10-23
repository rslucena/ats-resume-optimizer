import { getEnvKey } from "../utils/env.ts";

export interface OllamaStatus {
  available: boolean;
  configured: boolean;
  baseUrl: string;
  models: string[];
  selectedModel: string;
}

export interface OllamaGenerateOptions {
  prompt: string;
  system?: string;
  model?: string;
  formatJson?: boolean;
  timeoutMs?: number;
}

export function isOllamaConfigured(): boolean {
  const url = getEnvKey("OLLAMA_BASE_URL");
  const enabled = getEnvKey("OLLAMA_ENABLED");
  return (!!url && url.trim().length > 0) || enabled === "true";
}

export function getOllamaBaseUrl(): string {
  const url = getEnvKey("OLLAMA_BASE_URL");
  return (url || "http://localhost:11434").replace(/\/+$/, "");
}

export function getOllamaModel(): string {
  return getEnvKey("OLLAMA_MODEL") || "llama3.2";
}

/**
 * Checks if local Ollama server is running and returns available models.
 * Only probes localhost if Ollama has been explicitly configured in .env.
 */
export async function checkOllamaAvailable(): Promise<OllamaStatus> {
  const baseUrl = getOllamaBaseUrl();
  const configuredModel = getOllamaModel();
  const configured = isOllamaConfigured();

  if (!configured) {
    return {
      available: false,
      configured: false,
      baseUrl,
      models: [],
      selectedModel: configuredModel,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);

  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        available: false,
        configured: true,
        baseUrl,
        models: [],
        selectedModel: configuredModel,
      };
    }

    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = Array.isArray(data.models)
      ? data.models.map((m) => m.name)
      : [];

    // If configured model is not in list but models exist, prefer first available
    let selectedModel = configuredModel;
    if (models.length > 0 && !models.includes(configuredModel)) {
      const match = models.find(
        (m) =>
          m.startsWith(configuredModel) ||
          m.includes("llama") ||
          m.includes("mistral") ||
          m.includes("deepseek") ||
          m.includes("qwen"),
      );
      selectedModel = match || models[0];
    }

    return {
      available: true,
      configured: true,
      baseUrl,
      models,
      selectedModel,
    };
  } catch {
    return {
      available: false,
      configured: true,
      baseUrl,
      models: [],
      selectedModel: configuredModel,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Invokes Ollama local API generate endpoint.
 */
export async function callOllamaGenerate(
  options: OllamaGenerateOptions,
): Promise<string> {
  const baseUrl = getOllamaBaseUrl();
  const model = options.model || getOllamaModel();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs || 25000,
  );

  try {
    const payload: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      stream: false,
      options: {
        temperature: 0.2,
      },
    };

    if (options.system) {
      payload.system = options.system;
    }

    if (options.formatJson) {
      payload.format = "json";
    }

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Ollama HTTP ${res.status}: ${errText || res.statusText}`,
      );
    }

    const data = (await res.json()) as { response?: string };
    if (!data.response) {
      throw new Error("Resposta vazia retornada pelo Ollama");
    }

    return data.response.trim();
  } finally {
    clearTimeout(timeout);
  }
}
