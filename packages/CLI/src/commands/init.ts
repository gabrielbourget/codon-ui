import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import { createConsumerInitAdvisory, createConsumerInitDryRun, writeConsumerInitSeed } from "@/src/helpers"
import { handleError } from "@/src/helpers/handleError"
import { logger } from "@/src/helpers/logger"

const initOptionsSchema = z.object({
  cwd: z.string().default(process.cwd()),
  defaults: z.boolean().default(false),
  advisory: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  json: z.boolean().default(false),
})

const parseInitOptions = (CLIOptions: unknown) => {
  const options = initOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {})

  return {
    cwd: options.cwd,
    advisory: options.advisory,
    defaults: options.defaults,
    dryRun: options.dryRun,
    json: options.json,
  }
}

export const init = new Command()
  .name("init")
  .description("Initialize Amino UI consumer config and lockfile state.")
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("-y, --yes", "Accepted for compatibility; init is non-interactive.", true)
  .option("-d, --defaults", "Alias for the default strict config and lockfile seed path.", false)
  .option("--advisory", "Report the proposed consumer setup without writing files or installing dependencies.", false)
  .option("--dry-run", "Preview the default consumer config and lockfile seed without writing files.", false)
  .option("--json", "Print machine-readable output.", false)
  .action(async (CLIOptions) => {
    try {
      const options = parseInitOptions(CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      const selectedPlanningModes = [options.advisory, options.defaults, options.dryRun].filter(Boolean).length

      if (selectedPlanningModes > 1) {
        logger.error("Please choose only one of --advisory, --dry-run, or --defaults.")
        process.exit(1)
      }

      if (options.advisory) {
        const advisory = createConsumerInitAdvisory(cwd)

        if (options.json) {
          console.log(JSON.stringify(advisory, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Advisory Init ]")} No files were written.`)
        logger.info(`Package manager: ${advisory.packageManager}`)
        logger.info(`Config file: ${advisory.configFile}`)
        logger.info(`Lockfile: ${advisory.lockfile}`)
        logger.info(`Layout mode: ${advisory.proposedConfig.layoutMode}`)
        logger.info(`Theme tier: ${advisory.proposedConfig.theme.tier}`)
        logger.info(`Dependency policy: ${advisory.proposedConfig.dependencies.policy}`)

        return
      }

      if (options.dryRun) {
        const result = createConsumerInitDryRun(cwd)

        if (options.json) {
          console.log(JSON.stringify(result, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Init Dry Run ]")} No files were written.`)
        logger.info(`Package manager: ${result.packageManager}`)
        logger.info(`Config file: ${result.configFile}`)
        logger.info(`Lockfile: ${result.lockfile}`)
        logger.info(`Layout mode: ${result.proposedConfig.layoutMode}`)
        logger.info(`Theme tier: ${result.proposedConfig.theme.tier}`)
        logger.info(`Dependency policy: ${result.proposedConfig.dependencies.policy}`)
        logger.info(`Config effect: ${result.wouldEffects.config.status}`)
        logger.info(`Lockfile effect: ${result.wouldEffects.lockfile.status}`)
        logger.info(`Findings: ${result.findings.length}`)

        return
      }

      const result = await writeConsumerInitSeed(cwd)

      if (options.json) {
        console.log(JSON.stringify(result, null, 2))
        return
      }

      logger.info(`${chalk.green("[ Init ]")} ${result.initialized ? "Consumer files written." : "No files written."}`)
      logger.info(`Config file: ${result.configFile}`)
      logger.info(`Lockfile: ${result.lockfile}`)
      logger.info(`Layout mode: ${result.config.layoutMode}`)
      logger.info(`Theme tier: ${result.config.theme.tier}`)
      logger.info(`Dependency policy: ${result.config.dependencies.policy}`)
      logger.info(`Findings: ${result.findings.length}`)
    } catch (error) {
      handleError(error)
    }
  })
