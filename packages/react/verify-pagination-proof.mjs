import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const paginationRoot = path.join(packageRoot, "src/components/Pagination")
const paginationSourcePath = path.join(paginationRoot, "Pagination.tsx")
const helpersSourcePath = path.join(paginationRoot, "helpers.tsx")
const primaryControlsSourcePath = path.join(
  paginationRoot,
  "components/PrimaryPaginationControls/PrimaryPaginationControls.tsx",
)
const primaryControlsHelpersPath = path.join(paginationRoot, "components/PrimaryPaginationControls/helpers.tsx")
const primaryControlsStylesPath = path.join(
  paginationRoot,
  "components/PrimaryPaginationControls/PrimaryPaginationControlsStyles.module.css",
)
const paginationStylesPath = path.join(paginationRoot, "PaginationStyles.module.css")
const pageInputSourcePath = path.join(paginationRoot, "components/PageInput/PageInput.tsx")
const itemsPerPageSourcePath = path.join(paginationRoot, "components/ItemsPerPage/ItemsPerPage.tsx")
const pageCounterSourcePath = path.join(paginationRoot, "components/PageCounter/PageCounter.tsx")
const pageInputStylesPath = path.join(paginationRoot, "components/PageInput/PageInputStyles.module.css")
const paginationIndexPath = path.join(paginationRoot, "index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const packetSourcePath = path.join(packageRoot, "src/registry/pagination-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/pagination-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[pagination-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\/|@radix-ui|@internationalized\/date/u
const forbiddenLegacyCssPattern =
  /--distance_|--border_radius_|--shadow_1|--fadeInAnimation|--fadeOutAnimation|--focus-ring-color/u
const requiredRuntimeFileSources = [
  "packages/react/src/components/Pagination/Pagination.tsx",
  "packages/react/src/components/Pagination/helpers.tsx",
  "packages/react/src/components/Pagination/PaginationStyles.module.css",
  "packages/react/src/components/Pagination/components/PrimaryPaginationControls/PrimaryPaginationControls.tsx",
  "packages/react/src/components/Pagination/components/PrimaryPaginationControls/helpers.tsx",
  "packages/react/src/components/Pagination/components/PrimaryPaginationControls/DefaultPaginationIcons.tsx",
  "packages/react/src/components/Pagination/components/PrimaryPaginationControls/PrimaryPaginationControlsStyles.module.css",
  "packages/react/src/components/Pagination/components/PageCounter/PageCounter.tsx",
  "packages/react/src/components/Pagination/components/PageCounter/PageCounterStyles.module.css",
  "packages/react/src/components/Pagination/components/PageInput/PageInput.tsx",
  "packages/react/src/components/Pagination/components/PageInput/PageInputStyles.module.css",
  "packages/react/src/components/Pagination/components/ItemsPerPage/ItemsPerPage.tsx",
]
const requiredTargetPaths = requiredRuntimeFileSources.map((sourcePath) =>
  sourcePath.replace("packages/react/src/components/", ""),
)
const expectedRegistryDependencies = [
  "theme-css",
  "theme/action-colors",
  "tokens/geometry",
  "tokens/theme-order",
  "button",
  "click-popover",
  "counter",
  "form-field",
  "line-segment",
  "list-box-item",
  "number-input",
  "select",
  "text",
]
const expectedDefaultVariables = [
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-border",
  "--aui-control-foreground",
  "--aui-control-selected-foreground",
  "--aui-focus-ring",
  "--aui-radius-1",
  "--aui-shadow-1",
  "--aui-space-1",
  "--aui-space-2",
  "--aui-surface",
]
const expectedActionVariables = [
  "--aui-color-primary-500",
  "--aui-color-secondary-500",
  "--aui-color-tertiary-500",
  "--aui-color-quaternary-500",
  "--aui-color-quintenary-500",
]

const paginationSource = readRequiredText(paginationSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const primaryControlsSource = readRequiredText(primaryControlsSourcePath)
const primaryControlsHelpers = readRequiredText(primaryControlsHelpersPath)
const pageInputSource = readRequiredText(pageInputSourcePath)
const itemsPerPageSource = readRequiredText(itemsPerPageSourcePath)
const pageCounterSource = readRequiredText(pageCounterSourcePath)
const cssSources = [
  readRequiredText(paginationStylesPath),
  readRequiredText(primaryControlsStylesPath),
  readRequiredText(pageInputStylesPath),
]
const paginationIndexSource = readRequiredText(paginationIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const actionColorsCSS = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(paginationSource.startsWith('"use client"'), "Pagination must preserve the client component boundary")
assert(paginationSource.includes('from "../../tokens/geometry"'), "Pagination must use package-local geometry tokens")
assert(paginationSource.includes('from "../LineSegment/LineSegment"'), "Pagination must compose package LineSegment")
assert(paginationSource.includes("<PageCounter"), "Pagination must preserve PageCounter composition")
assert(paginationSource.includes("<PageInput"), "Pagination must preserve PageInput composition")
assert(paginationSource.includes("<ItemsPerPage"), "Pagination must preserve ItemsPerPage composition")
assert(paginationSource.includes("<PrimaryPaginationControls"), "Pagination must preserve primary controls composition")
assert(helpersSource.includes("buildItemsPerPageOptions"), "Pagination must localize the item-option mapper")
assert(!helpersSource.includes("listItemsGen"), "Pagination must not import the Wavemap app utility mapper")
assert(helpersSource.includes("type TIntRange"), "Pagination must keep range typing local")
assert(helpersSource.includes("type TAriaLabelingProps"), "Pagination must keep aria-labeling typing local")
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Pagination must import package-local theme-order support",
)
assert(helpersSource.includes('from "../Button/helpers"'), "Pagination props must type installed Button props")
assert(
  helpersSource.includes('from "../NumberInput/labels"'),
  "Pagination labels must reuse installed NumberInput labels",
)
assert(
  primaryControlsSource.includes('from "react-aria-components"'),
  "Primary controls must keep React Aria composition",
)
assert(primaryControlsSource.includes("<DialogTrigger"), "Primary controls must preserve overflow popover trigger")
assert(primaryControlsSource.includes("<ListBox"), "Primary controls must preserve overflow ListBox")
assert(
  primaryControlsSource.includes('from "../../../ClickPopover/ClickPopover"'),
  "Primary controls must compose ClickPopover",
)
assert(
  primaryControlsSource.includes('from "../../../ListBoxItem/ListBoxItem"'),
  "Primary controls must compose ListBoxItem",
)
assert(primaryControlsHelpers.includes("PaginationDefaultOverflowIcon"), "Primary controls must preserve default icons")
assert(pageInputSource.includes('from "../../../FormField/FormField"'), "PageInput must compose FormField")
assert(pageInputSource.includes('from "../../../NumberInput/NumberInput"'), "PageInput must compose NumberInput")
assert(itemsPerPageSource.includes('from "../../../Select/Select"'), "ItemsPerPage must compose Select")
assert(itemsPerPageSource.includes('from "../../../ListBoxItem/ListBoxItem"'), "ItemsPerPage must compose ListBoxItem")
assert(pageCounterSource.includes('from "../../../Counter/Counter"'), "PageCounter must compose Counter")
;[
  paginationSource,
  helpersSource,
  primaryControlsSource,
  primaryControlsHelpers,
  pageInputSource,
  itemsPerPageSource,
  pageCounterSource,
].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "Pagination runtime source must not import consumer-only modules",
  )
})

