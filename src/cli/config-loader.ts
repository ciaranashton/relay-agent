import { readFileSync } from "node:fs";
import { configSchema, type RelayAgentConfig } from "./config-schema.js";

/**
 * Replace `$VAR` references in strings with `process.env.VAR`.
 * Works recursively through objects and arrays.
 */
function substituteEnvVars(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("$")) {
      const envKey = value.slice(1);
      const envValue = process.env[envKey];
      if (envValue === undefined) {
        return value; // Keep the placeholder — validation will catch missing required values
      }
      return envValue;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(substituteEnvVars);
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = substituteEnvVars(v);
    }
    return result;
  }

  return value;
}

/**
 * Find all `$VAR` references that don't have a matching env var.
 */
function findMissingEnvVars(value: unknown): string[] {
  const missing: string[] = [];

  function walk(v: unknown): void {
    if (typeof v === "string" && v.startsWith("$")) {
      const envKey = v.slice(1);
      if (process.env[envKey] === undefined) {
        missing.push(envKey);
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v !== null && typeof v === "object") {
      Object.values(v).forEach(walk);
    }
  }

  walk(value);
  return [...new Set(missing)];
}

export function loadConfig(filePath: string): RelayAgentConfig {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`Config file not found: ${filePath}`);
    }
    throw new Error(`Failed to read config file: ${filePath}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${filePath}`);
  }

  // Check for missing env vars before substitution
  const missing = findMissingEnvVars(json);
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables:\n${missing.map((v) => `  - ${v}`).join("\n")}\n\nSet them in your .env file or environment.`,
    );
  }

  const substituted = substituteEnvVars(json);

  const result = configSchema.safeParse(substituted);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${issues}`);
  }

  return result.data;
}
