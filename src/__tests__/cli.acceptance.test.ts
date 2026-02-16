import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(import.meta.dirname, "../../dist/cli/index.js");
const FIXTURES = resolve(import.meta.dirname, "fixtures");

/** Minimal env — just enough to run node, nothing that might leak into $VAR substitution */
const CLEAN_ENV: Record<string, string> = {
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  NODE_ENV: "test",
};

function run(
  args: string[],
  env?: Record<string, string>,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("node", [CLI, ...args], {
    encoding: "utf-8",
    env: { ...CLEAN_ENV, ...env },
    timeout: 5000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

describe("CLI acceptance", () => {
  describe("--help", () => {
    it("prints usage and exits 0", () => {
      const result = run(["--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("relay-agent");
      expect(result.stdout).toContain("--config");
      expect(result.stdout).toContain("start");
    });

    it("prints usage when no args given", () => {
      const result = run([]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("relay-agent");
    });
  });

  describe("unknown command", () => {
    it("prints usage for unrecognised commands", () => {
      const result = run(["foobar"]);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Unknown command: "foobar"');
      expect(result.stdout).toContain("--config");
    });
  });

  describe("start without --config", () => {
    it("exits 1 with a clear message", () => {
      const result = run(["start"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Missing --config");
    });
  });

  describe("start with missing config file", () => {
    it("exits 1 saying file not found", () => {
      const result = run(["start", "--config", "/tmp/does-not-exist.json"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Config file not found");
    });
  });

  describe("start with missing env vars", () => {
    it("exits 1 listing every missing variable", () => {
      const configPath = resolve(FIXTURES, "with-env-vars.config.json");
      // CLEAN_ENV has no AGENT_NAME, WEBHOOK_SECRET, etc. — they should all be missing
      const result = run(["start", "--config", configPath]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("AGENT_NAME");
      expect(result.stderr).toContain("WEBHOOK_SECRET");
      expect(result.stderr).toContain("API_KEY");
      expect(result.stderr).toContain("TEST_PORT");
    });
  });
});
