import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const CONFIG_TEMPLATE = `model: gpt-4o-mini
threshold: 0.7
prompts:
  - name: greeting
    file: examples/prompts/greeting.txt
    testcases: examples/testcases/greeting.cases.json
`;

const EXAMPLE_PROMPT = "Say a friendly greeting to {{name}} in one sentence.\n";

const EXAMPLE_TESTCASES = JSON.stringify(
  [{ input: { name: "Alex" }, expectedContains: "Alex" }],
  null,
  2,
);

export function initCommand(): void {
  if (!existsSync(".promptci.yml")) {
    writeFileSync(".promptci.yml", CONFIG_TEMPLATE);
    console.log("Created .promptci.yml");
  }

  mkdirSync("examples/prompts", { recursive: true });
  mkdirSync("examples/testcases", { recursive: true });

  const promptFile = "examples/prompts/greeting.txt";
  const testcaseFile = "examples/testcases/greeting.cases.json";

  if (!existsSync(promptFile)) {
    writeFileSync(promptFile, EXAMPLE_PROMPT);
    console.log(`Created ${promptFile}`);
  }
  if (!existsSync(testcaseFile)) {
    writeFileSync(testcaseFile, EXAMPLE_TESTCASES);
    console.log(`Created ${testcaseFile}`);
  }

  console.log('\nNext: run "promptci snapshot" to save a baseline, then "promptci run".');
}
