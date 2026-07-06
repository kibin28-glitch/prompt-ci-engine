import type { EvalResult } from "../types.js";

export function containsMatch(output: string, expected: string): EvalResult {
  const pass = output.toLowerCase().includes(expected.toLowerCase());
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `Output contains expected substring "${expected}"`
      : `Output does not contain expected substring "${expected}"`,
  };
}
