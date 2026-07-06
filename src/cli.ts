#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { snapshotCommand } from "./commands/snapshot.js";
import { runCommand } from "./commands/run.js";

const program = new Command();

program.name("promptci").description("Prompt/model regression testing CLI");

program
  .command("init")
  .description("Create .promptci.yml and example prompt/testcase files")
  .action(initCommand);

program
  .command("snapshot")
  .description("Save the current prompts as the new baseline")
  .action(snapshotCommand);

program
  .command("run")
  .description("Run regression tests against the saved baseline")
  .action(async () => {
    try {
      await runCommand();
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program.parse();
