import { existsSync, promises as fs } from "fs"
import path from "path"

import { z } from "zod"

import {
  CODON_UI_LOCK_FILE_NAME,
  CONSUMER_OWNERSHIP_STATE__EJECTED,
  CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED,
  consumerLockfileDependencySchema,
  consumerLockfileSchema,
  consumerTargetRoleSchema,
  type TConsumerLockfile,
} from "./consumerContract"
import { EJECT_TARGETS } from "./ejectConstants"
import { createEjectDryRunReport, type TEjectDryRunFile, type TEjectDryRunReport } from "./ejectDryRun"
import { INSTALL_PLAN_FINDING_SEVERITY__ERROR, INSTALL_PLAN_FINDING_SEVERITIES } from "./installPlan"
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

const EJECT_STRICT_SCHEMA_VERSION = 1

const EJECT_STRICT_ITEM_STATE__EJECTED = "ejected"
const EJECT_STRICT_ITEM_STATE__ALREADY_EJECTED = "already-ejected"
const EJECT_STRICT_ITEM_STATE__BLOCKED = "blocked"
const EJECT_STRICT_ITEM_STATE__UNAVAILABLE = "unavailable"

const EJECT_STRICT_FILE_ACTION__EJECTED_LOCKFILE_OWNERSHIP = "ejected-lockfile-ownership"
const EJECT_STRICT_FILE_ACTION__ALREADY_EJECTED = "already-ejected"
const EJECT_STRICT_FILE_ACTION__BLOCKED = "blocked"
const EJECT_STRICT_FILE_ACTION__SKIPPED = "skipped"

const EJECT_STRICT_BLOCKER_KIND__FILE = "file"
const EJECT_STRICT_BLOCKER_KIND__ITEM = "item"
const EJECT_STRICT_BLOCKER_KIND__PROJECT = "project"

const EJECT_STRICT_ITEM_STATES = [
  EJECT_STRICT_ITEM_STATE__EJECTED,
  EJECT_STRICT_ITEM_STATE__ALREADY_EJECTED,
  EJECT_STRICT_ITEM_STATE__BLOCKED,
  EJECT_STRICT_ITEM_STATE__UNAVAILABLE,
] as const

const EJECT_STRICT_FILE_ACTIONS = [
  EJECT_STRICT_FILE_ACTION__EJECTED_LOCKFILE_OWNERSHIP,
  EJECT_STRICT_FILE_ACTION__ALREADY_EJECTED,
  EJECT_STRICT_FILE_ACTION__BLOCKED,
  EJECT_STRICT_FILE_ACTION__SKIPPED,
] as const

const EJECT_STRICT_BLOCKER_KINDS = [
  EJECT_STRICT_BLOCKER_KIND__FILE,
  EJECT_STRICT_BLOCKER_KIND__ITEM,
  EJECT_STRICT_BLOCKER_KIND__PROJECT,
] as const

const ejectStrictFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    kind: z.enum(EJECT_STRICT_BLOCKER_KINDS).optional(),
    message: z.string().min(1),
    path: z.string().min(1).optional(),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const ejectStrictBlockerSchema = ejectStrictFindingSchema
  .extend({
    kind: z.enum(EJECT_STRICT_BLOCKER_KINDS),
    path: z.string().min(1).optional(),
  })
  .strict()

const ejectStrictFileSchema = z
  .object({
    dryRunAction: z.string().min(1),
    ejectedLockfileOwnership: z.boolean(),
    ejectionTarget: z.enum(EJECT_TARGETS),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    sourceFileTouched: z.literal(false),
    strictAction: z.enum(EJECT_STRICT_FILE_ACTIONS),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

export const ejectStrictReportSchema = z
  .object({
    applied: z.boolean(),
    blockers: z.array(ejectStrictBlockerSchema).default([]),
    cwd: z.string().min(1),
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
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
            alreadyEjectedCount: z.number().int().nonnegative(),
            blockedCount: z.number().int().nonnegative(),
            ejectedLockfileRecordCount: z.number().int().nonnegative(),
            plannedEjectLockfileRecordCount: z.number().int().nonnegative(),
            sourceFileTouchedCount: z.literal(0),
          })
          .strict(),
        installsDependencies: z.literal(false),
        lockfile: z
          .object({
            ejectedFileRecordCount: z.number().int().nonnegative(),
            ejectedItem: z.boolean(),
            plannedItem: z.string().min(1).optional(),
            status: z.enum(CLI_STRICT_WRITE_STATUSES),
          })
          .strict(),
        writesConfig: z.literal(false),
        writesFiles: z.literal(false),
        writesLockfile: z.boolean(),
      })
      .strict(),
    files: z.array(ejectStrictFileSchema).default([]),
    findings: z.array(ejectStrictFindingSchema).default([]),
    itemEjectState: z.enum(EJECT_STRICT_ITEM_STATES),
    itemName: z.string().min(1),
    lockfileData: consumerLockfileSchema,
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(CLI_REGISTRY_SOURCE_STATUSES),
      })
      .strict(),
    schemaVersion: z.literal(EJECT_STRICT_SCHEMA_VERSION).default(EJECT_STRICT_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
        lockfile: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
      })
      .strict(),
  })
  .strict()

