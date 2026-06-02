import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import { createStatusReport, handleError, logger } from "@/src/helpers"

const statusOptionsSchema = z.object({
  cwd: z.string().default(process.cwd()),
  json: z.boolean().default(false),
  registrySource: z.string().optional(),
})

const parseStatusOptions = (itemName: string | undefined, CLIOptions: unknown) => ({
  itemName,
  ...statusOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {}),
})

export const status = new Command()
  .name("status")
  .description("Inspect installed Amino UI registry files without writing changes.")
  .argument("[item]", "The installed registry item you'd like to inspect.")
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("--json", "Print machine-readable status output.", false)
  .option("--registry-source <path>", "Path to a local registry source JSON file for source freshness checks.")
  .action(async (itemName, CLIOptions) => {
    try {
      const options = parseStatusOptions(itemName, CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      const statusReport = await createStatusReport({
        cwd,
        itemName: options.itemName,
        registrySourcePath: options.registrySource,
      })

      if (options.json) {
        console.log(JSON.stringify(statusReport, null, 2))
        return
      }

      logger.info(`${chalk.green("[ Status ]")} No files were written.`)
      logger.info(`Config file: ${statusReport.config.status}`)
      logger.info(`Lockfile: ${statusReport.lockfile.status}`)
      logger.info(`Registry source: ${statusReport.registrySource.status}`)
      if (statusReport.registrySource.path) logger.info(`Registry source path: ${statusReport.registrySource.path}`)
      logger.info(`Items inspected: ${statusReport.summary.itemCount}`)
      logger.info(`Files inspected: ${statusReport.summary.fileCount}`)
      logger.info(`Registry-owned files: ${statusReport.summary.fileStates["registry-owned"]}`)
      logger.info(`Consumer-owned support files: ${statusReport.summary.fileStates["consumer-owned-support"]}`)
      logger.info(`Locally modified files: ${statusReport.summary.fileStates["locally-modified"]}`)
      logger.info(`Missing files: ${statusReport.summary.fileStates.missing}`)
      logger.info(`Ejected files: ${statusReport.summary.fileStates.ejected}`)
      logger.info(`Unknown files: ${statusReport.summary.fileStates.unknown}`)
      logger.info(`Source changes available: ${statusReport.summary.sourceStates["source-changed"]}`)
      logger.info(`Unknown source freshness: ${statusReport.summary.sourceStates.unknown}`)
      logger.info(`Findings: ${statusReport.findings.length}`)
    } catch (error) {
      handleError(error)
    }
  })