cssSources.forEach((source) => {
  assert(!forbiddenLegacyCssPattern.test(source), "Pagination CSS must not read legacy Wavemap aliases")
  assert(!source.includes("theme/pagination-compatibility"), "Pagination must not need a bridge item")
})
expectedDefaultVariables.forEach((cssVariable) => {
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
})
expectedActionVariables.forEach((cssVariable) => {
  assert(actionColorsCSS.includes(`${cssVariable}:`), `action-colors.css must declare ${cssVariable}`)
})
assert(
  cssSources.some((source) => source.includes("var(--aui-space-2)")),
  "Pagination CSS must use space-2",
)
assert(
  cssSources.some((source) => source.includes("var(--aui-animation-fade-in)")),
  "Pagination CSS must use fade-in",
)
assert(
  cssSources.some((source) => source.includes("var(--aui-focus-ring)")),
  "Pagination CSS must use focus-ring",
)

assert(
  publicIndexSource.includes('export { Pagination } from "./components/Pagination"'),
  "Package index must export Pagination",
)
assert(
  publicIndexSource.includes('export type { PaginationProps } from "./components/Pagination"'),
  "Package index must export Pagination public type",
)
assert(
  !publicIndexSource.includes("computeInternalPaginationItems"),
  "Package index must not export Pagination internals",
)
assert(
  paginationIndexSource.includes('export { default as Pagination } from "./Pagination"'),
  "Pagination index must export component",
)
assert(paginationIndexSource.includes("TPaginationProps as PaginationProps"), "Pagination index must export props type")

