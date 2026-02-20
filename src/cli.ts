#!/usr/bin/env node
import { Command } from "commander";
import { InlineScanner } from "./scanner";
import { CliOptions } from "./types";
import { resolvePath } from "./utils";

async function main(): Promise<void> {
  const program = new Command();
  program
    .argument("[mode]", "run mode, supports run:once")
    .option("--config <path>", "config yaml file", "config.yaml")
    .option("--headful", "run with visible browser")
    .option("--headless", "run with headless browser")
    .option("--loop", "run forever")
    .option("--profile <dir>", "persistent profile dir", ".profile-inline")
    .parse(process.argv);

  const mode = program.args[0];
  const opts = program.opts<{
    config: string;
    headful?: boolean;
    headless?: boolean;
    loop?: boolean;
    profile: string;
  }>();

  const options: CliOptions = {
    config: resolvePath(opts.config),
    headless: opts.headful ? false : opts.headless ?? true,
    loop: mode === "run:once" ? false : Boolean(opts.loop),
    profile: resolvePath(opts.profile)
  };

  const scanner = new InlineScanner(options);
  await scanner.run();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
