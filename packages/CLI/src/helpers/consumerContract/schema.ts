import { z } from "zod"

import {
  AMINO_UI_CONFIG_FILE_NAME,
  AMINO_UI_LOCK_FILE_NAME,
  CONSUMER_ADVISORY_SEVERITIES,
  CONSUMER_DEPENDENCY_POLICIES,
  CONSUMER_LAYOUT_MODE__REGISTRY_CONTAINED,
  CONSUMER_LAYOUT_MODES,
  CONSUMER_OWNERSHIP_STATES,
  CONSUMER_PACKAGE_MANAGERS,
  CONSUMER_TARGET_ROLES,
  CONSUMER_THEME_TIER__DEFAULT_CONTRACT,
  CONSUMER_THEME_TIERS,
  DEFAULT_REGISTRY_CONTAINED_COMPONENTS_PATH,
  DEFAULT_REGISTRY_CONTAINED_REGISTRY_PATH,
} from "./constants"

export type TConsumerLayoutMode = (typeof CONSUMER_LAYOUT_MODES)[number]
export type TConsumerTargetRole = (typeof CONSUMER_TARGET_ROLES)[number]
export type TConsumerThemeTier = (typeof CONSUMER_THEME_TIERS)[number]
export type TConsumerDependencyPolicy = (typeof CONSUMER_DEPENDENCY_POLICIES)[number]
export type TConsumerPackageManager = (typeof CONSUMER_PACKAGE_MANAGERS)[number]
export type TConsumerOwnershipState = (typeof CONSUMER_OWNERSHIP_STATES)[number]
export type TConsumerAdvisorySeverity = (typeof CONSUMER_ADVISORY_SEVERITIES)[number]

export const consumerTargetRoleSchema = z.enum(CONSUMER_TARGET_ROLES)
export const consumerTargetPathOverridesSchema = z.record(consumerTargetRoleSchema, z.string().min(1))

export const consumerConfigSchema = z
  .object({
    $schema: z.string().optional(),
    configVersion: z.literal(1).default(1),
    layoutMode: z.enum(CONSUMER_LAYOUT_MODES).default(CONSUMER_LAYOUT_MODE__REGISTRY_CONTAINED),
    paths: z
      .object({
        components: z.string().min(1).default(DEFAULT_REGISTRY_CONTAINED_COMPONENTS_PATH),
        registry: z.string().min(1).default(DEFAULT_REGISTRY_CONTAINED_REGISTRY_PATH),
        roles: consumerTargetPathOverridesSchema.default({}),
      })
      .default({}),
    registry: z
      .object({
        source: z.string().min(1).default("local"),
        sourcePackage: z.string().min(1).default("@amino-ui/react"),
      })
      .default({}),
    theme: z
      .object({
        tier: z.enum(CONSUMER_THEME_TIERS).default(CONSUMER_THEME_TIER__DEFAULT_CONTRACT),
      })
      .default({}),
    dependencies: z
      .object({
        policy: z.enum(CONSUMER_DEPENDENCY_POLICIES).default("report-only"),
      })
      .default({}),
  })
  .strict()

export type TConsumerConfig = z.infer<typeof consumerConfigSchema>

export const consumerLockfileTargetFileSchema = z
  .object({
    path: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
    sourceHash: z.string().min(1),
    installedHash: z.string().min(1),
    ownershipState: z.enum(CONSUMER_OWNERSHIP_STATES),
  })
  .strict()

export const consumerLockfileItemSchema = z
  .object({
    name: z.string().min(1),
    sourceIdentity: z.string().min(1),
    registryDependencies: z.array(z.string().min(1)).default([]),
    files: z.array(consumerLockfileTargetFileSchema).default([]),
  })
  .strict()

export const consumerLockfileSchema = z
  .object({
    lockfileVersion: z.literal(1).default(1),
    configFile: z.literal(AMINO_UI_CONFIG_FILE_NAME).default(AMINO_UI_CONFIG_FILE_NAME),
    items: z.record(z.string().min(1), consumerLockfileItemSchema).default({}),
  })
  .strict()

export type TConsumerLockfile = z.infer<typeof consumerLockfileSchema>

export const consumerAdvisoryFindingSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    severity: z.enum(CONSUMER_ADVISORY_SEVERITIES),
  })
  .strict()

export const consumerInitAdvisorySchema = z
  .object({
    advisory: z.literal(true),
    configFile: z.literal(AMINO_UI_CONFIG_FILE_NAME).default(AMINO_UI_CONFIG_FILE_NAME),
    cwd: z.string().min(1),
    lockfile: z.literal(AMINO_UI_LOCK_FILE_NAME).default(AMINO_UI_LOCK_FILE_NAME),
    packageManager: z.enum(CONSUMER_PACKAGE_MANAGERS),
    proposedConfig: consumerConfigSchema,
    findings: z.array(consumerAdvisoryFindingSchema).default([]),
  })
  .strict()

export type TConsumerInitAdvisory = z.infer<typeof consumerInitAdvisorySchema>
