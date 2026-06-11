import { existsSync } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

import { z } from "zod"

import {
  INSTALL_PLAN_DEPENDENCY_STATUS__INCOMPATIBLE,
  INSTALL_PLAN_DEPENDENCY_STATUS__MISSING,
  INSTALL_PLAN_DEPENDENCY_STATUS__SATISFIED,
  INSTALL_PLAN_DEPENDENCY_STATUS__UNRESOLVED,
  INSTALL_PLAN_FINDING__COMPONENT_PACKET_UNAVAILABLE,
  INSTALL_PLAN_SOURCE_STATUS__MISSING,
  INSTALL_PLAN_TARGET_RESOLUTION__BLOCK_EXISTING,
  INSTALL_PLAN_TARGET_RESOLUTION__REUSE_EXISTING,
  INSTALL_PLAN_TARGET_RESOLUTION__WRITE,
  INSTALL_PLAN_FINDING_SEVERITY__WARNING,
  REGISTRY_ITEM_TYPES,
} from "./constants"
import {
  addAdvisoryComponentPacketSchema,
  addAdvisoryEffectsSchema,
  addDryRunEffectsSchema,
  addStrictEffectsSchema,
  dependencyMapSchema,
  localRegistryFileSchema,
  localRegistrySourceSchema,
  registryInstallPlanSchema,
  type TAddAdvisoryComponentPacket,
  type TAddAdvisoryEffects,
  type TAddDryRunEffects,
  type TAddStrictEffects,
  type TInstallPlanDependencyStatus,
  type TInstallPlanFinding,
  type TLocalRegistrySource,
  type TRegistryInstallPlan,
} from "./schema"

const ingestPublicExportSchema = z
  .object({
    exportedName: z.string().min(1),
    sourcePath: z.string().min(1),
    localName: z.string().min(1).optional(),
    typeOnly: z.boolean().optional(),
  })
  .strict()

