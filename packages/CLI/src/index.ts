#!/usr/bin/env node

import path from "path"

import { Command } from "commander"

import { add } from "./commands/add"
import { diff } from "./commands/diff"
import { info } from "./commands/info"
import { init } from "./commands/init"
import { status } from "./commands/status"
import { getPackageInfo } from "./helpers/getPackageInfo"

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

const main = async () => {
  const packageInfo = getPackageInfo()
  const commandName = path.basename(process.argv[1] ?? "aminoui-cli")

  const program = new Command()
    .name(commandName)
    .description("Add components and their dependencies directly into your project as needed.")
    .version(packageInfo.version!, "-v, --version", "Display the version number.")

  program.addCommand(init).addCommand(info).addCommand(add).addCommand(diff).addCommand(status)

  program.parse()
}

main()
