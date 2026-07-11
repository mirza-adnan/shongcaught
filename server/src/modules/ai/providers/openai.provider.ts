import OpenAI from "openai";
import { env } from "../../../config/env.js";
import type { AiGenerateOptions, AiProvider } from "../types.js";

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

// Small, cheap, fast — the anomaly voter only needs a short structured-JSON judgment, not deep
// reasoning, so a mini-tier model keeps latency and per-call cost down without giving up much
// quality for this task.
const MODEL = "gpt-4o-mini";

export const openaiProvider: AiProvider = {
  name: "openai",

  isConfigured() {
    return client !== null;
  },

  async generate({ prompt, systemPrompt, temperature, maxTokens }: AiGenerateOptions) {
    if (!client) {
      throw new Error("OpenAI is not configured");
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
      throw new Error("OpenAI returned an empty response");
    }

    return text;
  },
};
