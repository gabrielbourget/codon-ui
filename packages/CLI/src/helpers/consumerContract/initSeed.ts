import { existsSync, promises as fs } from "fs"
import path from "path"

import {
  CODON_UI_CONFIG_FILE_NAME,
  CODON_UI_LOCK_FILE_NAME,
  CONSUMER_ADVISORY_SEVERITY__WARNING,
  CONSUMER_PACKAGE_MANAGER__UNKNOWN,
} from "./constants"
import { normalizeConsumerRelativePath, resolveConsumerLayout } from "./layout"
import { getConsumerProjectContext } from "./projectContext"
import {
  consumerConfigSchema,
  consumerInitDryRunResultSchema,
  consumerInitSeedResultSchema,
  consumerLockfileSchema,
  type TConsumerConfig,
  type TConsumerInitDryRunResult,
  type TConsumerInitSeedResult,
  type TConsumerLockfile,
} from "./schema"

export type TConsumerInitOptions = {
  registryRoot?: string
}

const normalizeConsumerRegistryRootOption = (registryRoot?: string) => {
  if (!registryRoot) return undefined

  if (path.isAbsolute(registryRoot)) {
    throw new Error("--registry-root must be a consumer-relative path.")
  }

  const normalizedRegistryRoot = normalizeConsumerRelativePath(registryRoot)

  if (!normalizedRegistryRoot || normalizedRegistryRoot === ".") {
    throw new Error("--registry-root must be a non-empty consumer-relative path.")
  }

  if (normalizedRegistryRoot.split("/").includes("..")) {
    throw new Error("--registry-root cannot include parent directory segments.")
  }

  return normalizedRegistryRoot
}

export const createDefaultConsumerConfig = (options: TConsumerInitOptions = {}): TConsumerConfig => {
  const registryRoot = normalizeConsumerRegistryRootOption(options.registryRoot)

  return consumerConfigSchema.parse(registryRoot ? { paths: { registry: registryRoot } } : {})
}

export const createEmptyConsumerLockfile = (): TConsumerLockfile => consumerLockfileSchema.parse({})

const createConsumerInitSeedFindings = ({
  configExists,
  configMessage,
  lockfileExists,
  lockfileMessage,
}: {
  configExists: boolean
  configMessage: string
  lockfileExists: boolean
  lockfileMessage: string
}): TConsumerInitSeedResult["findings"] => {
  const findings: TConsumerInitSeedResult["findings"] = []

  if (configExists) {
    findings.push({
      code: "existing-config",
      message: configMessage,
      severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
    })
  }

  if (lockfileExists) {
    findings.push({
      code: "existing-lockfile",
      message: lockfileMessage,
      severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
    })
  }

  return findings
}

export const createConsumerInitDryRun = (
  cwd: string,
  options: TConsumerInitOptions = {},
): TConsumerInitDryRunResult => {
  const project = getConsumerProjectContext(cwd)
  const proposedConfig = createDefaultConsumerConfig(options)
  const lockfileData = createEmptyConsumerLockfile()
  const layout = resolveConsumerLayout(proposedConfig)
  const initialized = !project.hasConfigFile && !project.hasLockfile
  const findings: TConsumerInitDryRunResult["findings"] = [
    ...layout.findings,
    ...createConsumerInitSeedFindings({
      configExists: project.hasConfigFile,
      configMessage: `${CODON_UI_CONFIG_FILE_NAME} already exists. Init dry-run will not preview overwriting it.`,
      lockfileExists: project.hasLockfile,
      lockfileMessage: `${CODON_UI_LOCK_FILE_NAME} already exists. Init dry-run will not preview overwriting it.`,
    }),
  ]

  if (project.packageManager === CONSUMER_PACKAGE_MANAGER__UNKNOWN) {
    findings.push({
      code: "unknown-package-manager",
      message: "Could not infer a package manager from packageManager metadata or a known lockfile.",
      severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
    })
  }

  return consumerInitDryRunResultSchema.parse({
    cwd,
    dryRun: true,
    effects: {
      createsDirectories: false,
      installsDependencies: false,
      writesConfig: false,
      writesLockfile: false,
    },
    findings,
    initialized,
    lockfileData,
    packageManager: project.packageManager,
    project,
    proposedConfig,
    targetPaths: layout.targetPaths,
    wouldEffects: {
      config: {
        path: CODON_UI_CONFIG_FILE_NAME,
        status: initialized ? "would-write" : project.hasConfigFile ? "blocked" : "not-written",
        wouldWrite: initialized,
      },
      dependencies: {
        plannedInstallCount: 0,
        status: "not-written",
      },
      directories: {
        plannedCount: 0,
        status: "not-written",
      },
      lockfile: {
        path: CODON_UI_LOCK_FILE_NAME,
        status: initialized ? "would-write" : project.hasLockfile ? "blocked" : "not-written",
        wouldWrite: initialized,
      },
    },
  })
}

export const writeConsumerInitSeed = async (
  cwd: string,
  options: TConsumerInitOptions = {},
): Promise<TConsumerInitSeedResult> => {
  const config = createDefaultConsumerConfig(options)
  const lockfileData = createEmptyConsumerLockfile()
  const configPath = path.join(cwd, CODON_UI_CONFIG_FILE_NAME)
  const lockfilePath = path.join(cwd, CODON_UI_LOCK_FILE_NAME)
  const findings = createConsumerInitSeedFindings({
    configExists: existsSync(configPath),
    configMessage: `${CODON_UI_CONFIG_FILE_NAME} already exists. Strict init seed will not overwrite it.`,
    lockfileExists: existsSync(lockfilePath),
    lockfileMessage: `${CODON_UI_LOCK_FILE_NAME} already exists. Strict init seed will not overwrite it.`,
  })

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
