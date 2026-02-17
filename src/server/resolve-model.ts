import type { LanguageModel } from "ai";

interface ModelConfig {
  provider: string;
  name: string;
}

const providerPackages: Record<string, string> = {
  anthropic: "@ai-sdk/anthropic",
  openai: "@ai-sdk/openai",
  google: "@ai-sdk/google",
};

export async function resolveModel(config: ModelConfig): Promise<LanguageModel> {
  const pkg = providerPackages[config.provider];
  if (!pkg) {
    throw new Error(
      `Unknown model provider: "${config.provider}". Available: ${Object.keys(providerPackages).join(", ")}`,
    );
  }

  let mod: Record<string, unknown>;
  try {
    mod = (await import(pkg)) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Model provider "${config.provider}" requires package "${pkg}".\nRun: npm install ${pkg}`,
    );
  }

  const factory = mod[config.provider] as
    | ((name: string) => LanguageModel)
    | undefined;
  if (typeof factory !== "function") {
    throw new Error(
      `Could not find "${config.provider}" export in "${pkg}". Is the package up to date?`,
    );
  }

  return factory(config.name);
}
