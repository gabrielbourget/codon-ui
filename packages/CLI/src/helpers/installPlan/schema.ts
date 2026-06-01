import { z } from "zod"

import { consumerTargetRoleSchema } from "@/src/helpers/consumerContract"

import {
  INSTALL_PLAN_FILE_STATUSES,
  INSTALL_PLAN_FINDING_SEVERITIES,
  LOCAL_REGISTRY_SOURCE_SCHEMA_VERSION,
  REGISTRY_FILE_ROLES,
  REGISTRY_INSTALL_PLAN_SCHEMA_VERSION,
  REGISTRY_ITEM_TYPES,
} from "./constants"

export type TRegistryItemType = (typeof REGISTRY_ITEM_TYPES)[number]
export type TRegistryFileRole = (typeof REGISTRY_FILE_ROLES)[number]
export type TInstallPlanFileStatus = (typeof INSTALL_PLAN_FILE_STATUSES)[number]
export type TInstallPlanFindingSeverity = (typeof INSTALL_PLAN_FINDING_SEVERITIES)[number]

export const dependencyMapSchema = z.record(z.string().min(1), z.string().min(1))

export const localRegistryFileSchema = z
  .object({
    sourcePath: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
    targetPath: z.string().min(1),
    role: z.enum(REGISTRY_FILE_ROLES),
    contentHash: z.string().min(1).optional(),
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
    targetStatus: z.enum(INSTALL_PLAN_FILE_STATUSES),
    role: z.enum(REGISTRY_FILE_ROLES),
    contentHash: z.string().min(1).optional(),
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

export const registryInstallPlanSchema = z
  .object({
    schemaVersion: z.literal(REGISTRY_INSTALL_PLAN_SCHEMA_VERSION).default(REGISTRY_INSTALL_PLAN_SCHEMA_VERSION),
    requestedItems: z.array(z.string().min(1)).default([]),
    sourceIdentity: z.string().min(1),
    items: z.array(installPlanItemSchema).default([]),
    files: z.array(installPlanFileSchema).default([]),
    dependencies: installPlanDependenciesSchema.default({}),
    findings: z.array(installPlanFindingSchema).default([]),
  })
  .strict()

export type TRegistryInstallPlan = z.infer<typeof registryInstallPlanSchema>

export const addAdvisorySchema = z
  .object({
    advisory: z.literal(true),
    cwd: z.string().min(1),
    registrySourcePath: z.string().min(1),
    installPlan: registryInstallPlanSchema,
    findings: z.array(installPlanFindingSchema).default([]),
  })
  .strict()

export type TAddAdvisory = z.infer<typeof addAdvisorySchema>
