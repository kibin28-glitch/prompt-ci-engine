import { copyFileSync, mkdirSync } from "node:fs";
import { loadConfig } from "../config/loadConfig.js";
import { baselinePath } from "../prompts/loadPrompt.js";

export function snapshotCommand(): void {
  const config = loadConfig();

  mkdirSync(".promptci/baseline", { recursive: true });

  for (const prompt of config.prompts) {
    copyFileSync(prompt.file, baselinePath(prompt.name));
    console.log(`Saved baseline for "${prompt.name}" from ${prompt.file}`);
  }
}
