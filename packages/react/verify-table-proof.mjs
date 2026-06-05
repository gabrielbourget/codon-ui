import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const packetSourcePath = path.join(packageRoot, "src/registry/table-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/table-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const manifestPath = path.join(packageRoot, "src/registry/manifest.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[table-proof] ${message}`)
  process.exitCode = 1
}

const assert = (condition, message) => {
  if (!condition) fail(message)
}

const readRequiredText = (filePath) => {
  assert(existsSync(filePath), `missing ${path.relative(packageRoot, filePath)}`)

  return readFileSync(filePath, "utf8")
}

const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const manifestSource = readRequiredText(manifestPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPlannedSourcePaths = [
  "packages/react/src/components/Table/Table.tsx",
  "packages/react/src/components/Table/helpers.ts",
  "packages/react/src/components/Table/TableContext.tsx",
  "packages/react/src/components/Table/labels.ts",
  "packages/react/src/components/Table/queryTypes.ts",
  "packages/react/src/components/Table/filterMetadata.ts",
  "packages/react/src/components/Table/filterDraft.ts",
  "packages/react/src/components/Table/TableStyles.module.css",
  "packages/react/src/components/Table/components/TableHeader/TableHeader.tsx",
  "packages/react/src/components/Table/components/TableBody/TableBody.tsx",
  "packages/react/src/components/Table/components/TableRow/TableRow.tsx",
  "packages/react/src/components/Table/components/TableCell/TableCell.tsx",
  "packages/react/src/components/Table/components/TableColumn/TableColumn.tsx",
  "packages/react/src/components/Table/components/TableFilterPopover/TableFilterPopover.tsx",
  "packages/react/src/components/Filtering/labels.ts",
  "packages/react/src/components/Filtering/FilterClauseRow/FilterClauseRow.tsx",
  "packages/react/src/components/Filtering/DynamicFilterArgumentInput/DynamicFilterArgumentInput.tsx",
  "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/InputTypeFilterArgument/InputTypeFilterArgument.tsx",
  "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgument.tsx",
  "packages/react/src/components/SortParameterList/SortParameterList.tsx",
  "packages/react/src/components/SortParameterList/SortParameterListItem/SortParameterListItem.tsx",
]
const expectedRegistryDependencies = [
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
  "tag-combo-box",
  "text",
  "time-picker",
  "toggle-switcher",
]
const expectedDefaultThemeVariables = [
  "--aui-control-foreground",
  "--aui-control-selected-background",
  "--aui-focus-ring",
  "--aui-radius-1",
  "--aui-shadow-1",
  "--aui-space-1",
  "--aui-space-2",
  "--aui-surface-muted",
  "--aui-transition-background-color",
  "--aui-transition-color",
]
const expectedPublicExports = [
  "Table",
  "TableBody",
  "TableCell",
  "TableColumn",
  "TableHeader",
  "TableRow",
  "TableFilterPopover",
  "FilterClauseRow",
  "DynamicFilterArgumentInput",
  "SortParameterList",
  "TableProps",
  "TableColumnMetadata",
  "TableQueryControls",
  "TableFilteringLabels",
  "PartialTableFilteringLabels",
  "FilterClauseRowProps",
  "DynamicFilterArgumentInputProps",
  "SortParameterListProps",
]

assert(packet.name === "table", "Table packet must describe the public table registry item")
assert(packet.type === "component", "Table packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Table packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Table packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#table-extraction-planning-checkpoint"),
  "Table packet must point at the Wavemap Table planning checkpoint",
)

requiredPlannedSourcePaths.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Table packet must include ${sourcePath}`,
  )
})
assert(packet.files.length >= 50, "Table packet must model the full Table, Filtering, and SortParameterList graph")
assert(
  packet.files.every((file) => file.role !== "test"),
  "Table packet must not receive focused tests as runtime files",
)
assert(
  packet.files.some((file) => file.role === "style" && file.sourcePath.endsWith("TableStyles.module.css")),
  "Table packet must include table styles",
)
assert(
  packet.files.some((file) => file.sourcePath.includes("DynamicFilterArgumentInput/InternalComponents")),
  "Table packet must include internal dynamic filter argument renderers",
)

