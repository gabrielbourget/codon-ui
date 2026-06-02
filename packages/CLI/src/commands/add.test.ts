import assert from "node:assert/strict"

import {
  consumerConfigSchema,
  createAddDryRunEffects,
  createRegistryInstallPlan,
  getDefaultLocalReactRegistrySourcePath,
  getDefaultLocalSupportRegistrySourcePath,
  readComponentPacketsForRegistrySource,
  readLocalRegistrySource,
  resolveDefaultAddRegistrySourcePath,
} from "../helpers"

const requestedItems = ["checkbox"]
const registrySourcePath = resolveDefaultAddRegistrySourcePath({
  allComponents: false,
  requestedItems,
})

assert.equal(registrySourcePath, getDefaultLocalReactRegistrySourcePath())
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["legacy-hosted-component"] }),
  getDefaultLocalSupportRegistrySourcePath(),
)

const { registrySource, sourceRoot } = await readLocalRegistrySource(registrySourcePath)
const packetResult = await readComponentPacketsForRegistrySource({
  registrySource,
  requestedItems,
})
const checkboxPacket = packetResult.componentPackets.find((packet) => packet.name === "checkbox")

assert.equal(packetResult.findings.length, 0)
assert.equal(checkboxPacket?.activationStatus, "local-registry")
assert.ok(
  checkboxPacket?.themeRequirements.some((requirement) =>
    requirement.files.some((file) => file.sourcePath.endsWith("Checkbox/checkbox-compatibility.css")),
  ),
)

const installPlan = createRegistryInstallPlan({
  config: consumerConfigSchema.parse({}),
  registrySource: packetResult.registrySource,
  requestedItems,
  sourceRoot,
})
const dryRunEffects = createAddDryRunEffects(installPlan)

assert.deepEqual(
  installPlan.items.map((item) => item.name),
  ["theme-css", "theme/checkbox-compatibility", "tokens/geometry", "tokens/theme-order", "checkbox"],
)
assert.deepEqual(installPlan.files.map((file) => file.resolvedPath).sort(), [
  "src/components/Checkbox/Checkbox.tsx",
  "src/components/Checkbox/CheckboxStyles.module.css",
  "src/components/Checkbox/helpers.ts",
  "src/components/_registry/checkbox-compatibility.css",
  "src/components/_registry/theme.css",
  "src/components/_registry/tokens/geometry.ts",
  "src/components/_registry/tokens/theme-order.ts",
])
assert.equal(installPlan.findings.filter((finding) => finding.severity === "error").length, 0)
assert.equal(dryRunEffects.files.plannedCount, 7)
assert.equal(dryRunEffects.files.wouldWriteCount, 7)
assert.equal(dryRunEffects.dependencies.missingCount, 4)

console.log("[aminoui-cli] checkbox add planning verified")
