export interface LLMProvider {
  complete(prompt: string, model: string): Promise<string>;
}
