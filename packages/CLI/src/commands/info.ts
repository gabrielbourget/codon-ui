import { existsSync } from "fs"
import path from "path"

import { Command } from "commander"
import { z } from "zod"

import { createConsumerInitAdvisory, getConsumerProjectContext } from "@/src/helpers"
import { handleError } from "@/src/helpers/handleError"
import { logger } from "@/src/helpers/logger"

const infoOptionsSchema = z.object({
  cwd: z.string().default(process.cwd()),
  json: z.boolean().default(false),
})

const parseInfoOptions = (CLIOptions: unknown) =>
  infoOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {})

export const info = new Command()
  .name("info")
  .description("Inspect the current Amino UI consumer project context.")
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("--json", "Print machine-readable project context.", false)
  .action(async (CLIOptions) => {
    try {
      const options = parseInfoOptions(CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      const project = getConsumerProjectContext(cwd)
      const initAdvisory = createConsumerInitAdvisory(cwd)

      if (options.json) {
        console.log(JSON.stringify({ initAdvisory, project }, null, 2))
        return
      }

      logger.info(`Project kind: ${project.projectKind}`)
      logger.info(`Package manager: ${project.packageManager}`)
      logger.info(`Amino config present: ${project.hasConfigFile ? "yes" : "no"}`)
      logger.info(`Amino lockfile present: ${project.hasLockfile ? "yes" : "no"}`)
    } catch (error) {
      handleError(error)
    }
  })
