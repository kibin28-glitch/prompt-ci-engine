import type { EvalResult } from "../types.js";
import type { LLMProvider } from "../providers/types.js";

const JUDGE_TEMPLATE = `You are grading whether an AI response's quality regressed after a prompt change.

BASELINE RESPONSE:
"""
{{baseline}}
"""

NEW RESPONSE:
"""
{{current}}
"""

Compare quality, correctness, and tone. Reply in exactly this format:
SCORE: <number from 0 to 1, where 1 means no regression and 0 means severe regression>
REASON: <one short sentence>`;

export async function llmJudge(
  provider: LLMProvider,
  model: string,
  baselineOutput: string,
  currentOutput: string,
): Promise<EvalResult> {
  const judgePrompt = JUDGE_TEMPLATE.replace("{{baseline}}", baselineOutput).replace(
    "{{current}}",
    currentOutput,
  );

  const raw = await provider.complete(judgePrompt, model);

  const scoreMatch = raw.match(/SCORE:\s*([\d.]+)/i);
  const reasonMatch = raw.match(/REASON:\s*(.+)/i);

  const score = scoreMatch ? Math.max(0, Math.min(1, parseFloat(scoreMatch[1]))) : 0;
  const reason = reasonMatch ? reasonMatch[1].trim() : `Could not parse judge response: ${raw}`;

  return { pass: score >= 0.7, score, reason };
}
