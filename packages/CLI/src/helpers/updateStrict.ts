import crypto from "crypto"
import { existsSync, promises as fs } from "fs"
import path from "path"

import { z } from "zod"

import {
  AMINO_UI_LOCK_FILE_NAME,
  CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED,
  consumerLockfileSchema,
  consumerTargetRoleSchema,
  type TConsumerLockfile,
} from "./consumerContract"
import {
  createRegistryInstallPlan,
  createStrictInstalledFileContent,
  INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  INSTALL_PLAN_FINDING_SEVERITIES,
  installPlanDependencySchema,
  readConsumerConfigForStrictAdd,
  readConsumerLockfileForStrictAdd,
  readLocalRegistrySource,
  type TInstallPlanFile,
  type TRegistryInstallPlan,
} from "./installPlan"
import {
  CLI_PROJECT_RESOURCE_STATUS__PRESENT,
  CLI_PROJECT_RESOURCE_STATUSES,
  CLI_REGISTRY_SOURCE_STATUSES,
  CLI_STRICT_WRITE_STATUSES,
  CLI_WRITE_STATUS__BLOCKED,
  CLI_WRITE_STATUS__NOT_WRITTEN,
  CLI_WRITE_STATUS__WOULD_WRITE,
  CLI_WRITE_STATUS__WRITTEN,
} from "./reportConstants"
import {
  createUpdateAllDryRunReport,
  createUpdateDryRunReport,
  updateDryRunReportSchema,
  type TUpdateAllDryRunReport,
  type TUpdateDryRunFile,
  type TUpdateDryRunReport,
} from "./updateDryRun"

const UPDATE_STRICT_SCHEMA_VERSION = 1

const UPDATE_STRICT_ITEM_STATE__UPDATED = "updated"
const UPDATE_STRICT_ITEM_STATE__UP_TO_DATE = "up-to-date"
const UPDATE_STRICT_ITEM_STATE__BLOCKED = "blocked"
const UPDATE_STRICT_ITEM_STATE__UNAVAILABLE = "unavailable"

const UPDATE_STRICT_FILE_ACTION__WROTE_FILE_AND_LOCKFILE = "wrote-file-and-lockfile"
const UPDATE_STRICT_FILE_ACTION__UPDATED_LOCKFILE_RECORD = "updated-lockfile-record"
const UPDATE_STRICT_FILE_ACTION__NONE = "none"
const UPDATE_STRICT_FILE_ACTION__BLOCKED = "blocked"
const UPDATE_STRICT_FILE_ACTION__SKIPPED = "skipped"

const UPDATE_STRICT_BLOCKER_KIND__DEPENDENCY = "dependency"
const UPDATE_STRICT_BLOCKER_KIND__FILE = "file"
const UPDATE_STRICT_BLOCKER_KIND__ITEM = "item"
const UPDATE_STRICT_BLOCKER_KIND__PROJECT = "project"
const UPDATE_STRICT_BLOCKER_KIND__SOURCE = "source"

const UPDATE_STRICT_ITEM_STATES = [
  UPDATE_STRICT_ITEM_STATE__UPDATED,
  UPDATE_STRICT_ITEM_STATE__UP_TO_DATE,
  UPDATE_STRICT_ITEM_STATE__BLOCKED,
  UPDATE_STRICT_ITEM_STATE__UNAVAILABLE,
] as const

const UPDATE_STRICT_FILE_ACTIONS = [
  UPDATE_STRICT_FILE_ACTION__WROTE_FILE_AND_LOCKFILE,
  UPDATE_STRICT_FILE_ACTION__UPDATED_LOCKFILE_RECORD,
  UPDATE_STRICT_FILE_ACTION__NONE,
  UPDATE_STRICT_FILE_ACTION__BLOCKED,
  UPDATE_STRICT_FILE_ACTION__SKIPPED,
] as const

const UPDATE_STRICT_BLOCKER_KINDS = [
  UPDATE_STRICT_BLOCKER_KIND__DEPENDENCY,
  UPDATE_STRICT_BLOCKER_KIND__FILE,
  UPDATE_STRICT_BLOCKER_KIND__ITEM,
  UPDATE_STRICT_BLOCKER_KIND__PROJECT,
  UPDATE_STRICT_BLOCKER_KIND__SOURCE,
] as const

const updateStrictFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    kind: z.enum(UPDATE_STRICT_BLOCKER_KINDS).optional(),
    message: z.string().min(1),
    path: z.string().min(1).optional(),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const updateStrictBlockerSchema = updateStrictFindingSchema
  .extend({
    kind: z.enum(UPDATE_STRICT_BLOCKER_KINDS),
    path: z.string().min(1).optional(),
  })
  .strict()

const updateStrictFileSchema = z
  .object({
    currentHash: z.string().min(1).optional(),
    dryRunAction: z.string().min(1),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    lockfileRecordUpdated: z.boolean(),
    nextInstalledHash: z.string().min(1).optional(),
    nextSourceHash: z.string().min(1).optional(),
    path: z.string().min(1),
    sourceFileWritten: z.boolean(),
    strictAction: z.enum(UPDATE_STRICT_FILE_ACTIONS),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

export const updateStrictReportSchema = z
  .object({
    applied: z.boolean(),
    blockers: z.array(updateStrictBlockerSchema).default([]),
    cwd: z.string().min(1),
    dependencies: z.array(installPlanDependencySchema).default([]),
    effects: z
      .object({
        dependencies: z
          .object({
            status: z.literal(CLI_WRITE_STATUS__NOT_WRITTEN),
            updatedCount: z.literal(0),
          })
          .strict(),
        files: z
          .object({
            blockedCount: z.number().int().nonnegative(),
            lockfileRecordUpdatedCount: z.number().int().nonnegative(),
            plannedLockfileRecordUpdateCount: z.number().int().nonnegative(),
            plannedWriteCount: z.number().int().nonnegative(),
            skippedCount: z.number().int().nonnegative(),
            unchangedCount: z.number().int().nonnegative(),
            writtenCount: z.number().int().nonnegative(),
          })
          .strict(),
        installsDependencies: z.literal(false),
        lockfile: z
          .object({
            plannedItem: z.string().min(1).optional(),
            status: z.enum(CLI_STRICT_WRITE_STATUSES),
            updatedFileRecordCount: z.number().int().nonnegative(),
            updatedItem: z.boolean(),
          })
          .strict(),
        writesConfig: z.literal(false),
        writesFiles: z.boolean(),
        writesLockfile: z.boolean(),
      })
      .strict(),
    files: z.array(updateStrictFileSchema).default([]),
    findings: z.array(updateStrictFindingSchema).default([]),
    itemName: z.string().min(1),
    itemUpdateState: z.enum(UPDATE_STRICT_ITEM_STATES),
    lockfileData: consumerLockfileSchema,
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(CLI_REGISTRY_SOURCE_STATUSES),
      })
      .strict(),
    schemaVersion: z.literal(UPDATE_STRICT_SCHEMA_VERSION).default(UPDATE_STRICT_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
        lockfile: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
      })
      .strict(),
  })
  .strict()

