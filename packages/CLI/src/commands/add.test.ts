import assert from "node:assert/strict"

import {
  addDryRunSchema,
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
import { createDependencyInstallPlan } from "../helpers/packageManagerHelpers"
import { assertCliJsonReportContract } from "../testUtils/cliJsonContracts"

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
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["date-time-picker"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["date-time-range-picker"] }),
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
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["card"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["carousel"] }),
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
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["typeahead-search"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["compact-typeahead-search"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["thumbnail-image"] }),
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
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["panel"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["modal"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["alert-dialog"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["line-segment"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["indicator"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["circle-loader"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["lagging-lines-loader"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["link"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["breadcrumbs"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["pagination"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["toggle-switcher"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["table"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["sort-and-filter-panel"] }),
  getDefaultLocalReactRegistrySourcePath(),
)
assert.equal(
  resolveDefaultAddRegistrySourcePath({ allComponents: false, requestedItems: ["toaster"] }),
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
  const dryRunReport = addDryRunSchema.parse({
    componentPackets: packetResult.componentPackets,
    cwd: process.cwd(),
    dependencyInstallPlan: createDependencyInstallPlan({
      consumerRoot: process.cwd(),
      dependencyPlan: installPlan.dependencyPlan,
    }),
    dryRun: true,
    effects: dryRunEffects,
    findings: installPlan.findings,
    installPlan,
    registrySourcePath,
  })

  assertCliJsonReportContract({ report: dryRunReport, schemaName: "addDryRun" })
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

const verifyTableAddPlanning = async () => {
  const installPlan = await createComponentInstallPlan("table")
  const dryRunEffects = createAddDryRunEffects(installPlan)
  const plannedItems = installPlan.items.map((item) => item.name)
  const resolvedPaths = installPlan.files.map((file) => file.resolvedPath)

  for (const expectedItem of [
    "theme-css",
    "theme/action-colors",
    "theme/text-typography",
    "tokens/a11y",
    "tokens/alignment",
    "tokens/drag",
    "tokens/geometry",
    "tokens/responsive",
    "tokens/theme-order",
    "button",
    "card",
    "checkbox",
    "click-popover",
    "combo-box",
    "date-time-picker",
    "form-field",
    "input",
    "list-box-item",
    "number-input",
    "pagination",
    "select",
    "switch",
    "tag",
    "tag-group",
    "tag-combo-box",
    "time-picker",
    "toggle-switcher",
    "table",
  ]) {
    assert.ok(plannedItems.includes(expectedItem), `${expectedItem} should be planned for add table`)
  }

  for (const internalItemName of ["filtering", "sort-parameter-list", "table-filter-popover"]) {
    assert.equal(plannedItems.includes(internalItemName), false)
  }

  for (const expectedPath of [
    "src/components/Table/Table.tsx",
    "src/components/Table/components/TableFilterPopover/TableFilterPopover.tsx",
    "src/components/Filtering/FilterClauseRow/FilterClauseRow.tsx",
    "src/components/Filtering/DynamicFilterArgumentInput/DynamicFilterArgumentInput.tsx",
    "src/components/SortParameterList/SortParameterList.tsx",
    "src/components/DateTimePicker/DateTimePicker.tsx",
    "src/components/_registry/tokens/drag.ts",
    "src/components/_registry/tokens/responsive.ts",
    "src/components/_registry/action-colors.css",
  ]) {
    assert.ok(resolvedPaths.includes(expectedPath), `${expectedPath} should be planned for add table`)
  }

  for (const consumerOwnedPathFragment of [
    "EventTable",
    "RecentEventsTable",
    "FileUploadTable",
    "SortAndFilterPanel",
    "i18n",
  ]) {
    assert.equal(
      resolvedPaths.some((resolvedPath) => resolvedPath.includes(consumerOwnedPathFragment)),
      false,
    )
  }

  assert.equal(installPlan.findings.filter((finding) => finding.severity === "error").length, 0)
  assert.equal(dryRunEffects.files.plannedCount, 164)
  assert.equal(dryRunEffects.files.wouldWriteCount, 164)
  assert.equal(dryRunEffects.dependencies.missingCount, 7)
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
  itemName: "card",
  expectedItems: ["theme-css", "card"],
  expectedResolvedPaths: [
    "src/components/Cards/Card/Card.tsx",
    "src/components/Cards/Card/CardStyles.module.css",
    "src/components/Cards/Card/helpers.ts",
    "src/components/_registry/theme.css",
  ],
  expectedThemeVariables: ["--aui-space-3", "--aui-shadow-1"],
  expectedPlannedCount: 4,
})

await verifyComponentAddPlanning({
  itemName: "carousel",
  expectedItems: [
    "theme-css",
    "theme/action-colors",
    "tokens/geometry",
    "tokens/theme-order",
    "button",
    "tokens/a11y",
    "theme/text-typography",
    "text",
    "theme/circular-progress-compatibility",
    "tokens/svg",
    "circular-progress",
    "counter",
    "carousel",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/Carousel/Carousel.tsx",
    "src/components/Carousel/CarouselStyles.module.css",
    "src/components/Carousel/components/CarouselCloseButton/CarouselCloseButton.tsx",
    "src/components/Carousel/components/CarouselCloseButton/DefaultCloseIcon.tsx",
    "src/components/Carousel/components/CarouselCloseButton/helpers.tsx",
    "src/components/Carousel/components/CarouselCounter/CarouselCounter.tsx",
    "src/components/Carousel/components/CarouselCounter/CarouselCounterStyles.module.css",
    "src/components/Carousel/components/CarouselCounter/helpers.ts",
    "src/components/Carousel/components/CarouselDots/CarouselDots.tsx",
    "src/components/Carousel/components/CarouselDots/CarouselDotsStyles.module.css",
    "src/components/Carousel/components/CarouselDots/helpers.tsx",
    "src/components/Carousel/components/CarouselNextButton/CarouselNextButton.tsx",
    "src/components/Carousel/components/CarouselNextButton/DefaultNextIcon.tsx",
    "src/components/Carousel/components/CarouselNextButton/helpers.tsx",
    "src/components/Carousel/components/CarouselPrevButton/CarouselPrevButton.tsx",
    "src/components/Carousel/components/CarouselPrevButton/DefaultPrevIcon.tsx",
    "src/components/Carousel/components/CarouselPrevButton/helpers.tsx",
    "src/components/Carousel/helpers.ts",
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
    "src/components/_registry/action-colors.css",
    "src/components/_registry/circular-progress-compatibility.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/a11y.ts",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/svg.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-1", "--aui-focus-ring", "--aui-control-selected-background"],
  expectedMissingDependencyCount: 6,
  expectedPlannedCount: 42,
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
  itemName: "panel",
  expectedItems: ["theme-css", "tokens/geometry", "tokens/placement", "tokens/motion", "panel"],
  expectedResolvedPaths: [
    "src/components/Panel/Panel.tsx",
    "src/components/Panel/PanelStyles.module.css",
    "src/components/Panel/helpers.ts",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/motion.ts",
    "src/components/_registry/tokens/placement.ts",
  ],
  expectedThemeVariables: [
    "--aui-surface",
    "--aui-radius-1",
    "--aui-shadow-1",
    "--aui-z-index-panel",
    "--aui-z-index-content-offset",
    "--aui-z-index-overlay-offset",
  ],
  expectedMissingDependencyCount: 5,
})

await verifyComponentAddPlanning({
  itemName: "modal",
  expectedItems: [
    "theme-css",
    "theme/action-colors",
    "tokens/a11y",
    "tokens/geometry",
    "tokens/theme-order",
    "button",
    "theme/text-typography",
    "text",
    "modal",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/Modal/Modal.tsx",
    "src/components/Modal/ModalStyles.module.css",
    "src/components/Modal/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/a11y.ts",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "theme/action-colors.css",
  expectedThemeVariables: ["--aui-space-1", "--aui-shadow-1", "--aui-focus-ring", "--aui-color-quintenary-500"],
  expectedPlannedCount: 17,
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
  itemName: "indicator",
  expectedItems: ["indicator"],
  expectedResolvedPaths: [
    "src/components/VisualUtilities/Indicator/Indicator.tsx",
    "src/components/VisualUtilities/Indicator/IndicatorStyles.module.css",
    "src/components/VisualUtilities/Indicator/helpers.ts",
  ],
  expectedMissingDependencyCount: 2,
  expectedPlannedCount: 3,
})

await verifyComponentAddPlanning({
  itemName: "circle-loader",
  expectedItems: ["circle-loader"],
  expectedResolvedPaths: [
    "src/components/Loaders/CircleLoader/CircleLoader.tsx",
    "src/components/Loaders/CircleLoader/CircleLoaderStyles.module.css",
  ],
  expectedMissingDependencyCount: 1,
  expectedPlannedCount: 2,
})

await verifyComponentAddPlanning({
  itemName: "lagging-lines-loader",
  expectedItems: ["lagging-lines-loader"],
  expectedResolvedPaths: [
    "src/components/Loaders/LaggingLinesLoader/LaggingLinesLoader.tsx",
    "src/components/Loaders/LaggingLinesLoader/LaggingLinesLoaderStyles.module.css",
    "src/components/Loaders/LaggingLinesLoader/helpers.ts",
  ],
  expectedMissingDependencyCount: 2,
  expectedPlannedCount: 3,
})

await verifyComponentAddPlanning({
  itemName: "link",
  expectedItems: ["theme-css", "theme/action-colors", "tokens/a11y", "tokens/theme-order", "link"],
  expectedResolvedPaths: [
    "src/components/Link/Link.tsx",
    "src/components/Link/LinkStyles.module.css",
    "src/components/Link/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/a11y.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "theme/action-colors.css",
  expectedThemeVariables: ["--aui-space-1", "--aui-focus-ring", "--aui-color-primary-400"],
  expectedMissingDependencyCount: 2,
  expectedPlannedCount: 7,
})

await verifyComponentAddPlanning({
  itemName: "breadcrumbs",
  expectedItems: [
    "theme-css",
    "theme/action-colors",
    "tokens/a11y",
    "tokens/geometry",
    "tokens/theme-order",
    "button",
    "click-popover",
    "link",
    "theme/text-typography",
    "text",
    "list-box-item",
    "breadcrumbs",
  ],
  expectedResolvedPaths: [
    "src/components/Breadcrumbs/Breadcrumbs.tsx",
    "src/components/Breadcrumbs/BreadcrumbsStyles.module.css",
    "src/components/Breadcrumbs/DefaultBreadcrumbIcons.tsx",
    "src/components/Breadcrumbs/helpers.ts",
    "src/components/Breadcrumbs/labels.ts",
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/ClickPopover/ClickPopover.tsx",
    "src/components/ClickPopover/ClickPopoverStyles.module.css",
    "src/components/ClickPopover/helpers.ts",
    "src/components/Link/Link.tsx",
    "src/components/Link/LinkStyles.module.css",
    "src/components/Link/helpers.ts",
    "src/components/ListBoxItem/ListBoxItem.tsx",
    "src/components/ListBoxItem/ListBoxItemStyles.module.css",
    "src/components/ListBoxItem/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/a11y.ts",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-1", "--aui-color-primary-500", "--aui-animation-fade-in"],
  expectedMissingDependencyCount: 4,
  expectedPlannedCount: 28,
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
  itemName: "date-time-range-picker",
  expectedItems: [
    "theme-css",
    "theme/action-colors",
    "tokens/geometry",
    "tokens/placement",
    "theme/text-typography",
    "text",
    "tokens/theme-order",
    "button",
    "date-time-range-picker",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/DateTimeRangePicker/CalendarStyles.module.css",
    "src/components/DateTimeRangePicker/DateTimeRangePicker.tsx",
    "src/components/DateTimeRangePicker/DateTimeRangePickerStyles.module.css",
    "src/components/DateTimeRangePicker/DefaultDateTimeRangePickerIcons.tsx",
    "src/components/DateTimeRangePicker/helpers.tsx",
    "src/components/DateTimeRangePicker/labels.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/placement.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "theme/action-colors.css",
  expectedThemeVariables: ["--aui-space-1", "--aui-focus-ring", "--aui-color-primary-500"],
  expectedMissingDependencyCount: 4,
  expectedPlannedCount: 20,
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
  itemName: "toggle-switcher",
  expectedItems: [
    "theme-css",
    "theme/action-colors",
    "tokens/geometry",
    "tokens/theme-order",
    "tokens/motion",
    "toggle-switcher",
  ],
  expectedResolvedPaths: [
    "src/components/ToggleSwitcher/ToggleSwitcher.tsx",
    "src/components/ToggleSwitcher/ToggleSwitcherStyles.module.css",
    "src/components/ToggleSwitcher/helpers.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/motion.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeSourcePath: "theme/action-colors.css",
  expectedThemeVariables: ["--aui-surface-muted", "--aui-transition-box-shadow", "--aui-color-quintenary-500"],
  expectedMissingDependencyCount: 3,
  expectedPlannedCount: 8,
})

await verifyTableAddPlanning()

await verifyComponentAddPlanning({
  itemName: "toaster",
  expectedItems: [
    "theme-css",
    "theme/action-colors",
    "tokens/a11y",
    "tokens/geometry",
    "tokens/theme-order",
    "button",
    "theme/text-typography",
    "text",
    "toaster",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/Toaster/Toast/DefaultToastIcons.tsx",
    "src/components/Toaster/Toast/Toast.tsx",
    "src/components/Toaster/Toast/ToastStyles.module.css",
    "src/components/Toaster/Toast/helpers.tsx",
    "src/components/Toaster/Toast/labels.ts",
    "src/components/Toaster/Toaster.tsx",
    "src/components/Toaster/ToasterStyles.module.css",
    "src/components/Toaster/helpers.ts",
    "src/components/Toaster/stateManagement.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/a11y.ts",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-z-index-toast", "--aui-status-success", "--aui-control-selected-background"],
  expectedMissingDependencyCount: 5,
  expectedPlannedCount: 23,
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

await verifyComponentAddPlanning({
  itemName: "typeahead-search",
  expectedItems: [
    "theme-css",
    "tokens/geometry",
    "theme/text-typography",
    "text",
    "input",
    "theme/action-colors",
    "tokens/theme-order",
    "button",
    "list-box-item",
    "placeholder-text",
    "typeahead-search",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/Input/Input.tsx",
    "src/components/Input/InputStyles.module.css",
    "src/components/Input/helpers.ts",
    "src/components/ListBoxItem/ListBoxItem.tsx",
    "src/components/ListBoxItem/ListBoxItemStyles.module.css",
    "src/components/ListBoxItem/helpers.ts",
    "src/components/Search/TypeaheadSearch/DefaultLoadingIndicator.module.css",
    "src/components/Search/TypeaheadSearch/DefaultLoadingIndicator.tsx",
    "src/components/Search/TypeaheadSearch/DefaultSearchIcon.tsx",
    "src/components/Search/TypeaheadSearch/TypeaheadSearch.tsx",
    "src/components/Search/TypeaheadSearch/TypeaheadSearchStyles.module.css",
    "src/components/Search/TypeaheadSearch/helpers.ts",
    "src/components/Search/TypeaheadSearch/labels.ts",
    "src/components/Search/TypeaheadSearch/status.ts",
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
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: ["--aui-space-2", "--aui-focus-ring", "--aui-transition-box-shadow"],
  expectedMissingDependencyCount: 4,
  expectedPlannedCount: 30,
})

await verifyComponentAddPlanning({
  itemName: "compact-typeahead-search",
  expectedItems: [
    "theme-css",
    "tokens/geometry",
    "tokens/placement",
    "theme/text-typography",
    "text",
    "input",
    "theme/action-colors",
    "tokens/theme-order",
    "button",
    "list-box-item",
    "placeholder-text",
    "compact-typeahead-search",
  ],
  expectedResolvedPaths: [
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/CompactTypeaheadSearch/CompactTypeaheadSearch.tsx",
    "src/components/CompactTypeaheadSearch/CompactTypeaheadSearchStyles.module.css",
    "src/components/CompactTypeaheadSearch/DefaultLoadingIndicator.module.css",
    "src/components/CompactTypeaheadSearch/DefaultLoadingIndicator.tsx",
    "src/components/CompactTypeaheadSearch/DefaultSearchIcon.tsx",
    "src/components/CompactTypeaheadSearch/helpers.ts",
    "src/components/CompactTypeaheadSearch/labels.ts",
    "src/components/Input/Input.tsx",
    "src/components/Input/InputStyles.module.css",
    "src/components/Input/helpers.ts",
    "src/components/ListBoxItem/ListBoxItem.tsx",
    "src/components/ListBoxItem/ListBoxItemStyles.module.css",
    "src/components/ListBoxItem/helpers.ts",
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
    "--aui-surface",
  ],
  expectedMissingDependencyCount: 4,
  expectedPlannedCount: 30,
})

await verifyComponentAddPlanning({
  itemName: "thumbnail-image",
  expectedItems: ["thumbnail-image"],
  expectedResolvedPaths: ["src/components/ThumbnailImage/ThumbnailImage.tsx"],
  expectedMissingDependencyCount: 2,
  expectedPlannedCount: 1,
})

await verifyComponentAddPlanning({
  itemName: "alert-dialog",
  expectedItems: [
    "theme-css",
    "tokens/a11y",
    "tokens/geometry",
    "theme/action-colors",
    "tokens/theme-order",
    "button",
    "theme/text-typography",
    "text",
    "alert-dialog",
  ],
  expectedResolvedPaths: [
    "src/components/AlertDialog/AlertDialog.tsx",
    "src/components/AlertDialog/AlertDialogStyles.module.css",
    "src/components/AlertDialog/DefaultAlertDialogIcons.tsx",
    "src/components/AlertDialog/helpers.tsx",
    "src/components/AlertDialog/labels.ts",
    "src/components/Button/Button.tsx",
    "src/components/Button/ButtonStyles.module.css",
    "src/components/Button/helpers.ts",
    "src/components/Text/Text.tsx",
    "src/components/Text/TextStyles.module.css",
    "src/components/Text/constants.ts",
    "src/components/Text/helpers.ts",
    "src/components/Text/types.ts",
    "src/components/_registry/action-colors.css",
    "src/components/_registry/text-typography.css",
    "src/components/_registry/theme.css",
    "src/components/_registry/tokens/a11y.ts",
    "src/components/_registry/tokens/geometry.ts",
    "src/components/_registry/tokens/theme-order.ts",
  ],
  expectedThemeVariables: [
    "--aui-animation-fade-in",
    "--aui-animation-fade-out",
    "--aui-z-index-modal",
    "--aui-status-warning",
    "--aui-status-danger",
    "--aui-status-success",
  ],
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
  "[aminoui-cli] avatar, button, card, carousel, checkbox, checkbox-group, click-popover, tooltip, hover-popover, menu, panel, modal, alert-dialog, line-segment, indicator, circle-loader, lagging-lines-loader, link, breadcrumbs, pagination, input, text-area, number-input, stepper, time-picker, date-time-picker, date-time-range-picker, toggle-button, toggle-switcher, table, toaster, radio, text, placeholder-text, list-box-item, select, combo-box, tag-combo-box, typeahead-search, compact-typeahead-search, thumbnail-image, radio-group, slider, tag, tag-group, circular-progress, counter, form-field, linear-progress, meter, and dependency merge add planning verified",
)
