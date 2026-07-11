import OpenAI from "openai";
import { env } from "../../../config/env.js";
import type { AiGenerateOptions, AiProvider } from "../types.js";

const client = env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    })
  : null;

const MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export const openrouterProvider: AiProvider = {
  name: "openrouter",

  isConfigured() {
    return client !== null;
  },

  async generate({ prompt, systemPrompt, temperature, maxTokens }: AiGenerateOptions) {
    if (!client) {
      throw new Error("OpenRouter is not configured");
    }

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 1024,
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        { role: "user" as const, content: prompt },
      ],
    });

    const text = completion.choices[0]?.message?.content;

    if (!text) {
      throw new Error("OpenRouter returned an empty response");
    }

    return text;
  },
};
