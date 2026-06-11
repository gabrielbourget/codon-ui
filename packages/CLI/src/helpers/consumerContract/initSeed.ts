import { existsSync, promises as fs, readFileSync } from "fs"
import path from "path"

import {
  PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEPENDENCIES,
  PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEV_DEPENDENCIES,
  type TPackageManifestDependencyField,
} from "../packageManifestConstants"

import {
  CODON_UI_CLI_PACKAGE_NAME,
  CODON_UI_CLI_SHORTCUT_DEFAULT_DEV_DEPENDENCY_RANGE,
  CODON_UI_CLI_SHORTCUT_SCRIPT_COMMAND,
  CODON_UI_CLI_SHORTCUT_SCRIPT_NAME,
  CODON_UI_CONFIG_FILE_NAME,
  CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME,
  CODON_UI_LOCK_FILE_NAME,
  CONSUMER_ADVISORY_SEVERITY__WARNING,
  CONSUMER_INIT_CLI_SHORTCUT_STATUS__ALREADY_CONFIGURED,
  CONSUMER_INIT_CLI_SHORTCUT_STATUS__BLOCKED,
  CONSUMER_INIT_CLI_SHORTCUT_STATUS__MISSING_PACKAGE_JSON,
  CONSUMER_INIT_CLI_SHORTCUT_STATUS__NOT_REQUESTED,
  CONSUMER_INIT_CLI_SHORTCUT_STATUS__RECOMMENDED,
  CONSUMER_INIT_CLI_SHORTCUT_STATUS__WOULD_WRITE,
  CONSUMER_INIT_CLI_SHORTCUT_STATUS__WRITTEN,
  CONSUMER_PACKAGE_MANAGER__UNKNOWN,
} from "./constants"
import { normalizeConsumerRelativePath, resolveConsumerLayout } from "./layout"
import { getConsumerProjectContext } from "./projectContext"
import {
  consumerConfigSchema,
  consumerInitCliShortcutSchema,
  consumerInitDryRunResultSchema,
  consumerInitSeedResultSchema,
  consumerLockfileSchema,
  type TConsumerConfig,
  type TConsumerInitCliShortcut,
  type TConsumerInitDryRunResult,
  type TConsumerInitSeedResult,
  type TConsumerLockfile,
} from "./schema"

export type TConsumerInitOptions = {
  registryRoot?: string
  setupCli?: boolean
}

type TConsumerPackageManifest = Record<string, unknown>
export type TConsumerInitCliShortcutMode = "advisory" | "dry-run" | "strict"

export type TConsumerInitCliShortcutPlan = {
  cliShortcut: TConsumerInitCliShortcut
  findings: TConsumerInitSeedResult["findings"]
  packageManifest?: TConsumerPackageManifest
  shouldWritePackageJson: boolean
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const getStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
}

const getCliShortcutDependency = (
  packageManifest: TConsumerPackageManifest,
):
  | {
      field: TPackageManifestDependencyField
      range: string
    }
  | undefined => {
  const dependencyFields = [
    PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEV_DEPENDENCIES,
    PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEPENDENCIES,
  ] as const

  for (const field of dependencyFields) {
    const dependencies = getStringRecord(packageManifest[field])
    const range = dependencies?.[CODON_UI_CLI_PACKAGE_NAME]

    if (range) return { field, range }
  }

  return undefined
}

