import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import { createUpdateAdvisoryReport, createUpdateDryRunReport, handleError, logger } from "@/src/helpers"

const updateOptionsSchema = z.object({
  advisory: z.boolean().default(false),
  cwd: z.string().default(process.cwd()),
  dryRun: z.boolean().default(false),
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
  .option("--dry-run", "Preview an item-scoped update without writing files or lockfile data.", false)
  .option("--json", "Print machine-readable update output.", false)
  .option("--registry-source <path>", "Path to a local registry source JSON file for source comparison.")
  .action(async (itemName, CLIOptions) => {
    try {
      const options = parseUpdateOptions(itemName, CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (options.advisory && options.dryRun) {
        logger.error("Please choose either --advisory or --dry-run, not both.")
        process.exit(1)
      }

      if (!options.advisory && !options.dryRun) {
        logger.error("Please choose --advisory or --dry-run. Strict update remains deferred.")
        process.exit(1)
      }

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      if (options.dryRun) {
        const updateDryRunReport = await createUpdateDryRunReport({
          cwd,
          itemName: options.itemName,
          registrySourcePath: options.registrySource,
        })

        if (options.json) {
          console.log(JSON.stringify(updateDryRunReport, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Update Dry Run ]")} No files were written.`)
        logger.info(`Item: ${updateDryRunReport.itemName}`)
        logger.info(`Item update state: ${updateDryRunReport.itemUpdateState}`)
        logger.info(`Registry source: ${updateDryRunReport.registrySource.status}`)
        if (updateDryRunReport.registrySource.path) {
          logger.info(`Registry source path: ${updateDryRunReport.registrySource.path}`)
        }
        logger.info(`Files inspected: ${updateDryRunReport.summary.fileCount}`)
        logger.info(`Update candidates: ${updateDryRunReport.summary.candidateFileCount}`)
        logger.info(`Would write files: ${updateDryRunReport.summary.wouldWriteFileCount}`)
        logger.info(`Would update lockfile records: ${updateDryRunReport.summary.wouldUpdateLockfileFileCount}`)
        logger.info(`Skipped files: ${updateDryRunReport.summary.skippedFileCount}`)
        logger.info(`Blocked files: ${updateDryRunReport.summary.blockedFileCount}`)
        logger.info(`Blockers: ${updateDryRunReport.summary.blockerCount}`)
        logger.info(`Dependency blockers: ${updateDryRunReport.summary.dependencyBlockerCount}`)
        logger.info(`Lockfile effect: ${updateDryRunReport.wouldEffects.lockfile.status}`)

        for (const file of updateDryRunReport.files) {
          if (file.dryRunAction === "none") continue

          logger.info(`- ${file.path}: ${file.dryRunAction}`)
        }

        return
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
