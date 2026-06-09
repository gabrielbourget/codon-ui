import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const typeaheadSearchRoot = path.join(packageRoot, "src/components/Search/TypeaheadSearch")
const typeaheadSearchSourcePath = path.join(typeaheadSearchRoot, "TypeaheadSearch.tsx")
const helpersSourcePath = path.join(typeaheadSearchRoot, "helpers.ts")
const labelsSourcePath = path.join(typeaheadSearchRoot, "labels.ts")
const statusSourcePath = path.join(typeaheadSearchRoot, "status.ts")
const searchIconSourcePath = path.join(typeaheadSearchRoot, "DefaultSearchIcon.tsx")
const loadingIndicatorSourcePath = path.join(typeaheadSearchRoot, "DefaultLoadingIndicator.tsx")
const loadingIndicatorStylesPath = path.join(typeaheadSearchRoot, "DefaultLoadingIndicator.module.css")
const stylesSourcePath = path.join(typeaheadSearchRoot, "TypeaheadSearchStyles.module.css")
const typeaheadSearchIndexPath = path.join(typeaheadSearchRoot, "index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/typeahead-search-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/typeahead-search-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const manifestPath = path.join(packageRoot, "src/registry/manifest.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[typeahead-search-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|api-contract|shared-utils|window|document|localStorage|@\/src\/|@\/src\/utils\/typeahead/u
const forbiddenLegacyCssPattern =
  /--distance_|--disabledOpacity|--border_radius_|--borderColorTransition|--boxShadowTransition|--focus-ring-color|theme\/typeahead-search-compatibility/u

const typeaheadSearchSource = readRequiredText(typeaheadSearchSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const statusSource = readRequiredText(statusSourcePath)
const searchIconSource = readRequiredText(searchIconSourcePath)
const loadingIndicatorSource = readRequiredText(loadingIndicatorSourcePath)
const loadingIndicatorStyles = readRequiredText(loadingIndicatorStylesPath)
const stylesSource = readRequiredText(stylesSourcePath)
const typeaheadSearchIndexSource = readRequiredText(typeaheadSearchIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const manifestSource = readRequiredText(manifestPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Search/TypeaheadSearch/TypeaheadSearch.tsx",
  "packages/react/src/components/Search/TypeaheadSearch/helpers.ts",
  "packages/react/src/components/Search/TypeaheadSearch/labels.ts",
  "packages/react/src/components/Search/TypeaheadSearch/status.ts",
  "packages/react/src/components/Search/TypeaheadSearch/DefaultSearchIcon.tsx",
  "packages/react/src/components/Search/TypeaheadSearch/DefaultLoadingIndicator.tsx",
  "packages/react/src/components/Search/TypeaheadSearch/DefaultLoadingIndicator.module.css",
  "packages/react/src/components/Search/TypeaheadSearch/TypeaheadSearchStyles.module.css",
]
const requiredTargetPaths = [
  "Search/TypeaheadSearch/TypeaheadSearch.tsx",
  "Search/TypeaheadSearch/helpers.ts",
  "Search/TypeaheadSearch/labels.ts",
  "Search/TypeaheadSearch/status.ts",
  "Search/TypeaheadSearch/DefaultSearchIcon.tsx",
  "Search/TypeaheadSearch/DefaultLoadingIndicator.tsx",
  "Search/TypeaheadSearch/DefaultLoadingIndicator.module.css",
  "Search/TypeaheadSearch/TypeaheadSearchStyles.module.css",
]
const expectedRegistryDependencies = [
  "theme-css",
  "tokens/geometry",
  "input",
  "button",
  "list-box-item",
  "placeholder-text",
]
const expectedPublicExports = [
  "TypeaheadSearch",
  "TypeaheadSearchProps",
  "TypeaheadSearchLabels",
  "PartialTypeaheadSearchLabels",
  "TypeaheadSearchStatus",
  "AVAILABLE_TYPEAHEAD_SEARCH_STATUSES",
  "TYPEAHEAD_SEARCH_STATUS__IDLE",
  "TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY",
  "TYPEAHEAD_SEARCH_STATUS__LOADING",
  "TYPEAHEAD_SEARCH_STATUS__ERROR",
  "TYPEAHEAD_SEARCH_STATUS__EMPTY",
  "TYPEAHEAD_SEARCH_STATUS__RESULTS",
  "DEFAULT_TYPEAHEAD_SEARCH_LABELS",
  "resolveTypeaheadSearchLabels",
]
const expectedThemeVariables = [
  "--aui-control-background",
  "--aui-control-border",
  "--aui-control-foreground",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-radius-1",
  "--aui-space-1",
  "--aui-space-2",
  "--aui-transition-border-color",
  "--aui-transition-box-shadow",
]

assert(typeaheadSearchSource.startsWith('"use client"'), "TypeaheadSearch must preserve the client boundary")
assert(
  typeaheadSearchSource.includes('import Button from "../../Button/Button"'),
  "TypeaheadSearch must import package-local Button",
)
assert(
  typeaheadSearchSource.includes('import Input from "../../Input/Input"'),
  "TypeaheadSearch must import package-local Input",
)
assert(
  typeaheadSearchSource.includes('import ListBoxItem from "../../ListBoxItem/ListBoxItem"'),
  "TypeaheadSearch must import package-local ListBoxItem",
)
assert(
  typeaheadSearchSource.includes('import PlaceholderText from "../../Text/variants/PlaceholderText/PlaceholderText"'),
  "TypeaheadSearch must import package-local PlaceholderText",
)
assert(
  typeaheadSearchSource.includes("ListBox") && typeaheadSearchSource.includes("Selection"),
  "TypeaheadSearch must use React Aria listbox primitives",
)
assert(
  typeaheadSearchSource.includes("forwardedRef: ForwardedRef<HTMLDivElement>"),
  "TypeaheadSearch must forward a div ref",
)
assert(typeaheadSearchSource.includes("inputValue.trim()"), "TypeaheadSearch must trim submitted queries")
assert(
  typeaheadSearchSource.includes("onSelectionChange?.(selectedKey)"),
  "TypeaheadSearch must preserve selection callbacks",
)
assert(
  typeaheadSearchSource.includes('data-testid={dataTestID ?? "typeahead-search"}'),
  "TypeaheadSearch must preserve test id fallback",
)
assert(
  typeaheadSearchSource.includes("TYPEAHEAD_SEARCH_STATUS__RESULTS"),
  "TypeaheadSearch must use component-owned status constants",
)

assert(
  helpersSource.includes('from "../../../tokens/geometry"'),
  "TypeaheadSearch helpers must import package-local geometry tokens",
)
assert(helpersSource.includes("export type TTypeaheadSearchProps"), "TypeaheadSearch helpers must export props")
assert(
  helpersSource.includes("export const calibrateComponent"),
  "TypeaheadSearch calibration helper must remain local",
)
assert(
  helpersSource.includes("TypeaheadSearchDefaultSearchIcon"),
  "TypeaheadSearch helpers must preserve default search icon",
)
assert(
  helpersSource.includes("TypeaheadSearchDefaultLoadingIndicator"),
  "TypeaheadSearch helpers must preserve default loading indicator",
)
assert(labelsSource.includes("DEFAULT_TYPEAHEAD_SEARCH_LABELS"), "TypeaheadSearch labels must keep defaults")
assert(labelsSource.includes("resolveTypeaheadSearchLabels"), "TypeaheadSearch labels must keep resolver")
assert(
  statusSource.includes("AVAILABLE_TYPEAHEAD_SEARCH_STATUSES"),
  "TypeaheadSearch status must expose the status list",
)
assert(
  statusSource.includes('TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY = "minimum-query"'),
  "TypeaheadSearch status must keep minimum-query value",
)
assert(searchIconSource.includes("currentColor"), "TypeaheadSearch default search icon must inherit current color")
assert(
  loadingIndicatorSource.includes('role="status"'),
  "TypeaheadSearch default loading indicator must expose status semantics",
)
assert(
  loadingIndicatorStyles.includes("@keyframes typeahead-search-default-loading-spin"),
  "TypeaheadSearch loading indicator must keep local keyframes",
)

for (const [sourceName, source] of Object.entries({
  typeaheadSearchSource,
  helpersSource,
  labelsSource,
  statusSource,
  searchIconSource,
  loadingIndicatorSource,
})) {
  assert(!forbiddenConsumerImportsPattern.test(source), `${sourceName} must not import consumer-owned source`)
}

for (const [sourceName, source] of Object.entries({ stylesSource, loadingIndicatorStyles })) {
  assert(!forbiddenLegacyCssPattern.test(source), `${sourceName} must not include legacy CSS aliases`)
}

for (const variableName of expectedThemeVariables) {
  assert(themeCSS.includes(variableName), `theme.css must define ${variableName}`)
}

assert(packageJson.peerDependencies.react, "TypeaheadSearch package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "TypeaheadSearch package must keep React DOM peer dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "TypeaheadSearch package must keep React Aria Components peer dependency",
)
assert(packageJson.dependencies.classnames === "^2.3.2", "TypeaheadSearch package must keep classnames")
assert(
  packageJson.scripts.test.includes("verify-typeahead-search-proof.mjs"),
  "package test script must run TypeaheadSearch proof",
)

assert(packet.name === "typeahead-search", "TypeaheadSearch packet must describe the public item")
assert(packet.files.length === requiredPackageFileSources.length, "TypeaheadSearch packet must list the approved files")
for (const requiredSourcePath of requiredPackageFileSources) {
  assert(
    packet.files.some((file) => file.sourcePath === requiredSourcePath),
    `TypeaheadSearch packet must list ${requiredSourcePath}`,
  )
}
for (const requiredTargetPath of requiredTargetPaths) {
  assert(
    packet.files.some((file) => file.targetPath === requiredTargetPath),
    `TypeaheadSearch packet must target ${requiredTargetPath}`,
  )
}
assert(
  packet.files.every((file) => file.role !== "test"),
  "TypeaheadSearch packet must not include Wavemap tests",
)
for (const dependencyName of expectedRegistryDependencies) {
  assert(
    packet.registryDependencies.includes(dependencyName),
    `TypeaheadSearch packet must declare ${dependencyName} registry dependency`,
  )
}
for (const exportName of expectedPublicExports) {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportName),
    `TypeaheadSearch packet must document ${exportName} public export`,
  )
}
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/utils/typeahead/useTypeaheadSearchController.ts"),
  "TypeaheadSearch packet must exclude the consumer-owned controller hook",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/CompactTypeaheadSearch/**"),
  "TypeaheadSearch packet must exclude CompactTypeaheadSearch",
)
assert(
  packet.runtimeDependencies.classnames === "^2.3.2",
  "TypeaheadSearch packet must declare classnames runtime dependency",
)

assert(
  typeaheadSearchIndexSource.includes("export {") && typeaheadSearchIndexSource.includes("default as TypeaheadSearch"),
  "TypeaheadSearch component index must export the component",
)
assert(
  typeaheadSearchIndexSource.includes("TYPEAHEAD_SEARCH_STATUS__RESULTS") &&
    typeaheadSearchIndexSource.includes("resolveTypeaheadSearchLabels"),
  "TypeaheadSearch component index must export labels and status constants",
)
assert(
  publicIndexSource.includes('from "./components/Search/TypeaheadSearch"'),
  "package root index must export TypeaheadSearch",
)
assert(
  packetWrapperSource.includes("typeaheadSearchIngestPacketData") &&
    packetWrapperSource.includes("TRegistryIngestPacket"),
  "TypeaheadSearch packet wrapper must expose typed packet data",
)
assert(
  registryIndexSource.includes('export { typeaheadSearchIngestPacket } from "./typeahead-search-ingest-packet"'),
  "registry index must export TypeaheadSearch packet",
)
assert(manifestSource.includes('name: "typeahead-search"'), "TypeaheadSearch manifest item must be active")
for (const requiredSourcePath of requiredPackageFileSources) {
  assert(
    manifestSource.includes(`sourcePath: "${requiredSourcePath}"`),
    `TypeaheadSearch manifest must list ${requiredSourcePath}`,
  )
}

if (process.exitCode) process.exit(process.exitCode)

console.log("[typeahead-search-proof] verified TypeaheadSearch source receipt packet")
