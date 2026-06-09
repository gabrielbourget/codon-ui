import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const tooltipSourcePath = path.join(packageRoot, "src/components/Tooltip/Tooltip.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Tooltip/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Tooltip/TooltipStyles.module.css")
const tooltipIndexPath = path.join(packageRoot, "src/components/Tooltip/index.ts")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/tooltip-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/tooltip-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[tooltip-proof] ${message}`)
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
  /--distance_|--border_radius_|--fadeInAnimation|--fadeOutAnimation|--drop_shadow_1|theme\/tooltip-compatibility/u

const tooltipSource = readRequiredText(tooltipSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const tooltipIndexSource = readRequiredText(tooltipIndexPath)
const actionColorsSource = readRequiredText(actionColorsPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Tooltip/Tooltip.tsx",
  "packages/react/src/components/Tooltip/helpers.ts",
  "packages/react/src/components/Tooltip/TooltipStyles.module.css",
  "packages/react/src/components/Tooltip/__tests__/Tooltip.test.tsx",
]
const requiredTargetPaths = [
  "Tooltip/Tooltip.tsx",
  "Tooltip/helpers.ts",
  "Tooltip/TooltipStyles.module.css",
  "Tooltip/__tests__/Tooltip.test.tsx",
]
const requiredStyleSelectors = [
  ".tooltip",
  ".tooltip--raised",
  ".tooltip--rounded",
  ".tooltip--primary",
  ".tooltip--quintenary",
  ".tooltip__overlayArrow svg",
  ".tooltip__overlayArrow--primary svg",
  ".tooltip__overlayArrow--quintenary svg",
  '.tooltip[data-placement="top"]',
  '.tooltip[data-placement="left"]',
]
const requiredActionColorVariables = [
  "--aui-color-primary-500",
  "--aui-color-secondary-500",
  "--aui-color-tertiary-500",
  "--aui-color-quaternary-500",
  "--aui-color-quintenary-500",
]
const requiredDefaultThemeVariables = [
  "--aui-surface",
  "--aui-surface-foreground",
  "--aui-space-1",
  "--aui-space-2",
  "--aui-radius-1",
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-drop-shadow-1",
]

assert(tooltipSource.startsWith('"use client"'), "Tooltip must preserve the client component boundary")
assert(tooltipSource.includes('from "react-aria-components"'), "Tooltip must import React Aria")
assert(tooltipSource.includes("OverlayArrow"), "Tooltip must preserve overlay-arrow rendering")
assert(tooltipSource.includes("forwardRef<HTMLDivElement"), "Tooltip must forward a div ref")
assert(tooltipSource.includes('data-testid={dataTestID ?? "tooltip"}'), "Tooltip root test id fallback must stay")
assert(tooltipSource.includes('Tooltip.displayName = "Tooltip"'), "Tooltip display name must be set")
assert(tooltipSource.includes("showOverlayArrow ?"), "Tooltip must preserve the showOverlayArrow branch")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Tooltip helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Tooltip helpers must import package-local theme-order tokens",
)
assert(helpersSource.includes("export type TTooltipProps"), "Tooltip helpers must export local props")
assert(helpersSource.includes("export const calibrateComponent"), "Tooltip calibration helper must remain local")
;[tooltipSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Tooltip runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Tooltip CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `Tooltip CSS must read ${cssVariable}`)
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})
requiredActionColorVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `Tooltip CSS must read ${cssVariable}`)
  assert(actionColorsSource.includes(cssVariable), `action-colors CSS must define ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Tooltip CSS must not read legacy Wavemap aliases")

assert(
  publicIndexSource.includes('export { Tooltip } from "./components/Tooltip"'),
  "Package index must export Tooltip",
)
assert(
  publicIndexSource.includes('export type { TooltipProps } from "./components/Tooltip"'),
  "Package index must export TooltipProps",
)
assert(!publicIndexSource.includes("TTooltipProps"), "Package index must not export Tooltip internals directly")
assert(
  tooltipIndexSource.includes('export { default as Tooltip } from "./Tooltip"'),
  "Tooltip index must export component",
)
assert(tooltipIndexSource.includes("TTooltipProps as TooltipProps"), "Tooltip index must export props alias")
assert(!tooltipIndexSource.includes("calibrateComponent"), "Tooltip index must not export internals")

assert(packageJson.dependencies.classnames, "Tooltip package must keep classnames runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Tooltip React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "Tooltip package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Tooltip package must keep React DOM peer dependency")

assert(packet.name === "tooltip", "Tooltip packet must describe the tooltip item")
assert(packet.type === "component", "Tooltip packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Tooltip packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Tooltip packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#tooltip-next-candidate-planning-checkpoint"),
  "Tooltip packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Tooltip packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Tooltip packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Tooltip packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Tooltip" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Tooltip/Tooltip.tsx",
  ),
  "Tooltip packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TooltipProps" &&
      publicExport.localName === "TTooltipProps" &&
      publicExport.sourcePath === "packages/react/src/components/Tooltip/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Tooltip packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Tooltip packet must depend on default theme")
assert(packet.registryDependencies.includes("theme/action-colors"), "Tooltip packet must depend on action colors")
assert(packet.registryDependencies.includes("tokens/geometry"), "Tooltip packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Tooltip packet must depend on theme-order tokens")
assert(!packet.registryDependencies.includes("theme/tooltip-compatibility"), "Tooltip must not need a bridge item")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Tooltip packet must declare React Aria peer")
assert(packet.runtimeDependencies.classnames, "Tooltip packet must declare classnames runtime dependency")
assert(!packet.runtimeDependencies.motion, "Tooltip packet must not declare Motion")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "Tooltip packet must record default-contract theme pressure")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Tooltip packet must record ${cssVariable}`)
})
const actionColorsRequirement = packet.themeRequirements.find((requirement) =>
  requirement.files?.some((file) => file.sourcePath === "packages/react/src/theme/action-colors.css"),
)
assert(actionColorsRequirement, "Tooltip packet must record action-colors theme support")
requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsRequirement.cssVariables.includes(cssVariable), `Tooltip packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Tooltip packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/theme-order",
  ),
  "Tooltip packet must record theme-order token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--drop_shadow_1") &&
      resolution.replacementSource.includes("--aui-drop-shadow-1"),
  ),
  "Tooltip packet must record drop-shadow CSS variable rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Breadcrumbs/Breadcrumbs.tsx"),
  "Breadcrumbs must stay out",
)
assert(packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Link/Link.tsx"), "Link must stay out")
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/AlertDialog/AlertDialog.tsx"),
  "AlertDialog must stay out",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Sheets/FileUploadSheet/FileUploadSheet.tsx",
  ),
  "Sheet consumers must stay out",
)
assert(
  packet.notes.some((note) => note.includes("small React Aria overlay primitive proof")),
  "Packet must record Tooltip proof scope",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a tooltip manifest item")),
  "Packet must keep manifest activation separate from source receipt",
)

assert(
  packetWrapperSource.includes("tooltipIngestPacketData as TRegistryIngestPacket"),
  "Tooltip packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { tooltipIngestPacket } from "./tooltip-ingest-packet"'),
  "Registry index must export Tooltip ingest packet",
)

console.log("[tooltip-proof] verified Tooltip source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
