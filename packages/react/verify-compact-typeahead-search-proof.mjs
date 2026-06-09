import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const compactTypeaheadSearchRoot = path.join(packageRoot, "src/components/CompactTypeaheadSearch")
const compactTypeaheadSearchSourcePath = path.join(compactTypeaheadSearchRoot, "CompactTypeaheadSearch.tsx")
const helpersSourcePath = path.join(compactTypeaheadSearchRoot, "helpers.ts")
const labelsSourcePath = path.join(compactTypeaheadSearchRoot, "labels.ts")
const searchIconSourcePath = path.join(compactTypeaheadSearchRoot, "DefaultSearchIcon.tsx")
const loadingIndicatorSourcePath = path.join(compactTypeaheadSearchRoot, "DefaultLoadingIndicator.tsx")
const loadingIndicatorStylesPath = path.join(compactTypeaheadSearchRoot, "DefaultLoadingIndicator.module.css")
const stylesSourcePath = path.join(compactTypeaheadSearchRoot, "CompactTypeaheadSearchStyles.module.css")
const compactTypeaheadSearchIndexPath = path.join(compactTypeaheadSearchRoot, "index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/compact-typeahead-search-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/compact-typeahead-search-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const manifestPath = path.join(packageRoot, "src/registry/manifest.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[compact-typeahead-search-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|api-contract|shared-utils|localStorage|@\/src\//u
const forbiddenLegacyCssPattern =
  /--distance_|--disabledOpacity|--border_radius_|--borderColorTransition|--focus-ring-color|--fadeInAnimation|--fadeOutAnimation|theme\/compact-typeahead-search-compatibility/u

const compactTypeaheadSearchSource = readRequiredText(compactTypeaheadSearchSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const searchIconSource = readRequiredText(searchIconSourcePath)
const loadingIndicatorSource = readRequiredText(loadingIndicatorSourcePath)
const loadingIndicatorStyles = readRequiredText(loadingIndicatorStylesPath)
const stylesSource = readRequiredText(stylesSourcePath)
const compactTypeaheadSearchIndexSource = readRequiredText(compactTypeaheadSearchIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const manifestSource = readRequiredText(manifestPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/CompactTypeaheadSearch/CompactTypeaheadSearch.tsx",
  "packages/react/src/components/CompactTypeaheadSearch/helpers.ts",
  "packages/react/src/components/CompactTypeaheadSearch/labels.ts",
  "packages/react/src/components/CompactTypeaheadSearch/DefaultSearchIcon.tsx",
  "packages/react/src/components/CompactTypeaheadSearch/DefaultLoadingIndicator.tsx",
  "packages/react/src/components/CompactTypeaheadSearch/DefaultLoadingIndicator.module.css",
  "packages/react/src/components/CompactTypeaheadSearch/CompactTypeaheadSearchStyles.module.css",
]
const requiredTargetPaths = [
  "CompactTypeaheadSearch/CompactTypeaheadSearch.tsx",
  "CompactTypeaheadSearch/helpers.ts",
  "CompactTypeaheadSearch/labels.ts",
  "CompactTypeaheadSearch/DefaultSearchIcon.tsx",
  "CompactTypeaheadSearch/DefaultLoadingIndicator.tsx",
  "CompactTypeaheadSearch/DefaultLoadingIndicator.module.css",
  "CompactTypeaheadSearch/CompactTypeaheadSearchStyles.module.css",
]
const expectedRegistryDependencies = [
  "theme-css",
  "tokens/geometry",
  "tokens/placement",
  "input",
  "button",
  "list-box-item",
  "placeholder-text",
]
const expectedPublicExports = [
  "CompactTypeaheadSearch",
  "CompactTypeaheadSearchProps",
  "CompactTypeaheadSearchRenderItemArgs",
  "AvailableCompactTypeaheadSearchSizes",
  "AVAILABLE_TYPE_AHEAD_SEARCH_SIZES",
  "TYPE_AHEAD_SEARCH_SIZE__SM",
  "TYPE_AHEAD_SEARCH_SIZE__MD",
  "TYPE_AHEAD_SEARCH_SIZE__LG",
  "CompactTypeaheadSearchLabels",
  "PartialCompactTypeaheadSearchLabels",
  "CompactTypeaheadSearchStatusLabels",
  "PartialCompactTypeaheadSearchStatusLabels",
  "DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS",
  "resolveCompactTypeaheadSearchLabels",
]
const expectedThemeVariables = [
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-control-background",
  "--aui-control-border",
  "--aui-control-foreground",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-radius-1",
  "--aui-shadow-1",
  "--aui-space-1",
  "--aui-space-2",
  "--aui-surface",
  "--aui-transition-border-color",
  "--aui-validation-error-border",
  "--aui-validation-success-border",
  "--aui-validation-warning-border",
]

assert(
  compactTypeaheadSearchSource.startsWith('"use client"'),
  "CompactTypeaheadSearch must preserve the client boundary",
)
assert(
  compactTypeaheadSearchSource.includes('import Button from "../Button/Button"'),
  "CompactTypeaheadSearch must import package-local Button",
)
assert(
  compactTypeaheadSearchSource.includes('import Input from "../Input/Input"'),
  "CompactTypeaheadSearch must import package-local Input",
)
assert(
  compactTypeaheadSearchSource.includes('import ListBoxItem from "../ListBoxItem/ListBoxItem"'),
  "CompactTypeaheadSearch must import package-local ListBoxItem",
)
assert(
  compactTypeaheadSearchSource.includes(
    'import PlaceholderText from "../Text/variants/PlaceholderText/PlaceholderText"',
  ),
  "CompactTypeaheadSearch must import package-local PlaceholderText",
)
assert(
  compactTypeaheadSearchSource.includes('from "../../tokens/placement"'),
  "CompactTypeaheadSearch must import package-local placement tokens",
)
assert(
  compactTypeaheadSearchSource.includes("AdobeComboBox") &&
    compactTypeaheadSearchSource.includes("Group") &&
    compactTypeaheadSearchSource.includes("ListBox") &&
    compactTypeaheadSearchSource.includes("Popover"),
  "CompactTypeaheadSearch must use React Aria combobox/listbox primitives",
)
assert(
  compactTypeaheadSearchSource.includes("forwardedRef: ForwardedRef<HTMLDivElement>"),
  "CompactTypeaheadSearch must forward a div ref",
)
assert(
  compactTypeaheadSearchSource.includes("inputValue !== undefined ? inputValue : state.internalInputValue"),
  "CompactTypeaheadSearch must preserve controlled and uncontrolled input support",
)
assert(
  compactTypeaheadSearchSource.includes("minimumInputLength") && compactTypeaheadSearchSource.includes("isLoading"),
  "CompactTypeaheadSearch must preserve minimum-query and loading states",
)
assert(
  compactTypeaheadSearchSource.includes("onChange?.(key)"),
  "CompactTypeaheadSearch must preserve selection callbacks",
)
assert(
  compactTypeaheadSearchSource.includes('data-testid={dataTestID ?? "type-ahead-search"}'),
  "CompactTypeaheadSearch must preserve test id fallback",
)

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "CompactTypeaheadSearch helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/placement"'),
  "CompactTypeaheadSearch helpers must import package-local placement tokens",
)
assert(
  helpersSource.includes("export type TCompactTypeaheadSearchProps"),
  "CompactTypeaheadSearch helpers must export props",
)
assert(
  helpersSource.includes("export const calibrateComponent"),
  "CompactTypeaheadSearch calibration helper must remain local",
)
assert(
  helpersSource.includes("CompactTypeaheadSearchDefaultSearchIcon"),
  "CompactTypeaheadSearch helpers must preserve default search icon",
)
assert(
  helpersSource.includes("CompactTypeaheadSearchDefaultLoadingIndicator"),
  "CompactTypeaheadSearch helpers must preserve default loading indicator",
)
assert(
  labelsSource.includes("DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS"),
  "CompactTypeaheadSearch labels must keep defaults",
)
assert(labelsSource.includes("resolveCompactTypeaheadSearchLabels"), "CompactTypeaheadSearch labels must keep resolver")
assert(
  searchIconSource.includes("currentColor"),
  "CompactTypeaheadSearch default search icon must inherit current color",
)
assert(
  loadingIndicatorSource.includes('role="status"'),
  "CompactTypeaheadSearch default loading indicator must expose status semantics",
)
assert(
  loadingIndicatorStyles.includes("@keyframes compact-typeahead-search-default-loading-spin"),
  "CompactTypeaheadSearch loading indicator must keep local keyframes",
)

for (const [sourceName, source] of Object.entries({
  compactTypeaheadSearchSource,
  helpersSource,
  labelsSource,
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

assert(packageJson.peerDependencies.react, "CompactTypeaheadSearch package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "CompactTypeaheadSearch package must keep React DOM peer dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "CompactTypeaheadSearch package must keep React Aria Components peer dependency",
)
assert(packageJson.dependencies.classnames === "^2.3.2", "CompactTypeaheadSearch package must keep classnames")
assert(
  packageJson.scripts.test.includes("verify-compact-typeahead-search-proof.mjs"),
  "package test script must run CompactTypeaheadSearch proof",
)

assert(packet.name === "compact-typeahead-search", "CompactTypeaheadSearch packet must describe the public item")
assert(
  packet.files.length === requiredPackageFileSources.length,
  "CompactTypeaheadSearch packet must list the approved files",
)
for (const requiredSourcePath of requiredPackageFileSources) {
  assert(
    packet.files.some((file) => file.sourcePath === requiredSourcePath),
    `CompactTypeaheadSearch packet must list ${requiredSourcePath}`,
  )
}
for (const requiredTargetPath of requiredTargetPaths) {
  assert(
    packet.files.some((file) => file.targetPath === requiredTargetPath),
    `CompactTypeaheadSearch packet must target ${requiredTargetPath}`,
  )
}
assert(
  packet.files.every((file) => file.role !== "test"),
  "CompactTypeaheadSearch packet must not include Wavemap tests",
)
for (const dependencyName of expectedRegistryDependencies) {
  assert(
    packet.registryDependencies.includes(dependencyName),
    `CompactTypeaheadSearch packet must declare ${dependencyName} registry dependency`,
  )
}
for (const exportName of expectedPublicExports) {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportName),
    `CompactTypeaheadSearch packet must document ${exportName} public export`,
  )
}
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Forms/AddOrEditArtistForm/Components/ArtistEventTypeAhead/**",
  ),
  "CompactTypeaheadSearch packet must exclude the app-owned artist event wrapper",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/utils/typeahead/useTypeaheadSearchController.ts"),
  "CompactTypeaheadSearch packet must exclude the consumer-owned controller hook",
)
assert(
  packet.runtimeDependencies.classnames === "^2.3.2",
  "CompactTypeaheadSearch packet must declare classnames runtime dependency",
)

assert(
  compactTypeaheadSearchIndexSource.includes("export {") &&
    compactTypeaheadSearchIndexSource.includes("default as CompactTypeaheadSearch"),
  "CompactTypeaheadSearch component index must export the component",
)
assert(
  compactTypeaheadSearchIndexSource.includes("DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS") &&
    compactTypeaheadSearchIndexSource.includes("resolveCompactTypeaheadSearchLabels"),
  "CompactTypeaheadSearch component index must export label defaults and resolver",
)
assert(
  publicIndexSource.includes('from "./components/CompactTypeaheadSearch"'),
  "package root index must export CompactTypeaheadSearch",
)
assert(
  packetWrapperSource.includes("compactTypeaheadSearchIngestPacketData") &&
    packetWrapperSource.includes("TRegistryIngestPacket"),
  "CompactTypeaheadSearch packet wrapper must expose typed packet data",
)
assert(
  registryIndexSource.includes(
    'export { compactTypeaheadSearchIngestPacket } from "./compact-typeahead-search-ingest-packet"',
  ),
  "registry index must export CompactTypeaheadSearch packet",
)
assert(
  manifestSource.includes('name: "compact-typeahead-search"'),
  "CompactTypeaheadSearch manifest item must be active",
)
for (const requiredSourcePath of requiredPackageFileSources) {
  assert(
    manifestSource.includes(`sourcePath: "${requiredSourcePath}"`),
    `CompactTypeaheadSearch manifest must list ${requiredSourcePath}`,
  )
}

if (process.exitCode) process.exit(process.exitCode)

console.log("[compact-typeahead-search-proof] verified CompactTypeaheadSearch source receipt packet")