const updateAllStrictItemSchema = updateStrictReportSchema
  .pick({
    applied: true,
    blockers: true,
    dependencies: true,
    effects: true,
    files: true,
    findings: true,
    itemName: true,
    itemUpdateState: true,
  })
  .strict()

export const updateAllStrictReportSchema = z
  .object({
    all: z.literal(true),
    applied: z.boolean(),
    blockers: z.array(updateStrictBlockerSchema).default([]),
    cwd: z.string().min(1),
    dependencies: z.array(installPlanDependencySchema).default([]),
    effects: z
      .object({
        dependencies: updateStrictReportSchema.shape.effects.shape.dependencies,
        files: updateStrictReportSchema.shape.effects.shape.files,
        installsDependencies: z.literal(false),
        lockfile: z
          .object({
            plannedItemCount: z.number().int().nonnegative(),
            status: z.enum(CLI_STRICT_WRITE_STATUSES),
            updatedFileRecordCount: z.number().int().nonnegative(),
            updatedItemCount: z.number().int().nonnegative(),
          })
          .strict(),
        writesConfig: z.literal(false),
        writesFiles: z.boolean(),
        writesLockfile: z.boolean(),
      })
      .strict(),
    findings: z.array(updateStrictFindingSchema).default([]),
    items: z.array(updateAllStrictItemSchema).default([]),
    lockfileData: consumerLockfileSchema,
    registrySource: updateStrictReportSchema.shape.registrySource,
    schemaVersion: z.literal(UPDATE_STRICT_SCHEMA_VERSION).default(UPDATE_STRICT_SCHEMA_VERSION),
    status: updateStrictReportSchema.shape.status,
    summary: z
      .object({
        blockedFileCount: z.number().int().nonnegative(),
        blockerCount: z.number().int().nonnegative(),
        fileCount: z.number().int().nonnegative(),
        itemCount: z.number().int().nonnegative(),
        itemStates: z.record(z.enum(UPDATE_STRICT_ITEM_STATES), z.number().int().nonnegative()),
        lockfileRecordUpdatedCount: z.number().int().nonnegative(),
        plannedLockfileRecordUpdateCount: z.number().int().nonnegative(),
        plannedWriteCount: z.number().int().nonnegative(),
        skippedFileCount: z.number().int().nonnegative(),
        unchangedFileCount: z.number().int().nonnegative(),
        writtenFileCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type TUpdateStrictReport = z.infer<typeof updateStrictReportSchema>
export type TUpdateAllStrictReport = z.infer<typeof updateAllStrictReportSchema>

export type TCreateUpdateStrictReportOptions = {
  cwd: string
  itemName: string
  registrySourcePath?: string
}

export type TCreateUpdateAllStrictReportOptions = {
  cwd: string
  registrySourcePath?: string
}

type TUpdateStrictBlocker = z.infer<typeof updateStrictBlockerSchema>
type TUpdateStrictFile = z.infer<typeof updateStrictFileSchema>
type TUpdateAllStrictItem = z.infer<typeof updateAllStrictItemSchema>
type TCreateUpdateStrictBlockerOptions = Omit<TUpdateStrictBlocker, "severity"> & {
  severity?: TUpdateStrictBlocker["severity"]
}
type TCurrentInstallPlan = Awaited<ReturnType<typeof createCurrentInstallPlan>>

const createContentHash = (content: string | Buffer) =>
  `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const createUpdateStrictBlocker = ({
  code,
  itemName,
  kind,
  message,
  path: blockerPath,
  severity = INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  sourcePath,
  targetPath,
}: TCreateUpdateStrictBlockerOptions) =>
  updateStrictBlockerSchema.parse({
    code,
    itemName,
    kind,
    message,
    path: blockerPath,
    severity,
    sourcePath,
    targetPath,
  })

const convertFindingToBlocker = (
  finding: { code: string; itemName?: string; message: string; sourcePath?: string; targetPath?: string },
  kind: (typeof UPDATE_STRICT_BLOCKER_KINDS)[number],
) =>
  createUpdateStrictBlocker({
    ...finding,
    kind,
    path: finding.targetPath,
    severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  })

const isInsideDirectory = ({ directoryPath, filePath }: { directoryPath: string; filePath: string }) => {
  const relativePath = path.relative(directoryPath, filePath)

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
}

const getAbsoluteTargetPath = ({ cwd, targetPath }: { cwd: string; targetPath: string }) =>
  path.resolve(cwd, targetPath)

const createDryRunBlockers = (dryRunReport: TUpdateDryRunReport) =>
  dryRunReport.blockers.map((blocker) =>
    createUpdateStrictBlocker({
      code: "strict-update-dry-run-blocker",
      itemName: blocker.itemName,
      kind: blocker.kind,
      message: `Strict update is blocked by dry-run blocker "${blocker.code}": ${blocker.message}`,
      path: blocker.path,
      sourcePath: blocker.sourcePath,
      targetPath: blocker.targetPath,
    }),
  )

const createProjectStateBlockers = (dryRunReport: TUpdateDryRunReport) => {
  const blockers: TUpdateStrictBlocker[] = []

  if (dryRunReport.status.config !== CLI_PROJECT_RESOURCE_STATUS__PRESENT) {
    blockers.push(
      createUpdateStrictBlocker({
        code: "strict-update-config-blocker",
        itemName: dryRunReport.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__PROJECT,
        message: `Strict update requires a present consumer config. Current config status is "${dryRunReport.status.config}".`,
      }),
    )
  }

  if (dryRunReport.status.lockfile !== CLI_PROJECT_RESOURCE_STATUS__PRESENT) {
    blockers.push(
      createUpdateStrictBlocker({
        code: "strict-update-lockfile-status-blocker",
        itemName: dryRunReport.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__PROJECT,
        message: `Strict update requires a present Amino lockfile. Current lockfile status is "${dryRunReport.status.lockfile}".`,
      }),
    )
  }

  if (dryRunReport.itemUpdateState === "unavailable") {
    blockers.push(
      createUpdateStrictBlocker({
        code: "strict-update-item-unavailable",
        itemName: dryRunReport.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict update cannot continue because item "${dryRunReport.itemName}" is unavailable.`,
      }),
    )
  } else if (dryRunReport.itemUpdateState !== "would-update" && dryRunReport.itemUpdateState !== "up-to-date") {
    blockers.push(
      createUpdateStrictBlocker({
        code: "strict-update-item-state-blocker",
        itemName: dryRunReport.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict update requires itemUpdateState "would-update" or "up-to-date"; received "${dryRunReport.itemUpdateState}".`,
      }),
    )
  }

  if (
    dryRunReport.itemUpdateState === "would-update" &&
    dryRunReport.wouldEffects.lockfile.status !== CLI_WRITE_STATUS__WOULD_WRITE
  ) {
    blockers.push(
      createUpdateStrictBlocker({
        code: "strict-update-lockfile-effect-blocker",
        itemName: dryRunReport.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict update requires a would-write lockfile dry-run effect; received "${dryRunReport.wouldEffects.lockfile.status}".`,
      }),
    )
  }

  if (
    dryRunReport.itemUpdateState === "up-to-date" &&
    dryRunReport.wouldEffects.lockfile.status !== CLI_WRITE_STATUS__NOT_WRITTEN
  ) {
    blockers.push(
      createUpdateStrictBlocker({
        code: "strict-update-up-to-date-effect-blocker",
        itemName: dryRunReport.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict update expected an up-to-date item to be a lockfile no-op; received "${dryRunReport.wouldEffects.lockfile.status}".`,
      }),
    )
  }

  return blockers
}

const createLockfileBlockers = ({
  dryRunReport,
  lockfileData,
}: {
  dryRunReport: TUpdateDryRunReport
  lockfileData: TConsumerLockfile
}) => {
  const item = lockfileData.items[dryRunReport.itemName]

  if (!item) {
    return [
      createUpdateStrictBlocker({
        code: "strict-update-lockfile-item-missing",
        itemName: dryRunReport.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict update cannot continue because "${dryRunReport.itemName}" is missing from ${AMINO_UI_LOCK_FILE_NAME}.`,
      }),
    ]
  }

  return dryRunReport.files.flatMap((dryRunFile) => {
    const lockfileFile = item.files.find((file) => file.path === dryRunFile.path)

    if (!lockfileFile) {
      return [
        createUpdateStrictBlocker({
          code: "strict-update-lockfile-file-missing",
          itemName: dryRunFile.itemName,
          kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict update cannot continue because ${dryRunFile.path} is missing from the lockfile item.`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      ]
    }

    const blockers: TUpdateStrictBlocker[] = []

    if (lockfileFile.targetRole !== dryRunFile.targetRole) {
      blockers.push(
        createUpdateStrictBlocker({
          code: "strict-update-lockfile-target-role-blocker",
          itemName: dryRunFile.itemName,
          kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict update expected ${dryRunFile.path} to have target role "${dryRunFile.targetRole}", but lockfile target role is "${lockfileFile.targetRole}".`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      )
    }

    if (lockfileFile.installedHash !== dryRunFile.installedHash || lockfileFile.sourceHash !== dryRunFile.sourceHash) {
      blockers.push(
        createUpdateStrictBlocker({
          code: "strict-update-lockfile-hash-blocker",
          itemName: dryRunFile.itemName,
          kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict update expected ${dryRunFile.path} lockfile hashes to match dry-run input before mutation.`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      )
    }

    if (
      (dryRunFile.dryRunAction === "would-write" || dryRunFile.dryRunAction === "would-update-lockfile") &&
      lockfileFile.ownershipState !== CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED
    ) {
      blockers.push(
        createUpdateStrictBlocker({
          code: "strict-update-lockfile-ownership-blocker",
          itemName: dryRunFile.itemName,
          kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict update expected ${dryRunFile.path} to be registry-owned before update, but lockfile ownership is "${lockfileFile.ownershipState}".`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      )
    }

    return blockers
  })
}

const createFileActionBlockers = (dryRunReport: TUpdateDryRunReport) =>
  dryRunReport.files.flatMap((dryRunFile) => {
    if (dryRunFile.dryRunAction === "would-write") return []
    if (dryRunFile.dryRunAction === "would-update-lockfile") return []
    if (dryRunFile.dryRunAction === "none") return []

    return [
      createUpdateStrictBlocker({
        code: "strict-update-file-action-blocker",
        itemName: dryRunFile.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
        message: `Strict update cannot apply file ${dryRunFile.path} because dry-run action is "${dryRunFile.dryRunAction}".`,
        path: dryRunFile.path,
        targetPath: dryRunFile.path,
      }),
    ]
  })

const createCurrentInstallPlan = async ({
  cwd,
  dryRunReport,
}: {
  cwd: string
  dryRunReport: TUpdateDryRunReport
}): Promise<{
  blockers: TUpdateStrictBlocker[]
  installPlan?: TRegistryInstallPlan
  sourceRoot?: string
}> => {
  if (!dryRunReport.registrySource.path) {
    return {
      blockers: [
        createUpdateStrictBlocker({
          code: "strict-update-registry-source-unavailable",
          itemName: dryRunReport.itemName,
          kind: UPDATE_STRICT_BLOCKER_KIND__SOURCE,
          message: "Strict update requires a loaded local registry source before it can write files.",
        }),
      ],
    }
  }

  const configPlan = await readConsumerConfigForStrictAdd(cwd)
  const lockfilePlan = await readConsumerLockfileForStrictAdd(cwd)
  const { registrySource, sourceRoot } = await readLocalRegistrySource(dryRunReport.registrySource.path)
  const installPlan = createRegistryInstallPlan({
    config: configPlan.config,
    consumerRoot: cwd,
    registrySource,
    requestedItems: [dryRunReport.itemName],
    sourceRoot,
  })
  const blockers = [
    ...configPlan.findings.map((finding) => convertFindingToBlocker(finding, UPDATE_STRICT_BLOCKER_KIND__PROJECT)),
    ...lockfilePlan.findings.map((finding) => convertFindingToBlocker(finding, UPDATE_STRICT_BLOCKER_KIND__PROJECT)),
  ]

  return {
    blockers,
    installPlan,
    sourceRoot,
  }
}

const createInstallPlanFileKey = ({ itemName, path: filePath }: { itemName: string; path: string }) =>
  `${itemName}:${filePath}`

const createInstallPlanFileMap = (installPlan?: TRegistryInstallPlan) => {
  const filesByKey = new Map<string, TInstallPlanFile>()

  installPlan?.files.forEach((file) => {
    filesByKey.set(createInstallPlanFileKey({ itemName: file.itemName, path: file.resolvedPath }), file)
  })

  return filesByKey
}

const createPlannedContent = async ({
  dryRunFile,
  installPlan,
  installPlanFile,
  sourceRoot,
}: {
  dryRunFile: TUpdateDryRunFile
  installPlan?: TRegistryInstallPlan
  installPlanFile?: TInstallPlanFile
  sourceRoot?: string
}) => {
  if (!installPlan || !installPlanFile || !sourceRoot) {
    return {
      blockers: [
        createUpdateStrictBlocker({
          code: "strict-update-plan-file-missing",
          itemName: dryRunFile.itemName,
          kind: UPDATE_STRICT_BLOCKER_KIND__SOURCE,
          message: `Strict update cannot write ${dryRunFile.path} because the current registry install plan does not include that target.`,
          path: dryRunFile.path,
          sourcePath: dryRunFile.sourcePath,
          targetPath: dryRunFile.path,
        }),
      ],
    }
  }

  const sourceContent = await fs.readFile(path.resolve(sourceRoot, installPlanFile.sourcePath), "utf8")
  const installedContent = createStrictInstalledFileContent({
    content: sourceContent,
    file: installPlanFile,
    installPlan,
  })
  const nextSourceHash = createContentHash(sourceContent)
  const nextInstalledHash = createContentHash(installedContent)
  const blockers: TUpdateStrictBlocker[] = []

  if (dryRunFile.nextSourceHash && nextSourceHash !== dryRunFile.nextSourceHash) {
    blockers.push(
      createUpdateStrictBlocker({
        code: "strict-update-source-hash-blocker",
        itemName: dryRunFile.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__SOURCE,
        message: `Strict update will not write ${dryRunFile.path} because the registry source changed after dry-run classification.`,
        path: dryRunFile.path,
        sourcePath: installPlanFile.sourcePath,
        targetPath: dryRunFile.path,
      }),
    )
  }

  if (dryRunFile.nextInstalledHash && nextInstalledHash !== dryRunFile.nextInstalledHash) {
    blockers.push(
      createUpdateStrictBlocker({
        code: "strict-update-installed-hash-blocker",
        itemName: dryRunFile.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__SOURCE,
        message: `Strict update will not write ${dryRunFile.path} because the planned installed content changed after dry-run classification.`,
        path: dryRunFile.path,
        sourcePath: installPlanFile.sourcePath,
        targetPath: dryRunFile.path,
      }),
    )
  }

  return {
    blockers,
    installedContent,
    nextInstalledHash,
    nextSourceHash,
  }
}

const createFilePreflightBlockers = async ({
  cwd,
  dryRunFile,
  installPlan,
  installPlanFile,
  sourceRoot,
}: {
  cwd: string
  dryRunFile: TUpdateDryRunFile
  installPlan?: TRegistryInstallPlan
  installPlanFile?: TInstallPlanFile
  sourceRoot?: string
}) => {
  const blockers: TUpdateStrictBlocker[] = []
  const absoluteTargetPath = getAbsoluteTargetPath({ cwd, targetPath: dryRunFile.path })

  if (!isInsideDirectory({ directoryPath: cwd, filePath: absoluteTargetPath })) {
    return [
      createUpdateStrictBlocker({
        code: "strict-update-path-boundary-blocker",
        itemName: dryRunFile.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
        message: `Strict update will not write ${dryRunFile.path} because it resolves outside the consumer root.`,
        path: dryRunFile.path,
        targetPath: dryRunFile.path,
      }),
    ]
  }

  if (dryRunFile.currentHash) {
    if (!existsSync(absoluteTargetPath)) {
      blockers.push(
        createUpdateStrictBlocker({
          code: "strict-update-file-missing-blocker",
          itemName: dryRunFile.itemName,
          kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict update expected ${dryRunFile.path} to exist before update, but it is missing.`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      )
    } else {
      const fileStats = await fs.lstat(absoluteTargetPath)

      if (!fileStats.isFile() && !fileStats.isSymbolicLink()) {
        blockers.push(
          createUpdateStrictBlocker({
            code: "strict-update-non-file-blocker",
            itemName: dryRunFile.itemName,
            kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
            message: `Strict update will not write ${dryRunFile.path} because it is not a file.`,
            path: dryRunFile.path,
            targetPath: dryRunFile.path,
          }),
        )
      } else {
        const currentHash = createContentHash(await fs.readFile(absoluteTargetPath))

        if (currentHash !== dryRunFile.currentHash) {
          blockers.push(
            createUpdateStrictBlocker({
              code: "strict-update-file-hash-blocker",
              itemName: dryRunFile.itemName,
              kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
              message: `Strict update will not write ${dryRunFile.path} because its content changed after dry-run classification.`,
              path: dryRunFile.path,
              targetPath: dryRunFile.path,
            }),
          )
        }

        if (dryRunFile.dryRunAction === "would-update-lockfile" && currentHash !== dryRunFile.nextInstalledHash) {
          blockers.push(
            createUpdateStrictBlocker({
              code: "strict-update-lockfile-only-hash-blocker",
              itemName: dryRunFile.itemName,
              kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
              message: `Strict update expected ${dryRunFile.path} to already match the planned installed hash before lockfile-only update.`,
              path: dryRunFile.path,
              targetPath: dryRunFile.path,
            }),
          )
        }
      }
    }
  }

  if (dryRunFile.dryRunAction === "would-write" || dryRunFile.dryRunAction === "would-update-lockfile") {
    const plannedContent = await createPlannedContent({
      dryRunFile,
      installPlan,
      installPlanFile,
      sourceRoot,
    })

    blockers.push(...plannedContent.blockers)
  }

  return blockers
}

const createFileBlockers = async ({
  cwd,
  dryRunReport,
  installPlan,
  sourceRoot,
}: {
  cwd: string
  dryRunReport: TUpdateDryRunReport
  installPlan?: TRegistryInstallPlan
  sourceRoot?: string
}) => {
  const installPlanFilesByKey = createInstallPlanFileMap(installPlan)
  const blockerLists = await Promise.all(
    dryRunReport.files.map((dryRunFile) => {
      if (
        dryRunFile.dryRunAction === "would-write" ||
        dryRunFile.dryRunAction === "would-update-lockfile" ||
        dryRunFile.dryRunAction === "none"
      ) {
        return createFilePreflightBlockers({
          cwd,
          dryRunFile,
          installPlan,
          installPlanFile: installPlanFilesByKey.get(
            createInstallPlanFileKey({
              itemName: dryRunFile.itemName,
              path: dryRunFile.path,
            }),
          ),
          sourceRoot,
        })
      }

      return []
    }),
  )

  return blockerLists.flat()
}

const dedupeBlockers = (blockers: readonly TUpdateStrictBlocker[]) => {
  const dedupedBlockers = new Map<string, TUpdateStrictBlocker>()

  blockers.forEach((blocker) => {
    dedupedBlockers.set(
      [blocker.code, blocker.itemName, blocker.path, blocker.sourcePath, blocker.targetPath].join(":"),
      blocker,
    )
  })

  return [...dedupedBlockers.values()]
}

const dedupeStrictFindings = (findings: readonly z.infer<typeof updateStrictFindingSchema>[]) => {
  const dedupedFindings = new Map<string, z.infer<typeof updateStrictFindingSchema>>()

  findings.forEach((finding) => {
    dedupedFindings.set(
      [finding.code, finding.itemName, finding.path, finding.sourcePath, finding.targetPath].join(":"),
      finding,
    )
  })

  return [...dedupedFindings.values()]
}

const createItemDryRunReportFromUpdateAll = ({
  allDryRunReport,
  itemReport,
}: {
  allDryRunReport: TUpdateAllDryRunReport
  itemReport: TUpdateAllDryRunReport["items"][number]
}) =>
  updateDryRunReportSchema.parse({
    blockers: itemReport.blockers,
    cwd: allDryRunReport.cwd,
    dependencies: itemReport.dependencies,
    dryRun: true,
    effects: allDryRunReport.effects,
    files: itemReport.files,
    findings: itemReport.findings,
    itemName: itemReport.itemName,
    itemUpdateState: itemReport.itemUpdateState,
    registrySource: allDryRunReport.registrySource,
    status: allDryRunReport.status,
    summary: itemReport.summary,
    wouldEffects: itemReport.wouldEffects,
  })

const createStrictUpdatePreflight = async ({
  cwd,
  dryRunReport,
  lockfileData,
}: {
  cwd: string
  dryRunReport: TUpdateDryRunReport
  lockfileData: TConsumerLockfile
}): Promise<{
  blockers: TUpdateStrictBlocker[]
  currentPlan: TCurrentInstallPlan
}> => {
  const currentPlan = await createCurrentInstallPlan({
    cwd,
    dryRunReport,
  })
  const blockers = dedupeBlockers([
    ...createDryRunBlockers(dryRunReport),
    ...createProjectStateBlockers(dryRunReport),
    ...createLockfileBlockers({
      dryRunReport,
      lockfileData,
    }),
    ...createFileActionBlockers(dryRunReport),
    ...currentPlan.blockers,
    ...(await createFileBlockers({
      cwd,
      dryRunReport,
      installPlan: currentPlan.installPlan,
      sourceRoot: currentPlan.sourceRoot,
    })),
  ])

  return {
    blockers,
    currentPlan,
  }
}

const createDuplicateActionablePathBlockers = (dryRunReports: readonly TUpdateDryRunReport[]) => {
  const filesByPath = new Map<string, TUpdateDryRunFile[]>()

  dryRunReports.forEach((dryRunReport) => {
    dryRunReport.files.forEach((file) => {
      if (file.dryRunAction !== "would-write" && file.dryRunAction !== "would-update-lockfile") return

      filesByPath.set(file.path, [...(filesByPath.get(file.path) ?? []), file])
    })
  })

  return [...filesByPath.entries()].flatMap(([filePath, files]) => {
    const itemNames = [...new Set(files.map((file) => file.itemName))]

    if (itemNames.length <= 1) return []

    return files.map((file) =>
      createUpdateStrictBlocker({
        code: "strict-update-all-duplicate-file-path",
        itemName: file.itemName,
        kind: UPDATE_STRICT_BLOCKER_KIND__FILE,
        message: `Strict update --all cannot apply ${filePath} because multiple items plan to update the same target path: ${itemNames.join(", ")}.`,
        path: file.path,
        sourcePath: file.sourcePath,
        targetPath: file.path,
      }),
    )
  })
}

const resolveBlockedFiles = (files: readonly TUpdateDryRunFile[]) =>
  files.map((file) =>
    updateStrictFileSchema.parse({
      currentHash: file.currentHash,
      dryRunAction: file.dryRunAction,
      installedHash: file.installedHash,
      itemName: file.itemName,
      lockfileRecordUpdated: false,
      nextInstalledHash: file.nextInstalledHash,
      nextSourceHash: file.nextSourceHash,
      path: file.path,
      sourceFileWritten: false,
      strictAction:
        file.dryRunAction === "blocked" ? UPDATE_STRICT_FILE_ACTION__BLOCKED : UPDATE_STRICT_FILE_ACTION__SKIPPED,
      targetRole: file.targetRole,
    }),
  )

const resolveUpToDateFiles = (files: readonly TUpdateDryRunFile[]) =>
  files.map((file) =>
    updateStrictFileSchema.parse({
      currentHash: file.currentHash,
      dryRunAction: file.dryRunAction,
      installedHash: file.installedHash,
      itemName: file.itemName,
      lockfileRecordUpdated: false,
      nextInstalledHash: file.nextInstalledHash,
      nextSourceHash: file.nextSourceHash,
      path: file.path,
      sourceFileWritten: false,
      strictAction: UPDATE_STRICT_FILE_ACTION__NONE,
      targetRole: file.targetRole,
    }),
  )

const writeStrictUpdateFilesAndLockfileData = async ({
  cwd,
  dryRunReport,
  installPlan,
  lockfileData,
  sourceRoot,
}: {
  cwd: string
  dryRunReport: TUpdateDryRunReport
  installPlan?: TRegistryInstallPlan
  lockfileData: TConsumerLockfile
  sourceRoot?: string
}) => {
  const item = lockfileData.items[dryRunReport.itemName]

  if (!item) {
    throw new Error(`Strict update cannot write because "${dryRunReport.itemName}" is missing from the lockfile.`)
  }

  const installPlanFilesByKey = createInstallPlanFileMap(installPlan)
  const files: TUpdateStrictFile[] = []
  const updatedRecordsByPath = new Map<string, { installedHash: string; sourceHash: string }>()

  for (const file of dryRunReport.files) {
    if (file.dryRunAction === "none") {
      files.push(
        updateStrictFileSchema.parse({
          currentHash: file.currentHash,
          dryRunAction: file.dryRunAction,
          installedHash: file.installedHash,
          itemName: file.itemName,
          lockfileRecordUpdated: false,
          nextInstalledHash: file.nextInstalledHash,
          nextSourceHash: file.nextSourceHash,
          path: file.path,
          sourceFileWritten: false,
          strictAction: UPDATE_STRICT_FILE_ACTION__NONE,
          targetRole: file.targetRole,
        }),
      )
      continue
    }

    const plannedContent = await createPlannedContent({
      dryRunFile: file,
      installPlan,
      installPlanFile: installPlanFilesByKey.get(
        createInstallPlanFileKey({
          itemName: file.itemName,
          path: file.path,
        }),
      ),
      sourceRoot,
    })

    if (plannedContent.blockers.length > 0 || !plannedContent.nextInstalledHash || !plannedContent.nextSourceHash) {
      throw new Error(`Strict update cannot write ${file.path} because planned content is unavailable.`)
    }

    if (file.dryRunAction === "would-write") {
      const absoluteTargetPath = getAbsoluteTargetPath({ cwd, targetPath: file.path })

      await fs.mkdir(path.dirname(absoluteTargetPath), { recursive: true })
      await fs.writeFile(absoluteTargetPath, plannedContent.installedContent, "utf8")
      files.push(
        updateStrictFileSchema.parse({
          currentHash: file.currentHash,
          dryRunAction: file.dryRunAction,
          installedHash: file.installedHash,
          itemName: file.itemName,
          lockfileRecordUpdated: true,
          nextInstalledHash: plannedContent.nextInstalledHash,
          nextSourceHash: plannedContent.nextSourceHash,
          path: file.path,
          sourceFileWritten: true,
          strictAction: UPDATE_STRICT_FILE_ACTION__WROTE_FILE_AND_LOCKFILE,
          targetRole: file.targetRole,
        }),
      )
    } else {
      files.push(
        updateStrictFileSchema.parse({
          currentHash: file.currentHash,
          dryRunAction: file.dryRunAction,
          installedHash: file.installedHash,
          itemName: file.itemName,
          lockfileRecordUpdated: true,
          nextInstalledHash: plannedContent.nextInstalledHash,
          nextSourceHash: plannedContent.nextSourceHash,
          path: file.path,
          sourceFileWritten: false,
          strictAction: UPDATE_STRICT_FILE_ACTION__UPDATED_LOCKFILE_RECORD,
          targetRole: file.targetRole,
        }),
      )
    }

    updatedRecordsByPath.set(file.path, {
      installedHash: plannedContent.nextInstalledHash,
      sourceHash: plannedContent.nextSourceHash,
    })
  }

  const nextLockfileData = consumerLockfileSchema.parse({
    ...lockfileData,
    items: {
      ...lockfileData.items,
      [dryRunReport.itemName]: {
        ...item,
        files: item.files.map((file) => {
          const updatedRecord = updatedRecordsByPath.get(file.path)

          return updatedRecord
            ? {
                ...file,
                installedHash: updatedRecord.installedHash,
                sourceHash: updatedRecord.sourceHash,
              }
            : file
        }),
      },
    },
  })

  return {
    files,
    lockfileData: nextLockfileData,
  }
}

const writeStrictUpdate = async ({
  cwd,
  dryRunReport,
  installPlan,
  lockfileData,
  sourceRoot,
}: {
  cwd: string
  dryRunReport: TUpdateDryRunReport
  installPlan?: TRegistryInstallPlan
  lockfileData: TConsumerLockfile
  sourceRoot?: string
}) => {
  const result = await writeStrictUpdateFilesAndLockfileData({
    cwd,
    dryRunReport,
    installPlan,
    lockfileData,
    sourceRoot,
  })

  await fs.writeFile(
    path.join(cwd, AMINO_UI_LOCK_FILE_NAME),
    `${JSON.stringify(result.lockfileData, null, 2)}\n`,
    "utf8",
  )

  return result
}

const createUpdateStrictEffects = ({
  applied,
  blocked,
  dryRunReport,
  files,
}: {
  applied: boolean
  blocked: boolean
  dryRunReport: TUpdateDryRunReport
  files: readonly TUpdateStrictFile[]
}) => {
  const writtenCount = files.filter((file) => file.sourceFileWritten).length
  const lockfileRecordUpdatedCount = files.filter((file) => file.lockfileRecordUpdated).length
  const blockedCount = files.filter((file) => file.strictAction === UPDATE_STRICT_FILE_ACTION__BLOCKED).length
  const skippedCount = files.filter((file) => file.strictAction === UPDATE_STRICT_FILE_ACTION__SKIPPED).length
  const unchangedCount = files.filter((file) => file.strictAction === UPDATE_STRICT_FILE_ACTION__NONE).length

  return {
    dependencies: {
      status: CLI_WRITE_STATUS__NOT_WRITTEN,
      updatedCount: 0,
    },
    files: {
      blockedCount,
      lockfileRecordUpdatedCount,
      plannedLockfileRecordUpdateCount: dryRunReport.summary.wouldUpdateLockfileFileCount,
      plannedWriteCount: dryRunReport.summary.wouldWriteFileCount,
      skippedCount,
      unchangedCount,
      writtenCount,
    },
    installsDependencies: false,
    lockfile: {
      plannedItem: dryRunReport.files.length > 0 ? dryRunReport.itemName : undefined,
      status: applied ? CLI_WRITE_STATUS__WRITTEN : blocked ? CLI_WRITE_STATUS__BLOCKED : CLI_WRITE_STATUS__NOT_WRITTEN,
      updatedFileRecordCount: lockfileRecordUpdatedCount,
      updatedItem: applied,
    },
    writesConfig: false,
    writesFiles: writtenCount > 0,
    writesLockfile: applied,
  } as const
}

const resolveItemUpdateState = ({ applied, dryRunReport }: { applied: boolean; dryRunReport: TUpdateDryRunReport }) => {
  if (applied) return UPDATE_STRICT_ITEM_STATE__UPDATED
  if (dryRunReport.itemUpdateState === "up-to-date") return UPDATE_STRICT_ITEM_STATE__UP_TO_DATE
  if (dryRunReport.itemUpdateState === "unavailable") return UPDATE_STRICT_ITEM_STATE__UNAVAILABLE

  return UPDATE_STRICT_ITEM_STATE__BLOCKED
}

const createUpdateAllStrictItemReport = ({
  applied,
  blocked,
  blockers,
  dryRunReport,
  files,
}: {
  applied: boolean
  blocked: boolean
  blockers: readonly TUpdateStrictBlocker[]
  dryRunReport: TUpdateDryRunReport
  files: readonly TUpdateStrictFile[]
}) =>
  updateAllStrictItemSchema.parse({
    applied,
    blockers,
    dependencies: dryRunReport.dependencies,
    effects: createUpdateStrictEffects({
      applied,
      blocked,
      dryRunReport,
      files,
    }),
    files,
    findings: dedupeStrictFindings([...dryRunReport.findings, ...blockers]),
    itemName: dryRunReport.itemName,
    itemUpdateState: resolveItemUpdateState({
      applied,
      dryRunReport,
    }),
  })

const createUpdateAllStrictEffects = ({
  applied,
  blocked,
  dryRunReport,
  items,
}: {
  applied: boolean
  blocked: boolean
  dryRunReport: TUpdateAllDryRunReport
  items: readonly TUpdateAllStrictItem[]
}) => {
  const files = items.flatMap((item) => item.files)
  const blockedCount = files.filter((file) => file.strictAction === UPDATE_STRICT_FILE_ACTION__BLOCKED).length
  const lockfileRecordUpdatedCount = files.filter((file) => file.lockfileRecordUpdated).length
  const skippedCount = files.filter((file) => file.strictAction === UPDATE_STRICT_FILE_ACTION__SKIPPED).length
  const unchangedCount = files.filter((file) => file.strictAction === UPDATE_STRICT_FILE_ACTION__NONE).length
  const writtenCount = files.filter((file) => file.sourceFileWritten).length

  return {
    dependencies: {
      status: CLI_WRITE_STATUS__NOT_WRITTEN,
      updatedCount: 0,
    },
    files: {
      blockedCount,
      lockfileRecordUpdatedCount,
      plannedLockfileRecordUpdateCount: dryRunReport.summary.wouldUpdateLockfileFileCount,
      plannedWriteCount: dryRunReport.summary.wouldWriteFileCount,
      skippedCount,
      unchangedCount,
      writtenCount,
    },
    installsDependencies: false,
    lockfile: {
      plannedItemCount: dryRunReport.items.filter((item) => item.itemUpdateState === "would-update").length,
      status: applied ? CLI_WRITE_STATUS__WRITTEN : blocked ? CLI_WRITE_STATUS__BLOCKED : CLI_WRITE_STATUS__NOT_WRITTEN,
      updatedFileRecordCount: lockfileRecordUpdatedCount,
      updatedItemCount: items.filter((item) => item.applied).length,
    },
    writesConfig: false,
    writesFiles: writtenCount > 0,
    writesLockfile: applied,
  } as const
}

const createUpdateAllStrictSummary = ({
  blockers,
  items,
}: {
  blockers: readonly TUpdateStrictBlocker[]
  items: readonly TUpdateAllStrictItem[]
}) => {
  const files = items.flatMap((item) => item.files)
  const itemStates = createEmptyRecord(UPDATE_STRICT_ITEM_STATES)

  items.forEach((item) => {
    itemStates[item.itemUpdateState] += 1
  })

  return {
    blockedFileCount: files.filter((file) => file.strictAction === UPDATE_STRICT_FILE_ACTION__BLOCKED).length,
    blockerCount: blockers.length,
    fileCount: files.length,
    itemCount: items.length,
    itemStates,
    lockfileRecordUpdatedCount: files.filter((file) => file.lockfileRecordUpdated).length,
    plannedLockfileRecordUpdateCount: items.reduce(
      (total, item) => total + item.effects.files.plannedLockfileRecordUpdateCount,
      0,
    ),
    plannedWriteCount: items.reduce((total, item) => total + item.effects.files.plannedWriteCount, 0),
    skippedFileCount: files.filter((file) => file.strictAction === UPDATE_STRICT_FILE_ACTION__SKIPPED).length,
    unchangedFileCount: files.filter((file) => file.strictAction === UPDATE_STRICT_FILE_ACTION__NONE).length,
    writtenFileCount: files.filter((file) => file.sourceFileWritten).length,
  }
}

const createUpdateAllStrictReportFromItems = ({
  allDryRunReport,
  applied,
  blocked,
  blockers,
  items,
  lockfileData,
}: {
  allDryRunReport: TUpdateAllDryRunReport
  applied: boolean
  blocked: boolean
  blockers: readonly TUpdateStrictBlocker[]
  items: readonly TUpdateAllStrictItem[]
  lockfileData: TConsumerLockfile
}) =>
  updateAllStrictReportSchema.parse({
    all: true,
    applied,
    blockers,
    cwd: allDryRunReport.cwd,
    dependencies: allDryRunReport.dependencies,
    effects: createUpdateAllStrictEffects({
      applied,
      blocked,
      dryRunReport: allDryRunReport,
      items,
    }),
    findings: dedupeStrictFindings([...allDryRunReport.findings, ...blockers]),
    items,
    lockfileData,
    registrySource: allDryRunReport.registrySource,
    status: allDryRunReport.status,
    summary: createUpdateAllStrictSummary({
      blockers,
      items,
    }),
  })

export const createUpdateStrictReport = async ({
  cwd,
  itemName,
  registrySourcePath,
}: TCreateUpdateStrictReportOptions): Promise<TUpdateStrictReport> => {
  const dryRunReport = await createUpdateDryRunReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const lockfilePlan = await readConsumerLockfileForStrictAdd(cwd)
  const preflight = await createStrictUpdatePreflight({
    cwd,
    dryRunReport,
    lockfileData: lockfilePlan.lockfileData,
  })
  const blockers = dedupeBlockers([
    ...lockfilePlan.findings.map((finding) => convertFindingToBlocker(finding, UPDATE_STRICT_BLOCKER_KIND__PROJECT)),
    ...preflight.blockers,
  ])

  if (blockers.length > 0) {
    const files = resolveBlockedFiles(dryRunReport.files)

    return updateStrictReportSchema.parse({
      applied: false,
      blockers,
      cwd,
      dependencies: dryRunReport.dependencies,
      effects: createUpdateStrictEffects({
        applied: false,
        blocked: true,
        dryRunReport,
        files,
      }),
      files,
      findings: [...dryRunReport.findings, ...blockers],
      itemName,
      itemUpdateState: resolveItemUpdateState({
        applied: false,
        dryRunReport,
      }),
      lockfileData: lockfilePlan.lockfileData,
      registrySource: dryRunReport.registrySource,
      status: dryRunReport.status,
    })
  }

  if (dryRunReport.itemUpdateState === "up-to-date") {
    const files = resolveUpToDateFiles(dryRunReport.files)

    return updateStrictReportSchema.parse({
      applied: false,
      blockers: [],
      cwd,
      dependencies: dryRunReport.dependencies,
      effects: createUpdateStrictEffects({
        applied: false,
        blocked: false,
        dryRunReport,
        files,
      }),
      files,
      findings: dryRunReport.findings,
      itemName,
      itemUpdateState: UPDATE_STRICT_ITEM_STATE__UP_TO_DATE,
      lockfileData: lockfilePlan.lockfileData,
      registrySource: dryRunReport.registrySource,
      status: dryRunReport.status,
    })
  }

  const result = await writeStrictUpdate({
    cwd,
    dryRunReport,
    installPlan: preflight.currentPlan.installPlan,
    lockfileData: lockfilePlan.lockfileData,
    sourceRoot: preflight.currentPlan.sourceRoot,
  })

  return updateStrictReportSchema.parse({
    applied: true,
    blockers: [],
    cwd,
    dependencies: dryRunReport.dependencies,
    effects: createUpdateStrictEffects({
      applied: true,
      blocked: false,
      dryRunReport,
      files: result.files,
    }),
    files: result.files,
    findings: dryRunReport.findings,
    itemName,
    itemUpdateState: resolveItemUpdateState({
      applied: true,
      dryRunReport,
    }),
    lockfileData: result.lockfileData,
    registrySource: dryRunReport.registrySource,
    status: dryRunReport.status,
  })
}

export const createUpdateAllStrictReport = async ({
  cwd,
  registrySourcePath,
}: TCreateUpdateAllStrictReportOptions): Promise<TUpdateAllStrictReport> => {
  const allDryRunReport = await createUpdateAllDryRunReport({
    cwd,
    registrySourcePath,
  })
  const lockfilePlan = await readConsumerLockfileForStrictAdd(cwd)
  const dryRunReports = allDryRunReport.items.map((itemReport) =>
    createItemDryRunReportFromUpdateAll({
      allDryRunReport,
      itemReport,
    }),
  )
  const preflights = await Promise.all(
    dryRunReports.map((dryRunReport) =>
      createStrictUpdatePreflight({
        cwd,
        dryRunReport,
        lockfileData: lockfilePlan.lockfileData,
      }),
    ),
  )
  const duplicatePathBlockers = createDuplicateActionablePathBlockers(dryRunReports)
  const duplicatePathBlockersByItemName = new Map<string, TUpdateStrictBlocker[]>()

  duplicatePathBlockers.forEach((blocker) => {
    if (!blocker.itemName) return

    duplicatePathBlockersByItemName.set(blocker.itemName, [
      ...(duplicatePathBlockersByItemName.get(blocker.itemName) ?? []),
      blocker,
    ])
  })

  const blockers = dedupeBlockers([
    ...lockfilePlan.findings.map((finding) => convertFindingToBlocker(finding, UPDATE_STRICT_BLOCKER_KIND__PROJECT)),
    ...preflights.flatMap((preflight) => preflight.blockers),
    ...duplicatePathBlockers,
  ])

  if (blockers.length > 0) {
    const items = dryRunReports.map((dryRunReport, index) => {
      const itemBlockers = dedupeBlockers([
        ...preflights[index].blockers,
        ...(duplicatePathBlockersByItemName.get(dryRunReport.itemName) ?? []),
      ])
      const files =
        dryRunReport.itemUpdateState === "up-to-date"
          ? resolveUpToDateFiles(dryRunReport.files)
          : resolveBlockedFiles(dryRunReport.files)

      return createUpdateAllStrictItemReport({
        applied: false,
        blocked: dryRunReport.itemUpdateState !== "up-to-date",
        blockers: itemBlockers,
        dryRunReport,
        files,
      })
    })

    return createUpdateAllStrictReportFromItems({
      allDryRunReport,
      applied: false,
      blocked: true,
      blockers,
      items,
      lockfileData: lockfilePlan.lockfileData,
    })
  }

  let nextLockfileData = lockfilePlan.lockfileData
  const items: TUpdateAllStrictItem[] = []

  for (const [index, dryRunReport] of dryRunReports.entries()) {
    if (dryRunReport.itemUpdateState === "up-to-date") {
      items.push(
        createUpdateAllStrictItemReport({
          applied: false,
          blocked: false,
          blockers: [],
          dryRunReport,
          files: resolveUpToDateFiles(dryRunReport.files),
        }),
      )
      continue
    }

    const result = await writeStrictUpdateFilesAndLockfileData({
      cwd,
      dryRunReport,
      installPlan: preflights[index].currentPlan.installPlan,
      lockfileData: nextLockfileData,
      sourceRoot: preflights[index].currentPlan.sourceRoot,
    })

    nextLockfileData = result.lockfileData
    items.push(
      createUpdateAllStrictItemReport({
        applied: true,
        blocked: false,
        blockers: [],
        dryRunReport,
        files: result.files,
      }),
    )
  }

  const applied = items.some((item) => item.applied)

  if (applied) {
    await fs.writeFile(
      path.join(cwd, AMINO_UI_LOCK_FILE_NAME),
      `${JSON.stringify(nextLockfileData, null, 2)}\n`,
      "utf8",
    )
  }

  return createUpdateAllStrictReportFromItems({
    allDryRunReport,
    applied,
    blocked: false,
    blockers: [],
    items,
    lockfileData: nextLockfileData,
  })
}
