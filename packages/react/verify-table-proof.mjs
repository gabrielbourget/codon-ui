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
const tableIndexPath = path.join(packageRoot, "src/components/Table/index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const tableFilterPopoverPath = path.join(
  packageRoot,
  "src/components/Table/components/TableFilterPopover/TableFilterPopover.tsx",
)

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
const tableIndexSource = readRequiredText(tableIndexPath)
const tableSource = readRequiredText(path.join(packageRoot, "src/components/Table/Table.tsx"))
const tableHelpersSource = readRequiredText(path.join(packageRoot, "src/components/Table/helpers.ts"))
const tableFilterPopoverSource = readRequiredText(tableFilterPopoverPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))
const themeCSS = readRequiredText(themeCSSPath)

const forbiddenConsumerImportsPattern =
  /@wavemap|i18n|next\/|router|route|api-contract|media|upload|saved|localStorage|@\/src\//u
const forbiddenLegacyCssPattern =
  /--distance_|--border_radius_|--shadow_1|--bgColorTransition|--colorTransition|--borderColorTransition|--boxShadowTransition|--focus-ring-color|--disabledOpacity|--Z_INDEX|--aui-validation/u

const requiredPackageFileSources = [
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

assert(packet.name === "table", "Table packet must describe the public table registry item")
assert(packet.type === "component", "Table packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Table packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Table packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#table-extraction-planning-checkpoint"),
  "Table packet must point at the Wavemap Table planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
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

const receivedSources = packet.files.map((file) => {
  const packagePath = path.join(packageRoot, file.sourcePath.replace("packages/react/", ""))
  const source = readRequiredText(packagePath)

  if (file.role === "source") {
    assert(!forbiddenConsumerImportsPattern.test(source), `${file.sourcePath} must not import consumer-only modules`)
  }
  if (file.role === "style") {
    assert(!forbiddenLegacyCssPattern.test(source), `${file.sourcePath} must not read legacy Wavemap CSS aliases`)
  }

  return { file, source }
})
const receivedSourceText = receivedSources.map(({ source }) => source).join("\n")
const receivedStyleText = receivedSources
  .filter(({ file }) => file.role === "style")
  .map(({ source }) => source)
  .join("\n")
const tableFilterPopoverTypeAheadFieldCount =
  tableFilterPopoverSource.match(/usesTypeAheadInput: column\.filter\?\.usesTypeAheadInput/gu)?.length ?? 0
const tableFilterPopoverTypeAheadChangeFieldCount =
  tableFilterPopoverSource.match(/typeAheadInputOnChange: column\.filter\?\.typeAheadInputOnChange/gu)?.length ?? 0

assert(
  receivedSourceText.includes('from "../../tokens/alignment"'),
  "Table helpers must use package-local alignment tokens",
)
assert(
  receivedSourceText.includes('from "../../tokens/responsive"'),
  "Table helpers must use package-local responsive tokens",
)
assert(receivedSourceText.includes('from "../../tokens/drag"'), "SortParameterList must use package-local drag tokens")
assert(
  receivedSourceText.includes('from "../../../tokens/a11y"'),
  "Filtering helpers must use package-local a11y tokens",
)
assert(
  receivedSourceText.includes('from "../../../../../tokens/theme-order"'),
  "Filter arguments must use theme-order tokens",
)
assert(
  receivedSourceText.includes('from "@internationalized/date"'),
  "Table date filters must import date parsing runtime",
)
assert(receivedSourceText.includes('from "react-aria"'), "SortParameterList drag/drop must import React Aria")
assert(receivedSourceText.includes("MotionDiv"), "SortParameterList must keep the typed Motion bridge")
assert(
  tableSource.includes("<TRow extends object = Record<string, unknown>>(props: TTableProps<TRow>)"),
  "Table component must preserve consumer row generics",
)
assert(!tableSource.includes("FC<TTableProps>"), "Table component must not collapse props to the default row type")
assert(
  tableHelpersSource.includes("export function useStableColumns<TRow extends object>"),
  "useStableColumns must infer consumer row generics from the column factory",
)
assert(
  tableHelpersSource.includes("getColumns: GetColumnsFn<TTableColumnMetadata<TRow>>"),
  "useStableColumns must accept row-typed column factories directly",
)
assert(
  !tableHelpersSource.includes("TColumn extends TTableColumnMetadata<TRow>"),
  "useStableColumns must not leave row inference only in a secondary column constraint",
)
assert(
  tableHelpersSource.includes("usesTypeAheadInput?: boolean") &&
    tableHelpersSource.includes("typeAheadInputOnChange?: (value: string) => void"),
  "Table filter metadata must expose the same typeahead flags as generic filter criteria",
)
assert(
  tableFilterPopoverTypeAheadFieldCount === 3 && tableFilterPopoverTypeAheadChangeFieldCount === 3,
  "TableFilterPopover drafts and criteria metadata must preserve typeahead metadata from column filters",
)

expectedDefaultThemeVariables.forEach((cssVariable) => {
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
  assert(receivedStyleText.includes(`var(${cssVariable})`), `Table source CSS must read ${cssVariable}`)
})

expectedPublicExports.forEach((exportedName) => {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportedName),
    `Table packet must record public export intent for ${exportedName}`,
  )
  assert(tableIndexSource.includes(exportedName), `Table index must export ${exportedName}`)
  assert(publicIndexSource.includes(exportedName), `Package index must export ${exportedName}`)
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
assert(publicIndexSource.includes('from "./components/Table"'), "Package index must export the Table kit")

expectedRegistryDependencies.forEach((registryDependency) => {
  assert(
    packet.registryDependencies.includes(registryDependency),
    `Table packet must record registry dependency ${registryDependency}`,
  )
  assert(manifestSource.includes(`"${registryDependency}"`), `Table manifest must include ${registryDependency}`)
})
assert(packet.peerDependencies.react, "Table packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "Table packet must declare React DOM peer dependency")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Table packet must declare RAC peer")
assert(packet.peerDependencies["react-aria"] === "^3.48.0", "Table packet must declare React Aria peer")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "Table packet must declare classnames")
assert(packet.runtimeDependencies.motion === "^12.40.0", "Table packet must declare motion")
assert(
  packet.runtimeDependencies["@internationalized/date"] === "^3.12.1",
  "Table packet must declare @internationalized/date pressure",
)
assert(
  packageJson.dependencies["@internationalized/date"] === "^3.12.1",
  "Table source receipt must add @internationalized/date",
)
assert(packageJson.peerDependencies["react-aria"] === "^3.48.0", "Table source receipt must add react-aria peer")
assert(
  packageJson.devDependencies["react-aria"] === "^3.48.0",
  "Table source receipt must add react-aria dev dependency",
)

assert(
  packet.themeRequirements.some((requirement) =>
    expectedDefaultThemeVariables.every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
  ),
  "Table packet must record default theme variable pressure",
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
  "Table packet must keep public add table explicit",
)
assert(
  packet.notes.some((note) => note.includes("delete/reinstall proof")),
  "Table packet must record later Wavemap reinstall proof",
)

assert(
  packetWrapperSource.includes("tableIngestPacketData as TRegistryIngestPacket"),
  "Table packet wrapper must type JSON",
)
assert(
  registryIndexSource.includes('export { tableIngestPacket } from "./table-ingest-packet"'),
  "Registry index must export Table ingest packet",
)
assert(manifestSource.includes('name: "table"'), "Table manifest item must be active")
assert(publicIndexSource.includes("export {"), "Package index must expose Table exports")
assert(packageJson.scripts.test.includes("verify-table-proof.mjs"), "Package test script must run Table source proof")

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[table-proof] verified Table source receipt packet")
