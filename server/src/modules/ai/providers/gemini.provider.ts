import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../../config/env.js";
import type { AiGenerateOptions, AiProvider } from "../types.js";

const client = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

const MODEL = "gemini-2.0-flash";

export const geminiProvider: AiProvider = {
  name: "gemini",

  isConfigured() {
    return client !== null;
  },

  async generate({ prompt, systemPrompt, temperature, maxTokens }: AiGenerateOptions) {
    if (!client) {
      throw new Error("Gemini is not configured");
    }

    const model = client.getGenerativeModel({
      model: MODEL,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens ?? 1024,
      },
    });

    const text = result.response.text();

    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return text;
  },
};
