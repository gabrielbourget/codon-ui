import { existsSync } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

import { z } from "zod"

import {
  INSTALL_PLAN_FINDING__DRAFT_PACKET_UNAVAILABLE,
  INSTALL_PLAN_FINDING_SEVERITY__WARNING,
  REGISTRY_ITEM_TYPES,
} from "./constants"
import {
  addAdvisoryComponentPacketSchema,
  addAdvisoryEffectsSchema,
  dependencyMapSchema,
  localRegistryFileSchema,
  localRegistryItemSchema,
  localRegistrySourceSchema,
  registryInstallPlanSchema,
  type TAddAdvisoryComponentPacket,
  type TAddAdvisoryEffects,
  type TInstallPlanFinding,
  type TLocalRegistryItem,
  type TLocalRegistrySource,
  type TRegistryInstallPlan,
} from "./schema"

const DRAFT_SWITCH_ITEM_NAME = "switch"

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

const getSwitchPacketDataCandidatePaths = () => {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))

  return [
    path.resolve(moduleDirectory, "../../react/src/registry/switch-ingest-packet.data.json"),
    path.resolve(moduleDirectory, "../../../../react/src/registry/switch-ingest-packet.data.json"),
  ]
}

const readSwitchIngestPacket = async () => {
  const packetDataPath = getSwitchPacketDataCandidatePaths().find((candidatePath) => existsSync(candidatePath))

  if (!packetDataPath) {
    throw new Error("Could not find @amino-ui/react Switch ingest packet data.")
  }

  return registryIngestPacketSchema.parse(JSON.parse(await readFile(packetDataPath, "utf8")))
}

const createLocalRegistryItemFromIngestPacket = (packet: TRegistryIngestPacket): TLocalRegistryItem =>
  localRegistryItemSchema.parse({
    devDependencies: packet.devDependencies,
    files: packet.files,
    name: packet.name,
    peerDependencies: packet.peerDependencies,
    registryDependencies: packet.registryDependencies,
    runtimeDependencies: packet.runtimeDependencies,
    sourcePackage: packet.sourcePackage,
    type: packet.type,
  })

const createAdvisoryComponentPacketFromIngestPacket = (packet: TRegistryIngestPacket): TAddAdvisoryComponentPacket =>
  addAdvisoryComponentPacketSchema.parse({
    activationStatus: "draft-only",
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

export const createRegistrySourceWithDraftSwitchPacket = async ({
  registrySource,
  requestedItems,
}: {
  registrySource: TLocalRegistrySource
  requestedItems: readonly string[]
}): Promise<TComponentPacketRegistrySourceResult> => {
  if (!requestedItems.includes(DRAFT_SWITCH_ITEM_NAME)) {
    return {
      componentPackets: [],
      findings: [],
      registrySource,
    }
  }

  try {
    const packet = await readSwitchIngestPacket()
    const switchRegistryItem = createLocalRegistryItemFromIngestPacket(packet)
    const hasSwitchItem = registrySource.items.some((item) => item.name === switchRegistryItem.name)

    return {
      componentPackets: [createAdvisoryComponentPacketFromIngestPacket(packet)],
      findings: [],
      registrySource: localRegistrySourceSchema.parse({
        ...registrySource,
        items: hasSwitchItem ? registrySource.items : [...registrySource.items, switchRegistryItem],
        sourceIdentity: hasSwitchItem ? registrySource.sourceIdentity : `${registrySource.sourceIdentity}+draft-switch`,
      }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load draft Switch ingest packet."

    return {
      componentPackets: [],
      findings: [
        {
          code: INSTALL_PLAN_FINDING__DRAFT_PACKET_UNAVAILABLE,
          itemName: DRAFT_SWITCH_ITEM_NAME,
          message,
          severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
        },
      ],
      registrySource,
    }
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