export type TEjectStrictReport = z.infer<typeof ejectStrictReportSchema>

export type TCreateEjectStrictReportOptions = {
  cwd: string
  itemName: string
  registrySourcePath?: string
}

type TEjectStrictBlocker = z.infer<typeof ejectStrictBlockerSchema>
type TEjectStrictFile = z.infer<typeof ejectStrictFileSchema>
type TCreateEjectStrictBlockerOptions = Omit<TEjectStrictBlocker, "severity"> & {
  severity?: TEjectStrictBlocker["severity"]
}

const createEjectStrictBlocker = ({
  code,
  itemName,
  kind,
  message,
  path,
  severity = INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  sourcePath,
  targetPath,
}: TCreateEjectStrictBlockerOptions) =>
  ejectStrictBlockerSchema.parse({
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

const readConsumerLockfileForStrictEject = async (
  cwd: string,
): Promise<{
  findings: TEjectStrictBlocker[]
  lockfileData: TConsumerLockfile
}> => {
  const lockfilePath = path.join(cwd, CODON_UI_LOCK_FILE_NAME)

  if (!existsSync(lockfilePath)) {
    return {
      findings: [
        createEjectStrictBlocker({
          code: "strict-eject-lockfile-missing",
          kind: EJECT_STRICT_BLOCKER_KIND__PROJECT,
          message: `${CODON_UI_LOCK_FILE_NAME} is missing. Strict eject requires a valid Codon lockfile.`,
          targetPath: CODON_UI_LOCK_FILE_NAME,
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
        createEjectStrictBlocker({
          code: "strict-eject-lockfile-invalid",
          kind: EJECT_STRICT_BLOCKER_KIND__PROJECT,
          message: `${CODON_UI_LOCK_FILE_NAME} could not be read as a Codon lockfile. ${message}`,
          targetPath: CODON_UI_LOCK_FILE_NAME,
        }),
      ],
      lockfileData: createFallbackLockfile(),
    }
  }
}

const createDryRunBlockers = (dryRunReport: TEjectDryRunReport) =>
  dryRunReport.blockers.map((blocker) =>
    createEjectStrictBlocker({
      code: "strict-eject-dry-run-blocker",
      itemName: blocker.itemName,
      kind: blocker.kind,
      message: `Strict eject is blocked by dry-run blocker "${blocker.code}": ${blocker.message}`,
      path: blocker.path,
      sourcePath: blocker.sourcePath,
      targetPath: blocker.targetPath,
    }),
  )

const createProjectStateBlockers = (dryRunReport: TEjectDryRunReport) => {
  const blockers: TEjectStrictBlocker[] = []

  if (dryRunReport.status.config !== CLI_PROJECT_RESOURCE_STATUS__PRESENT) {
    blockers.push(
      createEjectStrictBlocker({
        code: "strict-eject-config-blocker",
        itemName: dryRunReport.itemName,
        kind: EJECT_STRICT_BLOCKER_KIND__PROJECT,
        message: `Strict eject requires a present consumer config. Current config status is "${dryRunReport.status.config}".`,
      }),
    )
  }

  if (dryRunReport.status.lockfile !== CLI_PROJECT_RESOURCE_STATUS__PRESENT) {
    blockers.push(
      createEjectStrictBlocker({
        code: "strict-eject-lockfile-status-blocker",
        itemName: dryRunReport.itemName,
        kind: EJECT_STRICT_BLOCKER_KIND__PROJECT,
        message: `Strict eject requires a present Codon lockfile. Current lockfile status is "${dryRunReport.status.lockfile}".`,
      }),
    )
  }

  if (dryRunReport.itemEjectState === "unavailable") {
    blockers.push(
      createEjectStrictBlocker({
        code: "strict-eject-item-unavailable",
        itemName: dryRunReport.itemName,
        kind: EJECT_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict eject cannot continue because item "${dryRunReport.itemName}" is unavailable.`,
      }),
    )
  } else if (dryRunReport.itemEjectState !== "would-eject" && dryRunReport.itemEjectState !== "already-ejected") {
    blockers.push(
      createEjectStrictBlocker({
        code: "strict-eject-item-state-blocker",
        itemName: dryRunReport.itemName,
        kind: EJECT_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict eject requires itemEjectState "would-eject" or "already-ejected"; received "${dryRunReport.itemEjectState}".`,
      }),
    )
  }

  if (
    dryRunReport.itemEjectState === "would-eject" &&
    dryRunReport.wouldEffects.lockfile.status !== CLI_WRITE_STATUS__WOULD_WRITE
  ) {
    blockers.push(
      createEjectStrictBlocker({
        code: "strict-eject-lockfile-effect-blocker",
        itemName: dryRunReport.itemName,
        kind: EJECT_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict eject requires a would-write lockfile dry-run effect; received "${dryRunReport.wouldEffects.lockfile.status}".`,
      }),
    )
  }

  if (
    dryRunReport.itemEjectState === "already-ejected" &&
    dryRunReport.wouldEffects.lockfile.status !== CLI_WRITE_STATUS__NOT_WRITTEN
  ) {
    blockers.push(
      createEjectStrictBlocker({
        code: "strict-eject-already-ejected-effect-blocker",
        itemName: dryRunReport.itemName,
        kind: EJECT_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict eject expected an already-ejected item to be lockfile no-op; received "${dryRunReport.wouldEffects.lockfile.status}".`,
      }),
    )
  }

  return blockers
}

const createLockfileBlockers = ({
  dryRunReport,
  lockfileData,
}: {
  dryRunReport: TEjectDryRunReport
  lockfileData: TConsumerLockfile
}) => {
  const item = lockfileData.items[dryRunReport.itemName]

  if (!item) {
    return [
      createEjectStrictBlocker({
        code: "strict-eject-lockfile-item-missing",
        itemName: dryRunReport.itemName,
        kind: EJECT_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict eject cannot continue because "${dryRunReport.itemName}" is missing from ${CODON_UI_LOCK_FILE_NAME}.`,
      }),
    ]
  }

  return dryRunReport.files.flatMap((dryRunFile) => {
    const lockfileFile = item.files.find((file) => file.path === dryRunFile.path)

    if (!lockfileFile) {
      return [
        createEjectStrictBlocker({
          code: "strict-eject-lockfile-file-missing",
          itemName: dryRunFile.itemName,
          kind: EJECT_STRICT_BLOCKER_KIND__FILE,
          message: `Strict eject cannot continue because ${dryRunFile.path} is missing from the lockfile item.`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      ]
    }

    if (
      dryRunFile.dryRunAction === "would-eject-lockfile-ownership" &&
      lockfileFile.ownershipState !== CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED
    ) {
      return [
        createEjectStrictBlocker({
          code: "strict-eject-lockfile-ownership-blocker",
          itemName: dryRunFile.itemName,
          kind: EJECT_STRICT_BLOCKER_KIND__FILE,
          message: `Strict eject expected ${dryRunFile.path} to be registry-owned before ownership transfer, but lockfile ownership is "${lockfileFile.ownershipState}".`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      ]
    }

    if (
      dryRunFile.dryRunAction === "already-ejected" &&
      lockfileFile.ownershipState !== CONSUMER_OWNERSHIP_STATE__EJECTED
    ) {
      return [
        createEjectStrictBlocker({
          code: "strict-eject-already-ejected-lockfile-blocker",
          itemName: dryRunFile.itemName,
          kind: EJECT_STRICT_BLOCKER_KIND__FILE,
          message: `Strict eject expected ${dryRunFile.path} to already be ejected, but lockfile ownership is "${lockfileFile.ownershipState}".`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      ]
    }

    return []
  })
}

const createFileActionBlockers = (dryRunReport: TEjectDryRunReport) =>
  dryRunReport.files.flatMap((dryRunFile) => {
    if (dryRunFile.dryRunAction === "would-eject-lockfile-ownership") return []
    if (dryRunFile.dryRunAction === "already-ejected") return []

    return [
      createEjectStrictBlocker({
        code: "strict-eject-file-action-blocker",
        itemName: dryRunFile.itemName,
        kind: EJECT_STRICT_BLOCKER_KIND__FILE,
        message: `Strict eject cannot apply file ${dryRunFile.path} because dry-run action is "${dryRunFile.dryRunAction}".`,
        path: dryRunFile.path,
        targetPath: dryRunFile.path,
      }),
    ]
  })

const dedupeBlockers = (blockers: readonly TEjectStrictBlocker[]) => {
  const dedupedBlockers = new Map<string, TEjectStrictBlocker>()

  blockers.forEach((blocker) => {
    dedupedBlockers.set(
      [blocker.code, blocker.itemName, blocker.path, blocker.sourcePath, blocker.targetPath].join(":"),
      blocker,
    )
  })

  return [...dedupedBlockers.values()]
}

const resolveBlockedFiles = (files: readonly TEjectDryRunFile[]) =>
  files.map((file) =>
    ejectStrictFileSchema.parse({
      dryRunAction: file.dryRunAction,
      ejectedLockfileOwnership: false,
      ejectionTarget: file.ejectionTarget,
      installedHash: file.installedHash,
      itemName: file.itemName,
      path: file.path,
      sourceFileTouched: false,
      strictAction:
        file.dryRunAction === "blocked" ? EJECT_STRICT_FILE_ACTION__BLOCKED : EJECT_STRICT_FILE_ACTION__SKIPPED,
      targetRole: file.targetRole,
    }),
  )

const resolveAlreadyEjectedFiles = (files: readonly TEjectDryRunFile[]) =>
  files.map((file) =>
    ejectStrictFileSchema.parse({
      dryRunAction: file.dryRunAction,
      ejectedLockfileOwnership: false,
      ejectionTarget: file.ejectionTarget,
      installedHash: file.installedHash,
      itemName: file.itemName,
      path: file.path,
      sourceFileTouched: false,
      strictAction: EJECT_STRICT_FILE_ACTION__ALREADY_EJECTED,
      targetRole: file.targetRole,
    }),
  )

const writeStrictEject = async ({
  cwd,
  dryRunReport,
  lockfileData,
}: {
  cwd: string
  dryRunReport: TEjectDryRunReport
  lockfileData: TConsumerLockfile
}) => {
  const item = lockfileData.items[dryRunReport.itemName]

  if (!item) {
    throw new Error(`Strict eject cannot write because "${dryRunReport.itemName}" is missing from the lockfile.`)
  }

  const ejectedPaths = new Set(
    dryRunReport.files
      .filter((file) => file.dryRunAction === "would-eject-lockfile-ownership")
      .map((file) => file.path),
  )
  const files = dryRunReport.files.map((file) =>
    ejectStrictFileSchema.parse({
      dryRunAction: file.dryRunAction,
      ejectedLockfileOwnership: file.dryRunAction === "would-eject-lockfile-ownership",
      ejectionTarget: file.ejectionTarget,
      installedHash: file.installedHash,
      itemName: file.itemName,
      path: file.path,
      sourceFileTouched: false,
      strictAction: EJECT_STRICT_FILE_ACTION__EJECTED_LOCKFILE_OWNERSHIP,
      targetRole: file.targetRole,
    }),
  )
  const nextItems = {
    ...lockfileData.items,
    [dryRunReport.itemName]: {
      ...item,
      files: item.files.map((file) =>
        ejectedPaths.has(file.path)
          ? {
              ...file,
              ownershipState: CONSUMER_OWNERSHIP_STATE__EJECTED,
            }
          : file,
      ),
    },
  }
  const nextLockfileData = consumerLockfileSchema.parse({
    ...lockfileData,
    items: nextItems,
  })

  await fs.writeFile(path.join(cwd, CODON_UI_LOCK_FILE_NAME), `${JSON.stringify(nextLockfileData, null, 2)}\n`, "utf8")

  return {
    files,
    lockfileData: nextLockfileData,
  }
}

const createEjectStrictEffects = ({
  applied,
  blocked,
  dryRunReport,
  files,
}: {
  applied: boolean
  blocked: boolean
  dryRunReport: TEjectDryRunReport
  files: readonly TEjectStrictFile[]
}) => {
  const ejectedLockfileRecordCount = files.filter((file) => file.ejectedLockfileOwnership).length
  const alreadyEjectedCount = files.filter(
    (file) => file.strictAction === EJECT_STRICT_FILE_ACTION__ALREADY_EJECTED,
  ).length
  const blockedCount = files.filter((file) => file.strictAction === EJECT_STRICT_FILE_ACTION__BLOCKED).length

  return {
    dependencies: {
      status: CLI_WRITE_STATUS__NOT_WRITTEN,
      updatedCount: 0,
    },
    files: {
      alreadyEjectedCount,
      blockedCount,
      ejectedLockfileRecordCount,
      plannedEjectLockfileRecordCount: dryRunReport.summary.wouldEjectLockfileRecordCount,
      sourceFileTouchedCount: 0,
    },
    installsDependencies: false,
    lockfile: {
      ejectedFileRecordCount: ejectedLockfileRecordCount,
      ejectedItem: applied,
      plannedItem: dryRunReport.files.length > 0 ? dryRunReport.itemName : undefined,
      status: applied ? CLI_WRITE_STATUS__WRITTEN : blocked ? CLI_WRITE_STATUS__BLOCKED : CLI_WRITE_STATUS__NOT_WRITTEN,
    },
    writesConfig: false,
    writesFiles: false,
    writesLockfile: applied,
  } as const
}

const resolveItemEjectState = ({ applied, dryRunReport }: { applied: boolean; dryRunReport: TEjectDryRunReport }) => {
  if (applied) return EJECT_STRICT_ITEM_STATE__EJECTED
  if (dryRunReport.itemEjectState === "already-ejected") return EJECT_STRICT_ITEM_STATE__ALREADY_EJECTED
  if (dryRunReport.itemEjectState === "unavailable") return EJECT_STRICT_ITEM_STATE__UNAVAILABLE

  return EJECT_STRICT_ITEM_STATE__BLOCKED
}

export const createEjectStrictReport = async ({
  cwd,
  itemName,
  registrySourcePath,
}: TCreateEjectStrictReportOptions): Promise<TEjectStrictReport> => {
  const dryRunReport = await createEjectDryRunReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const lockfilePlan = await readConsumerLockfileForStrictEject(cwd)
  const blockers = dedupeBlockers([
    ...lockfilePlan.findings,
    ...createDryRunBlockers(dryRunReport),
    ...createProjectStateBlockers(dryRunReport),
    ...createLockfileBlockers({
      dryRunReport,
      lockfileData: lockfilePlan.lockfileData,
    }),
    ...createFileActionBlockers(dryRunReport),
  ])

  if (blockers.length > 0) {
    const files = resolveBlockedFiles(dryRunReport.files)

    return ejectStrictReportSchema.parse({
      applied: false,
      blockers,
      cwd,
      dependencies: dryRunReport.dependencies,
      effects: createEjectStrictEffects({
        applied: false,
        blocked: true,
        dryRunReport,
        files,
      }),
      files,
      findings: [...dryRunReport.findings, ...blockers],
      itemEjectState: resolveItemEjectState({
        applied: false,
        dryRunReport,
      }),
      itemName,
      lockfileData: lockfilePlan.lockfileData,
      registrySource: dryRunReport.registrySource,
      status: dryRunReport.status,
    })
  }

  if (dryRunReport.itemEjectState === "already-ejected") {
    const files = resolveAlreadyEjectedFiles(dryRunReport.files)

    return ejectStrictReportSchema.parse({
      applied: false,
      blockers: [],
      cwd,
      dependencies: dryRunReport.dependencies,
      effects: createEjectStrictEffects({
        applied: false,
        blocked: false,
        dryRunReport,
        files,
      }),
      files,
      findings: dryRunReport.findings,
      itemEjectState: EJECT_STRICT_ITEM_STATE__ALREADY_EJECTED,
      itemName,
      lockfileData: lockfilePlan.lockfileData,
      registrySource: dryRunReport.registrySource,
      status: dryRunReport.status,
    })
  }

  const result = await writeStrictEject({
    cwd,
    dryRunReport,
    lockfileData: lockfilePlan.lockfileData,
  })

  return ejectStrictReportSchema.parse({
    applied: true,
    blockers: [],
    cwd,
    dependencies: dryRunReport.dependencies,
    effects: createEjectStrictEffects({
      applied: true,
      blocked: false,
      dryRunReport,
      files: result.files,
    }),
    files: result.files,
    findings: dryRunReport.findings,
    itemEjectState: resolveItemEjectState({
      applied: true,
      dryRunReport,
    }),
    itemName,
    lockfileData: result.lockfileData,
    registrySource: dryRunReport.registrySource,
    status: dryRunReport.status,
  })
}
