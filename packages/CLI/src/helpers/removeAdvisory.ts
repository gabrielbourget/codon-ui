import crypto from "crypto"
import { existsSync, promises as fs } from "fs"
import path from "path"

import { z } from "zod"

import {
  AMINO_UI_LOCK_FILE_NAME,
  consumerLockfileDependencySchema,
  consumerLockfileSchema,
  consumerTargetRoleSchema,
  type TConsumerLockfile,
} from "./consumerContract"
import { INSTALL_PLAN_FINDING_SEVERITIES, localRegistrySourceSchema, type TLocalRegistryItem } from "./installPlan"
import {
  REMOVE_TARGET__FILE_AND_LOCKFILE,
  REMOVE_TARGET__LOCKFILE_ONLY,
  REMOVE_TARGET__NONE,
  REMOVE_TARGETS,
} from "./removeConstants"
import { CLI_PROJECT_RESOURCE_STATUSES, CLI_REGISTRY_SOURCE_STATUSES } from "./reportConstants"
import { createStatusReport, type TStatusReport } from "./status"

const REMOVE_ADVISORY_SCHEMA_VERSION = 1

const REMOVE_ADVISORY_ITEM_STATE__REMOVE_CANDIDATE = "remove-candidate"
const REMOVE_ADVISORY_ITEM_STATE__LOCKFILE_CLEANUP_CANDIDATE = "lockfile-cleanup-candidate"
const REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED = "review-required"
const REMOVE_ADVISORY_ITEM_STATE__UNAVAILABLE = "unavailable"

const REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE = "remove-candidate"
const REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE = "lockfile-cleanup-candidate"
const REMOVE_ADVISORY_ACTION__REVIEW_SUPPORT_FILE = "review-support-file"
const REMOVE_ADVISORY_ACTION__REVIEW_SHARED_FILE = "review-shared-file"
const REMOVE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE = "preserve-local-change"
const REMOVE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT = "preserve-consumer-owned-support"
const REMOVE_ADVISORY_ACTION__PRESERVE_UNKNOWN = "preserve-unknown"
const REMOVE_ADVISORY_ACTION__PRESERVE_EJECTED = "preserve-ejected"

const REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__CLEANUP_CANDIDATE = "cleanup-candidate"
const REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__STILL_REQUIRED = "still-required"
const REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__UNKNOWN = "unknown"

const REMOVE_ADVISORY_ITEM_STATES = [
  REMOVE_ADVISORY_ITEM_STATE__REMOVE_CANDIDATE,
  REMOVE_ADVISORY_ITEM_STATE__LOCKFILE_CLEANUP_CANDIDATE,
  REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED,
  REMOVE_ADVISORY_ITEM_STATE__UNAVAILABLE,
] as const

const REMOVE_ADVISORY_ACTIONS = [
  REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE,
  REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE,
  REMOVE_ADVISORY_ACTION__REVIEW_SUPPORT_FILE,
  REMOVE_ADVISORY_ACTION__REVIEW_SHARED_FILE,
  REMOVE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE,
  REMOVE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT,
  REMOVE_ADVISORY_ACTION__PRESERVE_UNKNOWN,
  REMOVE_ADVISORY_ACTION__PRESERVE_EJECTED,
] as const

const REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTIONS = [
  REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__CLEANUP_CANDIDATE,
  REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__STILL_REQUIRED,
  REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__UNKNOWN,
] as const

const removeAdvisoryFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    message: z.string().min(1),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const removeAdvisoryFileSchema = z
  .object({
    action: z.enum(REMOVE_ADVISORY_ACTIONS),
    blocksAutomaticRemove: z.boolean(),
    currentHash: z.string().min(1).optional(),
    currentSourceHash: z.string().min(1).optional(),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    preservationRequired: z.boolean(),
    removalTarget: z.enum(REMOVE_TARGETS),
    reviewRequired: z.boolean(),
    sharedReferenceCount: z.number().int().nonnegative(),
    sourceHash: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    sourceState: z.string().min(1),
    state: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

const removeAdvisoryOrphanItemSchema = z
  .object({
    dependencyDepth: z.number().int().positive(),
    dependedOnBy: z.array(z.string().min(1)).default([]),
    files: z.array(removeAdvisoryFileSchema).default([]),
    itemRemoveState: z.enum(REMOVE_ADVISORY_ITEM_STATES),
    name: z.string().min(1),
    registryDependencies: z.array(z.string().min(1)).default([]),
  })
  .strict()

const removeAdvisoryOrphanCleanupSchema = z
  .object({
    automaticBlockerCount: z.number().int().nonnegative(),
    candidateFileCount: z.number().int().nonnegative(),
    candidateItemCount: z.number().int().nonnegative(),
    enabled: z.boolean(),
    itemCount: z.number().int().nonnegative(),
    items: z.array(removeAdvisoryOrphanItemSchema).default([]),
    lockfileCleanupCandidateCount: z.number().int().nonnegative(),
    preservationRequiredCount: z.number().int().nonnegative(),
    reviewRequiredCount: z.number().int().nonnegative(),
    sharedReferenceCount: z.number().int().nonnegative(),
  })
  .strict()

const removeAdvisoryDependencyCleanupDependencySchema = consumerLockfileDependencySchema
  .omit({ action: true })
  .extend({
    action: z.enum(REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTIONS),
    cleanupItemNames: z.array(z.string().min(1)).default([]),
    remainingItemNames: z.array(z.string().min(1)).default([]),
  })
  .strict()

export const removeAdvisoryDependencyCleanupSchema = z
  .object({
    candidateCount: z.number().int().nonnegative(),
    dependencies: z.array(removeAdvisoryDependencyCleanupDependencySchema).default([]),
    enabled: z.boolean(),
    stillRequiredCount: z.number().int().nonnegative(),
    unknownCount: z.number().int().nonnegative(),
  })
  .strict()

export const removeAdvisoryReportSchema = z
  .object({
    advisory: z.literal(true),
    cwd: z.string().min(1),
    dependencyCleanup: removeAdvisoryDependencyCleanupSchema,
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    effects: z
      .object({
        installsDependencies: z.literal(false),
        writesConfig: z.literal(false),
        writesFiles: z.literal(false),
        writesLockfile: z.literal(false),
      })
      .strict(),
    files: z.array(removeAdvisoryFileSchema).default([]),
    findings: z.array(removeAdvisoryFindingSchema).default([]),
    item: z
      .object({
        fileCount: z.number().int().nonnegative(),
        name: z.string().min(1),
        sourceIdentity: z.string().min(1),
        sourceState: z.string().min(1),
        state: z.string().min(1),
      })
      .strict()
      .optional(),
    itemName: z.string().min(1),
    itemRemoveState: z.enum(REMOVE_ADVISORY_ITEM_STATES),
    orphanCleanup: removeAdvisoryOrphanCleanupSchema,
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(CLI_REGISTRY_SOURCE_STATUSES),
      })
      .strict(),
    schemaVersion: z.literal(REMOVE_ADVISORY_SCHEMA_VERSION).default(REMOVE_ADVISORY_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
        lockfile: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
      })
      .strict(),
    summary: z
      .object({
        actionStates: z.record(z.enum(REMOVE_ADVISORY_ACTIONS), z.number().int().nonnegative()),
        automaticBlockerCount: z.number().int().nonnegative(),
        dependencyStates: z.record(z.string().min(1), z.number().int().nonnegative()),
        fileCount: z.number().int().nonnegative(),
        lockfileCleanupCandidateCount: z.number().int().nonnegative(),
        preservationRequiredCount: z.number().int().nonnegative(),
        removableFileCount: z.number().int().nonnegative(),
        reviewRequiredCount: z.number().int().nonnegative(),
        sharedReferenceCount: z.number().int().nonnegative(),
        supportReviewCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type TRemoveAdvisoryFile = z.infer<typeof removeAdvisoryFileSchema>
export type TRemoveAdvisoryReport = z.infer<typeof removeAdvisoryReportSchema>

export type TCreateRemoveAdvisoryReportOptions = {
  cwd: string
  includeOrphans?: boolean
  itemName: string
  registrySourcePath?: string
}

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const createContentHash = (content: string | Buffer) =>
  `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`

const createEmptyLockfileData = () => consumerLockfileSchema.parse({})

const readConsumerLockfileForRemoveAdvisory = async (cwd: string): Promise<TConsumerLockfile> => {
  const lockfilePath = path.join(cwd, AMINO_UI_LOCK_FILE_NAME)

  if (!existsSync(lockfilePath)) return createEmptyLockfileData()

  try {
    return consumerLockfileSchema.parse(JSON.parse(await fs.readFile(lockfilePath, "utf8")))
  } catch {
    return createEmptyLockfileData()
  }
}

const readRegistrySourceForDependencyCleanup = async (registrySourcePath?: string) => {
  if (!registrySourcePath) return undefined

  try {
    return localRegistrySourceSchema.parse(JSON.parse(await fs.readFile(registrySourcePath, "utf8")))
  } catch {
    return undefined
  }
}

const createLockfilePathReferences = (lockfileData: TConsumerLockfile) => {
  const pathReferences = new Map<string, Set<string>>()

  Object.values(lockfileData.items).forEach((item) => {
    item.files.forEach((file) => {
      const itemReferences = pathReferences.get(file.path) ?? new Set<string>()

      itemReferences.add(item.name)
      pathReferences.set(file.path, itemReferences)
    })
  })

  return pathReferences
}

const getSharedReferenceCount = ({
  file,
  ignoredItemNames,
  pathReferences,
}: {
  file: Pick<TRemoveAdvisoryFile, "itemName" | "path"> | Pick<TStatusReport["files"][number], "itemName" | "path">
  ignoredItemNames?: ReadonlySet<string>
  pathReferences: ReadonlyMap<string, ReadonlySet<string>>
}) => {
  const itemReferences = pathReferences.get(file.path)

  if (!itemReferences) return 0

  const ignoredNames = ignoredItemNames ?? new Set([file.itemName])

  return [...itemReferences].filter((itemName) => !ignoredNames.has(itemName)).length
}

const resolveAction = ({
  file,
  sharedReferenceCount,
}: {
  file: TStatusReport["files"][number]
  sharedReferenceCount: number
}): (typeof REMOVE_ADVISORY_ACTIONS)[number] => {
  if (file.state === "locally-modified") return REMOVE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE
  if (file.state === "consumer-owned-support") return REMOVE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT
  if (file.state === "unknown") return REMOVE_ADVISORY_ACTION__PRESERVE_UNKNOWN
  if (file.state === "ejected") return REMOVE_ADVISORY_ACTION__PRESERVE_EJECTED
  if (sharedReferenceCount > 0) return REMOVE_ADVISORY_ACTION__REVIEW_SHARED_FILE
  if (file.targetRole !== "components") return REMOVE_ADVISORY_ACTION__REVIEW_SUPPORT_FILE
  if (file.state === "missing") return REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE

  return REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE
}

const resolveOrphanAction = ({
  file,
  sharedReferenceCount,
}: {
  file: Pick<TRemoveAdvisoryFile, "state">
  sharedReferenceCount: number
}): (typeof REMOVE_ADVISORY_ACTIONS)[number] => {
  if (file.state === "locally-modified") return REMOVE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE
  if (file.state === "consumer-owned-support") return REMOVE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT
  if (file.state === "unknown") return REMOVE_ADVISORY_ACTION__PRESERVE_UNKNOWN
  if (file.state === "ejected") return REMOVE_ADVISORY_ACTION__PRESERVE_EJECTED
  if (sharedReferenceCount > 0) return REMOVE_ADVISORY_ACTION__REVIEW_SHARED_FILE
  if (file.state === "missing") return REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE

  return REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE
}

const resolveRemovalTarget = (action: (typeof REMOVE_ADVISORY_ACTIONS)[number]) => {
  if (action === REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE) return REMOVE_TARGET__FILE_AND_LOCKFILE
  if (action === REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE) return REMOVE_TARGET__LOCKFILE_ONLY

  return REMOVE_TARGET__NONE
}

const resolvePreservationRequired = (action: (typeof REMOVE_ADVISORY_ACTIONS)[number]) =>
  action === REMOVE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE ||
  action === REMOVE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT ||
  action === REMOVE_ADVISORY_ACTION__PRESERVE_UNKNOWN ||
  action === REMOVE_ADVISORY_ACTION__PRESERVE_EJECTED

const resolveReviewRequired = (action: (typeof REMOVE_ADVISORY_ACTIONS)[number]) =>
  action !== REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE && action !== REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE

const isCleanupCandidateItemState = (itemRemoveState: (typeof REMOVE_ADVISORY_ITEM_STATES)[number]) =>
  itemRemoveState === REMOVE_ADVISORY_ITEM_STATE__REMOVE_CANDIDATE ||
  itemRemoveState === REMOVE_ADVISORY_ITEM_STATE__LOCKFILE_CLEANUP_CANDIDATE

const createRemoveAdvisoryFile = ({
  file,
  pathReferences,
}: {
  file: TStatusReport["files"][number]
  pathReferences: ReadonlyMap<string, ReadonlySet<string>>
}) => {
  const sharedReferenceCount = getSharedReferenceCount({ file, pathReferences })
  const action = resolveAction({ file, sharedReferenceCount })
  const reviewRequired = resolveReviewRequired(action)
  const preservationRequired = resolvePreservationRequired(action)

  return removeAdvisoryFileSchema.parse({
    action,
    blocksAutomaticRemove: reviewRequired,
    currentHash: file.currentHash,
    currentSourceHash: file.currentSourceHash,
    installedHash: file.installedHash,
    itemName: file.itemName,
    path: file.path,
    preservationRequired,
    removalTarget: resolveRemovalTarget(action),
    reviewRequired,
    sharedReferenceCount,
    sourceHash: file.sourceHash,
    sourcePath: file.sourcePath,
    sourceState: file.sourceState,
    state: file.state,
    targetRole: file.targetRole,
  })
}

const deriveOrphanFileState = ({
  currentHash,
  installedHash,
  ownershipState,
}: {
  currentHash?: string
  installedHash: string
  ownershipState: TConsumerLockfile["items"][string]["files"][number]["ownershipState"]
}) => {
  if (!currentHash) return "missing"
  if (ownershipState === "ejected") return "ejected"
  if (currentHash !== installedHash) return "locally-modified"
  if (ownershipState === "consumer-owned-support") return "consumer-owned-support"
  if (ownershipState === "registry-owned") return "registry-owned"

  return "unknown"
}

const createRemoveAdvisoryOrphanFile = async ({
  cleanupItemNames,
  cwd,
  file,
  itemName,
  pathReferences,
}: {
  cleanupItemNames: ReadonlySet<string>
  cwd: string
  file: TConsumerLockfile["items"][string]["files"][number]
  itemName: string
  pathReferences: ReadonlyMap<string, ReadonlySet<string>>
}) => {
  const absoluteTargetPath = path.resolve(cwd, file.path)
  const currentHash = existsSync(absoluteTargetPath)
    ? createContentHash(await fs.readFile(absoluteTargetPath))
    : undefined
  const state = deriveOrphanFileState({
    currentHash,
    installedHash: file.installedHash,
    ownershipState: file.ownershipState,
  })
  const sharedReferenceCount = getSharedReferenceCount({
    file: {
      itemName,
      path: file.path,
    },
    ignoredItemNames: cleanupItemNames,
    pathReferences,
  })
  const action = resolveOrphanAction({
    file: { state },
    sharedReferenceCount,
  })
  const reviewRequired = resolveReviewRequired(action)
  const preservationRequired = resolvePreservationRequired(action)

  return removeAdvisoryFileSchema.parse({
    action,
    blocksAutomaticRemove: reviewRequired,
    currentHash,
    installedHash: file.installedHash,
    itemName,
    path: file.path,
    preservationRequired,
    removalTarget: resolveRemovalTarget(action),
    reviewRequired,
    sharedReferenceCount,
    sourceHash: file.sourceHash,
    sourceState: "unknown",
    state,
    targetRole: file.targetRole,
  })
}

const resolveItemRemoveState = (files: readonly TRemoveAdvisoryFile[]) => {
  if (files.length === 0) return REMOVE_ADVISORY_ITEM_STATE__UNAVAILABLE
  if (files.some((file) => file.blocksAutomaticRemove)) return REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED
  if (files.some((file) => file.action === REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE)) {
    return REMOVE_ADVISORY_ITEM_STATE__REMOVE_CANDIDATE
  }
  if (files.some((file) => file.action === REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE)) {
    return REMOVE_ADVISORY_ITEM_STATE__LOCKFILE_CLEANUP_CANDIDATE
  }

  return REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED
}

const createDependentsByName = (lockfileData: TConsumerLockfile) => {
  const dependentsByName = new Map<string, Set<string>>()

  Object.values(lockfileData.items).forEach((item) => {
    item.registryDependencies.forEach((dependencyName) => {
      const dependents = dependentsByName.get(dependencyName) ?? new Set<string>()

      dependents.add(item.name)
      dependentsByName.set(dependencyName, dependents)
    })
  })

  return dependentsByName
}

const collectDependencyClosure = ({
  itemName,
  lockfileData,
}: {
  itemName: string
  lockfileData: TConsumerLockfile
}) => {
  const dependencyDepths = new Map<string, number>()
  const visited = new Set<string>()
  const stack = (lockfileData.items[itemName]?.registryDependencies ?? []).map((dependencyName) => ({
    depth: 1,
    name: dependencyName,
  }))

  while (stack.length > 0) {
    const next = stack.shift()

    if (!next) continue

    const existingDepth = dependencyDepths.get(next.name)

    if (!existingDepth || next.depth < existingDepth) {
      dependencyDepths.set(next.name, next.depth)
    }

    if (visited.has(next.name)) continue

    visited.add(next.name)

    const dependencyItem = lockfileData.items[next.name]

    if (!dependencyItem) continue

    dependencyItem.registryDependencies.forEach((dependencyName) => {
      stack.push({
        depth: next.depth + 1,
        name: dependencyName,
      })
    })
  }

  return dependencyDepths
}

const collectOrphanItemNames = ({ itemName, lockfileData }: { itemName: string; lockfileData: TConsumerLockfile }) => {
  const dependencyDepths = collectDependencyClosure({ itemName, lockfileData })
  const reachableDependencyNames = [...dependencyDepths.keys()].sort((left, right) => {
    const leftDepth = dependencyDepths.get(left) ?? 0
    const rightDepth = dependencyDepths.get(right) ?? 0

    if (leftDepth !== rightDepth) return leftDepth - rightDepth

    return left.localeCompare(right)
  })
  const dependentsByName = createDependentsByName(lockfileData)
  const plannedRemovedItemNames = new Set([itemName])
  const orphanItemNames: string[] = []
  let changed = true

  while (changed) {
    changed = false

    reachableDependencyNames.forEach((dependencyName) => {
      if (plannedRemovedItemNames.has(dependencyName) || !lockfileData.items[dependencyName]) return

      const activeDependents = [...(dependentsByName.get(dependencyName) ?? new Set<string>())].filter(
        (dependentName) => !plannedRemovedItemNames.has(dependentName),
      )

      if (activeDependents.length > 0) return

      plannedRemovedItemNames.add(dependencyName)
      orphanItemNames.push(dependencyName)
      changed = true
    })
  }

  return {
    dependencyDepths,
    orphanItemNames,
  }
}

const createDisabledOrphanCleanup = () =>
  removeAdvisoryOrphanCleanupSchema.parse({
    automaticBlockerCount: 0,
    candidateFileCount: 0,
    candidateItemCount: 0,
    enabled: false,
    itemCount: 0,
    items: [],
    lockfileCleanupCandidateCount: 0,
    preservationRequiredCount: 0,
    reviewRequiredCount: 0,
    sharedReferenceCount: 0,
  })

const createRemoveAdvisoryOrphanCleanup = async ({
  cwd,
  includeOrphans,
  itemName,
  lockfileData,
  pathReferences,
  requestedItemRemoveState,
}: {
  cwd: string
  includeOrphans: boolean
  itemName: string
  lockfileData: TConsumerLockfile
  pathReferences: ReadonlyMap<string, ReadonlySet<string>>
  requestedItemRemoveState: (typeof REMOVE_ADVISORY_ITEM_STATES)[number]
}) => {
  if (!includeOrphans) return createDisabledOrphanCleanup()

  const { dependencyDepths, orphanItemNames } = collectOrphanItemNames({
    itemName,
    lockfileData,
  })
  const cleanupItemNames = new Set([itemName, ...orphanItemNames])
  const dependentsByName = createDependentsByName(lockfileData)
  const items = await Promise.all(
    orphanItemNames.map(async (orphanItemName) => {
      const orphanItem = lockfileData.items[orphanItemName]
      const files = await Promise.all(
        orphanItem.files.map((file) =>
          createRemoveAdvisoryOrphanFile({
            cleanupItemNames,
            cwd,
            file,
            itemName: orphanItem.name,
            pathReferences,
          }),
        ),
      )

      return removeAdvisoryOrphanItemSchema.parse({
        dependencyDepth: dependencyDepths.get(orphanItemName) ?? 1,
        dependedOnBy: [...(dependentsByName.get(orphanItemName) ?? new Set<string>())].sort(),
        files,
        itemRemoveState:
          requestedItemRemoveState === REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED
            ? REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED
            : resolveItemRemoveState(files),
        name: orphanItem.name,
        registryDependencies: orphanItem.registryDependencies,
      })
    }),
  )
  const files = items.flatMap((item) => item.files)

  return removeAdvisoryOrphanCleanupSchema.parse({
    automaticBlockerCount: files.filter((file) => file.blocksAutomaticRemove).length,
    candidateFileCount: files.filter((file) => file.action === REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE).length,
    candidateItemCount: items.filter(
      (item) =>
        item.itemRemoveState === REMOVE_ADVISORY_ITEM_STATE__REMOVE_CANDIDATE ||
        item.itemRemoveState === REMOVE_ADVISORY_ITEM_STATE__LOCKFILE_CLEANUP_CANDIDATE,
    ).length,
    enabled: true,
    itemCount: items.length,
    items,
    lockfileCleanupCandidateCount: files.filter(
      (file) => file.action === REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE,
    ).length,
    preservationRequiredCount: files.filter((file) => file.preservationRequired).length,
    reviewRequiredCount: files.filter((file) => file.reviewRequired).length,
    sharedReferenceCount: files.filter((file) => file.sharedReferenceCount > 0).length,
  })
}

type TRegistryDependencyReference = {
  itemNames: Set<string>
}

const createDependencyKey = ({ kind, name }: { kind: string; name: string }) => `${kind}:${name}`

const getRegistryItemDependencies = (item: TLocalRegistryItem) => [
  ...Object.keys(item.peerDependencies).map((name) => ({ kind: "peer", name })),
  ...Object.keys(item.runtimeDependencies).map((name) => ({ kind: "runtime", name })),
  ...Object.keys(item.devDependencies).map((name) => ({ kind: "dev", name })),
]

const collectDependencyReferencesByKey = ({
  itemNames,
  registryItemsByName,
}: {
  itemNames: readonly string[]
  registryItemsByName: ReadonlyMap<string, TLocalRegistryItem>
}) => {
  const referencesByKey = new Map<string, TRegistryDependencyReference>()

  itemNames.forEach((itemName) => {
    const registryItem = registryItemsByName.get(itemName)

    if (!registryItem) return

    getRegistryItemDependencies(registryItem).forEach((dependency) => {
      const key = createDependencyKey(dependency)
      const references = referencesByKey.get(key) ?? { itemNames: new Set<string>() }

      references.itemNames.add(itemName)
      referencesByKey.set(key, references)
    })
  })

  return referencesByKey
}

const createDisabledDependencyCleanup = () =>
  removeAdvisoryDependencyCleanupSchema.parse({
    candidateCount: 0,
    dependencies: [],
    enabled: false,
    stillRequiredCount: 0,
    unknownCount: 0,
  })

const createRemoveAdvisoryDependencyCleanup = async ({
  includeOrphans,
  itemName,
  itemRemoveState,
  lockfileData,
  orphanCleanup,
  registrySourcePath,
}: {
  includeOrphans: boolean
  itemName: string
  itemRemoveState: (typeof REMOVE_ADVISORY_ITEM_STATES)[number]
  lockfileData: TConsumerLockfile
  orphanCleanup: z.infer<typeof removeAdvisoryOrphanCleanupSchema>
  registrySourcePath?: string
}) => {
  if (!includeOrphans) return createDisabledDependencyCleanup()

  const registrySource = await readRegistrySourceForDependencyCleanup(registrySourcePath)

  if (!registrySource) return createDisabledDependencyCleanup()

  const cleanupItemNames = [
    ...(isCleanupCandidateItemState(itemRemoveState) ? [itemName] : []),
    ...orphanCleanup.items.filter((item) => isCleanupCandidateItemState(item.itemRemoveState)).map((item) => item.name),
  ]

  if (cleanupItemNames.length === 0) return createDisabledDependencyCleanup()

  const cleanupItemNamesSet = new Set(cleanupItemNames)
  const registryItemsByName = new Map(registrySource.items.map((item) => [item.name, item]))
  const remainingItemNames = Object.keys(lockfileData.items).filter((name) => !cleanupItemNamesSet.has(name))
  const cleanupReferencesByKey = collectDependencyReferencesByKey({
    itemNames: cleanupItemNames,
    registryItemsByName,
  })
  const remainingReferencesByKey = collectDependencyReferencesByKey({
    itemNames: remainingItemNames,
    registryItemsByName,
  })
  const dependencies = lockfileData.dependencies
    .filter((dependency) => cleanupReferencesByKey.has(createDependencyKey(dependency)))
    .map((dependency) => {
      const key = createDependencyKey(dependency)
      const cleanupReferences = cleanupReferencesByKey.get(key)
      const remainingReferences = remainingReferencesByKey.get(key)
      const action =
        remainingReferences && remainingReferences.itemNames.size > 0
          ? REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__STILL_REQUIRED
          : REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__CLEANUP_CANDIDATE

      return removeAdvisoryDependencyCleanupDependencySchema.parse({
        ...dependency,
        action,
        cleanupItemNames: [...(cleanupReferences?.itemNames ?? new Set<string>())].sort(),
        remainingItemNames: [...(remainingReferences?.itemNames ?? new Set<string>())].sort(),
      })
    })

  return removeAdvisoryDependencyCleanupSchema.parse({
    candidateCount: dependencies.filter(
      (dependency) => dependency.action === REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__CLEANUP_CANDIDATE,
    ).length,
    dependencies,
    enabled: true,
    stillRequiredCount: dependencies.filter(
      (dependency) => dependency.action === REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__STILL_REQUIRED,
    ).length,
    unknownCount: dependencies.filter(
      (dependency) => dependency.action === REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__UNKNOWN,
    ).length,
  })
}

export const createRemoveAdvisoryReport = async ({
  cwd,
  includeOrphans = false,
  itemName,
  registrySourcePath,
}: TCreateRemoveAdvisoryReportOptions): Promise<TRemoveAdvisoryReport> => {
  const statusReport = await createStatusReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const lockfileData = await readConsumerLockfileForRemoveAdvisory(cwd)
  const pathReferences = createLockfilePathReferences(lockfileData)
  const files = statusReport.files.map((file) =>
    createRemoveAdvisoryFile({
      file,
      pathReferences,
    }),
  )
  const actionStates = createEmptyRecord(REMOVE_ADVISORY_ACTIONS)
  const dependencyStates: Record<string, number> = {}
  const statusItem = statusReport.items.find((item) => item.name === itemName)
  const item = statusItem
    ? {
        fileCount: statusItem.fileCount,
        name: statusItem.name,
        sourceIdentity: statusItem.sourceIdentity,
        sourceState: statusItem.sourceState,
        state: statusItem.state,
      }
    : undefined
  const itemRemoveState = resolveItemRemoveState(files)
  const orphanCleanup = await createRemoveAdvisoryOrphanCleanup({
    cwd,
    includeOrphans,
    itemName,
    lockfileData,
    pathReferences,
    requestedItemRemoveState: itemRemoveState,
  })
  const dependencyCleanup = await createRemoveAdvisoryDependencyCleanup({
    includeOrphans,
    itemName,
    itemRemoveState,
    lockfileData,
    orphanCleanup,
    registrySourcePath: statusReport.registrySource.path,
  })

  files.forEach((file) => {
    actionStates[file.action] += 1
  })
  statusReport.dependencies.forEach((dependency) => {
    dependencyStates[dependency.status] = (dependencyStates[dependency.status] ?? 0) + 1
  })

  return removeAdvisoryReportSchema.parse({
    advisory: true,
    cwd,
    dependencyCleanup,
    dependencies: statusReport.dependencies,
    effects: {
      installsDependencies: false,
      writesConfig: false,
      writesFiles: false,
      writesLockfile: false,
    },
    files,
    findings: statusReport.findings,
    item,
    itemName,
    itemRemoveState,
    orphanCleanup,
    registrySource: statusReport.registrySource,
    status: {
      config: statusReport.config.status,
      lockfile: statusReport.lockfile.status,
    },
    summary: {
      actionStates,
      automaticBlockerCount: files.filter((file) => file.blocksAutomaticRemove).length,
      dependencyStates,
      fileCount: files.length,
      lockfileCleanupCandidateCount: files.filter(
        (file) => file.action === REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE,
      ).length,
      preservationRequiredCount: files.filter((file) => file.preservationRequired).length,
      removableFileCount: files.filter((file) => file.action === REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE).length,
      reviewRequiredCount: files.filter((file) => file.reviewRequired).length,
      sharedReferenceCount: files.filter((file) => file.sharedReferenceCount > 0).length,
      supportReviewCount: files.filter((file) => file.action === REMOVE_ADVISORY_ACTION__REVIEW_SUPPORT_FILE).length,
    },
  })
}
