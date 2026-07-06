import { renderTemplate } from "../prompts/renderTemplate.js";
import { containsMatch } from "../evaluators/containsMatch.js";
import { llmJudge } from "../evaluators/llmJudge.js";
import type { LLMProvider } from "../providers/types.js";
import type { CaseResult, PromptEntry, RunResult, TestCase } from "../types.js";

export async function runRegression(
  provider: LLMProvider,
  model: string,
  threshold: number,
  prompt: PromptEntry,
  baselineTemplate: string,
  currentTemplate: string,
  testCases: TestCase[],
): Promise<RunResult> {
  const cases: CaseResult[] = [];

  for (const testCase of testCases) {
    const baselinePrompt = renderTemplate(baselineTemplate, testCase.input);
    const currentPrompt = renderTemplate(currentTemplate, testCase.input);

    const [baselineOutput, currentOutput] = await Promise.all([
      provider.complete(baselinePrompt, model),
      provider.complete(currentPrompt, model),
    ]);

    const evalResult = testCase.expectedContains
      ? containsMatch(currentOutput, testCase.expectedContains)
      : await llmJudge(provider, model, baselineOutput, currentOutput);

    cases.push({
      input: testCase.input,
      baselineOutput,
      currentOutput,
      eval: evalResult,
    });
  }

  const avgScore = cases.reduce((sum, c) => sum + c.eval.score, 0) / (cases.length || 1);

  return {
    promptName: prompt.name,
    timestamp: new Date().toISOString(),
    threshold,
    cases,
    passed: avgScore >= threshold,
  };
}
