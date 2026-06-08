import crypto from "crypto"
import { existsSync, promises as fs } from "fs"
import path from "path"

import { z } from "zod"

import {
  AMINO_UI_CONFIG_FILE_NAME,
  AMINO_UI_LOCK_FILE_NAME,
  CONSUMER_OWNERSHIP_STATE__CONSUMER_OWNED_SUPPORT,
  CONSUMER_OWNERSHIP_STATE__EJECTED,
  CONSUMER_OWNERSHIP_STATE__LOCALLY_MODIFIED,
  CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED,
  CONSUMER_OWNERSHIP_STATE__UNKNOWN,
  consumerConfigSchema,
  consumerLockfileDependencySchema,
  consumerLockfileSchema,
  consumerTargetRoleSchema,
  resolveConsumerLayout,
  resolveConsumerRegistryFileTarget,
  type TConsumerConfig,
  type TConsumerLockfile,
  type TConsumerOwnershipState,
} from "./consumerContract"
import {
  INSTALL_PLAN_FINDING__CONSUMER_CONFIG_INVALID,
  INSTALL_PLAN_FINDING__CONSUMER_CONFIG_MISSING,
  INSTALL_PLAN_FINDING__CONSUMER_LOCKFILE_INVALID,
  INSTALL_PLAN_FINDING__CONSUMER_LOCKFILE_MISSING,
  INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  INSTALL_PLAN_FINDING_SEVERITY__WARNING,
  INSTALL_PLAN_FINDING_SEVERITIES,
  REGISTRY_FILE_ROLES,
} from "./installPlan/constants"
import {
  getDefaultLocalReactRegistrySourcePath,
  getDefaultLocalSupportRegistrySourcePath,
  isLocalReactRegistryComponentItemRequest,
} from "./installPlan/localRegistry"

const STATUS_SCHEMA_VERSION = 1
const STATUS_FILE_STATE__MISSING = "missing"
const STATUS_SOURCE_STATE__UP_TO_DATE = "up-to-date"
const STATUS_SOURCE_STATE__SOURCE_CHANGED = "source-changed"
const STATUS_SOURCE_STATE__UNKNOWN = "unknown"
const STATUS_FINDING__REGISTRY_SOURCE_UNAVAILABLE = "status-registry-source-unavailable"
const STATUS_FINDING__LOCKFILE_ITEM_MISSING = "status-lockfile-item-missing"

const STATUS_FILE_STATES = [
  CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED,
  CONSUMER_OWNERSHIP_STATE__LOCALLY_MODIFIED,
  STATUS_FILE_STATE__MISSING,
  CONSUMER_OWNERSHIP_STATE__UNKNOWN,
  CONSUMER_OWNERSHIP_STATE__CONSUMER_OWNED_SUPPORT,
  CONSUMER_OWNERSHIP_STATE__EJECTED,
] as const

const STATUS_SOURCE_STATES = [
  STATUS_SOURCE_STATE__UP_TO_DATE,
  STATUS_SOURCE_STATE__SOURCE_CHANGED,
  STATUS_SOURCE_STATE__UNKNOWN,
] as const

const statusFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    message: z.string().min(1),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

export type TStatusFinding = z.infer<typeof statusFindingSchema>

