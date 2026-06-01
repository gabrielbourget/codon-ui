import { z } from "zod"

import { consumerLockfileSchema, consumerTargetRoleSchema } from "@/src/helpers/consumerContract"

import {
  INSTALL_PLAN_DEPENDENCY_KINDS,
  INSTALL_PLAN_DEPENDENCY_STATUSES,
  INSTALL_PLAN_FILE_STATUSES,
  INSTALL_PLAN_FINDING_SEVERITIES,
  INSTALL_PLAN_SOURCE_STATUSES,
  LOCAL_REGISTRY_SOURCE_SCHEMA_VERSION,
  REGISTRY_FILE_ROLES,
  REGISTRY_INSTALL_PLAN_SCHEMA_VERSION,
  REGISTRY_ITEM_TYPES,
} from "./constants"

export type TRegistryItemType = (typeof REGISTRY_ITEM_TYPES)[number]
export type TRegistryFileRole = (typeof REGISTRY_FILE_ROLES)[number]
export type TInstallPlanFileStatus = (typeof INSTALL_PLAN_FILE_STATUSES)[number]
export type TInstallPlanSourceStatus = (typeof INSTALL_PLAN_SOURCE_STATUSES)[number]
export type TInstallPlanDependencyKind = (typeof INSTALL_PLAN_DEPENDENCY_KINDS)[number]
export type TInstallPlanDependencyStatus = (typeof INSTALL_PLAN_DEPENDENCY_STATUSES)[number]
export type TInstallPlanFindingSeverity = (typeof INSTALL_PLAN_FINDING_SEVERITIES)[number]

export const dependencyMapSchema = z.record(z.string().min(1), z.string().min(1))

export const localRegistryFileSchema = z
  .object({
    sourcePath: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
    targetPath: z.string().min(1),
    role: z.enum(REGISTRY_FILE_ROLES),
    contentHash: z.string().min(1).optional(),
    required: z.boolean().optional(),
  })
  .strict()

export type TLocalRegistryFile = z.infer<typeof localRegistryFileSchema>

export const localRegistryItemSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(REGISTRY_ITEM_TYPES),
    sourcePackage: z.string().min(1),
    files: z.array(localRegistryFileSchema).min(1),
    registryDependencies: z.array(z.string().min(1)).default([]),
    peerDependencies: dependencyMapSchema.default({}),
    runtimeDependencies: dependencyMapSchema.default({}),
    devDependencies: dependencyMapSchema.default({}),
  })
  .strict()

export type TLocalRegistryItem = z.infer<typeof localRegistryItemSchema>

export const localRegistrySourceSchema = z
  .object({
    schemaVersion: z.literal(LOCAL_REGISTRY_SOURCE_SCHEMA_VERSION).default(LOCAL_REGISTRY_SOURCE_SCHEMA_VERSION),
    sourceIdentity: z.string().min(1),
    sourceRoot: z.string().min(1).optional(),
    items: z.array(localRegistryItemSchema).default([]),
  })
  .strict()

export type TLocalRegistrySource = z.infer<typeof localRegistrySourceSchema>

export const installPlanFindingSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    itemName: z.string().min(1).optional(),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

export type TInstallPlanFinding = z.infer<typeof installPlanFindingSchema>

export const installPlanFileSchema = z
  .object({
    itemName: z.string().min(1),
    sourcePath: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
    targetPath: z.string().min(1),
    resolvedPath: z.string().min(1),
    sourceStatus: z.enum(INSTALL_PLAN_SOURCE_STATUSES),
    targetStatus: z.enum(INSTALL_PLAN_FILE_STATUSES),
    role: z.enum(REGISTRY_FILE_ROLES),
    contentHash: z.string().min(1).optional(),
    required: z.boolean().optional(),
  })
  .strict()

export type TInstallPlanFile = z.infer<typeof installPlanFileSchema>

export const installPlanItemSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(REGISTRY_ITEM_TYPES),
    sourcePackage: z.string().min(1),
    registryDependencies: z.array(z.string().min(1)).default([]),
    files: z.array(installPlanFileSchema).default([]),
  })
  .strict()