const createCliShortcutBase = ({
  status,
  dependency,
  packageJsonPath,
  requested,
  shouldWritePackageJson,
}: {
  status: TConsumerInitCliShortcut["status"]
  dependency?: ReturnType<typeof getCliShortcutDependency>
  packageJsonPath?: typeof CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME
  requested: boolean
  shouldWritePackageJson: boolean
}) =>
  consumerInitCliShortcutSchema.parse({
    dependencyField: dependency?.field,
    devDependencyRange: CODON_UI_CLI_SHORTCUT_DEFAULT_DEV_DEPENDENCY_RANGE,
    existingDependencyRange: dependency?.range,
    packageJsonPath,
    packageName: CODON_UI_CLI_PACKAGE_NAME,
    requested,
    scriptCommand: CODON_UI_CLI_SHORTCUT_SCRIPT_COMMAND,
    scriptName: CODON_UI_CLI_SHORTCUT_SCRIPT_NAME,
    status,
    wouldWritePackageJson: shouldWritePackageJson,
    writesPackageJson: status === CONSUMER_INIT_CLI_SHORTCUT_STATUS__WRITTEN,
  })

const createCliShortcutWriteStatus = (mode: TConsumerInitCliShortcutMode) => {
  switch (mode) {
    case "advisory":
      return CONSUMER_INIT_CLI_SHORTCUT_STATUS__RECOMMENDED
    case "dry-run":
      return CONSUMER_INIT_CLI_SHORTCUT_STATUS__WOULD_WRITE
    case "strict":
      return CONSUMER_INIT_CLI_SHORTCUT_STATUS__WRITTEN
  }
}

export const createConsumerInitCliShortcutPlan = ({
  cwd,
  mode,
  setupCli = false,
}: {
  cwd: string
  mode: TConsumerInitCliShortcutMode
  setupCli?: boolean
}): TConsumerInitCliShortcutPlan => {
  if (!setupCli) {
    return {
      cliShortcut: createCliShortcutBase({
        requested: false,
        shouldWritePackageJson: false,
        status: CONSUMER_INIT_CLI_SHORTCUT_STATUS__NOT_REQUESTED,
      }),
      findings: [],
      shouldWritePackageJson: false,
    }
  }

  const packageJsonPath = path.join(cwd, CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME)

  if (!existsSync(packageJsonPath)) {
    return {
      cliShortcut: createCliShortcutBase({
        packageJsonPath: CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME,
        requested: true,
        shouldWritePackageJson: false,
        status: CONSUMER_INIT_CLI_SHORTCUT_STATUS__MISSING_PACKAGE_JSON,
      }),
      findings: [
        {
          code: "missing-package-json",
          message: `${CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME} was not found. CLI shortcut setup was skipped.`,
          severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
        },
      ],
      shouldWritePackageJson: false,
    }
  }

  let packageManifest: unknown

  try {
    packageManifest = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  } catch {
    return {
      cliShortcut: createCliShortcutBase({
        packageJsonPath: CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME,
        requested: true,
        shouldWritePackageJson: false,
        status: CONSUMER_INIT_CLI_SHORTCUT_STATUS__BLOCKED,
      }),
      findings: [
        {
          code: "invalid-package-json",
          message: `${CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME} could not be parsed. CLI shortcut setup was skipped.`,
          severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
        },
      ],
      shouldWritePackageJson: false,
    }
  }

  if (!isRecord(packageManifest)) {
    return {
      cliShortcut: createCliShortcutBase({
        packageJsonPath: CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME,
        requested: true,
        shouldWritePackageJson: false,
        status: CONSUMER_INIT_CLI_SHORTCUT_STATUS__BLOCKED,
      }),
      findings: [
        {
          code: "invalid-package-json",
          message: `${CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME} must contain a JSON object. CLI shortcut setup was skipped.`,
          severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
        },
      ],
      shouldWritePackageJson: false,
    }
  }

  const scripts = getStringRecord(packageManifest.scripts)
  const scriptValue = scripts?.[CODON_UI_CLI_SHORTCUT_SCRIPT_NAME]
  const dependency = getCliShortcutDependency(packageManifest)
  const needsScript = scriptValue !== CODON_UI_CLI_SHORTCUT_SCRIPT_COMMAND
  const needsDependency = !dependency

  if (scriptValue !== undefined && scriptValue !== CODON_UI_CLI_SHORTCUT_SCRIPT_COMMAND) {
    return {
      cliShortcut: createCliShortcutBase({
        dependency,
        packageJsonPath: CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME,
        requested: true,
        shouldWritePackageJson: false,
        status: CONSUMER_INIT_CLI_SHORTCUT_STATUS__BLOCKED,
      }),
      findings: [
        {
          code: "existing-cui-script",
          message: `${CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME} already defines scripts.${CODON_UI_CLI_SHORTCUT_SCRIPT_NAME}. CLI shortcut setup will not overwrite it.`,
          severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
        },
      ],
      packageManifest,
      shouldWritePackageJson: false,
    }
  }

  if (needsScript && packageManifest.scripts !== undefined && !isRecord(packageManifest.scripts)) {
    return {
      cliShortcut: createCliShortcutBase({
        dependency,
        packageJsonPath: CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME,
        requested: true,
        shouldWritePackageJson: false,
        status: CONSUMER_INIT_CLI_SHORTCUT_STATUS__BLOCKED,
      }),
      findings: [
        {
          code: "invalid-package-json-scripts",
          message: `${CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME} has a non-object scripts field. CLI shortcut setup will not overwrite it.`,
          severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
        },
      ],
      packageManifest,
      shouldWritePackageJson: false,
    }
  }

  if (
    needsDependency &&
    packageManifest[PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEV_DEPENDENCIES] !== undefined &&
    !isRecord(packageManifest[PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEV_DEPENDENCIES])
  ) {
    return {
      cliShortcut: createCliShortcutBase({
        dependency,
        packageJsonPath: CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME,
        requested: true,
        shouldWritePackageJson: false,
        status: CONSUMER_INIT_CLI_SHORTCUT_STATUS__BLOCKED,
      }),
      findings: [
        {
          code: "invalid-package-json-dev-dependencies",
          message: `${CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME} has a non-object devDependencies field. CLI shortcut setup will not overwrite it.`,
          severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
        },
      ],
      packageManifest,
      shouldWritePackageJson: false,
    }
  }

  const shouldWritePackageJson = needsScript || needsDependency

  return {
    cliShortcut: createCliShortcutBase({
      dependency,
      packageJsonPath: CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME,
      requested: true,
      shouldWritePackageJson,
      status: shouldWritePackageJson
        ? createCliShortcutWriteStatus(mode)
        : CONSUMER_INIT_CLI_SHORTCUT_STATUS__ALREADY_CONFIGURED,
    }),
    findings: [],
    packageManifest,
    shouldWritePackageJson,
  }
}

