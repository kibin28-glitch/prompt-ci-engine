import OpenAI from "openai";
import type { LLMProvider } from "./types.js";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string = process.env.OPENAI_API_KEY ?? "") {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.client = new OpenAI({ apiKey });
  }

  async complete(prompt: string, model: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0]?.message?.content ?? "";
  }
}
