import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import {
  createEjectAdvisoryReport,
  createEjectDryRunReport,
  createEjectStrictReport,
  handleError,
  logger,
} from "@/src/helpers"

const ejectOptionsSchema = z.object({
  advisory: z.boolean().default(false),
  cwd: z.string().default(process.cwd()),
  dryRun: z.boolean().default(false),
  json: z.boolean().default(false),
  registrySource: z.string().optional(),
})

const parseEjectOptions = (itemName: string, CLIOptions: unknown) => ({
  itemName,
  ...ejectOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {}),
})

export const eject = new Command()
  .name("eject")
  .description("Eject one installed Amino UI registry item when strict provenance checks pass.")
  .argument("<item>", "The installed registry item you'd like to inspect or eject.")
  .option("--advisory", "Report eject posture without writing files or lockfile data.", false)
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("--dry-run", "Preview an item-scoped eject without writing files or lockfile data.", false)
  .option("--json", "Print machine-readable eject output.", false)
  .option("--registry-source <path>", "Path to a local registry source JSON file for source comparison.")
  .action(async (itemName, CLIOptions) => {
    try {
      const options = parseEjectOptions(itemName, CLIOptions)
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
        const ejectDryRunReport = await createEjectDryRunReport({
          cwd,
          itemName: options.itemName,
          registrySourcePath: options.registrySource,
        })

        if (options.json) {
          console.log(JSON.stringify(ejectDryRunReport, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Eject Dry Run ]")} No files or lockfile records were written.`)
        logger.info(`Item: ${ejectDryRunReport.itemName}`)
        logger.info(`Item eject state: ${ejectDryRunReport.itemEjectState}`)
        logger.info(`Registry source: ${ejectDryRunReport.registrySource.status}`)
        if (ejectDryRunReport.registrySource.path) {
          logger.info(`Registry source path: ${ejectDryRunReport.registrySource.path}`)
        }
        logger.info(`Files inspected: ${ejectDryRunReport.summary.fileCount}`)
        logger.info(`Eject candidates: ${ejectDryRunReport.summary.ejectCandidateCount}`)
        logger.info(
          `Would eject lockfile ownership records: ${ejectDryRunReport.summary.wouldEjectLockfileRecordCount}`,
        )
        logger.info(`Already ejected files: ${ejectDryRunReport.summary.alreadyEjectedCount}`)
        logger.info(`Skipped files: ${ejectDryRunReport.summary.skippedFileCount}`)
        logger.info(`Blocked files: ${ejectDryRunReport.summary.blockedFileCount}`)
        logger.info(`Blockers: ${ejectDryRunReport.summary.blockerCount}`)
        logger.info(`Lockfile effect: ${ejectDryRunReport.wouldEffects.lockfile.status}`)

        for (const file of ejectDryRunReport.files) {
          logger.info(`- ${file.path}: ${file.dryRunAction}`)
        }

        return
      }

      if (!options.advisory) {
        const ejectStrictReport = await createEjectStrictReport({
          cwd,
          itemName: options.itemName,
          registrySourcePath: options.registrySource,
        })

        const isBlocked =
          ejectStrictReport.blockers.length > 0 ||
          ejectStrictReport.itemEjectState === "blocked" ||
          ejectStrictReport.itemEjectState === "unavailable"

        if (isBlocked) {
          if (options.json) {
            console.log(JSON.stringify(ejectStrictReport, null, 2))
          } else {
            logger.error(`${chalk.red("[ Strict Eject ]")} No lockfile records were written.`)
            logger.error(`Item: ${ejectStrictReport.itemName}`)
            logger.error(`Item eject state: ${ejectStrictReport.itemEjectState}`)
            logger.error(`Blockers: ${ejectStrictReport.blockers.length}`)
            logger.error(`Findings: ${ejectStrictReport.findings.length}`)
          }

          process.exitCode = 1
          return
        }

        if (options.json) {
          console.log(JSON.stringify(ejectStrictReport, null, 2))
          return
        }

        if (ejectStrictReport.itemEjectState === "already-ejected") {
          logger.info(`${chalk.green("[ Strict Eject ]")} ${ejectStrictReport.itemName} is already ejected.`)
          logger.info(`Lockfile effect: ${ejectStrictReport.effects.lockfile.status}`)
          logger.info(`Findings: ${ejectStrictReport.findings.length}`)
          return
        }

        logger.info(`${chalk.green("[ Strict Eject ]")} ${ejectStrictReport.itemName} ejected.`)
        logger.info(`Ejected lockfile records: ${ejectStrictReport.effects.lockfile.ejectedFileRecordCount}`)
        logger.info(`Lockfile effect: ${ejectStrictReport.effects.lockfile.status}`)
        logger.info(`Findings: ${ejectStrictReport.findings.length}`)

        return
      }

      const ejectAdvisoryReport = await createEjectAdvisoryReport({
        cwd,
        itemName: options.itemName,
        registrySourcePath: options.registrySource,
      })

      if (options.json) {
        console.log(JSON.stringify(ejectAdvisoryReport, null, 2))
        return
      }

      logger.info(`${chalk.green("[ Eject Advisory ]")} No files or lockfile records were written.`)
      logger.info(`Item: ${ejectAdvisoryReport.itemName}`)
      logger.info(`Item eject state: ${ejectAdvisoryReport.itemEjectState}`)
      logger.info(`Registry source: ${ejectAdvisoryReport.registrySource.status}`)
      if (ejectAdvisoryReport.registrySource.path) {
        logger.info(`Registry source path: ${ejectAdvisoryReport.registrySource.path}`)
      }
      logger.info(`Files inspected: ${ejectAdvisoryReport.summary.fileCount}`)
      logger.info(`Eject candidates: ${ejectAdvisoryReport.summary.ejectCandidateCount}`)
      logger.info(`Already ejected files: ${ejectAdvisoryReport.summary.alreadyEjectedCount}`)
      logger.info(`Review-required files: ${ejectAdvisoryReport.summary.reviewRequiredCount}`)
      logger.info(`Preserved files: ${ejectAdvisoryReport.summary.preservationRequiredCount}`)
      logger.info(`Automatic eject blockers: ${ejectAdvisoryReport.summary.automaticBlockerCount}`)
      logger.info(`Findings: ${ejectAdvisoryReport.findings.length}`)

      for (const file of ejectAdvisoryReport.files) {
        logger.info(`- ${file.path}: ${file.action}`)
      }
    } catch (error) {
      handleError(error)
    }
  })