const statusRegistryFileSchema = z
  .object({
    contentHash: z.string().min(1).optional(),
    required: z.boolean().optional(),
    role: z.enum(REGISTRY_FILE_ROLES),
    sourcePath: z.string().min(1),
    targetPath: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

const statusRegistryItemSchema = z
  .object({
    devDependencies: z.record(z.string().min(1), z.string().min(1)).default({}),
    files: z.array(statusRegistryFileSchema).min(1),
    name: z.string().min(1),
    peerDependencies: z.record(z.string().min(1), z.string().min(1)).default({}),
    registryDependencies: z.array(z.string().min(1)).default([]),
    runtimeDependencies: z.record(z.string().min(1), z.string().min(1)).default({}),
    sourcePackage: z.string().min(1),
    type: z.string().min(1),
  })
  .strict()

const statusRegistrySourceSchema = z
  .object({
    items: z.array(statusRegistryItemSchema).default([]),
    schemaVersion: z.literal(1).default(1),
    sourceIdentity: z.string().min(1),
    sourceRoot: z.string().min(1).optional(),
  })
  .strict()

type TStatusRegistrySource = z.infer<typeof statusRegistrySourceSchema>
type TStatusFileState = (typeof STATUS_FILE_STATES)[number]
type TStatusSourceState = (typeof STATUS_SOURCE_STATES)[number]

const statusFileSchema = z
  .object({
    currentHash: z.string().min(1).optional(),
    currentSourceHash: z.string().min(1).optional(),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    sourceHash: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    sourceState: z.enum(STATUS_SOURCE_STATES),
    state: z.enum(STATUS_FILE_STATES),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

const statusItemSchema = z
  .object({
    fileCount: z.number().int().nonnegative(),
    files: z.array(statusFileSchema).default([]),
    name: z.string().min(1),
    sourceIdentity: z.string().min(1),
    sourceState: z.enum(STATUS_SOURCE_STATES),
    state: z.enum(STATUS_FILE_STATES),
  })
  .strict()

type TStatusFile = z.infer<typeof statusFileSchema>
type TStatusItem = z.infer<typeof statusItemSchema>

const statusReportSchema = z
  .object({
    config: z
      .object({
        path: z.string().min(1),
        status: z.enum(["present", "missing", "invalid"]),
      })
      .strict(),
    cwd: z.string().min(1),
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    files: z.array(statusFileSchema).default([]),
    findings: z.array(statusFindingSchema).default([]),
    items: z.array(statusItemSchema).default([]),
    lockfile: z
      .object({
        itemCount: z.number().int().nonnegative(),
        path: z.string().min(1),
        status: z.enum(["present", "missing", "invalid"]),
      })
      .strict(),
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(["loaded", "unavailable", "not-requested"]),
      })
      .strict(),
    requestedItems: z.array(z.string().min(1)).default([]),
    schemaVersion: z.literal(STATUS_SCHEMA_VERSION).default(STATUS_SCHEMA_VERSION),
    summary: z
      .object({
        fileCount: z.number().int().nonnegative(),
        fileStates: z.record(z.enum(STATUS_FILE_STATES), z.number().int().nonnegative()),
        dependencyStates: z.record(z.string().min(1), z.number().int().nonnegative()),
        itemCount: z.number().int().nonnegative(),
        sourceStates: z.record(z.enum(STATUS_SOURCE_STATES), z.number().int().nonnegative()),
      })
      .strict(),
  })
  .strict()

export type TStatusReport = z.infer<typeof statusReportSchema>

type TStatusRegistryReadResult = {
  registrySource: TStatusRegistrySource
  registrySourcePath: string
  sourceRoot: string
}

type TStatusSourceFile = {
  hash?: string
  sourcePath: string
}

export type TCreateStatusReportOptions = {
  cwd: string
  itemName?: string
  registrySourcePath?: string
}

const createContentHash = (content: string | Buffer) =>
  `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const resolveDefaultStatusRegistrySourcePath = (requestedItems: readonly string[]) => {
  if (isLocalReactRegistryComponentItemRequest(requestedItems)) return getDefaultLocalReactRegistrySourcePath()

  return getDefaultLocalSupportRegistrySourcePath()
}

const readStatusRegistrySource = async (registrySourcePath: string): Promise<TStatusRegistryReadResult> => {
  const resolvedRegistrySourcePath = path.resolve(registrySourcePath)

  if (!existsSync(resolvedRegistrySourcePath)) {
    throw new Error(`Local registry source not found at ${resolvedRegistrySourcePath}.`)
  }

  const registrySource = statusRegistrySourceSchema.parse(
    JSON.parse(await fs.readFile(resolvedRegistrySourcePath, "utf8")),
  )
  const sourceRoot = path.resolve(path.dirname(resolvedRegistrySourcePath), registrySource.sourceRoot ?? ".")

  return {
    registrySource,
    registrySourcePath: resolvedRegistrySourcePath,
    sourceRoot,
  }
}

const readConsumerConfigForStatus = async (
  cwd: string,
): Promise<{ config: TConsumerConfig; findings: TStatusFinding[]; status: "present" | "missing" | "invalid" }> => {
  const configPath = path.join(cwd, AMINO_UI_CONFIG_FILE_NAME)
  const fallbackConfig = consumerConfigSchema.parse({})

  if (!existsSync(configPath)) {
    return {
      config: fallbackConfig,
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_CONFIG_MISSING,
          message: `${AMINO_UI_CONFIG_FILE_NAME} is missing. Status is using default registry-contained paths where needed.`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
          targetPath: AMINO_UI_CONFIG_FILE_NAME,
        },
      ],
      status: "missing",
    }
  }

  try {
    return {
      config: consumerConfigSchema.parse(JSON.parse(await fs.readFile(configPath, "utf8"))),
      findings: [],
      status: "present",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown config parse error."

    return {
      config: fallbackConfig,
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_CONFIG_INVALID,
          message: `${AMINO_UI_CONFIG_FILE_NAME} could not be read as a consumer config. Status is using default registry-contained paths where needed. ${message}`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
          targetPath: AMINO_UI_CONFIG_FILE_NAME,
        },
      ],
      status: "invalid",
    }
  }
}

const readConsumerLockfileForStatus = async (
  cwd: string,
): Promise<{
  findings: TStatusFinding[]
  lockfileData: TConsumerLockfile
  status: "present" | "missing" | "invalid"
}> => {
  const lockfilePath = path.join(cwd, AMINO_UI_LOCK_FILE_NAME)
  const fallbackLockfile = consumerLockfileSchema.parse({})

  if (!existsSync(lockfilePath)) {
    return {
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_LOCKFILE_MISSING,
          message: `${AMINO_UI_LOCK_FILE_NAME} is missing. No installed registry-owned files can be inspected.`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
          targetPath: AMINO_UI_LOCK_FILE_NAME,
        },
      ],
      lockfileData: fallbackLockfile,
      status: "missing",
    }
  }

  try {
    return {
      findings: [],
      lockfileData: consumerLockfileSchema.parse(JSON.parse(await fs.readFile(lockfilePath, "utf8"))),
      status: "present",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown lockfile parse error."

    return {
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_LOCKFILE_INVALID,
          message: `${AMINO_UI_LOCK_FILE_NAME} could not be read as an Amino lockfile. ${message}`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
          targetPath: AMINO_UI_LOCK_FILE_NAME,
        },
      ],
      lockfileData: fallbackLockfile,
      status: "invalid",
    }
  }
}

const createSourceFileKey = ({ itemName, path: filePath }: { itemName: string; path: string }) =>
  `${itemName}:${filePath}`

const createRegistrySourceFileMap = async ({
  config,
  registrySource,
  sourceRoot,
}: {
  config: TConsumerConfig
  registrySource: TStatusRegistrySource
  sourceRoot: string
}) => {
  const layout = resolveConsumerLayout(config)
  const sourceFileMap = new Map<string, TStatusSourceFile>()

  for (const item of registrySource.items) {
    for (const file of item.files) {
      const resolvedTarget = resolveConsumerRegistryFileTarget({
        file,
        targetPaths: layout.targetPaths,
      })
      const absoluteSourcePath = path.resolve(sourceRoot, file.sourcePath)
      const hash = existsSync(absoluteSourcePath)
        ? createContentHash(await fs.readFile(absoluteSourcePath))
        : file.contentHash

      sourceFileMap.set(createSourceFileKey({ itemName: item.name, path: resolvedTarget.resolvedPath }), {
        hash,
        sourcePath: file.sourcePath,
      })
    }
  }

  return sourceFileMap
}

const deriveFileState = ({
  currentHash,
  installedHash,
  ownershipState,
}: {
  currentHash?: string
  installedHash: string
  ownershipState: TConsumerOwnershipState
}): TStatusFileState => {
  if (!currentHash) return STATUS_FILE_STATE__MISSING
  if (ownershipState === CONSUMER_OWNERSHIP_STATE__EJECTED) return CONSUMER_OWNERSHIP_STATE__EJECTED
  if (currentHash !== installedHash) return CONSUMER_OWNERSHIP_STATE__LOCALLY_MODIFIED
  if (ownershipState === CONSUMER_OWNERSHIP_STATE__CONSUMER_OWNED_SUPPORT) {
    return CONSUMER_OWNERSHIP_STATE__CONSUMER_OWNED_SUPPORT
  }
  if (ownershipState === CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED) return CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED

  return CONSUMER_OWNERSHIP_STATE__UNKNOWN
}

const deriveSourceState = ({
  currentSourceHash,
  sourceHash,
}: {
  currentSourceHash?: string
  sourceHash: string
}): TStatusSourceState => {
  if (!currentSourceHash) return STATUS_SOURCE_STATE__UNKNOWN

  return currentSourceHash === sourceHash ? STATUS_SOURCE_STATE__UP_TO_DATE : STATUS_SOURCE_STATE__SOURCE_CHANGED
}

const deriveItemFileState = (files: readonly z.infer<typeof statusFileSchema>[]): TStatusFileState => {
  if (files.some((file) => file.state === STATUS_FILE_STATE__MISSING)) return STATUS_FILE_STATE__MISSING
  if (files.some((file) => file.state === CONSUMER_OWNERSHIP_STATE__LOCALLY_MODIFIED)) {
    return CONSUMER_OWNERSHIP_STATE__LOCALLY_MODIFIED
  }
  if (files.some((file) => file.state === CONSUMER_OWNERSHIP_STATE__UNKNOWN)) return CONSUMER_OWNERSHIP_STATE__UNKNOWN
  if (files.length > 0 && files.every((file) => file.state === CONSUMER_OWNERSHIP_STATE__EJECTED)) {
    return CONSUMER_OWNERSHIP_STATE__EJECTED
  }
  if (files.some((file) => file.state === CONSUMER_OWNERSHIP_STATE__CONSUMER_OWNED_SUPPORT)) {
    return CONSUMER_OWNERSHIP_STATE__CONSUMER_OWNED_SUPPORT
  }

  return CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED
}

const deriveItemSourceState = (files: readonly z.infer<typeof statusFileSchema>[]): TStatusSourceState => {
  if (files.some((file) => file.sourceState === STATUS_SOURCE_STATE__SOURCE_CHANGED)) {
    return STATUS_SOURCE_STATE__SOURCE_CHANGED
  }
  if (files.some((file) => file.sourceState === STATUS_SOURCE_STATE__UNKNOWN)) return STATUS_SOURCE_STATE__UNKNOWN

  return STATUS_SOURCE_STATE__UP_TO_DATE
}

const createStatusFile = async ({
  consumerRoot,
  file,
  itemName,
  sourceFileMap,
}: {
  consumerRoot: string
  file: TConsumerLockfile["items"][string]["files"][number]
  itemName: string
  sourceFileMap: Map<string, TStatusSourceFile>
}): Promise<TStatusFile> => {
  const absoluteTargetPath = path.resolve(consumerRoot, file.path)
  const currentHash = existsSync(absoluteTargetPath)
    ? createContentHash(await fs.readFile(absoluteTargetPath))
    : undefined
  const sourceFile = sourceFileMap.get(createSourceFileKey({ itemName, path: file.path }))
  const currentSourceHash = sourceFile?.hash

  return statusFileSchema.parse({
    currentHash,
    currentSourceHash,
    installedHash: file.installedHash,
    itemName,
    path: file.path,
    sourceHash: file.sourceHash,
    sourcePath: sourceFile?.sourcePath,
    sourceState: deriveSourceState({ currentSourceHash, sourceHash: file.sourceHash }),
    state: deriveFileState({
      currentHash,
      installedHash: file.installedHash,
      ownershipState: file.ownershipState,
    }),
    targetRole: file.targetRole,
  })
}

export const createStatusReport = async ({
  cwd,
  itemName,
  registrySourcePath,
}: TCreateStatusReportOptions): Promise<TStatusReport> => {
  const configPath = path.join(cwd, AMINO_UI_CONFIG_FILE_NAME)
  const lockfilePath = path.join(cwd, AMINO_UI_LOCK_FILE_NAME)
  const configPlan = await readConsumerConfigForStatus(cwd)
  const lockfilePlan = await readConsumerLockfileForStatus(cwd)
  const allLockfileItemNames = Object.keys(lockfilePlan.lockfileData.items)
  const requestedItems = itemName ? [itemName] : allLockfileItemNames
  const findings: TStatusFinding[] = [...configPlan.findings, ...lockfilePlan.findings]
  let registrySourceStatus: "loaded" | "unavailable" | "not-requested" =
    requestedItems.length > 0 ? "unavailable" : "not-requested"
  let resolvedRegistrySourcePath = registrySourcePath ? path.resolve(registrySourcePath) : undefined
  let registrySourceIdentity: string | undefined
  let sourceFileMap = new Map<string, TStatusSourceFile>()

  if (requestedItems.length > 0) {
    try {
      const registryReadResult = await readStatusRegistrySource(
        registrySourcePath ?? resolveDefaultStatusRegistrySourcePath(requestedItems),
      )

      resolvedRegistrySourcePath = registryReadResult.registrySourcePath
      registrySourceIdentity = registryReadResult.registrySource.sourceIdentity
      sourceFileMap = await createRegistrySourceFileMap({
        config: configPlan.config,
        registrySource: registryReadResult.registrySource,
        sourceRoot: registryReadResult.sourceRoot,
      })
      registrySourceStatus = "loaded"
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown registry source error."

      findings.push({
        code: STATUS_FINDING__REGISTRY_SOURCE_UNAVAILABLE,
        message: `Local registry source could not be loaded. Source freshness will be unknown. ${message}`,
        severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
      })
    }
  }

  const items: TStatusItem[] = []

  for (const requestedItemName of requestedItems) {
    const lockfileItem = lockfilePlan.lockfileData.items[requestedItemName]

    if (!lockfileItem) {
      findings.push({
        code: STATUS_FINDING__LOCKFILE_ITEM_MISSING,
        itemName: requestedItemName,
        message: `Registry item "${requestedItemName}" is not recorded in ${AMINO_UI_LOCK_FILE_NAME}.`,
        severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
      })
      continue
    }

    const files: TStatusFile[] = []

    for (const file of lockfileItem.files) {
      files.push(
        await createStatusFile({
          consumerRoot: cwd,
          file,
          itemName: requestedItemName,
          sourceFileMap,
        }),
      )
    }

    items.push(
      statusItemSchema.parse({
        fileCount: files.length,
        files,
        name: lockfileItem.name,
        sourceIdentity: lockfileItem.sourceIdentity,
        sourceState: deriveItemSourceState(files),
        state: deriveItemFileState(files),
      }),
    )
  }

  const files = items.flatMap((item) => item.files)
  const fileStates = createEmptyRecord(STATUS_FILE_STATES)
  const sourceStates = createEmptyRecord(STATUS_SOURCE_STATES)
  const dependencyStates: Record<string, number> = {}

  files.forEach((file) => {
    fileStates[file.state] += 1
    sourceStates[file.sourceState] += 1
  })
  lockfilePlan.lockfileData.dependencies.forEach((dependency) => {
    dependencyStates[dependency.status] = (dependencyStates[dependency.status] ?? 0) + 1
  })

  return statusReportSchema.parse({
    config: {
      path: configPath,
      status: configPlan.status,
    },
    cwd,
    dependencies: lockfilePlan.lockfileData.dependencies,
    files,
    findings,
    items,
    lockfile: {
      itemCount: allLockfileItemNames.length,
      path: lockfilePath,
      status: lockfilePlan.status,
    },
    registrySource: {
      path: resolvedRegistrySourcePath,
      sourceIdentity: registrySourceIdentity,
      status: registrySourceStatus,
    },
    requestedItems,
    summary: {
      dependencyStates,
      fileCount: files.length,
      fileStates,
      itemCount: items.length,
      sourceStates,
    },
  })
}