requiredPlannedSourcePaths.forEach((sourcePath) => {
  assert(
    !existsSync(path.join(packageRoot, sourcePath.replace("packages/react/", ""))),
    `metadata-only boundary must not move ${sourcePath}`,
  )
})

expectedPublicExports.forEach((exportedName) => {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportedName),
    `Table packet must record public export intent for ${exportedName}`,
  )
})
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TableCellProps" &&
      publicExport.localName === "TCellProps" &&
      publicExport.typeOnly === true,
  ),
  "Table packet must record TableCellProps alias intent",
)

expectedRegistryDependencies.forEach((registryDependency) => {
  assert(
    packet.registryDependencies.includes(registryDependency),
    `Table packet must record registry dependency ${registryDependency}`,
  )
})
assert(packet.peerDependencies.react, "Table packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "Table packet must declare React DOM peer dependency")
assert(
  packet.peerDependencies["react-aria-components"] === "^1.17.0",
  "Table packet must declare React Aria Components peer dependency",
)
assert(packet.peerDependencies["react-aria"] === "^3.48.0", "Table packet must declare React Aria peer dependency")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "Table packet must declare classnames")
assert(packet.runtimeDependencies.motion === "^12.40.0", "Table packet must declare motion")
assert(
  packet.runtimeDependencies["@internationalized/date"] === "^3.12.1",
  "Table packet must declare @internationalized/date pressure",
)
assert(
  !packageJson.dependencies["@internationalized/date"],
  "metadata-only boundary must not add @internationalized/date yet",
)
assert(!packageJson.peerDependencies["react-aria"], "metadata-only boundary must not add react-aria yet")

assert(
  packet.themeRequirements.some((requirement) =>
    expectedDefaultThemeVariables.every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
  ),
  "Table packet must record default theme variable pressure",
)
assert(
  packet.importResolutions.some((resolution) => resolution.registryDependencyName === "tokens/alignment"),
  "Table packet must record alignment token support pressure",
)
assert(
  packet.importResolutions.some((resolution) => resolution.registryDependencyName === "tokens/drag"),
  "Table packet must record drag token support pressure",
)
assert(
  packet.importResolutions.some((resolution) => resolution.registryDependencyName === "tokens/responsive"),
  "Table packet must record responsive token support pressure",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--distance_1") && resolution.replacementSource.includes("--aui-space-1"),
  ),
  "Table packet must record spacing CSS variable rewrites",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Filtering/i18n.ts"),
  "Table packet must exclude Wavemap i18n adapter source",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Tables/EventTable/**"),
  "Table packet must exclude EventTable adapters",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Tables/FileUploadTable/**"),
  "Table packet must exclude FileUploadTable adapters",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Panels/SortAndFilterPanel/**"),
  "Table packet must exclude SortAndFilterPanel workflow source",
)

assert(
  packet.notes.some((note) => note.includes("add table")),
  "Table packet must keep the public add table command shape explicit",
)
assert(
  packet.notes.some((note) => note.includes("does not move Wavemap Table source")),
  "Table packet must document metadata-only source movement boundary",
)
assert(
  packet.notes.some((note) => note.includes("does not move Wavemap Table source")) &&
    packet.notes.some((note) => note.includes("activate a table manifest item")),
  "Table packet must keep manifest activation separate",
)
assert(
  packet.notes.some((note) => note.includes("delete/reinstall proof")),
  "Table packet must record later Wavemap reinstall proof",
)

assert(
  packetWrapperSource.includes("tableIngestPacketData as TRegistryIngestPacket"),
  "Table packet wrapper must type the JSON packet",
)
assert(
  registryIndexSource.includes('export { tableIngestPacket } from "./table-ingest-packet"'),
  "Registry index must export Table ingest packet",
)
assert(!manifestSource.includes('name: "table"'), "metadata-only boundary must not activate a table manifest item")
assert(
  !publicIndexSource.includes('export { Table } from "./components/Table"'),
  "metadata-only boundary must not export Table publicly yet",
)
assert(packageJson.scripts.test.includes("verify-table-proof.mjs"), "Package test script must run Table metadata proof")

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[table-proof] verified Table metadata-only receipt packet")