assert(packageJson.dependencies.classnames, "Pagination package must keep classnames runtime dependency")
assert(packageJson.dependencies.motion, "Pagination package must keep motion runtime dependency through Select")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Pagination React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "Pagination package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Pagination package must keep React DOM peer dependency")
assert(
  packageJson.scripts.test.includes("verify-pagination-proof.mjs"),
  "Package test script must run Pagination proof",
)

assert(packet.name === "pagination", "Pagination packet must describe the pagination item")
assert(packet.type === "component", "Pagination packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Pagination packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Pagination packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#pagination-next-candidate-planning-checkpoint"),
  "Pagination packet must point at the Wavemap planning checkpoint",
)
requiredRuntimeFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Pagination packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Pagination packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Pagination packet test files must remain optional source evidence",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Pagination/i18n.ts"),
  "Pagination packet must exclude Wavemap i18n wiring",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/utils/data.ts"),
  "Pagination packet must exclude Wavemap utility modules",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Pagination" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Pagination/Pagination.tsx",
  ),
  "Pagination packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "PaginationProps" &&
      publicExport.localName === "TPaginationProps" &&
      publicExport.sourcePath === "packages/react/src/components/Pagination/helpers.tsx" &&
      publicExport.typeOnly === true,
  ),
  "Pagination packet must define the public props type alias intent",
)
expectedRegistryDependencies.forEach((registryDependency) => {
  assert(
    packet.registryDependencies.includes(registryDependency),
    `Pagination packet must depend on ${registryDependency}`,
  )
})
assert(
  !packet.registryDependencies.includes("theme/pagination-compatibility"),
  "Pagination must not need a bridge item",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Pagination packet must declare React Aria")
assert(packet.peerDependencies.react, "Pagination packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "Pagination packet must declare React DOM peer dependency")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "Pagination packet must declare classnames")
assert(packet.runtimeDependencies.motion === "^12.40.0", "Pagination packet must declare motion through Select")
assert(
  packet.themeRequirements.some((requirement) =>
    ["--aui-space-1", "--aui-space-2", "--aui-focus-ring", "--aui-shadow-1", "--aui-border"].every((cssVariable) =>
      requirement.cssVariables.includes(cssVariable),
    ),
  ),
  "Pagination packet must record default theme variables",
)
assert(
  packet.themeRequirements.some((requirement) => requirement.cssVariables.includes("--aui-color-quintenary-500")),
  "Pagination packet must record action color variables",
)
assert(
  packet.importResolutions.some((resolution) => resolution.replacementSource.includes("buildItemsPerPageOptions")),
  "Pagination packet must record the local item mapper replacement",
)

assert(
  packetWrapperSource.includes("paginationIngestPacketData") && packetWrapperSource.includes("TRegistryIngestPacket"),
  "Pagination packet wrapper must type the JSON packet",
)
assert(
  registryIndexSource.includes('export { paginationIngestPacket } from "./pagination-ingest-packet"'),
  "Registry index must export Pagination ingest packet",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[pagination-proof] Source receipt checks passed.")
