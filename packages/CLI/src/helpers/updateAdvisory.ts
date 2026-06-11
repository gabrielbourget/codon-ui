import { z } from "zod"

import { consumerLockfileDependencySchema, consumerTargetRoleSchema } from "./consumerContract"
import { createDiffReport, type TDiffReport } from "./diff"
import { dependencyInstallPlanSchema } from "./installPlan"
import { CLI_PROJECT_RESOURCE_STATUSES, CLI_REGISTRY_SOURCE_STATUSES } from "./reportConstants"
import { createStatusReport } from "./status"
import { createUpdateDependencyPlan, type TUpdateDependencyPlanningOptions } from "./updateDependencyPlanning"

const UPDATE_ADVISORY_SCHEMA_VERSION = 1

const UPDATE_ADVISORY_ITEM_STATE__UP_TO_DATE = "up-to-date"
const UPDATE_ADVISORY_ITEM_STATE__UPDATE_CANDIDATE = "update-candidate"
const UPDATE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED = "review-required"
const UPDATE_ADVISORY_ITEM_STATE__UNAVAILABLE = "unavailable"

const UPDATE_ADVISORY_ACTION__NONE = "none"
const UPDATE_ADVISORY_ACTION__UPDATE_CANDIDATE = "update-candidate"
const UPDATE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE = "preserve-local-change"
const UPDATE_ADVISORY_ACTION__REVIEW_LOCAL_AND_SOURCE_CHANGE = "review-local-and-source-change"
const UPDATE_ADVISORY_ACTION__PRESERVE_MISSING_FILE = "preserve-missing-file"
const UPDATE_ADVISORY_ACTION__PRESERVE_UNKNOWN = "preserve-unknown"
const UPDATE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT = "preserve-consumer-owned-support"
const UPDATE_ADVISORY_ACTION__PRESERVE_EJECTED = "preserve-ejected"
const UPDATE_ADVISORY_ACTION__INSPECT_SOURCE = "inspect-source"

const UPDATE_ADVISORY_ITEM_STATES = [
  UPDATE_ADVISORY_ITEM_STATE__UP_TO_DATE,
  UPDATE_ADVISORY_ITEM_STATE__UPDATE_CANDIDATE,
  UPDATE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED,
  UPDATE_ADVISORY_ITEM_STATE__UNAVAILABLE,
] as const

const UPDATE_ADVISORY_ACTIONS = [
  UPDATE_ADVISORY_ACTION__NONE,
  UPDATE_ADVISORY_ACTION__UPDATE_CANDIDATE,
  UPDATE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE,
  UPDATE_ADVISORY_ACTION__REVIEW_LOCAL_AND_SOURCE_CHANGE,
  UPDATE_ADVISORY_ACTION__PRESERVE_MISSING_FILE,
  UPDATE_ADVISORY_ACTION__PRESERVE_UNKNOWN,
  UPDATE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT,
  UPDATE_ADVISORY_ACTION__PRESERVE_EJECTED,
  UPDATE_ADVISORY_ACTION__INSPECT_SOURCE,
] as const

const updateAdvisoryFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    message: z.string().min(1),
    severity: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const updateAdvisoryFileSchema = z
  .object({
    action: z.enum(UPDATE_ADVISORY_ACTIONS),
    blocksAutomaticUpdate: z.boolean(),
    comparison: z.string().min(1),
    currentHash: z.string().min(1).optional(),
    currentSourceHash: z.string().min(1).optional(),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    preservationRequired: z.boolean(),
    recommendation: z.string().min(1),
    reviewRequired: z.boolean(),
    sourceHash: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    sourceState: z.string().min(1),
    state: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

export const updateAdvisoryReportSchema = z
  .object({
    advisory: z.literal(true),
    cwd: z.string().min(1),
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    dependencyInstallPlan: dependencyInstallPlanSchema.optional(),
    effects: z
      .object({
        installsDependencies: z.literal(false),
        writesConfig: z.literal(false),
        writesFiles: z.literal(false),
        writesLockfile: z.literal(false),
      })
      .strict(),
    files: z.array(updateAdvisoryFileSchema).default([]),
    findings: z.array(updateAdvisoryFindingSchema).default([]),
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
    itemUpdateState: z.enum(UPDATE_ADVISORY_ITEM_STATES),
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(CLI_REGISTRY_SOURCE_STATUSES),
      })
      .strict(),
    schemaVersion: z.literal(UPDATE_ADVISORY_SCHEMA_VERSION).default(UPDATE_ADVISORY_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
        lockfile: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
      })
      .strict(),
    summary: z
      .object({
        actionStates: z.record(z.enum(UPDATE_ADVISORY_ACTIONS), z.number().int().nonnegative()),
        automaticBlockerCount: z.number().int().nonnegative(),
        candidateFileCount: z.number().int().nonnegative(),
        dependencyStates: z.record(z.string().min(1), z.number().int().nonnegative()),
        fileCount: z.number().int().nonnegative(),
        localChangeCount: z.number().int().nonnegative(),
        preservationRequiredCount: z.number().int().nonnegative(),
        reviewRequiredCount: z.number().int().nonnegative(),
        sourceChangedCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

const updateAllAdvisoryItemSchema = z
  .object({
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    files: z.array(updateAdvisoryFileSchema).default([]),
    findings: z.array(updateAdvisoryFindingSchema).default([]),
    item: updateAdvisoryReportSchema.shape.item,
    itemName: z.string().min(1),
    itemUpdateState: z.enum(UPDATE_ADVISORY_ITEM_STATES),
    summary: updateAdvisoryReportSchema.shape.summary,
  })
  .strict()

export const updateAllAdvisoryReportSchema = z
  .object({
    advisory: z.literal(true),
    all: z.literal(true),
    cwd: z.string().min(1),
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    effects: z
      .object({
        installsDependencies: z.literal(false),
        writesConfig: z.literal(false),
        writesFiles: z.literal(false),
        writesLockfile: z.literal(false),
      })
      .strict(),
    findings: z.array(updateAdvisoryFindingSchema).default([]),
    items: z.array(updateAllAdvisoryItemSchema).default([]),
    registrySource: updateAdvisoryReportSchema.shape.registrySource,
    schemaVersion: z.literal(UPDATE_ADVISORY_SCHEMA_VERSION).default(UPDATE_ADVISORY_SCHEMA_VERSION),
    status: updateAdvisoryReportSchema.shape.status,
    summary: z
      .object({
        actionStates: z.record(z.enum(UPDATE_ADVISORY_ACTIONS), z.number().int().nonnegative()),
        automaticBlockerCount: z.number().int().nonnegative(),
        candidateFileCount: z.number().int().nonnegative(),
        dependencyStates: z.record(z.string().min(1), z.number().int().nonnegative()),
        fileCount: z.number().int().nonnegative(),
        itemCount: z.number().int().nonnegative(),
        itemStates: z.record(z.enum(UPDATE_ADVISORY_ITEM_STATES), z.number().int().nonnegative()),
        localChangeCount: z.number().int().nonnegative(),
        preservationRequiredCount: z.number().int().nonnegative(),
        reviewRequiredCount: z.number().int().nonnegative(),
        sourceChangedCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type TUpdateAdvisoryFile = z.infer<typeof updateAdvisoryFileSchema>
export type TUpdateAdvisoryReport = z.infer<typeof updateAdvisoryReportSchema>
export type TUpdateAllAdvisoryReport = z.infer<typeof updateAllAdvisoryReportSchema>

export type TCreateUpdateAdvisoryReportOptions = {
  cwd: string
  dependencyPolicyOverride?: TUpdateDependencyPlanningOptions["dependencyPolicyOverride"]
  installDependencies?: boolean
  itemName: string
  nonInteractive?: boolean
  packageJsonPath?: string
  packageManager?: TUpdateDependencyPlanningOptions["packageManager"]
  registrySourcePath?: string
}

export type TCreateUpdateAllAdvisoryReportOptions = {
  cwd: string
  registrySourcePath?: string
}

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const resolveUpdateAction = (file: TDiffReport["files"][number]): (typeof UPDATE_ADVISORY_ACTIONS)[number] => {
  if (file.comparison === "source-changed") return UPDATE_ADVISORY_ACTION__UPDATE_CANDIDATE
  if (file.comparison === "local-modification") return UPDATE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE
  if (file.comparison === "local-and-source-changed") {
    return UPDATE_ADVISORY_ACTION__REVIEW_LOCAL_AND_SOURCE_CHANGE
  }
  if (file.comparison === "missing-local-file") return UPDATE_ADVISORY_ACTION__PRESERVE_MISSING_FILE
  if (file.comparison === "unknown-ownership") return UPDATE_ADVISORY_ACTION__PRESERVE_UNKNOWN
  if (file.comparison === "consumer-owned-support" || file.comparison === "consumer-owned-support-source-changed") {
    return UPDATE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT
  }
  if (file.comparison === "ejected") return UPDATE_ADVISORY_ACTION__PRESERVE_EJECTED
  if (file.comparison === "source-unavailable") return UPDATE_ADVISORY_ACTION__INSPECT_SOURCE

  return UPDATE_ADVISORY_ACTION__NONE
}

const resolvePreservationRequired = (action: (typeof UPDATE_ADVISORY_ACTIONS)[number]) =>
  action === UPDATE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE ||
  action === UPDATE_ADVISORY_ACTION__REVIEW_LOCAL_AND_SOURCE_CHANGE ||
  action === UPDATE_ADVISORY_ACTION__PRESERVE_MISSING_FILE ||
  action === UPDATE_ADVISORY_ACTION__PRESERVE_UNKNOWN ||
  action === UPDATE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT ||
  action === UPDATE_ADVISORY_ACTION__PRESERVE_EJECTED

const resolveBlocksAutomaticUpdate = (action: (typeof UPDATE_ADVISORY_ACTIONS)[number]) =>
  action !== UPDATE_ADVISORY_ACTION__NONE && action !== UPDATE_ADVISORY_ACTION__UPDATE_CANDIDATE

const createUpdateAdvisoryFile = (file: TDiffReport["files"][number]) => {
  const action = resolveUpdateAction(file)
  const preservationRequired = resolvePreservationRequired(action)

  return updateAdvisoryFileSchema.parse({
    action,
    blocksAutomaticUpdate: resolveBlocksAutomaticUpdate(action),
    comparison: file.comparison,
    currentHash: file.currentHash,
    currentSourceHash: file.currentSourceHash,
    installedHash: file.installedHash,
    itemName: file.itemName,
    path: file.path,
    preservationRequired,
    recommendation: file.recommendation,
    reviewRequired: file.reviewRequired,
    sourceHash: file.sourceHash,
    sourcePath: file.sourcePath,
    sourceState: file.sourceState,
    state: file.state,
    targetRole: file.targetRole,
  })
}

const resolveItemUpdateState = (files: readonly TUpdateAdvisoryFile[]) => {
  if (files.length === 0) return UPDATE_ADVISORY_ITEM_STATE__UNAVAILABLE
  if (files.some((file) => file.blocksAutomaticUpdate)) {
    return UPDATE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED
  }
  if (files.some((file) => file.action === UPDATE_ADVISORY_ACTION__UPDATE_CANDIDATE)) {
    return UPDATE_ADVISORY_ITEM_STATE__UPDATE_CANDIDATE
  }
  if (files.some((file) => file.reviewRequired)) return UPDATE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED

  return UPDATE_ADVISORY_ITEM_STATE__UP_TO_DATE
}

export const createUpdateAdvisoryReport = async ({
  cwd,
  dependencyPolicyOverride,
  installDependencies,
  itemName,
  nonInteractive,
  packageJsonPath,
  packageManager,
  registrySourcePath,
}: TCreateUpdateAdvisoryReportOptions): Promise<TUpdateAdvisoryReport> => {
  const diffReport = await createDiffReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const dependencyPlan = await createUpdateDependencyPlan({
    cwd,
    dependencyPolicyOverride,
    installDependencies,
    itemName,
    nonInteractive,
    packageJsonPath,
    packageManager,
    registrySourcePath: diffReport.registrySource.path,
  })
  const files = diffReport.files.map(createUpdateAdvisoryFile)
  const actionStates = createEmptyRecord(UPDATE_ADVISORY_ACTIONS)
  const dependencyStates: Record<string, number> = {}

  files.forEach((file) => {
    actionStates[file.action] += 1
  })
  diffReport.dependencies.forEach((dependency) => {
    dependencyStates[dependency.status] = (dependencyStates[dependency.status] ?? 0) + 1
  })

  return updateAdvisoryReportSchema.parse({
    advisory: true,
    cwd,
    dependencies: diffReport.dependencies,
    dependencyInstallPlan: dependencyPlan.dependencyInstallPlan,
    effects: {
      installsDependencies: false,
      writesConfig: false,
      writesFiles: false,
      writesLockfile: false,
    },
    files,
    findings: diffReport.findings,
    item: diffReport.item,
    itemName,
    itemUpdateState: resolveItemUpdateState(files),
    registrySource: diffReport.registrySource,
    status: diffReport.status,
    summary: {
      actionStates,
      automaticBlockerCount: files.filter((file) => file.blocksAutomaticUpdate).length,
      candidateFileCount: files.filter((file) => file.action === UPDATE_ADVISORY_ACTION__UPDATE_CANDIDATE).length,
      dependencyStates,
      fileCount: files.length,
      localChangeCount: diffReport.summary.localChangeCount,
      preservationRequiredCount: files.filter((file) => file.preservationRequired).length,
      reviewRequiredCount: files.filter((file) => file.reviewRequired).length,
      sourceChangedCount: diffReport.summary.sourceChangedCount,
    },
  })
}

export const createUpdateAllAdvisoryReport = async ({
  cwd,
  registrySourcePath,
}: TCreateUpdateAllAdvisoryReportOptions): Promise<TUpdateAllAdvisoryReport> => {
  const statusReport = await createStatusReport({
    cwd,
    registrySourcePath,
  })
  const actionStates = createEmptyRecord(UPDATE_ADVISORY_ACTIONS)
  const itemStates = createEmptyRecord(UPDATE_ADVISORY_ITEM_STATES)
  const dependencyStates: Record<string, number> = {}
  const itemReports = await Promise.all(
    statusReport.items.map((item) =>
      createUpdateAdvisoryReport({
        cwd,
        itemName: item.name,
        registrySourcePath,
      }),
    ),
  )

  statusReport.dependencies.forEach((dependency) => {
    dependencyStates[dependency.status] = (dependencyStates[dependency.status] ?? 0) + 1
  })
  itemReports.forEach((itemReport) => {
    itemStates[itemReport.itemUpdateState] += 1

    UPDATE_ADVISORY_ACTIONS.forEach((action) => {
      actionStates[action] += itemReport.summary.actionStates[action] ?? 0
    })
  })

  return updateAllAdvisoryReportSchema.parse({
    advisory: true,
    all: true,
    cwd,
    dependencies: statusReport.dependencies,
    effects: {
      installsDependencies: false,
      writesConfig: false,
      writesFiles: false,
      writesLockfile: false,
    },
    findings: statusReport.findings,
    items: itemReports.map((itemReport) => ({
      dependencies: itemReport.dependencies,
      files: itemReport.files,
      findings: itemReport.findings,
      item: itemReport.item,
      itemName: itemReport.itemName,
      itemUpdateState: itemReport.itemUpdateState,
      summary: itemReport.summary,
    })),
    registrySource: statusReport.registrySource,
    status: {
      config: statusReport.config.status,
      lockfile: statusReport.lockfile.status,
    },
    summary: {
      actionStates,
      automaticBlockerCount: itemReports.reduce(
        (total, itemReport) => total + itemReport.summary.automaticBlockerCount,
        0,
      ),
      candidateFileCount: itemReports.reduce((total, itemReport) => total + itemReport.summary.candidateFileCount, 0),
      dependencyStates,
      fileCount: itemReports.reduce((total, itemReport) => total + itemReport.summary.fileCount, 0),
      itemCount: itemReports.length,
      itemStates,
      localChangeCount: itemReports.reduce((total, itemReport) => total + itemReport.summary.localChangeCount, 0),
      preservationRequiredCount: itemReports.reduce(
        (total, itemReport) => total + itemReport.summary.preservationRequiredCount,
        0,
      ),
      reviewRequiredCount: itemReports.reduce((total, itemReport) => total + itemReport.summary.reviewRequiredCount, 0),
      sourceChangedCount: itemReports.reduce((total, itemReport) => total + itemReport.summary.sourceChangedCount, 0),
    },
  })
}