export type TInstallPlanItem = z.infer<typeof installPlanItemSchema>

export const installPlanDependenciesSchema = z
  .object({
    peerDependencies: dependencyMapSchema.default({}),
    runtimeDependencies: dependencyMapSchema.default({}),
    devDependencies: dependencyMapSchema.default({}),
  })
  .strict()

export type TInstallPlanDependencies = z.infer<typeof installPlanDependenciesSchema>

export const installPlanDependencySchema = z
  .object({
    name: z.string().min(1),
    kind: z.enum(INSTALL_PLAN_DEPENDENCY_KINDS),
    requiredRange: z.string().min(1),
    status: z.enum(INSTALL_PLAN_DEPENDENCY_STATUSES),
    declaredRange: z.string().min(1).optional(),
    declaredIn: z.enum(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]).optional(),
  })
  .strict()

export type TInstallPlanDependency = z.infer<typeof installPlanDependencySchema>

export const registryInstallPlanSchema = z
  .object({
    schemaVersion: z.literal(REGISTRY_INSTALL_PLAN_SCHEMA_VERSION).default(REGISTRY_INSTALL_PLAN_SCHEMA_VERSION),
    requestedItems: z.array(z.string().min(1)).default([]),
    sourceIdentity: z.string().min(1),
    items: z.array(installPlanItemSchema).default([]),
    files: z.array(installPlanFileSchema).default([]),
    dependencies: installPlanDependenciesSchema.default({}),
    dependencyPlan: z.array(installPlanDependencySchema).default([]),
    findings: z.array(installPlanFindingSchema).default([]),
  })
  .strict()

export type TRegistryInstallPlan = z.infer<typeof registryInstallPlanSchema>

export const addAdvisoryComponentPublicExportSchema = z
  .object({
    exportedName: z.string().min(1),
    sourcePath: z.string().min(1),
    localName: z.string().min(1).optional(),
    typeOnly: z.boolean().optional(),
  })
  .strict()

