import { existsSync, promises as fs } from "fs"
import path from "path"

import { AMINO_UI_CONFIG_FILE_NAME, AMINO_UI_LOCK_FILE_NAME, CONSUMER_ADVISORY_SEVERITY__WARNING } from "./constants"
import {
  consumerConfigSchema,
  consumerInitSeedResultSchema,
  consumerLockfileSchema,
  type TConsumerConfig,
  type TConsumerInitSeedResult,
  type TConsumerLockfile,
} from "./schema"

export const createDefaultConsumerConfig = (): TConsumerConfig =>
  consumerConfigSchema.parse({
    $schema: "https://aminoui.com/schema.json",
  })

export const createEmptyConsumerLockfile = (): TConsumerLockfile => consumerLockfileSchema.parse({})

export const writeConsumerInitSeed = async (cwd: string): Promise<TConsumerInitSeedResult> => {
  const config = createDefaultConsumerConfig()
  const lockfileData = createEmptyConsumerLockfile()
  const configPath = path.join(cwd, AMINO_UI_CONFIG_FILE_NAME)
  const lockfilePath = path.join(cwd, AMINO_UI_LOCK_FILE_NAME)
  const findings: TConsumerInitSeedResult["findings"] = []

  if (existsSync(configPath)) {
    findings.push({
      code: "existing-config",
      message: `${AMINO_UI_CONFIG_FILE_NAME} already exists. Strict init seed will not overwrite it.`,
      severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
    })
  }

  if (existsSync(lockfilePath)) {
    findings.push({
      code: "existing-lockfile",
      message: `${AMINO_UI_LOCK_FILE_NAME} already exists. Strict init seed will not overwrite it.`,
      severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
    })
  }

  if (findings.length > 0) {
    return consumerInitSeedResultSchema.parse({
      config,
      cwd,
      effects: {
        createsDirectories: false,
        installsDependencies: false,
        writesConfig: false,
        writesLockfile: false,
      },
      findings,
      initialized: false,
      lockfileData,
    })
  }

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
  await fs.writeFile(lockfilePath, `${JSON.stringify(lockfileData, null, 2)}\n`, "utf8")

  return consumerInitSeedResultSchema.parse({
    config,
    cwd,
    effects: {
      createsDirectories: false,
      installsDependencies: false,
      writesConfig: true,
      writesLockfile: true,
    },
    initialized: true,
    lockfileData,
  })
}
