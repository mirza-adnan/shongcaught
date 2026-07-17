import { AppError } from "../../middleware/errorHandler.js";
import { openaiProvider } from "./providers/openai.provider.js";
import { groqProvider } from "./providers/groq.provider.js";
import { geminiProvider } from "./providers/gemini.provider.js";
import { openrouterProvider } from "./providers/openrouter.provider.js";
import type { AiGenerateOptions, AiProvider } from "./types.js";

// OpenAI first: it's the freshest key with headroom left, after Groq/Gemini/OpenRouter all
// started hitting rate limits/timeouts in the same session. The others stay as fallbacks.
const PROVIDER_CHAIN: AiProvider[] = [openaiProvider, groqProvider, geminiProvider, openrouterProvider];
const PROVIDER_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Provider timed out")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function generateText(options: AiGenerateOptions): Promise<{ text: string; provider: string }> {
  const configured = PROVIDER_CHAIN.filter((provider) => provider.isConfigured());

  if (configured.length === 0) {
    throw new AppError("No AI provider is configured", 503);
  }

  const errors: string[] = [];

  for (const provider of configured) {
    try {
      const text = await withTimeout(provider.generate(options), PROVIDER_TIMEOUT_MS);
      return { text, provider: provider.name };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${provider.name}: ${message}`);
    }
  }

  throw new AppError(`All AI providers failed. ${errors.join(" | ")}`, 502);
}

/**
 * Queries every configured provider in parallel instead of stopping at the first success — for
 * callers that want several independent model opinions on the same prompt (e.g. an LLM voting
 * ensemble) rather than one answer with fallback redundancy. Providers that fail or time out are
 * silently dropped from the result; it's up to the caller to decide what to do if fewer models
 * answered than expected.
 *
 * Not currently called anywhere — kept as a reference for the 3-model consensus design the
 * anomaly ensemble briefly used before reverting to a single fallback-chain call via
 * generateText() (see anomaly.service.ts's llmEnsembleVoter).
 */
export async function generateTextFromAllProviders(
  options: AiGenerateOptions,
): Promise<{ text: string; provider: string }[]> {
  const configured = PROVIDER_CHAIN.filter((provider) => provider.isConfigured());

  const settled = await Promise.allSettled(
    configured.map(async (provider) => ({
      text: await withTimeout(provider.generate(options), PROVIDER_TIMEOUT_MS),
      provider: provider.name,
    })),
  );

  return settled
    .filter((r): r is PromiseFulfilledResult<{ text: string; provider: string }> => r.status === "fulfilled")
    .map((r) => r.value);
}