export const addAdvisoryComponentImportResolutionSchema = z
  .object({
    sourcePath: z.string().min(1),
    importSource: z.string().min(1),
    registryDependencyName: z.string().min(1).optional(),
    replacementSource: z.string().min(1).optional(),
    advisory: z.boolean().optional(),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()

export const addAdvisoryComponentThemeRequirementSchema = z
  .object({
    strategy: z.string().min(1),
    cssVariables: z.array(z.string().min(1)).default([]),
    files: z.array(localRegistryFileSchema).default([]),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()

export const addAdvisoryComponentVerificationStepSchema = z
  .object({
    kind: z.string().min(1),
    command: z.string().min(1),
    workingDirectory: z.string().min(1).optional(),
    advisory: z.boolean().optional(),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()

export const addAdvisoryComponentPacketSchema = z
  .object({
    activationStatus: z.literal("local-registry"),
    name: z.string().min(1),
    sourceRepository: z.string().min(1).optional(),
    sourceRef: z.string().min(1).optional(),
    publicExports: z.array(addAdvisoryComponentPublicExportSchema).default([]),
    importResolutions: z.array(addAdvisoryComponentImportResolutionSchema).default([]),
    excludedSourcePaths: z.array(z.string().min(1)).default([]),
    themeRequirements: z.array(addAdvisoryComponentThemeRequirementSchema).default([]),
    verification: z.array(addAdvisoryComponentVerificationStepSchema).default([]),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()

export type TAddAdvisoryComponentPacket = z.infer<typeof addAdvisoryComponentPacketSchema>

export const addAdvisoryEffectsSchema = z
  .object({
    installsDependencies: z.literal(false),
    writesConfig: z.literal(false),
    writesFiles: z.literal(false),
    writesLockfile: z.literal(false),
    lockfile: z
      .object({
        plannedFileCount: z.number().int().nonnegative(),
        plannedItems: z.array(z.string().min(1)).default([]),
        status: z.literal("not-written"),
      })
      .strict(),
  })
  .strict()

export type TAddAdvisoryEffects = z.infer<typeof addAdvisoryEffectsSchema>

export const addAdvisorySchema = z
  .object({
    advisory: z.literal(true),
    componentPackets: z.array(addAdvisoryComponentPacketSchema).default([]),
    cwd: z.string().min(1),
    effects: addAdvisoryEffectsSchema,
    registrySourcePath: z.string().min(1),
    installPlan: registryInstallPlanSchema,
    findings: z.array(installPlanFindingSchema).default([]),
  })
  .strict()

export type TAddAdvisory = z.infer<typeof addAdvisorySchema>

export const addDryRunEffectsSchema = z
  .object({
    dependencies: z
      .object({
        incompatibleCount: z.number().int().nonnegative(),
        missingCount: z.number().int().nonnegative(),
        requiresDecisionCount: z.number().int().nonnegative(),
        satisfiedCount: z.number().int().nonnegative(),
        unresolvedCount: z.number().int().nonnegative(),
      })
      .strict(),
    files: z
      .object({
        blockedExistingTargetCount: z.number().int().nonnegative(),
        missingSourceCount: z.number().int().nonnegative(),
        plannedCount: z.number().int().nonnegative(),
        wouldWriteCount: z.number().int().nonnegative(),
      })
      .strict(),
    installsDependencies: z.literal(false),
    writesConfig: z.literal(false),
    writesFiles: z.literal(false),
    writesLockfile: z.literal(false),
    lockfile: z
      .object({
        plannedFileCount: z.number().int().nonnegative(),
        plannedItems: z.array(z.string().min(1)).default([]),
        status: z.literal("would-write"),
      })
      .strict(),
  })
  .strict()

export type TAddDryRunEffects = z.infer<typeof addDryRunEffectsSchema>

export const addDryRunSchema = z
  .object({
    componentPackets: z.array(addAdvisoryComponentPacketSchema).default([]),
    cwd: z.string().min(1),
    dryRun: z.literal(true),
    effects: addDryRunEffectsSchema,
    registrySourcePath: z.string().min(1),
    installPlan: registryInstallPlanSchema,
    findings: z.array(installPlanFindingSchema).default([]),
  })
  .strict()

export type TAddDryRun = z.infer<typeof addDryRunSchema>

export const addStrictEffectsSchema = z
  .object({
    dependencies: z
      .object({
        incompatibleCount: z.number().int().nonnegative(),
        missingCount: z.number().int().nonnegative(),
        requiresDecisionCount: z.number().int().nonnegative(),
        satisfiedCount: z.number().int().nonnegative(),
        unresolvedCount: z.number().int().nonnegative(),
      })
      .strict(),
    files: z
      .object({
        blockedExistingTargetCount: z.number().int().nonnegative(),
        missingSourceCount: z.number().int().nonnegative(),
        plannedCount: z.number().int().nonnegative(),
        writtenCount: z.number().int().nonnegative(),
      })
      .strict(),
    installsDependencies: z.literal(false),
    writesConfig: z.literal(false),
    writesFiles: z.boolean(),
    writesLockfile: z.boolean(),
    lockfile: z
      .object({
        plannedFileCount: z.number().int().nonnegative(),
        plannedItems: z.array(z.string().min(1)).default([]),
        status: z.enum(["blocked", "written"]),
        writtenFileCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type TAddStrictEffects = z.infer<typeof addStrictEffectsSchema>

export const addStrictSchema = z
  .object({
    applied: z.boolean(),
    componentPackets: z.array(addAdvisoryComponentPacketSchema).default([]),
    cwd: z.string().min(1),
    effects: addStrictEffectsSchema,
    registrySourcePath: z.string().min(1),
    installPlan: registryInstallPlanSchema,
    findings: z.array(installPlanFindingSchema).default([]),
    lockfileData: consumerLockfileSchema,
  })
  .strict()

export type TAddStrict = z.infer<typeof addStrictSchema>