const ingestImportResolutionSchema = z
  .object({
    sourcePath: z.string().min(1),
    importSource: z.string().min(1),
    registryDependencyName: z.string().min(1).optional(),
    replacementSource: z.string().min(1).optional(),
    advisory: z.boolean().optional(),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()

const ingestThemeRequirementSchema = z
  .object({
    strategy: z.string().min(1),
    cssVariables: z.array(z.string().min(1)).default([]),
    files: z.array(localRegistryFileSchema).default([]),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()

const ingestVerificationStepSchema = z
  .object({
    kind: z.string().min(1),
    command: z.string().min(1),
    workingDirectory: z.string().min(1).optional(),
    advisory: z.boolean().optional(),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()

const registryIngestPacketSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(REGISTRY_ITEM_TYPES),
    sourcePackage: z.string().min(1),
    sourceRepository: z.string().min(1).optional(),
    sourceRef: z.string().min(1).optional(),
    files: z.array(localRegistryFileSchema).min(1),
    publicExports: z.array(ingestPublicExportSchema).default([]),
    importResolutions: z.array(ingestImportResolutionSchema).default([]),
    excludedSourcePaths: z.array(z.string().min(1)).default([]),
    registryDependencies: z.array(z.string().min(1)).default([]),
    peerDependencies: dependencyMapSchema.default({}),
    runtimeDependencies: dependencyMapSchema.default({}),
    devDependencies: dependencyMapSchema.default({}),
    themeRequirements: z.array(ingestThemeRequirementSchema).default([]),
    verification: z.array(ingestVerificationStepSchema).default([]),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()

type TRegistryIngestPacket = z.infer<typeof registryIngestPacketSchema>

export type TComponentPacketRegistrySourceResult = {
  componentPackets: readonly TAddAdvisoryComponentPacket[]
  findings: readonly TInstallPlanFinding[]
  registrySource: TLocalRegistrySource
}

const getPacketDataCandidatePaths = (itemName: string) => {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const packetFileName = `${itemName}-ingest-packet.data.json`

  return [
    path.resolve(moduleDirectory, `../../react/src/registry/${packetFileName}`),
    path.resolve(moduleDirectory, `../../../../react/src/registry/${packetFileName}`),
  ]
}

const readIngestPacket = async (itemName: string) => {
  const packetDataPath = getPacketDataCandidatePaths(itemName).find((candidatePath) => existsSync(candidatePath))

  if (!packetDataPath) {
    throw new Error(`Could not find @codon-ui/react ingest packet data for ${itemName}.`)
  }

  return registryIngestPacketSchema.parse(JSON.parse(await readFile(packetDataPath, "utf8")))
}

const createAdvisoryComponentPacketFromIngestPacket = (packet: TRegistryIngestPacket): TAddAdvisoryComponentPacket =>
  addAdvisoryComponentPacketSchema.parse({
    activationStatus: "local-registry",
    excludedSourcePaths: packet.excludedSourcePaths,
    importResolutions: packet.importResolutions,
    name: packet.name,
    notes: packet.notes,
    publicExports: packet.publicExports,
    sourceRef: packet.sourceRef,
    sourceRepository: packet.sourceRepository,
    themeRequirements: packet.themeRequirements,
    verification: packet.verification,
  })

export const readComponentPacketsForRegistrySource = async ({
  registrySource,
  requestedItems,
}: {
  registrySource: TLocalRegistrySource
  requestedItems: readonly string[]
}): Promise<TComponentPacketRegistrySourceResult> => {
  const requestedComponentItems = requestedItems.filter((itemName) =>
    registrySource.items.some((item) => item.name === itemName && item.type === "component"),
  )

  if (requestedComponentItems.length === 0) return { componentPackets: [], findings: [], registrySource }

  const componentPackets: TAddAdvisoryComponentPacket[] = []
  const findings: TInstallPlanFinding[] = []

  for (const itemName of requestedComponentItems) {
    try {
      const packet = await readIngestPacket(itemName)
      const hasRegistryItem = registrySource.items.some((item) => item.name === packet.name)

      if (hasRegistryItem) componentPackets.push(createAdvisoryComponentPacketFromIngestPacket(packet))
    } catch (error) {
      const message = error instanceof Error ? error.message : `Could not load ${itemName} advisory packet.`

      findings.push({
        code: INSTALL_PLAN_FINDING__COMPONENT_PACKET_UNAVAILABLE,
        itemName,
        message,
        severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
      })
    }
  }

  return {
    componentPackets,
    findings,
    registrySource: localRegistrySourceSchema.parse(registrySource),
  }
}

export const createAddAdvisoryEffects = (installPlan: TRegistryInstallPlan): TAddAdvisoryEffects =>
  addAdvisoryEffectsSchema.parse({
    installsDependencies: false,
    lockfile: {
      plannedFileCount: installPlan.files.length,
      plannedItems: installPlan.items.map((item) => item.name),
      status: "not-written",
    },
    writesConfig: false,
    writesFiles: false,
    writesLockfile: false,
  })

export const createAddDryRunEffects = (installPlan: TRegistryInstallPlan): TAddDryRunEffects => {
  const blockedExistingTargetCount = installPlan.files.filter(
    (file) => file.targetResolution === INSTALL_PLAN_TARGET_RESOLUTION__BLOCK_EXISTING,
  ).length
  const reusedExistingTargetCount = installPlan.files.filter(
    (file) => file.targetResolution === INSTALL_PLAN_TARGET_RESOLUTION__REUSE_EXISTING,
  ).length
  const missingSourceCount = installPlan.files.filter(
    (file) => file.sourceStatus === INSTALL_PLAN_SOURCE_STATUS__MISSING,
  ).length
  const wouldWriteCount = installPlan.files.filter(
    (file) =>
      file.targetResolution === INSTALL_PLAN_TARGET_RESOLUTION__WRITE &&
      file.sourceStatus !== INSTALL_PLAN_SOURCE_STATUS__MISSING,
  ).length
  const countDependenciesByStatus = (status: TInstallPlanDependencyStatus) =>
    installPlan.dependencyPlan.filter((dependency) => dependency.status === status).length
  const missingCount = countDependenciesByStatus(INSTALL_PLAN_DEPENDENCY_STATUS__MISSING)
  const incompatibleCount = countDependenciesByStatus(INSTALL_PLAN_DEPENDENCY_STATUS__INCOMPATIBLE)

  return addDryRunEffectsSchema.parse({
    dependencies: {
      incompatibleCount,
      missingCount,
      requiresDecisionCount: missingCount + incompatibleCount,
      satisfiedCount: countDependenciesByStatus(INSTALL_PLAN_DEPENDENCY_STATUS__SATISFIED),
      unresolvedCount: countDependenciesByStatus(INSTALL_PLAN_DEPENDENCY_STATUS__UNRESOLVED),
    },
    files: {
      blockedExistingTargetCount,
      missingSourceCount,
      plannedCount: installPlan.files.length,
      reusedExistingTargetCount,
      wouldWriteCount,
    },
    installsDependencies: false,
    lockfile: {
      plannedFileCount: installPlan.files.length,
      plannedItems: installPlan.items.map((item) => item.name),
      status: "would-write",
    },
    writesConfig: false,
    writesFiles: false,
    writesLockfile: false,
  })
}

export const createAddStrictEffects = ({
  applied,
  installsDependencies = false,
  installPlan,
  writtenFileCount = 0,
}: {
  applied: boolean
  installsDependencies?: boolean
  installPlan: TRegistryInstallPlan
  writtenFileCount?: number
}): TAddStrictEffects => {
  const dryRunEffects = createAddDryRunEffects(installPlan)

  return addStrictEffectsSchema.parse({
    dependencies: dryRunEffects.dependencies,
    files: {
      blockedExistingTargetCount: dryRunEffects.files.blockedExistingTargetCount,
      missingSourceCount: dryRunEffects.files.missingSourceCount,
      plannedCount: dryRunEffects.files.plannedCount,
      reusedExistingTargetCount: dryRunEffects.files.reusedExistingTargetCount,
      writtenCount: applied ? writtenFileCount : 0,
    },
    installsDependencies,
    lockfile: {
      plannedFileCount: installPlan.files.length,
      plannedItems: installPlan.items.map((item) => item.name),
      status: applied ? "written" : "blocked",
      writtenFileCount: applied ? writtenFileCount : 0,
    },
    writesConfig: false,
    writesFiles: applied,
    writesLockfile: applied,
  })
}

export const createRegistryInstallPlanWithFindings = ({
  findings,
  installPlan,
}: {
  findings: readonly TInstallPlanFinding[]
  installPlan: TRegistryInstallPlan
}): TRegistryInstallPlan =>
  registryInstallPlanSchema.parse({
    ...installPlan,
    findings,
  })
