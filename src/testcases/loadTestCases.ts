import { readFileSync } from "node:fs";
import type { TestCase } from "../types.js";

export function loadTestCases(file: string): TestCase[] {
  const raw = readFileSync(file, "utf-8");
  return JSON.parse(raw) as TestCase[];
}
