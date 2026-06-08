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
import { INSTALL_PLAN_FINDING_SEVERITY__ERROR, INSTALL_PLAN_FINDING_SEVERITIES } from "./installPlan"
import { createRemoveDryRunReport, type TRemoveDryRunFile, type TRemoveDryRunReport } from "./removeDryRun"

const REMOVE_STRICT_SCHEMA_VERSION = 1

const REMOVE_STRICT_ITEM_STATE__REMOVED = "removed"
const REMOVE_STRICT_ITEM_STATE__BLOCKED = "blocked"
const REMOVE_STRICT_ITEM_STATE__UNAVAILABLE = "unavailable"

const REMOVE_STRICT_FILE_ACTION__REMOVED_FILE_AND_LOCKFILE = "removed-file-and-lockfile"
const REMOVE_STRICT_FILE_ACTION__REMOVED_LOCKFILE_RECORD = "removed-lockfile-record"
const REMOVE_STRICT_FILE_ACTION__BLOCKED = "blocked"
const REMOVE_STRICT_FILE_ACTION__SKIPPED = "skipped"

const REMOVE_STRICT_BLOCKER_KIND__FILE = "file"
const REMOVE_STRICT_BLOCKER_KIND__ITEM = "item"
const REMOVE_STRICT_BLOCKER_KIND__PROJECT = "project"

const REMOVE_STRICT_ITEM_STATES = [
  REMOVE_STRICT_ITEM_STATE__REMOVED,
  REMOVE_STRICT_ITEM_STATE__BLOCKED,
  REMOVE_STRICT_ITEM_STATE__UNAVAILABLE,
] as const

const REMOVE_STRICT_FILE_ACTIONS = [
  REMOVE_STRICT_FILE_ACTION__REMOVED_FILE_AND_LOCKFILE,
  REMOVE_STRICT_FILE_ACTION__REMOVED_LOCKFILE_RECORD,
  REMOVE_STRICT_FILE_ACTION__BLOCKED,
  REMOVE_STRICT_FILE_ACTION__SKIPPED,
] as const

const REMOVE_STRICT_BLOCKER_KINDS = [
  REMOVE_STRICT_BLOCKER_KIND__FILE,
  REMOVE_STRICT_BLOCKER_KIND__ITEM,
  REMOVE_STRICT_BLOCKER_KIND__PROJECT,
] as const

const removeStrictFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    kind: z.enum(REMOVE_STRICT_BLOCKER_KINDS).optional(),
    message: z.string().min(1),
    path: z.string().min(1).optional(),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const removeStrictBlockerSchema = removeStrictFindingSchema
  .extend({
    kind: z.enum(REMOVE_STRICT_BLOCKER_KINDS),
    path: z.string().min(1).optional(),
  })
  .strict()

const removeStrictFileSchema = z
  .object({
    dryRunAction: z.string().min(1),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    removalTarget: z.enum(["file-and-lockfile", "lockfile-only", "none"]),
    removedFile: z.boolean(),
    removedLockfileRecord: z.boolean(),
    strictAction: z.enum(REMOVE_STRICT_FILE_ACTIONS),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

export const removeStrictReportSchema = z
  .object({
    applied: z.boolean(),
    blockers: z.array(removeStrictBlockerSchema).default([]),
    cwd: z.string().min(1),
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    effects: z
      .object({
        dependencies: z
          .object({
            removedCount: z.literal(0),
            status: z.literal("not-written"),
          })
          .strict(),
        files: z
          .object({
            deletedCount: z.number().int().nonnegative(),
            plannedDeleteCount: z.number().int().nonnegative(),
            plannedLockfileRecordRemovalCount: z.number().int().nonnegative(),
            preservedCount: z.number().int().nonnegative(),
          })
          .strict(),
        installsDependencies: z.literal(false),
        lockfile: z
          .object({
            plannedItem: z.string().min(1).optional(),
            removedFileRecordCount: z.number().int().nonnegative(),
            removedItem: z.boolean(),
            status: z.enum(["written", "blocked", "not-written"]),
          })
          .strict(),
        writesConfig: z.literal(false),
        writesFiles: z.boolean(),
        writesLockfile: z.boolean(),
      })
      .strict(),
    files: z.array(removeStrictFileSchema).default([]),
    findings: z.array(removeStrictFindingSchema).default([]),
    itemName: z.string().min(1),
    itemRemoveState: z.enum(REMOVE_STRICT_ITEM_STATES),
    lockfileData: consumerLockfileSchema,
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(["loaded", "unavailable", "not-requested"]),
      })
      .strict(),
    schemaVersion: z.literal(REMOVE_STRICT_SCHEMA_VERSION).default(REMOVE_STRICT_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(["present", "missing", "invalid"]),
        lockfile: z.enum(["present", "missing", "invalid"]),
      })
      .strict(),
  })
  .strict()

