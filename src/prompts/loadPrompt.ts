import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BASELINE_DIR = ".promptci/baseline";

export function loadCurrentPrompt(file: string): string {
  return readFileSync(file, "utf-8");
}

export function loadBaselinePrompt(promptName: string): string | null {
  const baselinePath = path.join(BASELINE_DIR, `${promptName}.txt`);
  if (!existsSync(baselinePath)) return null;
  return readFileSync(baselinePath, "utf-8");
}

export function baselinePath(promptName: string): string {
  return path.join(BASELINE_DIR, `${promptName}.txt`);
}