const applyCliShortcutPackageManifest = (packageManifest: TConsumerPackageManifest): TConsumerPackageManifest => {
  const dependency = getCliShortcutDependency(packageManifest)
  const nextManifest = { ...packageManifest }

  if (
    getStringRecord(nextManifest.scripts)?.[CODON_UI_CLI_SHORTCUT_SCRIPT_NAME] !== CODON_UI_CLI_SHORTCUT_SCRIPT_COMMAND
  ) {
    nextManifest.scripts = {
      ...(isRecord(nextManifest.scripts) ? nextManifest.scripts : {}),
      [CODON_UI_CLI_SHORTCUT_SCRIPT_NAME]: CODON_UI_CLI_SHORTCUT_SCRIPT_COMMAND,
    }
  }

  if (!dependency) {
    nextManifest.devDependencies = {
      ...(isRecord(nextManifest.devDependencies) ? nextManifest.devDependencies : {}),
      [CODON_UI_CLI_PACKAGE_NAME]: CODON_UI_CLI_SHORTCUT_DEFAULT_DEV_DEPENDENCY_RANGE,
    }
  }

  return nextManifest
}

const writeCliShortcutPackageManifest = async ({
  cwd,
  packageManifest,
}: {
  cwd: string
  packageManifest: TConsumerPackageManifest
}) => {
  const packageJsonPath = path.join(cwd, CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME)
  const nextManifest = applyCliShortcutPackageManifest(packageManifest)

  await fs.writeFile(packageJsonPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8")
}

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
  const cliShortcutPlan = createConsumerInitCliShortcutPlan({
    cwd,
    mode: "dry-run",
    setupCli: options.setupCli,
  })
  const initialized = !project.hasConfigFile && !project.hasLockfile
  const findings: TConsumerInitDryRunResult["findings"] = [
    ...layout.findings,
    ...createConsumerInitSeedFindings({
      configExists: project.hasConfigFile,
      configMessage: `${CODON_UI_CONFIG_FILE_NAME} already exists. Init dry-run will not preview overwriting it.`,
      lockfileExists: project.hasLockfile,
      lockfileMessage: `${CODON_UI_LOCK_FILE_NAME} already exists. Init dry-run will not preview overwriting it.`,
    }),
    ...cliShortcutPlan.findings,
  ]

  if (project.packageManager === CONSUMER_PACKAGE_MANAGER__UNKNOWN) {
    findings.push({
      code: "unknown-package-manager",
      message: "Could not infer a package manager from packageManager metadata or a known lockfile.",
      severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
    })
  }

  return consumerInitDryRunResultSchema.parse({
    cliShortcut: cliShortcutPlan.cliShortcut,
    cwd,
    dryRun: true,
    effects: {
      createsDirectories: false,
      installsDependencies: false,
      writesConfig: false,
      writesLockfile: false,
      writesPackageJson: false,
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
      packageJson: {
        path: CODON_UI_CONSUMER_PACKAGE_MANIFEST_FILE_NAME,
        status: cliShortcutPlan.cliShortcut.status,
        wouldWrite: cliShortcutPlan.cliShortcut.wouldWritePackageJson,
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
  const seedFindings = createConsumerInitSeedFindings({
    configExists: existsSync(configPath),
    configMessage: `${CODON_UI_CONFIG_FILE_NAME} already exists. Strict init seed will not overwrite it.`,
    lockfileExists: existsSync(lockfilePath),
    lockfileMessage: `${CODON_UI_LOCK_FILE_NAME} already exists. Strict init seed will not overwrite it.`,
  })
  const cliShortcutPlan = createConsumerInitCliShortcutPlan({
    cwd,
    mode: "strict",
    setupCli: options.setupCli,
  })
  const findings = [...seedFindings, ...cliShortcutPlan.findings]
  const shouldWriteSeedFiles = seedFindings.length === 0

  if (!shouldWriteSeedFiles && !cliShortcutPlan.shouldWritePackageJson) {
    return consumerInitSeedResultSchema.parse({
      cliShortcut: cliShortcutPlan.cliShortcut,
      config,
      cwd,
      effects: {
        createsDirectories: false,
        installsDependencies: false,
        writesConfig: false,
        writesLockfile: false,
        writesPackageJson: false,
      },
      findings,
      initialized: false,
      lockfileData,
    })
  }

  if (shouldWriteSeedFiles) {
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
    await fs.writeFile(lockfilePath, `${JSON.stringify(lockfileData, null, 2)}\n`, "utf8")
  }

  if (cliShortcutPlan.shouldWritePackageJson && cliShortcutPlan.packageManifest) {
    await writeCliShortcutPackageManifest({
      cwd,
      packageManifest: cliShortcutPlan.packageManifest,
    })
  }

  return consumerInitSeedResultSchema.parse({
    cliShortcut: cliShortcutPlan.cliShortcut,
    config,
    cwd,
    effects: {
      createsDirectories: false,
      installsDependencies: false,
      writesConfig: shouldWriteSeedFiles,
      writesLockfile: shouldWriteSeedFiles,
      writesPackageJson: cliShortcutPlan.shouldWritePackageJson,
    },
    findings,
    initialized: shouldWriteSeedFiles,
    lockfileData,
  })
}
