import { mkdirSync, writeFileSync } from "node:fs";
import { loadConfig } from "../config/loadConfig.js";
import { loadCurrentPrompt, loadBaselinePrompt } from "../prompts/loadPrompt.js";
import { loadTestCases } from "../testcases/loadTestCases.js";
import { OpenAIProvider } from "../providers/openai.js";
import { runRegression } from "../runner/runRegression.js";
import { formatConsole } from "../report/formatConsole.js";
import type { RunResult } from "../types.js";

export async function runCommand(): Promise<void> {
  const config = loadConfig();
  const provider = new OpenAIProvider();

  const results: RunResult[] = [];

  for (const prompt of config.prompts) {
    const currentTemplate = loadCurrentPrompt(prompt.file);
    const baselineTemplate = loadBaselinePrompt(prompt.name);

    if (baselineTemplate === null) {
      console.error(
        `No baseline found for "${prompt.name}". Run "promptci snapshot" first.`,
      );
      process.exitCode = 1;
      continue;
    }

    const testCases = loadTestCases(prompt.testcases);

    const result = await runRegression(
      provider,
      config.model,
      config.threshold,
      prompt,
      baselineTemplate,
      currentTemplate,
      testCases,
    );

    results.push(result);
    console.log(formatConsole(result));
  }

  mkdirSync("tests/results", { recursive: true });
  writeFileSync("tests/results/latest.json", JSON.stringify(results, null, 2));

  if (results.some((r) => !r.passed)) {
    process.exitCode = 1;
  }
}
