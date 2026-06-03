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
  expectedThemeVariables = [],
  expectedMissingDependencyCount = 4,
  expectedPlannedCount = 7,
}: {
  itemName: string
  expectedItems: string[]
  expectedResolvedPaths: string[]
  expectedThemeSourcePath?: string
  expectedThemeVariables?: string[]
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
  if (expectedThemeSourcePath) {
    assert.ok(
      componentPacket?.themeRequirements.some((requirement) =>
        requirement.files.some((file) => file.sourcePath.endsWith(expectedThemeSourcePath)),
      ),
    )
  }
  for (const expectedThemeVariable of expectedThemeVariables) {
    assert.ok(
      componentPacket?.themeRequirements.some((requirement) =>
        requirement.cssVariables.some((cssVariable) => cssVariable === expectedThemeVariable),
      ),
    )
  }

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
  itemName: "avatar",
  expectedItems: ["theme-css", "tokens/geometry", "theme/text-typography", "text", "avatar"],
  expectedResolvedPaths: [
    "src/components/Avatar/Avatar.tsx",
    "src/components/Avatar/AvatarStyles.module.css",
    "src/components/Avatar/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
  ],
  expectedThemeVariables: ["--aui-surface-foreground", "--aui-surface", "--aui-shadow-1", "--aui-radius-1"],
  expectedMissingDependencyCount: 4,
  expectedPlannedCount: 11,
})

await verifyComponentAddPlanning({
  itemName: "button",
  expectedItems: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order", "button"],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "theme/action-colors.css",
  expectedThemeVariables: ["--aui-action-primary-background", "--aui-action-quintenary-foreground"],
})

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

await verifyComponentAddPlanning({
  itemName: "tag-group",
  expectedItems: ["theme-css", "theme/tag-group-compatibility", "tokens/geometry", "tokens/theme-order", "tag-group"],
  expectedResolvedPaths: [
    "src/components/TagGroup/AdobeTag/AdobeTag.tsx",
    "src/components/TagGroup/AdobeTag/AdobeTagStyles.module.css",
    "src/components/TagGroup/AdobeTag/DefaultCloseIcon.tsx",
    "src/components/TagGroup/AdobeTag/helpers.tsx",
    "src/components/TagGroup/TagGroup.tsx",
    "src/components/TagGroup/TagGroupStyles.module.css",
    "src/components/TagGroup/helpers.ts",
    "src/components/_registry/tag-group-compatibility.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "TagGroup/tag-group-compatibility.css",
  expectedPlannedCount: 11,
})

await verifyComponentAddPlanning({
  itemName: "circular-progress",
  expectedItems: [
    "theme-css",
    "theme/circular-progress-compatibility",
    "tokens/svg",
    "tokens/theme-order",
    "circular-progress",
  ],
  expectedResolvedPaths: [
    "src/components/CircularProgress/CircularProgress.tsx",
    "src/components/CircularProgress/CircularProgressStyles.module.css",
    "src/components/CircularProgress/Path/Path.tsx",
    "src/components/CircularProgress/Path/helpers.ts",
    "src/components/CircularProgress/helpers.ts",
    "src/components/_registry/circular-progress-compatibility.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/svg.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "CircularProgress/circular-progress-compatibility.css",
  expectedPlannedCount: 9,
})

await verifyComponentAddPlanning({
  itemName: "counter",
  expectedItems: [
    "theme-css",
    "tokens/a11y",
    "theme/text-typography",
    "text",
    "theme/circular-progress-compatibility",
    "tokens/svg",
    "tokens/theme-order",
    "circular-progress",
    "counter",
  ],
  expectedResolvedPaths: [
    "src/components/CircularProgress/CircularProgress.tsx",
    "src/components/CircularProgress/CircularProgressStyles.module.css",
    "src/components/CircularProgress/Path/Path.tsx",
    "src/components/CircularProgress/Path/helpers.ts",
    "src/components/CircularProgress/helpers.ts",
    "src/components/Counter/Counter.tsx",
    "src/components/Counter/CounterStyles.module.css",
    "src/components/Counter/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/circular-progress-compatibility.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/a11y.ts",
    "src/components/_registry/tokens/svg.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-1", "--aui-transition-color", "--aui-state-warning", "--aui-state-danger"],
  expectedPlannedCount: 19,
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
  "[aminoui-cli] avatar, button, checkbox, toggle-button, radio, text, radio-group, slider, tag, tag-group, circular-progress, counter, and dependency merge add planning verified",
)
