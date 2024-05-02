#!/usr/bin/env node

import { Command } from "commander";
import { getPackageInfo } from "./helpers/getPackageInfo";
import { diff } from "./commands/diff";
import { add } from "./commands/add";
import { init } from "./commands/init";

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

const main = async () => {
  const packageInfo = getPackageInfo();

  const program = new Command()
    .name("amino-ui-cli")
    .description("Add components and their dependencies directly into your project as needed.")
    .version(
      packageInfo.version!,
      "-v, --version",
      "Display the version number."
    );

  program.addCommand(init).addCommand(add).addCommand(diff);

  program.parse();
};

main();
