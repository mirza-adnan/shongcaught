export interface AiGenerateOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiProvider {
  name: string;
  isConfigured(): boolean;
  generate(options: AiGenerateOptions): Promise<string>;
}
