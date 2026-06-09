import { existsSync } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { z } from "zod"

import { createDiffReport, handleError, logger } from "@/src/helpers"

const diffOptionsSchema = z.object({
  cwd: z.string().default(process.cwd()),
  json: z.boolean().default(false),
  registrySource: z.string().optional(),
})

const parseDiffOptions = (itemName: string, CLIOptions: unknown) => ({
  itemName,
  ...diffOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {}),
})

export const diff = new Command()
  .name("diff")
  .description("Compare an installed Amino UI registry item with the current registry source without writing changes.")
  .argument("<item>", "The installed registry item you'd like to compare.")
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("--json", "Print machine-readable diff output.", false)
  .option("--registry-source <path>", "Path to a local registry source JSON file for source comparison.")
  .action(async (itemName, CLIOptions) => {
    try {
      const options = parseDiffOptions(itemName, CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      const diffReport = await createDiffReport({
        cwd,
        itemName: options.itemName,
        registrySourcePath: options.registrySource,
      })

      if (options.json) {
        console.log(JSON.stringify(diffReport, null, 2))
        return
      }

      logger.info(`${chalk.green("[ Diff ]")} No files were written.`)
      logger.info(`Item: ${diffReport.itemName}`)
      logger.info(`Registry source: ${diffReport.registrySource.status}`)
      if (diffReport.registrySource.path) logger.info(`Registry source path: ${diffReport.registrySource.path}`)
      logger.info(`Files compared: ${diffReport.summary.fileCount}`)
      logger.info(`Review-required files: ${diffReport.summary.reviewRequiredCount}`)
      logger.info(`Source changes: ${diffReport.summary.sourceChangedCount}`)
      logger.info(`Local changes: ${diffReport.summary.localChangeCount}`)
      logger.info(`Preserved files: ${diffReport.summary.preservationRequiredCount}`)
      logger.info(`Findings: ${diffReport.findings.length}`)

      for (const file of diffReport.files) {
        if (!file.reviewRequired) continue

        logger.info(`- ${file.path}: ${file.comparison} (${file.recommendation})`)
      }
    } catch (error) {
      handleError(error)
    }
  })
