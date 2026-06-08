import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import { createRemoveAdvisoryReport, handleError, logger } from "@/src/helpers"

const removeOptionsSchema = z.object({
  advisory: z.boolean().default(false),
  cwd: z.string().default(process.cwd()),
  json: z.boolean().default(false),
  registrySource: z.string().optional(),
})

const parseRemoveOptions = (itemName: string, CLIOptions: unknown) => ({
  itemName,
  ...removeOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {}),
})

export const remove = new Command()
  .name("remove")
  .description("Inspect remove posture for one installed Amino UI registry item without writing changes.")
  .argument("<item>", "The installed registry item you'd like to inspect for remove posture.")
  .option("--advisory", "Report remove posture without deleting files or writing lockfile data.", false)
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("--json", "Print machine-readable remove output.", false)
  .option("--registry-source <path>", "Path to a local registry source JSON file for source comparison.")
  .action(async (itemName, CLIOptions) => {
    try {
      const options = parseRemoveOptions(itemName, CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (!options.advisory) {
        logger.error("Please choose --advisory. Remove dry-run and strict remove remain deferred.")
        process.exit(1)
      }

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      const removeAdvisoryReport = await createRemoveAdvisoryReport({
        cwd,
        itemName: options.itemName,
        registrySourcePath: options.registrySource,
      })

      if (options.json) {
        console.log(JSON.stringify(removeAdvisoryReport, null, 2))
        return
      }

      logger.info(`${chalk.green("[ Remove Advisory ]")} No files were deleted or written.`)
      logger.info(`Item: ${removeAdvisoryReport.itemName}`)
      logger.info(`Item remove state: ${removeAdvisoryReport.itemRemoveState}`)
      logger.info(`Registry source: ${removeAdvisoryReport.registrySource.status}`)
      if (removeAdvisoryReport.registrySource.path) {
        logger.info(`Registry source path: ${removeAdvisoryReport.registrySource.path}`)
      }
      logger.info(`Files inspected: ${removeAdvisoryReport.summary.fileCount}`)
      logger.info(`Future removable files: ${removeAdvisoryReport.summary.removableFileCount}`)
      logger.info(`Future lockfile cleanup records: ${removeAdvisoryReport.summary.lockfileCleanupCandidateCount}`)
      logger.info(`Review-required files: ${removeAdvisoryReport.summary.reviewRequiredCount}`)
      logger.info(`Preserved files: ${removeAdvisoryReport.summary.preservationRequiredCount}`)
      logger.info(`Automatic remove blockers: ${removeAdvisoryReport.summary.automaticBlockerCount}`)
      logger.info(`Findings: ${removeAdvisoryReport.findings.length}`)

      for (const file of removeAdvisoryReport.files) {
        logger.info(`- ${file.path}: ${file.action}`)
      }
    } catch (error) {
      handleError(error)
    }
  })
