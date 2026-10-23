import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Retrieves an environment variable from process.env or directly reads the .env file,
 * supporting hot-reloading at runtime without needing to restart the server.
 */
export function getEnvKey(name: string): string | undefined {
  const envVal = process.env[name]?.trim();
  if (envVal && envVal.length > 0) {
    return envVal;
  }
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const regex = new RegExp(
        `^\\s*${name}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`,
        "m",
      );
      const match = content.match(regex);
      if (match?.[1]?.trim()) {
        const val = match[1].trim();
        process.env[name] = val;
        return val;
      }
    }
  } catch {}
  return undefined;
}
