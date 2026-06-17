import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const sortAndFilterPanelRoot = path.join(packageRoot, "src/components/SortAndFilterPanel")
const packetSourcePath = path.join(packageRoot, "src/registry/sort-and-filter-panel-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/sort-and-filter-panel-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const manifestPath = path.join(packageRoot, "src/registry/manifest.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")
const themeCSSPath = path.join(packageRoot, "theme.css")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")

const fail = (message) => {
  console.error(`[sort-and-filter-panel-proof] ${message}`)
  process.exitCode = 1
}

const assert = (condition, message) => {
  if (!condition) fail(message)
}

const readRequiredText = (filePath) => {
  assert(existsSync(filePath), `missing ${path.relative(packageRoot, filePath)}`)

  return readFileSync(filePath, "utf8")
}

const forbiddenConsumerImportsPattern =
  /@wavemap|@\/src\/|next\/|router|route|api-contract|shared-utils|UIContext|serverSideStyles|i18n/u
const forbiddenSourcePattern = /motion\/react|localStorage|media|upload|saved-view/u
const forbiddenLegacyCssPattern =
  /module\.scss|--distance_|--neutral_|--border_radius_|--disabledOpacity|--bgColorTransition|--background\)|serverSideStyles/u

const requiredPackageFileSources = [
  "packages/react/src/components/SortAndFilterPanel/SortAndFilterPanel.tsx",
  "packages/react/src/components/SortAndFilterPanel/helpers.ts",
  "packages/react/src/components/SortAndFilterPanel/labels.ts",
  "packages/react/src/components/SortAndFilterPanel/SortAndFilterPanelStyles.module.css",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/ActiveFilters/ActiveFilters.tsx",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/ActiveFilters/helpers.ts",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/ActiveFilters/ActiveFiltersStyles.module.css",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/ActiveSorts/ActiveSorts.tsx",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/ActiveSorts/helpers.ts",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/ActiveSorts/ActiveSortsStyles.module.css",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/PanelFooter/PanelFooter.tsx",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/PanelFooter/helpers.ts",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/PanelFooter/PanelFooterStyles.module.css",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/PanelHeader/PanelHeader.tsx",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/PanelHeader/helpers.ts",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/PanelHeader/DefaultCloseIcon.tsx",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/PanelHeader/PanelHeaderStyles.module.css",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/SortParameterList/SortParameterList.tsx",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/SortParameterList/helpers.ts",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/SortParameterList/SortParameterListStyles.module.css",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/SortParameterList/InternalComponents/AnimatedListBoxItem/AnimatedListBoxItem.tsx",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/SortParameterList/InternalComponents/AnimatedListBoxItem/helpers.ts",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/SortParameterList/InternalComponents/AnimatedListBoxItem/AnimatedListBoxItemStyles.module.css",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/SortParameterList/InternalComponents/SortParameterListItem/SortParameterListItem.tsx",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/SortParameterList/InternalComponents/SortParameterListItem/helpers.ts",
  "packages/react/src/components/SortAndFilterPanel/InternalComponents/SortParameterList/InternalComponents/SortParameterListItem/SortParameterListItemStyles.module.css",
]
const requiredTargetPaths = requiredPackageFileSources.map((sourcePath) =>
  sourcePath.replace("packages/react/src/components/SortAndFilterPanel", "Panels/SortAndFilterPanel"),
)
const expectedRegistryDependencies = [
  "theme-css",
  "theme/action-colors",
  "table",
  "panel",
  "form-field",
  "select",
  "list-box-item",
  "line-segment",
  "tag-group",
  "text",
  "placeholder-text",
  "toggle-switcher",
  "tooltip",
  "button",
]
const expectedPublicExports = [
  "SortAndFilterPanel",
  "SortAndFilterPanelProps",
  "ApplySortAndFilterParametersArgs",
  "SortAndFilterPanelFilterGroup",
  "SortAndFilterPanelSortInstruction",
  "SortAndFilterPanelFocusTarget",
  "SortAndFilterPanelLabels",
  "PartialSortAndFilterPanelLabels",
  "DEFAULT_SORT_AND_FILTER_PANEL_LABELS",
  "resolveSortAndFilterPanelLabels",
]
const expectedThemeVariables = [
  "--cui-background",
  "--cui-border",
  "--cui-border-muted",
  "--cui-control-hover-background",
  "--cui-control-selected-foreground",
  "--cui-foreground",
  "--cui-opacity-disabled",
  "--cui-radius-1",
  "--cui-space-1",
  "--cui-space-2",
  "--cui-surface-muted",
  "--cui-transition-background-color",
]

