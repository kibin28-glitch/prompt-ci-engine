import type { RunResult } from "../types.js";

function truncate(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

export function formatConsole(result: RunResult): string {
  const lines: string[] = [];
  lines.push(`\nPrompt: ${result.promptName}  (threshold: ${result.threshold})`);
  lines.push("-".repeat(60));

  result.cases.forEach((c, i) => {
    const verdict = c.eval.pass ? "PASS" : "FAIL";
    lines.push(`[${i + 1}] ${verdict}  score=${c.eval.score.toFixed(2)}  ${c.eval.reason}`);
    lines.push(`    baseline: ${truncate(c.baselineOutput)}`);
    lines.push(`    current : ${truncate(c.currentOutput)}`);
  });

  lines.push("-".repeat(60));
  lines.push(result.passed ? "RESULT: PASSED" : "RESULT: FAILED (regression detected)");

  return lines.join("\n");
}
