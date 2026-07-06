import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import type { PromptCiConfig } from "../types.js";

export function loadConfig(path = ".promptci.yml"): PromptCiConfig {
  const raw = readFileSync(path, "utf-8");
  const config = yaml.load(raw) as PromptCiConfig;

  if (!config.model || !config.prompts?.length) {
    throw new Error(`Invalid config at ${path}: missing "model" or "prompts"`);
  }

  return config;
}