const sortAndFilterPanelSource = readRequiredText(path.join(sortAndFilterPanelRoot, "SortAndFilterPanel.tsx"))
const helpersSource = readRequiredText(path.join(sortAndFilterPanelRoot, "helpers.ts"))
const labelsSource = readRequiredText(path.join(sortAndFilterPanelRoot, "labels.ts"))
const componentIndexSource = readRequiredText(path.join(sortAndFilterPanelRoot, "index.ts"))
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const manifestSource = readRequiredText(manifestPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))
const themeCSS = readRequiredText(themeCSSPath)
const actionColors = readRequiredText(actionColorsPath)

assert(sortAndFilterPanelSource.startsWith('"use client"'), "SortAndFilterPanel must preserve the client boundary")
assert(
  sortAndFilterPanelSource.includes('import FormField from "../FormField/FormField"'),
  "SortAndFilterPanel must import package-local FormField",
)
assert(
  sortAndFilterPanelSource.includes('import Panel from "../Panel/Panel"'),
  "SortAndFilterPanel must import package-local Panel",
)
assert(
  sortAndFilterPanelSource.includes('import Select from "../Select/Select"'),
  "SortAndFilterPanel must import package-local Select",
)
assert(
  sortAndFilterPanelSource.includes('from "../Table/filterDraft"') &&
    sortAndFilterPanelSource.includes('from "../Table/queryTypes"'),
  "SortAndFilterPanel must use generic Table query support",
)
assert(
  sortAndFilterPanelSource.includes(
    "applyPendingSortAndFilterChanges({ sortInstructions: sortParameterList, filterGroups })",
  ),
  "SortAndFilterPanel must emit generic sortInstructions and filterGroups",
)
assert(
  helpersSource.includes("export type TSortAndFilterPanelFilterGroup = TTableFilterGroup"),
  "SortAndFilterPanel helpers must alias generic Table filter groups",
)
assert(
  helpersSource.includes("export type TSortAndFilterPanelSortInstruction = TTableSortInstruction"),
  "SortAndFilterPanel helpers must alias generic Table sort instructions",
)
assert(
  labelsSource.includes("DEFAULT_SORT_AND_FILTER_PANEL_LABELS") &&
    labelsSource.includes("resolveSortAndFilterPanelLabels"),
  "SortAndFilterPanel must ship default labels and a resolver",
)

const receivedSources = requiredPackageFileSources.map((sourcePath) => {
  const packagePath = path.join(packageRoot, sourcePath.replace("packages/react/", ""))
  const source = readRequiredText(packagePath)

  if (sourcePath.endsWith(".ts") || sourcePath.endsWith(".tsx")) {
    assert(!forbiddenConsumerImportsPattern.test(source), `${sourcePath} must not import consumer-owned source`)
    assert(!forbiddenSourcePattern.test(source), `${sourcePath} must not import excluded runtime domains`)
  }
  if (sourcePath.endsWith(".css")) {
    assert(!forbiddenLegacyCssPattern.test(source), `${sourcePath} must not read legacy Wavemap CSS aliases`)
  }

  return { sourcePath, source }
})

const receivedSourceText = receivedSources.map(({ source }) => source).join("\n")
const receivedStyleText = receivedSources
  .filter(({ sourcePath }) => sourcePath.endsWith(".css"))
  .map(({ source }) => source)
  .join("\n")

assert(
  !receivedSourceText.includes("buildCommonSortAndFilterPanelLabels"),
  "Wavemap i18n adapter must not enter source",
)
assert(!receivedSourceText.includes("@wavemap/api-contracts"), "Wavemap API contracts must not enter source")
assert(!receivedSourceText.includes("motion/react"), "SortAndFilterPanel must not import Motion")
assert(receivedStyleText.includes("var(--cui-border-muted)"), "SortAndFilterPanel CSS must use Codon UI border tokens")
assert(receivedStyleText.includes("var(--cui-space-2)"), "SortAndFilterPanel CSS must use Codon UI spacing tokens")

