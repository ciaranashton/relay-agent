import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../config-loader.js";

const testDir = join(tmpdir(), "relay-agent-test-" + Date.now());

function writeConfig(filename: string, content: unknown): string {
  const path = join(testDir, filename);
  writeFileSync(path, JSON.stringify(content, null, 2));
  return path;
}

const validConfig = {
  name: "Test Agent",
  description: "A test agent",
  instructions: "Do things",
  model: { provider: "anthropic", name: "claude-sonnet-4-20250514" },
  inbound: { type: "webhook" },
  sources: [],
  actions: [{ type: "log" }],
  server: { port: 4000 },
};

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("loadConfig", () => {
  it("loads and validates a valid config", () => {
    const path = writeConfig("valid.json", validConfig);
    const config = loadConfig(path);
    expect(config.name).toBe("Test Agent");
    expect(config.model.provider).toBe("anthropic");
    expect(config.server?.port).toBe(4000);
  });

  it("throws on missing file", () => {
    expect(() => loadConfig(join(testDir, "nope.json"))).toThrow(
      "Config file not found",
    );
  });

  it("throws on invalid JSON", () => {
    const path = join(testDir, "bad.json");
    writeFileSync(path, "not json{{{");
    expect(() => loadConfig(path)).toThrow("Invalid JSON");
  });

  it("throws on invalid config structure", () => {
    const path = writeConfig("invalid.json", { name: "Test" });
    expect(() => loadConfig(path)).toThrow("Invalid config");
  });

  it("substitutes $VAR with environment variables", () => {
    vi.stubEnv("TEST_SECRET", "my-secret");
    const config = {
      ...validConfig,
      inbound: { type: "resend", webhookSecret: "$TEST_SECRET", apiKey: "$TEST_SECRET" },
    };
    const path = writeConfig("env.json", config);
    const loaded = loadConfig(path);
    const inbound = loaded.inbound as Record<string, unknown>;
    expect(inbound.webhookSecret).toBe("my-secret");
    expect(inbound.apiKey).toBe("my-secret");
  });

  it("throws listing missing env vars", () => {
    const config = {
      ...validConfig,
      inbound: { type: "resend", webhookSecret: "$MISSING_VAR_1", apiKey: "$MISSING_VAR_2" },
    };
    const path = writeConfig("missing-env.json", config);
    expect(() => loadConfig(path)).toThrow("MISSING_VAR_1");
  });

  it("substitutes env vars in nested objects and arrays", () => {
    vi.stubEnv("NESTED_VAL", "resolved");
    const config = {
      ...validConfig,
      sources: [{ type: "google-sheets", sheetId: "$NESTED_VAL", credentials: { key: "$NESTED_VAL" }, tabs: {} }],
    };
    const path = writeConfig("nested.json", config);
    const loaded = loadConfig(path);
    const source = loaded.sources[0] as Record<string, unknown>;
    expect(source.sheetId).toBe("resolved");
    expect((source.credentials as Record<string, unknown>).key).toBe("resolved");
  });

  it("applies defaults for missing optional fields", () => {
    const minimal = {
      name: "Minimal",
      description: "Minimal agent",
      instructions: "Do it",
      model: { provider: "openai", name: "gpt-4o" },
      inbound: { type: "webhook" },
    };
    const path = writeConfig("minimal.json", minimal);
    const config = loadConfig(path);
    expect(config.sources).toEqual([]);
    expect(config.actions).toEqual([]);
    expect(config.triage).toBeUndefined();
    expect(config.server).toBeUndefined();
  });
});