export type TRemoveStrictReport = z.infer<typeof removeStrictReportSchema>

export type TCreateRemoveStrictReportOptions = {
  cwd: string
  itemName: string
  registrySourcePath?: string
}

type TRemoveStrictBlocker = z.infer<typeof removeStrictBlockerSchema>
type TRemoveStrictFile = z.infer<typeof removeStrictFileSchema>
type TCreateRemoveStrictBlockerOptions = Omit<TRemoveStrictBlocker, "severity"> & {
  severity?: TRemoveStrictBlocker["severity"]
}

const createContentHash = (content: string | Buffer) =>
  `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`

const createRemoveStrictBlocker = ({
  code,
  itemName,
  kind,
  message,
  path,
  severity = INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  sourcePath,
  targetPath,
}: TCreateRemoveStrictBlockerOptions) =>
  removeStrictBlockerSchema.parse({
    code,
    itemName,
    kind,
    message,
    path,
    severity,
    sourcePath,
    targetPath,
  })

const createFallbackLockfile = () => consumerLockfileSchema.parse({})

const readConsumerLockfileForStrictRemove = async (
  cwd: string,
): Promise<{
  findings: TRemoveStrictBlocker[]
  lockfileData: TConsumerLockfile
}> => {
  const lockfilePath = path.join(cwd, AMINO_UI_LOCK_FILE_NAME)

  if (!existsSync(lockfilePath)) {
    return {
      findings: [
        createRemoveStrictBlocker({
          code: "strict-remove-lockfile-missing",
          kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
          message: `${AMINO_UI_LOCK_FILE_NAME} is missing. Strict remove requires a valid Amino lockfile.`,
          targetPath: AMINO_UI_LOCK_FILE_NAME,
        }),
      ],
      lockfileData: createFallbackLockfile(),
    }
  }

  try {
    return {
      findings: [],
      lockfileData: consumerLockfileSchema.parse(JSON.parse(await fs.readFile(lockfilePath, "utf8"))),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown lockfile parse error."

    return {
      findings: [
        createRemoveStrictBlocker({
          code: "strict-remove-lockfile-invalid",
          kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
          message: `${AMINO_UI_LOCK_FILE_NAME} could not be read as an Amino lockfile. ${message}`,
          targetPath: AMINO_UI_LOCK_FILE_NAME,
        }),
      ],
      lockfileData: createFallbackLockfile(),
    }
  }
}

const isInsideDirectory = ({ directoryPath, filePath }: { directoryPath: string; filePath: string }) => {
  const relativePath = path.relative(directoryPath, filePath)

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
}

const getAbsoluteTargetPath = ({ cwd, targetPath }: { cwd: string; targetPath: string }) =>
  path.resolve(cwd, targetPath)

const createDryRunBlockers = (dryRunReport: TRemoveDryRunReport) =>
  dryRunReport.blockers.map((blocker) =>
    createRemoveStrictBlocker({
      code: "strict-remove-dry-run-blocker",
      itemName: blocker.itemName,
      kind: blocker.kind,
      message: `Strict remove is blocked by dry-run blocker "${blocker.code}": ${blocker.message}`,
      path: blocker.path,
      sourcePath: blocker.sourcePath,
      targetPath: blocker.targetPath,
    }),
  )

const createProjectStateBlockers = (dryRunReport: TRemoveDryRunReport) => {
  const blockers: TRemoveStrictBlocker[] = []

  if (dryRunReport.status.config !== "present") {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-config-blocker",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
        message: `Strict remove requires a present consumer config. Current config status is "${dryRunReport.status.config}".`,
      }),
    )
  }

  if (dryRunReport.status.lockfile !== "present") {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-lockfile-status-blocker",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
        message: `Strict remove requires a present Amino lockfile. Current lockfile status is "${dryRunReport.status.lockfile}".`,
      }),
    )
  }

  if (dryRunReport.itemRemoveState === "unavailable") {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-item-unavailable",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict remove cannot continue because item "${dryRunReport.itemName}" is unavailable.`,
      }),
    )
  } else if (dryRunReport.itemRemoveState !== "would-remove") {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-item-state-blocker",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict remove requires itemRemoveState "would-remove"; received "${dryRunReport.itemRemoveState}".`,
      }),
    )
  }

  if (dryRunReport.wouldEffects.lockfile.status !== "would-write") {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-lockfile-effect-blocker",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict remove requires a would-write lockfile dry-run effect; received "${dryRunReport.wouldEffects.lockfile.status}".`,
      }),
    )
  }

  return blockers
}

