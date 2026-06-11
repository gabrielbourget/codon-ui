import { z } from "zod"

import { PACKAGE_MANIFEST_DEPENDENCY_FIELDS } from "../packageManifestConstants"
import { CLI_DRY_RUN_WRITE_STATUSES, CLI_WRITE_STATUS__NOT_WRITTEN } from "../reportConstants"

import {
  CODON_UI_CONFIG_FILE_NAME,
  CODON_UI_LOCK_FILE_NAME,
  CONSUMER_ADVISORY_SEVERITIES,
  CONSUMER_DEPENDENCY_ACTION__NONE,
  CONSUMER_DEPENDENCY_ACTIONS,
  CONSUMER_DEPENDENCY_POLICY__REPORT_ONLY,
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
export type TConsumerDependencyAction = (typeof CONSUMER_DEPENDENCY_ACTIONS)[number]
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
        sourcePackage: z.string().min(1).default("@codon-ui/react"),
      })
      .default({}),
    theme: z
      .object({
        tier: z.enum(CONSUMER_THEME_TIERS).default(CONSUMER_THEME_TIER__DEFAULT_CONTRACT),
      })
      .default({}),
    dependencies: z
      .object({
        policy: z.enum(CONSUMER_DEPENDENCY_POLICIES).default(CONSUMER_DEPENDENCY_POLICY__REPORT_ONLY),
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

export const consumerLockfileDependencySchema = z
  .object({
    action: z.enum(CONSUMER_DEPENDENCY_ACTIONS).default(CONSUMER_DEPENDENCY_ACTION__NONE),
    declaredIn: z.enum(PACKAGE_MANIFEST_DEPENDENCY_FIELDS).optional(),
    declaredRange: z.string().min(1).optional(),
    kind: z.string().min(1),
    name: z.string().min(1),
    requiredRange: z.string().min(1),
    status: z.string().min(1),
  })
  .strict()

export const consumerLockfileSchema = z
  .object({
    lockfileVersion: z.literal(1).default(1),
    configFile: z.literal(CODON_UI_CONFIG_FILE_NAME).default(CODON_UI_CONFIG_FILE_NAME),
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    items: z.record(z.string().min(1), consumerLockfileItemSchema).default({}),
    themeTier: z.enum(CONSUMER_THEME_TIERS).optional(),
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

export const consumerProjectContextSchema = z
  .object({
    cwd: z.string().min(1),
    hasComponentsDirectory: z.boolean(),
    hasConfigFile: z.boolean(),
    hasLockfile: z.boolean(),
    hasPackageJson: z.boolean(),
    hasRegistryDirectory: z.boolean(),
    hasSrcDirectory: z.boolean(),
    hasTsConfig: z.boolean(),
    packageManager: z.enum(CONSUMER_PACKAGE_MANAGERS),
    packageName: z.string().optional(),
    projectKind: z.string(),
  })
  .strict()

export type TConsumerProjectContext = z.infer<typeof consumerProjectContextSchema>

export const consumerInitAdvisorySchema = z
  .object({
    advisory: z.literal(true),
    configFile: z.literal(CODON_UI_CONFIG_FILE_NAME).default(CODON_UI_CONFIG_FILE_NAME),
    cwd: z.string().min(1),
    lockfile: z.literal(CODON_UI_LOCK_FILE_NAME).default(CODON_UI_LOCK_FILE_NAME),
    packageManager: z.enum(CONSUMER_PACKAGE_MANAGERS),
    project: consumerProjectContextSchema,
    proposedConfig: consumerConfigSchema,
    targetPaths: z.record(consumerTargetRoleSchema, z.string().min(1)),
    findings: z.array(consumerAdvisoryFindingSchema).default([]),
  })
  .strict()

export type TConsumerInitAdvisory = z.infer<typeof consumerInitAdvisorySchema>

export const consumerInitSeedResultSchema = z
  .object({
    config: consumerConfigSchema,
    configFile: z.literal(CODON_UI_CONFIG_FILE_NAME).default(CODON_UI_CONFIG_FILE_NAME),
    cwd: z.string().min(1),
    effects: z
      .object({
        createsDirectories: z.literal(false),
        installsDependencies: z.literal(false),
        writesConfig: z.boolean(),
        writesLockfile: z.boolean(),
      })
      .strict(),
    findings: z.array(consumerAdvisoryFindingSchema).default([]),
    initialized: z.boolean(),
    lockfile: z.literal(CODON_UI_LOCK_FILE_NAME).default(CODON_UI_LOCK_FILE_NAME),
    lockfileData: consumerLockfileSchema,
  })
  .strict()

export type TConsumerInitSeedResult = z.infer<typeof consumerInitSeedResultSchema>

const consumerInitDryRunEffectStatusSchema = z.enum(CLI_DRY_RUN_WRITE_STATUSES)

export const consumerInitDryRunResultSchema = z
  .object({
    configFile: z.literal(CODON_UI_CONFIG_FILE_NAME).default(CODON_UI_CONFIG_FILE_NAME),
    cwd: z.string().min(1),
    dryRun: z.literal(true),
    effects: z
      .object({
        createsDirectories: z.literal(false),
        installsDependencies: z.literal(false),
        writesConfig: z.literal(false),
        writesLockfile: z.literal(false),
      })
      .strict(),
    findings: z.array(consumerAdvisoryFindingSchema).default([]),
    initialized: z.boolean(),
    lockfile: z.literal(CODON_UI_LOCK_FILE_NAME).default(CODON_UI_LOCK_FILE_NAME),
    lockfileData: consumerLockfileSchema,
    packageManager: z.enum(CONSUMER_PACKAGE_MANAGERS),
    project: consumerProjectContextSchema,
    proposedConfig: consumerConfigSchema,
    targetPaths: z.record(consumerTargetRoleSchema, z.string().min(1)),
    wouldEffects: z
      .object({
        config: z
          .object({
            path: z.literal(CODON_UI_CONFIG_FILE_NAME),
            status: consumerInitDryRunEffectStatusSchema,
            wouldWrite: z.boolean(),
          })
          .strict(),
        dependencies: z
          .object({
            plannedInstallCount: z.literal(0),
            status: z.literal(CLI_WRITE_STATUS__NOT_WRITTEN),
          })
          .strict(),
        directories: z
          .object({
            plannedCount: z.literal(0),
            status: z.literal(CLI_WRITE_STATUS__NOT_WRITTEN),
          })
          .strict(),
        lockfile: z
          .object({
            path: z.literal(CODON_UI_LOCK_FILE_NAME),
            status: consumerInitDryRunEffectStatusSchema,
            wouldWrite: z.boolean(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()

export type TConsumerInitDryRunResult = z.infer<typeof consumerInitDryRunResultSchema>
