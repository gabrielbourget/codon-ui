import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const breadcrumbsRoot = path.join(packageRoot, "src/components/Breadcrumbs")
const breadcrumbsSourcePath = path.join(breadcrumbsRoot, "Breadcrumbs.tsx")
const helpersSourcePath = path.join(breadcrumbsRoot, "helpers.ts")
const stylesSourcePath = path.join(breadcrumbsRoot, "BreadcrumbsStyles.module.css")
const defaultIconsSourcePath = path.join(breadcrumbsRoot, "DefaultBreadcrumbIcons.tsx")
const labelsSourcePath = path.join(breadcrumbsRoot, "labels.ts")
const breadcrumbsIndexPath = path.join(breadcrumbsRoot, "index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const packetSourcePath = path.join(packageRoot, "src/registry/breadcrumbs-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/breadcrumbs-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[breadcrumbs-proof] ${message}`)
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
  /@wavemap|i18n|next\/|useRouter|router|route|media|query|api-contract|shared-utils|document|localStorage|@\/src\/|@radix-ui|@internationalized\/date/u
const forbiddenLegacyCssPattern =
  /--distance_|--border_radius_|--shadow_1|--fadeInAnimation|--fadeOutAnimation|--focus-ring-color|--disabledOpacity|theme\/breadcrumbs-compatibility/u
const requiredRuntimeFileSources = [
  "packages/react/src/components/Breadcrumbs/Breadcrumbs.tsx",
  "packages/react/src/components/Breadcrumbs/helpers.ts",
  "packages/react/src/components/Breadcrumbs/BreadcrumbsStyles.module.css",
  "packages/react/src/components/Breadcrumbs/DefaultBreadcrumbIcons.tsx",
  "packages/react/src/components/Breadcrumbs/labels.ts",
]
const requiredTargetPaths = requiredRuntimeFileSources.map((sourcePath) =>
  sourcePath.replace("packages/react/src/components/", ""),
)
const expectedRegistryDependencies = [
  "theme-css",
  "theme/action-colors",
  "tokens/a11y",
  "tokens/geometry",
  "tokens/theme-order",
  "button",
  "click-popover",
  "link",
  "list-box-item",
  "text",
]
const expectedDefaultVariables = [
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-radius-1",
  "--aui-shadow-1",
  "--aui-space-1",
  "--aui-surface",
]
const expectedActionVariables = [
  "--aui-color-primary-500",
  "--aui-color-secondary-500",
  "--aui-color-tertiary-500",
  "--aui-color-quaternary-500",
  "--aui-color-quintenary-500",
]

const breadcrumbsSource = readRequiredText(breadcrumbsSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const defaultIconsSource = readRequiredText(defaultIconsSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const breadcrumbsIndexSource = readRequiredText(breadcrumbsIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const actionColorsCSS = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(breadcrumbsSource.startsWith('"use client"'), "Breadcrumbs must preserve the client component boundary")
assert(!breadcrumbsSource.includes("next/navigation"), "Breadcrumbs must not import Next navigation")
assert(!breadcrumbsSource.includes("useRouter"), "Breadcrumbs must not own router behavior")
assert(breadcrumbsSource.includes('from "../../tokens/geometry"'), "Breadcrumbs must use package-local geometry tokens")
assert(breadcrumbsSource.includes('from "../Button/Button"'), "Breadcrumbs must compose Button")
assert(breadcrumbsSource.includes('from "../ClickPopover/ClickPopover"'), "Breadcrumbs must compose ClickPopover")
assert(breadcrumbsSource.includes('from "../Link/Link"'), "Breadcrumbs must compose Link")
assert(breadcrumbsSource.includes('from "../ListBoxItem/ListBoxItem"'), "Breadcrumbs must compose ListBoxItem")
assert(breadcrumbsSource.includes('from "../Text/Text"'), "Breadcrumbs must compose Text")
assert(breadcrumbsSource.includes('from "react-aria-components"'), "Breadcrumbs must keep React Aria composition")
assert(breadcrumbsSource.includes("flushSync"), "Breadcrumbs must close the overflow popover before navigation")
assert(breadcrumbsSource.includes("onNavigate"), "Breadcrumbs must preserve consumer-owned navigation callback")
assert(breadcrumbsSource.includes("window.open"), "Breadcrumbs must preserve browser-native overflow fallback")
assert(helpersSource.includes('from "../../tokens/a11y"'), "Breadcrumbs must import package-local a11y support")
assert(helpersSource.includes('from "../../tokens/geometry"'), "Breadcrumbs must import package-local geometry support")
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Breadcrumbs must import package-local theme-order support",
)
assert(helpersSource.includes("type TIntRange"), "Breadcrumbs must keep range typing local")
assert(helpersSource.includes('from "../ClickPopover/helpers"'), "Breadcrumbs props must type ClickPopover slot props")
assert(helpersSource.includes('from "../Link/helpers"'), "Breadcrumbs props must type Link slot props")
assert(helpersSource.includes("export type TBreadcrumbsProps"), "Breadcrumbs helpers must export local props")
assert(
  helpersSource.includes("export type TBreadcrumbNavigateDetails"),
  "Breadcrumbs helpers must export navigate details",
)
assert(helpersSource.includes("onNavigate?:"), "Breadcrumbs props must expose onNavigate")
assert(labelsSource.includes("DEFAULT_BREADCRUMBS_LABELS"), "Breadcrumbs labels must preserve default labels")
assert(defaultIconsSource.includes("BreadcrumbDefaultChevronRightIcon"), "Breadcrumbs must preserve chevron icon")
assert(defaultIconsSource.includes("BreadcrumbDefaultOverflowIcon"), "Breadcrumbs must preserve overflow icon")
;[breadcrumbsSource, helpersSource, defaultIconsSource, labelsSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "Breadcrumbs runtime source must not import consumer-only modules",
  )
})

assert(!forbiddenLegacyCssPattern.test(stylesSource), "Breadcrumbs CSS must not read legacy Wavemap aliases")
assert(!stylesSource.includes("theme/breadcrumbs-compatibility"), "Breadcrumbs must not need a bridge item")
;[".breadcrumbs", ".breadcrumb", ".popover", ".breadcrumbsList"].forEach((selector) => {
  assert(stylesSource.includes(selector), `Breadcrumbs CSS module must include ${selector}`)
})
expectedDefaultVariables.forEach((cssVariable) => {
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
  assert(stylesSource.includes(`var(${cssVariable})`), `Breadcrumbs CSS must read ${cssVariable}`)
})
expectedActionVariables.forEach((cssVariable) => {
  assert(actionColorsCSS.includes(`${cssVariable}:`), `action-colors.css must declare ${cssVariable}`)
  assert(helpersSource.includes(cssVariable), `Breadcrumbs helpers must read ${cssVariable}`)
})

assert(
  publicIndexSource.includes('export { Breadcrumbs } from "./components/Breadcrumbs"'),
  "Package index must export Breadcrumbs",
)
assert(publicIndexSource.includes("BreadcrumbsProps"), "Package index must export BreadcrumbsProps")
assert(publicIndexSource.includes("BreadcrumbNavigateDetails"), "Package index must export BreadcrumbNavigateDetails")
assert(!publicIndexSource.includes("TBreadcrumbsProps"), "Package index must not export Breadcrumbs internals directly")
assert(
  breadcrumbsIndexSource.includes('export { default as Breadcrumbs } from "./Breadcrumbs"'),
  "Breadcrumbs index must export component",
)
assert(
  breadcrumbsIndexSource.includes("TBreadcrumbsProps as BreadcrumbsProps"),
  "Breadcrumbs index must export props type alias",
)
assert(
  breadcrumbsIndexSource.includes("TBreadcrumbNavigateDetails as BreadcrumbNavigateDetails"),
  "Breadcrumbs index must export navigate details alias",
)

assert(packageJson.dependencies.classnames, "Breadcrumbs package must keep classnames runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Breadcrumbs React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "Breadcrumbs package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Breadcrumbs package must keep React DOM peer dependency")
assert(!packageJson.peerDependencies.next, "Breadcrumbs package must not declare a Next peer dependency")
assert(
  packageJson.scripts.test.includes("verify-breadcrumbs-proof.mjs"),
  "Package test script must run Breadcrumbs proof",
)

assert(packet.name === "breadcrumbs", "Breadcrumbs packet must describe the breadcrumbs item")
assert(packet.type === "component", "Breadcrumbs packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Breadcrumbs packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Breadcrumbs packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#breadcrumbs-next-candidate-planning-checkpoint"),
  "Breadcrumbs packet must point at the Wavemap planning checkpoint",
)
requiredRuntimeFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Breadcrumbs packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Breadcrumbs packet must target ${targetPath}`,
  )
})
assert(
  packet.files.every((file) => file.role !== "test"),
  "Breadcrumbs packet must not receive focused tests as source",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Breadcrumbs/i18n.ts"),
  "Breadcrumbs packet must exclude Wavemap i18n wiring",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Breadcrumbs/__tests__/Breadcrumbs.test.tsx",
  ),
  "Breadcrumbs packet must exclude focused tests",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/app/[locale]/component-showcase/page.tsx"),
  "Breadcrumbs packet must exclude component showcase source",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Breadcrumbs" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Breadcrumbs/Breadcrumbs.tsx",
  ),
  "Breadcrumbs packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "BreadcrumbsProps" &&
      publicExport.localName === "TBreadcrumbsProps" &&
      publicExport.sourcePath === "packages/react/src/components/Breadcrumbs/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Breadcrumbs packet must define the public props type alias intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "BreadcrumbNavigateDetails" &&
      publicExport.localName === "TBreadcrumbNavigateDetails" &&
      publicExport.typeOnly === true,
  ),
  "Breadcrumbs packet must define the public navigate details alias intent",
)
expectedRegistryDependencies.forEach((registryDependency) => {
  assert(
    packet.registryDependencies.includes(registryDependency),
    `Breadcrumbs packet must depend on ${registryDependency}`,
  )
})
assert(
  !packet.registryDependencies.includes("theme/breadcrumbs-compatibility"),
  "Breadcrumbs must not need a bridge item",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Breadcrumbs packet must declare React Aria")
assert(packet.peerDependencies.react, "Breadcrumbs packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "Breadcrumbs packet must declare React DOM peer dependency")
assert(!packet.peerDependencies.next, "Breadcrumbs packet must not declare Next peer dependency")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "Breadcrumbs packet must declare classnames")
assert(
  packet.themeRequirements.some((requirement) =>
    expectedDefaultVariables.every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
  ),
  "Breadcrumbs packet must record default theme variables",
)
assert(
  packet.themeRequirements.some((requirement) =>
    expectedActionVariables.every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
  ),
  "Breadcrumbs packet must record action-color variables",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/geometry" &&
      resolution.replacementSource === "../../tokens/geometry",
  ),
  "Breadcrumbs packet must record geometry import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--distance_1") && resolution.replacementSource.includes("--aui-space-1"),
  ),
  "Breadcrumbs packet must record spacing alias rewrite",
)
assert(
  packet.notes.some((note) => note.includes("onNavigate")),
  "Breadcrumbs packet must record consumer-owned navigation",
)

assert(
  packetWrapperSource.includes("breadcrumbsIngestPacketData") && packetWrapperSource.includes("TRegistryIngestPacket"),
  "Breadcrumbs packet wrapper must type the JSON packet",
)
assert(
  registryIndexSource.includes('export { breadcrumbsIngestPacket } from "./breadcrumbs-ingest-packet"'),
  "Registry index must export Breadcrumbs ingest packet",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[breadcrumbs-proof] Source receipt checks passed.")