const createLockfileBlockers = ({
  dryRunReport,
  lockfileData,
}: {
  dryRunReport: TRemoveDryRunReport
  lockfileData: TConsumerLockfile
}) => {
  if (lockfileData.items[dryRunReport.itemName]) return []

  return [
    createRemoveStrictBlocker({
      code: "strict-remove-lockfile-item-missing",
      itemName: dryRunReport.itemName,
      kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
      message: `Strict remove cannot continue because "${dryRunReport.itemName}" is missing from ${AMINO_UI_LOCK_FILE_NAME}.`,
    }),
  ]
}

const createFilePreflightBlockers = async ({ cwd, dryRunFile }: { cwd: string; dryRunFile: TRemoveDryRunFile }) => {
  const blockers: TRemoveStrictBlocker[] = []
  const absoluteTargetPath = getAbsoluteTargetPath({ cwd, targetPath: dryRunFile.path })

  if (!isInsideDirectory({ directoryPath: cwd, filePath: absoluteTargetPath })) {
    return [
      createRemoveStrictBlocker({
        code: "strict-remove-path-boundary-blocker",
        itemName: dryRunFile.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
        message: `Strict remove will not remove ${dryRunFile.path} because it resolves outside the consumer root.`,
        path: dryRunFile.path,
        targetPath: dryRunFile.path,
      }),
    ]
  }

  if (!dryRunFile.wouldRemoveFile) {
    if (dryRunFile.wouldRemoveLockfileRecord && existsSync(absoluteTargetPath)) {
      blockers.push(
        createRemoveStrictBlocker({
          code: "strict-remove-lockfile-only-existing-file-blocker",
          itemName: dryRunFile.itemName,
          kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict remove expected ${dryRunFile.path} to be missing before lockfile-only cleanup, but it exists.`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      )
    }

    return blockers
  }

  if (!existsSync(absoluteTargetPath)) {
    return [
      createRemoveStrictBlocker({
        code: "strict-remove-file-missing-blocker",
        itemName: dryRunFile.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
        message: `Strict remove expected ${dryRunFile.path} to exist before deletion, but it is missing.`,
        path: dryRunFile.path,
        targetPath: dryRunFile.path,
      }),
    ]
  }

  const fileStats = await fs.lstat(absoluteTargetPath)

  if (!fileStats.isFile() && !fileStats.isSymbolicLink()) {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-non-file-blocker",
        itemName: dryRunFile.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
        message: `Strict remove will not remove ${dryRunFile.path} because it is not a file.`,
        path: dryRunFile.path,
        targetPath: dryRunFile.path,
      }),
    )
  }

  if (dryRunFile.currentHash) {
    const currentHash = createContentHash(await fs.readFile(absoluteTargetPath))

    if (currentHash !== dryRunFile.currentHash) {
      blockers.push(
        createRemoveStrictBlocker({
          code: "strict-remove-file-hash-blocker",
          itemName: dryRunFile.itemName,
          kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict remove will not remove ${dryRunFile.path} because its content changed after dry-run classification.`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      )
    }
  }

  return blockers
}

const createFileBlockers = async ({ cwd, dryRunReport }: { cwd: string; dryRunReport: TRemoveDryRunReport }) => {
  const blockerLists = await Promise.all(
    dryRunReport.files.map(async (dryRunFile) => {
      if (dryRunFile.dryRunAction === "would-remove-file-and-lockfile") {
        return createFilePreflightBlockers({ cwd, dryRunFile })
      }
      if (dryRunFile.dryRunAction === "would-remove-lockfile-record") {
        return createFilePreflightBlockers({ cwd, dryRunFile })
      }

      return [
        createRemoveStrictBlocker({
          code: "strict-remove-file-action-blocker",
          itemName: dryRunFile.itemName,
          kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict remove cannot apply file ${dryRunFile.path} because dry-run action is "${dryRunFile.dryRunAction}".`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      ]
    }),
  )

  return blockerLists.flat()
}

const dedupeBlockers = (blockers: readonly TRemoveStrictBlocker[]) => {
  const dedupedBlockers = new Map<string, TRemoveStrictBlocker>()

  blockers.forEach((blocker) => {
    dedupedBlockers.set(
      [blocker.code, blocker.itemName, blocker.path, blocker.sourcePath, blocker.targetPath].join(":"),
      blocker,
    )
  })

  return [...dedupedBlockers.values()]
}

const resolveBlockedFiles = (files: readonly TRemoveDryRunFile[]) =>
  files.map((file) =>
    removeStrictFileSchema.parse({
      dryRunAction: file.dryRunAction,
      installedHash: file.installedHash,
      itemName: file.itemName,
      path: file.path,
      removalTarget: file.removalTarget,
      removedFile: false,
      removedLockfileRecord: false,
      strictAction:
        file.dryRunAction === "blocked" ? REMOVE_STRICT_FILE_ACTION__BLOCKED : REMOVE_STRICT_FILE_ACTION__SKIPPED,
      targetRole: file.targetRole,
    }),
  )

const writeStrictRemove = async ({
  cwd,
  dryRunReport,
  lockfileData,
}: {
  cwd: string
  dryRunReport: TRemoveDryRunReport
  lockfileData: TConsumerLockfile
}) => {
  const files: TRemoveStrictFile[] = []

  for (const file of dryRunReport.files) {
    if (file.wouldRemoveFile) {
      await fs.rm(getAbsoluteTargetPath({ cwd, targetPath: file.path }))
      files.push(
        removeStrictFileSchema.parse({
          dryRunAction: file.dryRunAction,
          installedHash: file.installedHash,
          itemName: file.itemName,
          path: file.path,
          removalTarget: file.removalTarget,
          removedFile: true,
          removedLockfileRecord: true,
          strictAction: REMOVE_STRICT_FILE_ACTION__REMOVED_FILE_AND_LOCKFILE,
          targetRole: file.targetRole,
        }),
      )
      continue
    }

    files.push(
      removeStrictFileSchema.parse({
        dryRunAction: file.dryRunAction,
        installedHash: file.installedHash,
        itemName: file.itemName,
        path: file.path,
        removalTarget: file.removalTarget,
        removedFile: false,
        removedLockfileRecord: true,
        strictAction: REMOVE_STRICT_FILE_ACTION__REMOVED_LOCKFILE_RECORD,
        targetRole: file.targetRole,
      }),
    )
  }

  const nextItems = { ...lockfileData.items }

  delete nextItems[dryRunReport.itemName]

  const nextLockfileData = consumerLockfileSchema.parse({
    ...lockfileData,
    items: nextItems,
  })

  await fs.writeFile(path.join(cwd, AMINO_UI_LOCK_FILE_NAME), `${JSON.stringify(nextLockfileData, null, 2)}\n`, "utf8")

  return {
    files,
    lockfileData: nextLockfileData,
  }
}

const createRemoveStrictEffects = ({
  applied,
  dryRunReport,
  files,
}: {
  applied: boolean
  dryRunReport: TRemoveDryRunReport
  files: readonly TRemoveStrictFile[]
}) => {
  const deletedCount = files.filter((file) => file.removedFile).length
  const removedFileRecordCount = files.filter((file) => file.removedLockfileRecord).length

  return {
    dependencies: {
      removedCount: 0,
      status: "not-written",
    },
    files: {
      deletedCount,
      plannedDeleteCount: dryRunReport.summary.wouldRemoveFileCount,
      plannedLockfileRecordRemovalCount: dryRunReport.summary.wouldRemoveLockfileRecordCount,
      preservedCount: dryRunReport.summary.skippedFileCount + dryRunReport.summary.blockedFileCount,
    },
    installsDependencies: false,
    lockfile: {
      plannedItem: dryRunReport.files.length > 0 ? dryRunReport.itemName : undefined,
      removedFileRecordCount,
      removedItem: applied,
      status: applied ? "written" : dryRunReport.files.length > 0 ? "blocked" : "not-written",
    },
    writesConfig: false,
    writesFiles: deletedCount > 0,
    writesLockfile: applied,
  } as const
}

const resolveItemRemoveState = ({ applied, dryRunReport }: { applied: boolean; dryRunReport: TRemoveDryRunReport }) => {
  if (applied) return REMOVE_STRICT_ITEM_STATE__REMOVED
  if (dryRunReport.itemRemoveState === "unavailable") return REMOVE_STRICT_ITEM_STATE__UNAVAILABLE

  return REMOVE_STRICT_ITEM_STATE__BLOCKED
}

export const createRemoveStrictReport = async ({
  cwd,
  itemName,
  registrySourcePath,
}: TCreateRemoveStrictReportOptions): Promise<TRemoveStrictReport> => {
  const dryRunReport = await createRemoveDryRunReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const lockfilePlan = await readConsumerLockfileForStrictRemove(cwd)
  const blockers = dedupeBlockers([
    ...lockfilePlan.findings,
    ...createDryRunBlockers(dryRunReport),
    ...createProjectStateBlockers(dryRunReport),
    ...createLockfileBlockers({
      dryRunReport,
      lockfileData: lockfilePlan.lockfileData,
    }),
    ...(await createFileBlockers({
      cwd,
      dryRunReport,
    })),
  ])

  if (blockers.length > 0) {
    const files = resolveBlockedFiles(dryRunReport.files)

    return removeStrictReportSchema.parse({
      applied: false,
      blockers,
      cwd,
      dependencies: dryRunReport.dependencies,
      effects: createRemoveStrictEffects({
        applied: false,
        dryRunReport,
        files,
      }),
      files,
      findings: [...dryRunReport.findings, ...blockers],
      itemName,
      itemRemoveState: resolveItemRemoveState({
        applied: false,
        dryRunReport,
      }),
      lockfileData: lockfilePlan.lockfileData,
      registrySource: dryRunReport.registrySource,
      status: dryRunReport.status,
    })
  }

  const result = await writeStrictRemove({
    cwd,
    dryRunReport,
    lockfileData: lockfilePlan.lockfileData,
  })

  return removeStrictReportSchema.parse({
    applied: true,
    blockers: [],
    cwd,
    dependencies: dryRunReport.dependencies,
    effects: createRemoveStrictEffects({
      applied: true,
      dryRunReport,
      files: result.files,
    }),
    files: result.files,
    findings: dryRunReport.findings,
    itemName,
    itemRemoveState: resolveItemRemoveState({
      applied: true,
      dryRunReport,
    }),
    lockfileData: result.lockfileData,
    registrySource: dryRunReport.registrySource,
    status: dryRunReport.status,
  })
}
