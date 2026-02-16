import { describe, it, expect, vi } from "vitest";
import { resolveModel } from "../cli/resolve-model.js";

describe("resolveModel", () => {
  it("throws on unknown provider", async () => {
    await expect(
      resolveModel({ provider: "unknown", name: "model" }),
    ).rejects.toThrow('Unknown model provider: "unknown"');
  });

  it("throws with install instructions when package is missing", async () => {
    // Mock a provider that will fail to import
    vi.doMock("@ai-sdk/anthropic", () => {
      throw new Error("Cannot find module");
    });

    // Need to re-import to pick up the mock
    const { resolveModel: freshResolve } = await import(
      "../cli/resolve-model.js"
    );

    await expect(
      freshResolve({ provider: "anthropic", name: "claude-sonnet-4-20250514" }),
    ).rejects.toThrow("npm install @ai-sdk/anthropic");

    vi.doUnmock("@ai-sdk/anthropic");
  });

  it("resolves a model from a valid provider", async () => {
    const mockModel = { modelId: "test-model" };
    vi.doMock("@ai-sdk/anthropic", () => ({
      anthropic: vi.fn(() => mockModel),
    }));

    const { resolveModel: freshResolve } = await import(
      "../cli/resolve-model.js"
    );
    const model = await freshResolve({
      provider: "anthropic",
      name: "claude-sonnet-4-20250514",
    });
    expect(model).toBe(mockModel);

    vi.doUnmock("@ai-sdk/anthropic");
  });
});