expectedThemeVariables.forEach((cssVariable) => {
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
})
assert(actionColors.includes("--cui-color-primary-500"), "action-colors.css must declare --cui-color-primary-500")

assert(packet.name === "sort-and-filter-panel", "SortAndFilterPanel packet must describe the public item")
assert(packet.type === "component", "SortAndFilterPanel packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "SortAndFilterPanel packet must target @codon-ui/react")
assert(packet.sourceRepository === "wavemap", "SortAndFilterPanel packet must record Wavemap source")
assert(packet.files.length === requiredPackageFileSources.length, "SortAndFilterPanel packet must list approved files")
requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `packet must target ${targetPath}`,
  )
})
assert(
  packet.files.every((file) => !file.sourcePath.includes("i18n") && !file.sourcePath.includes("__tests__")),
  "SortAndFilterPanel packet must exclude Wavemap i18n and tests",
)

expectedPublicExports.forEach((exportedName) => {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportedName),
    `packet must record public export ${exportedName}`,
  )
  assert(componentIndexSource.includes(exportedName), `component index must export ${exportedName}`)
  assert(publicIndexSource.includes(exportedName), `package index must export ${exportedName}`)
})

expectedRegistryDependencies.forEach((registryDependency) => {
  assert(packet.registryDependencies.includes(registryDependency), `packet must depend on ${registryDependency}`)
  assert(manifestSource.includes(`"${registryDependency}"`), `manifest must include ${registryDependency}`)
})
assert(packet.peerDependencies.react, "packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "packet must declare React DOM peer dependency")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "packet must declare RAC peer")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "packet must declare classnames")
assert(!packet.runtimeDependencies.motion, "packet must not declare Motion")
assert(
  packet.themeRequirements.some((requirement) =>
    ["--cui-color-primary-500", ...expectedThemeVariables].every((cssVariable) =>
      requirement.cssVariables.includes(cssVariable),
    ),
  ),
  "packet must record default theme variable pressure",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Panels/SortAndFilterPanel/i18n.ts"),
  "packet must exclude Wavemap i18n adapter",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Panels/SortAndFilterPanel/__tests__/**"),
  "packet must exclude Wavemap focused tests",
)
assert(
  packet.notes.some((note) => note.includes("generic sort/filter query-builder panel")),
  "packet notes must describe the reusable boundary",
)

assert(
  packetWrapperSource.includes("sortAndFilterPanelIngestPacketData as TRegistryIngestPacket"),
  "packet wrapper must type JSON",
)
assert(
  registryIndexSource.includes(
    'export { sortAndFilterPanelIngestPacket } from "./sort-and-filter-panel-ingest-packet"',
  ),
  "registry index must export SortAndFilterPanel packet",
)
assert(manifestSource.includes('name: "sort-and-filter-panel"'), "manifest item must be active")
requiredPackageFileSources.forEach((sourcePath) => {
  assert(manifestSource.includes(`"${sourcePath}"`), `manifest must include ${sourcePath}`)
})
requiredTargetPaths.forEach((targetPath) => {
  assert(manifestSource.includes(`"${targetPath}"`), `manifest must target ${targetPath}`)
})
assert(publicIndexSource.includes('from "./components/SortAndFilterPanel"'), "package index must export panel")
assert(packageJson.dependencies.classnames === "^2.3.2", "package must keep classnames runtime dependency")
assert(packageJson.peerDependencies.react, "package must keep React peer dependency")
assert(packageJson.peerDependencies["react-aria-components"], "package must keep React Aria Components peer")
assert(
  packageJson.scripts.test.includes("verify-sort-and-filter-panel-proof.mjs"),
  "package test script must run SortAndFilterPanel proof",
)

if (process.exitCode) process.exit(process.exitCode)

console.log("[sort-and-filter-panel-proof] verified SortAndFilterPanel source receipt packet")
