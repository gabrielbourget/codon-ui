import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import { createEjectAdvisoryReport, handleError, logger } from "@/src/helpers"

const ejectOptionsSchema = z.object({
  advisory: z.boolean().default(false),
  cwd: z.string().default(process.cwd()),
  json: z.boolean().default(false),
  registrySource: z.string().optional(),
})

const parseEjectOptions = (itemName: string, CLIOptions: unknown) => ({
  itemName,
  ...ejectOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {}),
})

export const eject = new Command()
  .name("eject")
  .description("Inspect eject posture for one installed Amino UI registry item without writing changes.")
  .argument("<item>", "The installed registry item you'd like to inspect for eject posture.")
  .option("--advisory", "Report eject posture without writing files or lockfile data.", false)
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("--json", "Print machine-readable eject output.", false)
  .option("--registry-source <path>", "Path to a local registry source JSON file for source comparison.")
  .action(async (itemName, CLIOptions) => {
    try {
      const options = parseEjectOptions(itemName, CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (!options.advisory) {
        logger.error("Please choose --advisory. Eject dry-run and strict eject remain deferred.")
        process.exit(1)
      }

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
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
