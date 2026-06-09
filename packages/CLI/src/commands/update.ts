import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import {
  createUpdateAllAdvisoryReport,
  createUpdateAllDryRunReport,
  createUpdateAdvisoryReport,
  createUpdateDryRunReport,
  createUpdateStrictReport,
  handleError,
  logger,
} from "@/src/helpers"

const updateOptionsSchema = z.object({
  all: z.boolean().default(false),
  advisory: z.boolean().default(false),
  cwd: z.string().default(process.cwd()),
  dryRun: z.boolean().default(false),
  json: z.boolean().default(false),
  registrySource: z.string().optional(),
})

const parseUpdateOptions = (itemName: string | undefined, CLIOptions: unknown) => ({
  itemName,
  ...updateOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {}),
})

export const update = new Command()
  .name("update")
  .description("Update one installed Amino UI registry item when strict provenance checks pass.")
  .argument("[item]", "The installed registry item you'd like to inspect or update.")
  .option("--all", "Report update posture for every installed registry item.", false)
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

      if (options.all && options.itemName) {
        logger.error("Please choose either a single item or --all, not both.")
        process.exit(1)
      }

      if (!options.all && !options.itemName) {
        logger.error("Please provide an item to update, or use --all with --advisory or --dry-run.")
        process.exit(1)
      }

      if (options.all && !options.advisory && !options.dryRun) {
        logger.error("update --all currently supports --advisory or --dry-run only.")
        process.exit(1)
      }

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      if (options.all) {
        if (options.dryRun) {
          const updateAllDryRunReport = await createUpdateAllDryRunReport({
            cwd,
            registrySourcePath: options.registrySource,
          })

          if (options.json) {
            console.log(JSON.stringify(updateAllDryRunReport, null, 2))
            return
          }

          logger.info(`${chalk.green("[ Update All Dry Run ]")} No files were written.`)
          logger.info(`Items inspected: ${updateAllDryRunReport.summary.itemCount}`)
          logger.info(`Would-update items: ${updateAllDryRunReport.summary.itemStates["would-update"]}`)
          logger.info(`Blocked items: ${updateAllDryRunReport.summary.itemStates.blocked}`)
          logger.info(`Up-to-date items: ${updateAllDryRunReport.summary.itemStates["up-to-date"]}`)
          logger.info(`Unavailable items: ${updateAllDryRunReport.summary.itemStates.unavailable}`)
          logger.info(`Update candidate files: ${updateAllDryRunReport.summary.candidateFileCount}`)
          logger.info(`Would write files: ${updateAllDryRunReport.summary.wouldWriteFileCount}`)
          logger.info(`Would update lockfile records: ${updateAllDryRunReport.summary.wouldUpdateLockfileFileCount}`)
          logger.info(`Skipped files: ${updateAllDryRunReport.summary.skippedFileCount}`)
          logger.info(`Blocked files: ${updateAllDryRunReport.summary.blockedFileCount}`)
          logger.info(`Blockers: ${updateAllDryRunReport.summary.blockerCount}`)
          logger.info(`Findings: ${updateAllDryRunReport.findings.length}`)

          for (const item of updateAllDryRunReport.items) {
            logger.info(`- ${item.itemName}: ${item.itemUpdateState}`)
          }

          return
        }

        const updateAllAdvisoryReport = await createUpdateAllAdvisoryReport({
          cwd,
          registrySourcePath: options.registrySource,
        })

        if (options.json) {
          console.log(JSON.stringify(updateAllAdvisoryReport, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Update All Advisory ]")} No files were written.`)
        logger.info(`Items inspected: ${updateAllAdvisoryReport.summary.itemCount}`)
        logger.info(`Update candidate items: ${updateAllAdvisoryReport.summary.itemStates["update-candidate"]}`)
        logger.info(`Review-required items: ${updateAllAdvisoryReport.summary.itemStates["review-required"]}`)
        logger.info(`Up-to-date items: ${updateAllAdvisoryReport.summary.itemStates["up-to-date"]}`)
        logger.info(`Unavailable items: ${updateAllAdvisoryReport.summary.itemStates.unavailable}`)
        logger.info(`Update candidate files: ${updateAllAdvisoryReport.summary.candidateFileCount}`)
        logger.info(`Automatic update blockers: ${updateAllAdvisoryReport.summary.automaticBlockerCount}`)
        logger.info(`Findings: ${updateAllAdvisoryReport.findings.length}`)

        for (const item of updateAllAdvisoryReport.items) {
          logger.info(`- ${item.itemName}: ${item.itemUpdateState}`)
        }

        return
      }

      const selectedItemName = options.itemName

      if (!selectedItemName) {
        logger.error("Please provide an item to update, or use --all with --advisory or --dry-run.")
        process.exit(1)
      }

      if (options.dryRun) {
        const updateDryRunReport = await createUpdateDryRunReport({
          cwd,
          itemName: selectedItemName,
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

      if (!options.advisory) {
        const updateStrictReport = await createUpdateStrictReport({
          cwd,
          itemName: selectedItemName,
          registrySourcePath: options.registrySource,
        })

        const isBlocked =
          updateStrictReport.blockers.length > 0 ||
          updateStrictReport.itemUpdateState === "blocked" ||
          updateStrictReport.itemUpdateState === "unavailable"

        if (isBlocked) {
          if (options.json) {
            console.log(JSON.stringify(updateStrictReport, null, 2))
          } else {
            logger.error(`${chalk.red("[ Strict Update ]")} No files or lockfile records were written.`)
            logger.error(`Item: ${updateStrictReport.itemName}`)
            logger.error(`Item update state: ${updateStrictReport.itemUpdateState}`)
            logger.error(`Blockers: ${updateStrictReport.blockers.length}`)
            logger.error(`Findings: ${updateStrictReport.findings.length}`)
          }

          process.exitCode = 1
          return
        }

        if (options.json) {
          console.log(JSON.stringify(updateStrictReport, null, 2))
          return
        }

        if (updateStrictReport.itemUpdateState === "up-to-date") {
          logger.info(`${chalk.green("[ Strict Update ]")} ${updateStrictReport.itemName} is already up to date.`)
          logger.info(`Lockfile effect: ${updateStrictReport.effects.lockfile.status}`)
          logger.info(`Findings: ${updateStrictReport.findings.length}`)
          return
        }

        logger.info(`${chalk.green("[ Strict Update ]")} ${updateStrictReport.itemName} updated.`)
        logger.info(`Files written: ${updateStrictReport.effects.files.writtenCount}`)
        logger.info(`Lockfile records updated: ${updateStrictReport.effects.lockfile.updatedFileRecordCount}`)
        logger.info(`Lockfile effect: ${updateStrictReport.effects.lockfile.status}`)
        logger.info(`Findings: ${updateStrictReport.findings.length}`)

        return
      }

      const updateAdvisoryReport = await createUpdateAdvisoryReport({
        cwd,
        itemName: selectedItemName,
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
