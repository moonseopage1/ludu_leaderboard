import { readFileSync } from "fs";
import path from "path";

let loaded = false;

export function loadLocalEnv() {
  if (loaded) return;
  loaded = true;

  try {
    const envPath = path.join(process.cwd(), ".env");
    const lines = readFileSync(envPath, "utf-8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const [rawKey, ...valueParts] = trimmed.split("=");
      const key = rawKey.trim().replace(/^\uFEFF/, "");
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Local .env is optional.
  }
}
