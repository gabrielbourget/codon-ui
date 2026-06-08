import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import {
  createRemoveAdvisoryReport,
  createRemoveDryRunReport,
  createRemoveStrictReport,
  handleError,
  logger,
} from "@/src/helpers"

const removeOptionsSchema = z.object({
  advisory: z.boolean().default(false),
  cwd: z.string().default(process.cwd()),
  dryRun: z.boolean().default(false),
  json: z.boolean().default(false),
  registrySource: z.string().optional(),
})

const parseRemoveOptions = (itemName: string, CLIOptions: unknown) => ({
  itemName,
  ...removeOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {}),
})

export const remove = new Command()
  .name("remove")
  .description("Remove one installed Amino UI registry item when strict provenance checks pass.")
  .argument("<item>", "The installed registry item you'd like to inspect or remove.")
  .option("--advisory", "Report remove posture without deleting files or writing lockfile data.", false)
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("--dry-run", "Preview an item-scoped remove without deleting files or writing lockfile data.", false)
  .option("--json", "Print machine-readable remove output.", false)
  .option("--registry-source <path>", "Path to a local registry source JSON file for source comparison.")
  .action(async (itemName, CLIOptions) => {
    try {
      const options = parseRemoveOptions(itemName, CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (options.advisory && options.dryRun) {
        logger.error("Please choose either --advisory or --dry-run, not both.")
        process.exit(1)
      }

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      if (options.dryRun) {
        const removeDryRunReport = await createRemoveDryRunReport({
          cwd,
          itemName: options.itemName,
          registrySourcePath: options.registrySource,
        })

        if (options.json) {
          console.log(JSON.stringify(removeDryRunReport, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Remove Dry Run ]")} No files were deleted or written.`)
        logger.info(`Item: ${removeDryRunReport.itemName}`)
        logger.info(`Item remove state: ${removeDryRunReport.itemRemoveState}`)
        logger.info(`Registry source: ${removeDryRunReport.registrySource.status}`)
        if (removeDryRunReport.registrySource.path) {
          logger.info(`Registry source path: ${removeDryRunReport.registrySource.path}`)
        }
        logger.info(`Files inspected: ${removeDryRunReport.summary.fileCount}`)
        logger.info(`Remove candidates: ${removeDryRunReport.summary.removeCandidateCount}`)
        logger.info(`Would remove files: ${removeDryRunReport.summary.wouldRemoveFileCount}`)
        logger.info(`Would remove lockfile records: ${removeDryRunReport.summary.wouldRemoveLockfileRecordCount}`)
        logger.info(`Skipped files: ${removeDryRunReport.summary.skippedFileCount}`)
        logger.info(`Blocked files: ${removeDryRunReport.summary.blockedFileCount}`)
        logger.info(`Blockers: ${removeDryRunReport.summary.blockerCount}`)
        logger.info(`Lockfile effect: ${removeDryRunReport.wouldEffects.lockfile.status}`)

        for (const file of removeDryRunReport.files) {
          logger.info(`- ${file.path}: ${file.dryRunAction}`)
        }

        return
      }

      if (!options.advisory) {
        const removeStrictReport = await createRemoveStrictReport({
          cwd,
          itemName: options.itemName,
          registrySourcePath: options.registrySource,
        })

        if (!removeStrictReport.applied) {
          if (options.json) {
            console.log(JSON.stringify(removeStrictReport, null, 2))
          } else {
            logger.error(`${chalk.red("[ Strict Remove ]")} No files or lockfile records were removed.`)
            logger.error(`Item: ${removeStrictReport.itemName}`)
            logger.error(`Item remove state: ${removeStrictReport.itemRemoveState}`)
            logger.error(`Blockers: ${removeStrictReport.blockers.length}`)
            logger.error(`Findings: ${removeStrictReport.findings.length}`)
          }

          process.exitCode = 1
          return
        }

        if (options.json) {
          console.log(JSON.stringify(removeStrictReport, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Strict Remove ]")} ${removeStrictReport.itemName} removed.`)
        logger.info(`Deleted files: ${removeStrictReport.effects.files.deletedCount}`)
        logger.info(`Removed lockfile records: ${removeStrictReport.effects.lockfile.removedFileRecordCount}`)
        logger.info(`Lockfile effect: ${removeStrictReport.effects.lockfile.status}`)
        logger.info(`Findings: ${removeStrictReport.findings.length}`)

        return
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
