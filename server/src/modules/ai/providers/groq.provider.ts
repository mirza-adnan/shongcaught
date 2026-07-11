import Groq from "groq-sdk";
import { env } from "../../../config/env.js";
import type { AiGenerateOptions, AiProvider } from "../types.js";

const client = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

const MODEL = "llama-3.3-70b-versatile";

export const groqProvider: AiProvider = {
  name: "groq",

  isConfigured() {
    return client !== null;
  },

  async generate({ prompt, systemPrompt, temperature, maxTokens }: AiGenerateOptions) {
    if (!client) {
      throw new Error("Groq is not configured");
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
      throw new Error("Groq returned an empty response");
    }

    return text;
  },
};
