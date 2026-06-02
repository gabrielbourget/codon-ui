import assert from "node:assert/strict"

import {
  consumerConfigSchema,
  consumerLockfileSchema,
  createAddDryRunEffects,
  createRegistryInstallPlan,
  getDefaultLocalReactRegistrySourcePath,
  getDefaultLocalSupportRegistrySourcePath,
  mergeStrictAddLockfileDependencies,
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

const createComponentInstallPlan = async (itemName: string) => {
  const packetResult = await readComponentPacketsForRegistrySource({
    registrySource,
    requestedItems: [itemName],
  })

  assert.equal(packetResult.findings.length, 0)

  return createRegistryInstallPlan({
    config: consumerConfigSchema.parse({}),
    registrySource: packetResult.registrySource,
    requestedItems: [itemName],
    sourceRoot,
  })
}

const verifyComponentAddPlanning = async ({
  itemName,
  expectedItems,
  expectedResolvedPaths,
  expectedThemeSourcePath,
  expectedMissingDependencyCount = 4,
  expectedPlannedCount = 7,
}: {
  itemName: string
  expectedItems: string[]
  expectedResolvedPaths: string[]
  expectedThemeSourcePath: string
  expectedMissingDependencyCount?: number
  expectedPlannedCount?: number
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
      requirement.files.some((file) => file.sourcePath.endsWith(expectedThemeSourcePath)),
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
  assert.equal(dryRunEffects.files.plannedCount, expectedPlannedCount)
  assert.equal(dryRunEffects.files.wouldWriteCount, expectedPlannedCount)
  assert.equal(dryRunEffects.dependencies.missingCount, expectedMissingDependencyCount)
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
  expectedThemeSourcePath: "Checkbox/checkbox-compatibility.css",
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
  expectedThemeSourcePath: "ToggleButton/toggle-button-compatibility.css",
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
  expectedThemeSourcePath: "Radio/radio-compatibility.css",
})

await verifyComponentAddPlanning({
  itemName: "text",
  expectedItems: ["theme-css", "theme/text-typography", "text"],
  expectedResolvedPaths: [
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
  ],
  expectedThemeSourcePath: "Text/text-typography.css",
  expectedMissingDependencyCount: 3,
})

await verifyComponentAddPlanning({
  itemName: "radio-group",
  expectedItems: [
    "theme-css",
    "theme/radio-group-compatibility",
    "theme/radio-compatibility",
    "tokens/geometry",
    "tokens/theme-order",
    "radio",
    "radio-group",
  ],
  expectedResolvedPaths: [
    "src/components/Radio/Radio.tsx",
    "src/components/Radio/RadioStyles.module.css",
    "src/components/Radio/helpers.ts",
    "src/components/RadioGroup/RadioGroup.tsx",
    "src/components/RadioGroup/RadioGroupStyles.module.css",
    "src/components/RadioGroup/helpers.ts",
    "src/components/_registry/radio-compatibility.css",
    "src/components/_registry/radio-group-compatibility.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "RadioGroup/radio-group-compatibility.css",
  expectedPlannedCount: 11,
})

await verifyComponentAddPlanning({
  itemName: "slider",
  expectedItems: [
    "theme-css",
    "theme/slider-compatibility",
    "tokens/geometry",
    "tokens/theme-order",
    "theme/text-typography",
    "text",
    "slider",
  ],
  expectedResolvedPaths: [
    "src/components/Slider/Slider.tsx",
    "src/components/Slider/SliderStyles.module.css",
    "src/components/Slider/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/slider-compatibility.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "Slider/slider-compatibility.css",
  expectedPlannedCount: 13,
})

await verifyComponentAddPlanning({
  itemName: "tag",
  expectedItems: ["theme-css", "theme/tag-compatibility", "tokens/geometry", "tag"],
  expectedResolvedPaths: [
    "src/components/Tag/Tag.tsx",
    "src/components/Tag/TagStyles.module.css",
    "src/components/Tag/helpers.ts",
    "src/components/_registry/tag-compatibility.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
  ],
  expectedThemeSourcePath: "Tag/tag-compatibility.css",
  expectedMissingDependencyCount: 3,
  expectedPlannedCount: 6,
})

const sliderInstallPlan = await createComponentInstallPlan("slider")
const tagInstallPlan = await createComponentInstallPlan("tag")
const existingSliderLockfile = consumerLockfileSchema.parse({
  dependencies: sliderInstallPlan.dependencyPlan.map((dependency) => ({
    ...dependency,
    action: "none",
  })),
})
const mergedTagDependencies = mergeStrictAddLockfileDependencies({
  installPlan: tagInstallPlan,
  lockfileData: existingSliderLockfile,
})

assert.deepEqual(
  mergedTagDependencies.map((dependency) => `${dependency.kind}:${dependency.name}`),
  ["peer:react", "peer:react-aria-components", "peer:react-dom", "runtime:classnames"],
)
assert.equal(
  mergedTagDependencies.find((dependency) => dependency.name === "react-aria-components")?.requiredRange,
  "^1.17.0",
)
assert.equal(mergedTagDependencies.find((dependency) => dependency.name === "react-aria-components")?.status, "missing")

console.log(
  "[aminoui-cli] checkbox, toggle-button, radio, text, radio-group, slider, tag, and dependency merge add planning verified",
)
