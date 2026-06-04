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
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["input"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["number-input"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["stepper"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["time-picker"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["form-field"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["linear-progress"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["meter"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["placeholder-text"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["list-box-item"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["select"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["combo-box"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["tag-combo-box"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["click-popover"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["tooltip"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["hover-popover"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["menu"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["line-segment"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["pagination"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
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
  itemName: "checkbox-group",
  expectedItems: [
    "theme-css",
    "theme/checkbox-compatibility",
    "tokens/geometry",
    "tokens/theme-order",
    "checkbox",
    "checkbox-group",
  ],
  expectedResolvedPaths: [
    "src/components/Checkbox/Checkbox.tsx",
    "src/components/Checkbox/CheckboxStyles.module.css",
    "src/components/Checkbox/helpers.ts",
    "src/components/CheckboxGroup/CheckboxGroup.tsx",
    "src/components/CheckboxGroup/CheckboxGroupStyles.module.css",
    "src/components/CheckboxGroup/helpers.ts",
    "src/components/_registry/checkbox-compatibility.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-2", "--aui-opacity-disabled"],
  expectedPlannedCount: 10,
})

await verifyComponentAddPlanning({
  itemName: "click-popover",
  expectedItems: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order", "click-popover"],
  expectedResolvedPaths: [
    "src/components/ClickPopover/ClickPopover.tsx",
    "src/components/ClickPopover/ClickPopoverStyles.module.css",
    "src/components/ClickPopover/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-2", "--aui-focus-ring", "--aui-color-quintenary-500"],
})

await verifyComponentAddPlanning({
  itemName: "tooltip",
  expectedItems: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order", "tooltip"],
  expectedResolvedPaths: [
    "src/components/Tooltip/Tooltip.tsx",
    "src/components/Tooltip/TooltipStyles.module.css",
    "src/components/Tooltip/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-1", "--aui-drop-shadow-1", "--aui-color-quintenary-500"],
})

await verifyComponentAddPlanning({
  itemName: "hover-popover",
  expectedItems: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order", "hover-popover"],
  expectedResolvedPaths: [
    "src/components/HoverPopover/HoverPopover.tsx",
    "src/components/HoverPopover/HoverPopoverStyles.module.css",
    "src/components/HoverPopover/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-2", "--aui-shadow-1", "--aui-color-quintenary-500"],
})

await verifyComponentAddPlanning({
  itemName: "menu",
  expectedItems: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order", "menu"],
  expectedResolvedPaths: [
    "src/components/Menu/Menu.tsx",
    "src/components/Menu/MenuStyles.module.css",
    "src/components/Menu/components/MenuItem.tsx",
    "src/components/Menu/components/MenuSeparator.tsx",
    "src/components/Menu/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-1", "--aui-shadow-1", "--aui-state-danger", "--aui-color-quintenary-500"],
  expectedPlannedCount: 9,
})

await verifyComponentAddPlanning({
  itemName: "line-segment",
  expectedItems: ["theme-css", "line-segment"],
  expectedResolvedPaths: [
    "src/components/VisualUtilities/LineSegment/LineSegment.tsx",
    "src/components/_registry/theme.css",
  ],
  expectedThemeVariables: ["--aui-border"],
  expectedMissingDependencyCount: 2,
  expectedPlannedCount: 2,
})

await verifyComponentAddPlanning({
  itemName: "pagination",
  expectedItems: [
    "theme-css",
    "theme/action-colors",
    "tokens/geometry",
    "tokens/theme-order",
    "button",
    "click-popover",
    "tokens/a11y",
    "theme/text-typography",
    "text",
    "theme/circular-progress-compatibility",
    "tokens/svg",
    "circular-progress",
    "counter",
    "form-field",
    "line-segment",
    "list-box-item",
    "input",
    "number-input",
    "tokens/placement",
    "placeholder-text",
    "select",
    "pagination",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/CircularProgress/CircularProgress.tsx",
    "src/components/CircularProgress/CircularProgressStyles.module.css",
    "src/components/CircularProgress/Path/Path.tsx",
    "src/components/CircularProgress/Path/helpers.ts",
    "src/components/CircularProgress/helpers.ts",
    "src/components/ClickPopover/ClickPopover.tsx",
    "src/components/ClickPopover/ClickPopoverStyles.module.css",
    "src/components/ClickPopover/helpers.ts",
    "src/components/Counter/Counter.tsx",
    "src/components/Counter/CounterStyles.module.css",
    "src/components/Counter/helpers.ts",
    "src/components/FormField/FormField.tsx",
    "src/components/FormField/FormFieldStyles.module.css",
    "src/components/FormField/helpers.ts",
    "src/components/Input/Input.tsx",
    "src/components/Input/InputStyles.module.css",
    "src/components/Input/helpers.ts",
    "src/components/ListBoxItem/ListBoxItem.tsx",
    "src/components/ListBoxItem/ListBoxItemStyles.module.css",
    "src/components/ListBoxItem/helpers.ts",
    "src/components/NumberInput/DefaultDecrementIcon.tsx",
    "src/components/NumberInput/DefaultIncrementIcon.tsx",
    "src/components/NumberInput/NumberInput.tsx",
    "src/components/NumberInput/NumberInputStyles.module.css",
    "src/components/NumberInput/helpers.tsx",
    "src/components/NumberInput/labels.ts",
    "src/components/Pagination/Pagination.tsx",
    "src/components/Pagination/PaginationStyles.module.css",
    "src/components/Pagination/components/ItemsPerPage/ItemsPerPage.tsx",
    "src/components/Pagination/components/PageCounter/PageCounter.tsx",
    "src/components/Pagination/components/PageCounter/PageCounterStyles.module.css",
    "src/components/Pagination/components/PageInput/PageInput.tsx",
    "src/components/Pagination/components/PageInput/PageInputStyles.module.css",
    "src/components/Pagination/components/PrimaryPaginationControls/DefaultPaginationIcons.tsx",
    "src/components/Pagination/components/PrimaryPaginationControls/PrimaryPaginationControls.tsx",
    "src/components/Pagination/components/PrimaryPaginationControls/PrimaryPaginationControlsStyles.module.css",
    "src/components/Pagination/components/PrimaryPaginationControls/helpers.tsx",
    "src/components/Pagination/helpers.tsx",
    "src/components/Select/DefaultChevronDownIcon.tsx",
    "src/components/Select/Select.tsx",
    "src/components/Select/SelectStyles.module.css",
    "src/components/Select/helpers.tsx",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/Text/variants/PlaceholderText/PlaceholderText.tsx",
    "src/components/Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
    "src/components/Text/variants/PlaceholderText/helpers.ts",
    "src/components/VisualUtilities/LineSegment/LineSegment.tsx",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/circular-progress-compatibility.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/a11y.ts",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/placement.ts",
    "src/components/_registry/tokens/svg.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-2", "--aui-focus-ring", "--aui-border", "--aui-color-quintenary-500"],
  expectedMissingDependencyCount: 5,
  expectedPlannedCount: 63,
})

await verifyComponentAddPlanning({
  itemName: "input",
  expectedItems: ["theme-css", "tokens/geometry", "theme/text-typography", "text", "input"],
  expectedResolvedPaths: [
    "src/components/Input/Input.tsx",
    "src/components/Input/InputStyles.module.css",
    "src/components/Input/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
  ],
  expectedThemeVariables: ["--aui-space-1", "--aui-state-danger", "--aui-state-success"],
  expectedPlannedCount: 11,
})

await verifyComponentAddPlanning({
  itemName: "text-area",
  expectedItems: ["theme-css", "tokens/geometry", "theme/text-typography", "text", "text-area"],
  expectedResolvedPaths: [
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/TextArea/TextArea.tsx",
    "src/components/TextArea/TextAreaStyles.module.css",
    "src/components/TextArea/helpers.ts",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
  ],
  expectedThemeVariables: ["--aui-space-1", "--aui-state-danger", "--aui-state-success"],
  expectedPlannedCount: 11,
})

await verifyComponentAddPlanning({
  itemName: "number-input",
  expectedItems: [
    "theme-css",
    "tokens/geometry",
    "theme/text-typography",
    "text",
    "input",
    "theme/action-colors",
    "tokens/theme-order",
    "button",
    "number-input",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/Input/Input.tsx",
    "src/components/Input/InputStyles.module.css",
    "src/components/Input/helpers.ts",
    "src/components/NumberInput/DefaultDecrementIcon.tsx",
    "src/components/NumberInput/DefaultIncrementIcon.tsx",
    "src/components/NumberInput/NumberInput.tsx",
    "src/components/NumberInput/NumberInputStyles.module.css",
    "src/components/NumberInput/helpers.tsx",
    "src/components/NumberInput/labels.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-radius-1", "--aui-transition-color", "--aui-state-danger"],
  expectedPlannedCount: 22,
})

await verifyComponentAddPlanning({
  itemName: "stepper",
  expectedItems: [
    "theme-css",
    "tokens/geometry",
    "tokens/theme-order",
    "theme/text-typography",
    "text",
    "input",
    "theme/action-colors",
    "button",
    "stepper",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/Input/Input.tsx",
    "src/components/Input/InputStyles.module.css",
    "src/components/Input/helpers.ts",
    "src/components/Stepper/Stepper.tsx",
    "src/components/Stepper/StepperStyles.module.css",
    "src/components/Stepper/helpers.tsx",
    "src/components/Stepper/labels.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-radius-1", "--aui-transition-color", "--aui-action-primary-background"],
  expectedPlannedCount: 20,
})

await verifyComponentAddPlanning({
  itemName: "time-picker",
  expectedItems: ["theme-css", "tokens/geometry", "theme/text-typography", "text", "time-picker"],
  expectedResolvedPaths: [
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/TimePicker/DefaultClockIcon.tsx",
    "src/components/TimePicker/TimePicker.tsx",
    "src/components/TimePicker/TimePickerStyles.module.css",
    "src/components/TimePicker/helpers.tsx",
    "src/components/TimePicker/labels.ts",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
  ],
  expectedThemeVariables: ["--aui-radius-1", "--aui-focus-ring", "--aui-state-danger"],
  expectedPlannedCount: 13,
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

await verifyComponentAddPlanning({
  itemName: "form-field",
  expectedItems: ["theme-css", "tokens/a11y", "theme/text-typography", "text", "form-field"],
  expectedResolvedPaths: [
    "src/components/FormField/FormField.tsx",
    "src/components/FormField/FormFieldStyles.module.css",
    "src/components/FormField/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/a11y.ts",
  ],
  expectedThemeVariables: ["--aui-space-1", "--aui-shadow-1", "--aui-state-danger"],
  expectedMissingDependencyCount: 3,
  expectedPlannedCount: 11,
})

await verifyComponentAddPlanning({
  itemName: "linear-progress",
  expectedItems: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order", "linear-progress"],
  expectedResolvedPaths: [
    "src/components/LinearProgress/LinearProgress.tsx",
    "src/components/LinearProgress/LinearProgressStyles.module.css",
    "src/components/LinearProgress/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "action-colors.css",
  expectedThemeVariables: ["--aui-shadow-1", "--aui-radius-1", "--aui-color-primary-500"],
  expectedMissingDependencyCount: 5,
  expectedPlannedCount: 7,
})

await verifyComponentAddPlanning({
  itemName: "meter",
  expectedItems: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order", "meter"],
  expectedResolvedPaths: [
    "src/components/Meter/Meter.tsx",
    "src/components/Meter/MeterStyles.module.css",
    "src/components/Meter/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "action-colors.css",
  expectedThemeVariables: ["--aui-shadow-1", "--aui-radius-1", "--aui-color-primary-500"],
  expectedMissingDependencyCount: 5,
  expectedPlannedCount: 7,
})

await verifyComponentAddPlanning({
  itemName: "placeholder-text",
  expectedItems: ["theme-css", "theme/text-typography", "text", "placeholder-text"],
  expectedResolvedPaths: [
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/Text/variants/PlaceholderText/PlaceholderText.tsx",
    "src/components/Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
    "src/components/Text/variants/PlaceholderText/helpers.ts",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
  ],
  expectedThemeVariables: ["--aui-control-placeholder"],
  expectedMissingDependencyCount: 3,
  expectedPlannedCount: 10,
})

await verifyComponentAddPlanning({
  itemName: "list-box-item",
  expectedItems: ["theme-css", "theme/text-typography", "text", "list-box-item"],
  expectedResolvedPaths: [
    "src/components/ListBoxItem/ListBoxItem.tsx",
    "src/components/ListBoxItem/ListBoxItemStyles.module.css",
    "src/components/ListBoxItem/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
  ],
  expectedThemeVariables: [
    "--aui-space-1",
    "--aui-radius-1",
    "--aui-transition-background-color",
    "--aui-control-hover-background",
    "--aui-opacity-disabled",
  ],
  expectedPlannedCount: 10,
})

await verifyComponentAddPlanning({
  itemName: "select",
  expectedItems: [
    "theme-css",
    "tokens/geometry",
    "tokens/placement",
    "theme/text-typography",
    "text",
    "theme/action-colors",
    "tokens/theme-order",
    "button",
    "placeholder-text",
    "select",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/Select/DefaultChevronDownIcon.tsx",
    "src/components/Select/Select.tsx",
    "src/components/Select/SelectStyles.module.css",
    "src/components/Select/helpers.tsx",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/Text/variants/PlaceholderText/PlaceholderText.tsx",
    "src/components/Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
    "src/components/Text/variants/PlaceholderText/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/placement.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: [
    "--aui-animation-fade-in",
    "--aui-animation-fade-out",
    "--aui-validation-error-border",
    "--aui-validation-warning-border",
    "--aui-validation-success-border",
    "--aui-control-placeholder",
  ],
  expectedMissingDependencyCount: 5,
  expectedPlannedCount: 21,
})

await verifyComponentAddPlanning({
  itemName: "combo-box",
  expectedItems: [
    "theme-css",
    "tokens/geometry",
    "tokens/placement",
    "theme/action-colors",
    "tokens/theme-order",
    "button",
    "theme/text-typography",
    "text",
    "input",
    "placeholder-text",
    "combo-box",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/ComboBox/ComboBox.tsx",
    "src/components/ComboBox/ComboBoxStyles.module.css",
    "src/components/ComboBox/DefaultChevronDownIcon.tsx",
    "src/components/ComboBox/helpers.tsx",
    "src/components/ComboBox/labels.ts",
    "src/components/Input/Input.tsx",
    "src/components/Input/InputStyles.module.css",
    "src/components/Input/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/Text/variants/PlaceholderText/PlaceholderText.tsx",
    "src/components/Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
    "src/components/Text/variants/PlaceholderText/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/placement.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: [
    "--aui-animation-fade-in",
    "--aui-animation-fade-out",
    "--aui-transition-border-color",
    "--aui-validation-error-border",
    "--aui-validation-warning-border",
    "--aui-validation-success-border",
  ],
  expectedMissingDependencyCount: 5,
  expectedPlannedCount: 25,
})

await verifyComponentAddPlanning({
  itemName: "tag-combo-box",
  expectedItems: [
    "theme-css",
    "tokens/geometry",
    "tokens/placement",
    "tokens/theme-order",
    "theme/text-typography",
    "text",
    "theme/action-colors",
    "button",
    "input",
    "placeholder-text",
    "combo-box",
    "theme/tag-group-compatibility",
    "tag-group",
    "tag-combo-box",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/ComboBox/ComboBox.tsx",
    "src/components/ComboBox/ComboBoxStyles.module.css",
    "src/components/ComboBox/DefaultChevronDownIcon.tsx",
    "src/components/ComboBox/helpers.tsx",
    "src/components/ComboBox/labels.ts",
    "src/components/Input/Input.tsx",
    "src/components/Input/InputStyles.module.css",
    "src/components/Input/helpers.ts",
    "src/components/TagComboBox/TagComboBox.tsx",
    "src/components/TagComboBox/TagComboBoxStyles.module.css",
    "src/components/TagComboBox/helpers.ts",
    "src/components/TagComboBox/labels.ts",
    "src/components/TagGroup/AdobeTag/AdobeTag.tsx",
    "src/components/TagGroup/AdobeTag/AdobeTagStyles.module.css",
    "src/components/TagGroup/AdobeTag/DefaultCloseIcon.tsx",
    "src/components/TagGroup/AdobeTag/helpers.tsx",
    "src/components/TagGroup/TagGroup.tsx",
    "src/components/TagGroup/TagGroupStyles.module.css",
    "src/components/TagGroup/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/Text/variants/PlaceholderText/PlaceholderText.tsx",
    "src/components/Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
    "src/components/Text/variants/PlaceholderText/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/tag-group-compatibility.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/placement.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: [
    "--aui-focus-ring",
    "--aui-opacity-disabled",
    "--aui-transition-border-color",
    "--aui-validation-error-border",
    "--aui-validation-warning-border",
    "--aui-validation-success-border",
  ],
  expectedMissingDependencyCount: 5,
  expectedPlannedCount: 37,
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
  "[aminoui-cli] avatar, button, checkbox, checkbox-group, click-popover, tooltip, hover-popover, menu, line-segment, pagination, input, text-area, number-input, stepper, time-picker, toggle-button, radio, text, placeholder-text, list-box-item, select, combo-box, tag-combo-box, radio-group, slider, tag, tag-group, circular-progress, counter, form-field, linear-progress, meter, and dependency merge add planning verified",
)
