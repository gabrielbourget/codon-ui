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

const registrySourcePath = resolveDefaultAddRegistrySourcePath({
  allComponents: false,
  requestedItems: ["toggle-button"],
})

assert.equal(registrySourcePath, getDefaultLocalReactRegistrySourcePath())
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["legacy-hosted-component"] }),
  getDefaultLocalSupportRegistrySourcePath(),
)

const { registrySource, sourceRoot } = await readLocalRegistrySource(registrySourcePath)

const verifyComponentAddPlanning = async ({
  itemName,
  expectedItems,
  expectedResolvedPaths,
  expectedCompatibilityBridgeSourcePath,
}: {
  itemName: string
  expectedItems: string[]
  expectedResolvedPaths: string[]
  expectedCompatibilityBridgeSourcePath: string
}) => {
  const requestedItems = [itemName]
  const packetResult = await readComponentPacketsForRegistrySource({
    registrySource,
    requestedItems,
  })
  const componentPacket = packetResult.componentPackets.find((packet) => packet.name === itemName)

  assert.equal(packetResult.findings.length, 0)
  assert.equal(componentPacket?.activationStatus, "local-registry")
  assert.ok(
    componentPacket?.themeRequirements.some((requirement) =>
      requirement.files.some((file) => file.sourcePath.endsWith(expectedCompatibilityBridgeSourcePath)),
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
    expectedItems,
  )
  assert.deepEqual(installPlan.files.map((file) => file.resolvedPath).sort(), expectedResolvedPaths)
  assert.equal(installPlan.findings.filter((finding) => finding.severity === "error").length, 0)
  assert.equal(dryRunEffects.files.plannedCount, 7)
  assert.equal(dryRunEffects.files.wouldWriteCount, 7)
  assert.equal(dryRunEffects.dependencies.missingCount, 4)
}

await verifyComponentAddPlanning({
  itemName: "checkbox",
  expectedItems: ["theme-css", "theme/checkbox-compatibility", "tokens/geometry", "tokens/theme-order", "checkbox"],
  expectedResolvedPaths: [
    "src/components/Checkbox/Checkbox.tsx",
    "src/components/Checkbox/CheckboxStyles.module.css",
    "src/components/Checkbox/helpers.ts",
    "src/components/_registry/checkbox-compatibility.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedCompatibilityBridgeSourcePath: "Checkbox/checkbox-compatibility.css",
})

await verifyComponentAddPlanning({
  itemName: "toggle-button",
  expectedItems: [
    "theme-css",
    "theme/toggle-button-compatibility",
    "tokens/geometry",
    "tokens/theme-order",
    "toggle-button",
  ],
  expectedResolvedPaths: [
    "src/components/ToggleButton/ToggleButton.tsx",
    "src/components/ToggleButton/ToggleButtonStyles.module.css",
    "src/components/ToggleButton/helpers.ts",
    "src/components/_registry/theme.css",
    "src/components/_registry/toggle-button-compatibility.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedCompatibilityBridgeSourcePath: "ToggleButton/toggle-button-compatibility.css",
})

await verifyComponentAddPlanning({
  itemName: "radio",
  expectedItems: ["theme-css", "theme/radio-compatibility", "tokens/geometry", "tokens/theme-order", "radio"],
  expectedResolvedPaths: [
    "src/components/Radio/Radio.tsx",
    "src/components/Radio/RadioStyles.module.css",
    "src/components/Radio/helpers.ts",
    "src/components/_registry/radio-compatibility.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedCompatibilityBridgeSourcePath: "Radio/radio-compatibility.css",
})

console.log("[aminoui-cli] checkbox, toggle-button, and radio add planning verified")
