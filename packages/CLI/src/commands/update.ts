import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import { createUpdateAdvisoryReport, handleError, logger } from "@/src/helpers"

const updateOptionsSchema = z.object({
  advisory: z.boolean().default(false),
  cwd: z.string().default(process.cwd()),
  json: z.boolean().default(false),
  registrySource: z.string().optional(),
})

const parseUpdateOptions = (itemName: string, CLIOptions: unknown) => ({
  itemName,
  ...updateOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {}),
})

export const update = new Command()
  .name("update")
  .description("Inspect update posture for one installed Amino UI registry item without writing changes.")
  .argument("<item>", "The installed registry item you'd like to inspect for update posture.")
  .option("--advisory", "Report update posture without writing files or lockfile data.", false)
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("--json", "Print machine-readable update advisory output.", false)
  .option("--registry-source <path>", "Path to a local registry source JSON file for source comparison.")
  .action(async (itemName, CLIOptions) => {
    try {
      const options = parseUpdateOptions(itemName, CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (!options.advisory) {
        logger.error("Only update --advisory is implemented. Strict update and update --dry-run remain deferred.")
        process.exit(1)
      }

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      const updateAdvisoryReport = await createUpdateAdvisoryReport({
        cwd,
        itemName: options.itemName,
        registrySourcePath: options.registrySource,
      })

      if (options.json) {
        console.log(JSON.stringify(updateAdvisoryReport, null, 2))
        return
      }

      logger.info(`${chalk.green("[ Update Advisory ]")} No files were written.`)
      logger.info(`Item: ${updateAdvisoryReport.itemName}`)
      logger.info(`Item update state: ${updateAdvisoryReport.itemUpdateState}`)
      logger.info(`Registry source: ${updateAdvisoryReport.registrySource.status}`)
      if (updateAdvisoryReport.registrySource.path) {
        logger.info(`Registry source path: ${updateAdvisoryReport.registrySource.path}`)
      }
      logger.info(`Files inspected: ${updateAdvisoryReport.summary.fileCount}`)
      logger.info(`Update candidates: ${updateAdvisoryReport.summary.candidateFileCount}`)
      logger.info(`Review-required files: ${updateAdvisoryReport.summary.reviewRequiredCount}`)
      logger.info(`Preserved files: ${updateAdvisoryReport.summary.preservationRequiredCount}`)
      logger.info(`Automatic update blockers: ${updateAdvisoryReport.summary.automaticBlockerCount}`)
      logger.info(`Findings: ${updateAdvisoryReport.findings.length}`)

      for (const file of updateAdvisoryReport.files) {
        if (file.action === "none") continue

        logger.info(`- ${file.path}: ${file.action}`)
      }
    } catch (error) {
      handleError(error)
    }
  })
