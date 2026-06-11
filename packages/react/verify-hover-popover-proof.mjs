import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const hoverPopoverSourcePath = path.join(packageRoot, "src/components/HoverPopover/HoverPopover.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/HoverPopover/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/HoverPopover/HoverPopoverStyles.module.css")
const hoverPopoverIndexPath = path.join(packageRoot, "src/components/HoverPopover/index.ts")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/hover-popover-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/hover-popover-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[hover-popover-proof] ${message}`)
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
  /--distance_|--border_radius_|--fadeInAnimation|--fadeOutAnimation|--shadow_1|theme\/hover-popover-compatibility|\.tooltip__overlayArrow/u

const hoverPopoverSource = readRequiredText(hoverPopoverSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const hoverPopoverIndexSource = readRequiredText(hoverPopoverIndexPath)
const actionColorsSource = readRequiredText(actionColorsPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/HoverPopover/HoverPopover.tsx",
  "packages/react/src/components/HoverPopover/helpers.ts",
  "packages/react/src/components/HoverPopover/HoverPopoverStyles.module.css",
  "packages/react/src/components/HoverPopover/__tests__/HoverPopover.test.tsx",
]
const requiredTargetPaths = [
  "HoverPopover/HoverPopover.tsx",
  "HoverPopover/helpers.ts",
  "HoverPopover/HoverPopoverStyles.module.css",
  "HoverPopover/__tests__/HoverPopover.test.tsx",
]
const requiredStyleSelectors = [
  ".hoverPopover",
  ".hoverPopover--raised",
  ".hoverPopover--rounded",
  ".hoverPopover--primary",
  ".hoverPopover--quintenary",
  ".hoverPopover__overlayArrow svg",
  ".hoverPopover__overlayArrow--primary svg",
  ".hoverPopover__overlayArrow--quintenary svg",
  '.hoverPopover[data-placement="top"]',
  '.hoverPopover[data-placement="left"]',
  '.hoverPopover[data-placement="bottom"] .hoverPopover__overlayArrow svg',
]
const requiredActionColorVariables = [
  "--cui-color-primary-500",
  "--cui-color-secondary-500",
  "--cui-color-tertiary-500",
  "--cui-color-quaternary-500",
  "--cui-color-quintenary-500",
]
const requiredDefaultThemeVariables = [
  "--cui-surface",
  "--cui-surface-foreground",
  "--cui-space-2",
  "--cui-space-3",
  "--cui-radius-1",
  "--cui-animation-fade-in",
  "--cui-animation-fade-out",
  "--cui-shadow-1",
]

assert(hoverPopoverSource.startsWith('"use client"'), "HoverPopover must preserve the client component boundary")
assert(hoverPopoverSource.includes('from "react-aria-components"'), "HoverPopover must import React Aria")
assert(hoverPopoverSource.includes("OverlayArrow"), "HoverPopover must preserve overlay-arrow rendering")
assert(hoverPopoverSource.includes("forwardRef<HTMLDivElement"), "HoverPopover must forward a div ref")
assert(
  hoverPopoverSource.includes('data-testid={dataTestID ?? "hover-popover"}'),
  "HoverPopover root test id fallback must stay",
)
assert(
  hoverPopoverSource.includes('HoverPopover.displayName = "HoverPopover"'),
  "HoverPopover display name must be set",
)
assert(hoverPopoverSource.includes("showOverlayArrow ?"), "HoverPopover must preserve the showOverlayArrow branch")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "HoverPopover helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "HoverPopover helpers must import package-local theme-order tokens",
)
assert(helpersSource.includes("export type THoverPopoverProps"), "HoverPopover helpers must export local props")
assert(helpersSource.includes("export const calibrateComponent"), "HoverPopover calibration helper must remain local")
;[hoverPopoverSource, helpersSource, stylesSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "HoverPopover runtime source must not import consumer-only modules",
  )
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `HoverPopover CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `HoverPopover CSS must read ${cssVariable}`)
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})
requiredActionColorVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `HoverPopover CSS must read ${cssVariable}`)
  assert(actionColorsSource.includes(cssVariable), `action-colors CSS must define ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "HoverPopover CSS must not read legacy Wavemap aliases")

assert(
  publicIndexSource.includes('export { HoverPopover } from "./components/HoverPopover"'),
  "Package index must export HoverPopover",
)
assert(
  publicIndexSource.includes('export type { HoverPopoverProps } from "./components/HoverPopover"'),
  "Package index must export HoverPopoverProps",
)
assert(
  !publicIndexSource.includes("THoverPopoverProps"),
  "Package index must not export HoverPopover internals directly",
)
assert(
  hoverPopoverIndexSource.includes('export { default as HoverPopover } from "./HoverPopover"'),
  "HoverPopover index must export component",
)
assert(
  hoverPopoverIndexSource.includes("THoverPopoverProps as HoverPopoverProps"),
  "HoverPopover index must export props alias",
)
assert(!hoverPopoverIndexSource.includes("calibrateComponent"), "HoverPopover index must not export internals")

assert(packageJson.dependencies.classnames, "HoverPopover package must keep classnames runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "HoverPopover React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "HoverPopover package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "HoverPopover package must keep React DOM peer dependency")

assert(packet.name === "hover-popover", "HoverPopover packet must describe the hover-popover item")
assert(packet.type === "component", "HoverPopover packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "HoverPopover packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "HoverPopover packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#hoverpopover-next-candidate-planning-checkpoint"),
  "HoverPopover packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `HoverPopover packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `HoverPopover packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "HoverPopover packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "HoverPopover" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/HoverPopover/HoverPopover.tsx",
  ),
  "HoverPopover packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "HoverPopoverProps" &&
      publicExport.localName === "THoverPopoverProps" &&
      publicExport.sourcePath === "packages/react/src/components/HoverPopover/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "HoverPopover packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "HoverPopover packet must depend on default theme")
assert(packet.registryDependencies.includes("theme/action-colors"), "HoverPopover packet must depend on action colors")
assert(packet.registryDependencies.includes("tokens/geometry"), "HoverPopover packet must depend on geometry tokens")
assert(
  packet.registryDependencies.includes("tokens/theme-order"),
  "HoverPopover packet must depend on theme-order tokens",
)
assert(
  !packet.registryDependencies.includes("theme/hover-popover-compatibility"),
  "HoverPopover must not need a bridge item",
)
assert(
  packet.peerDependencies["react-aria-components"] === "^1.17.0",
  "HoverPopover packet must declare React Aria peer",
)
assert(packet.runtimeDependencies.classnames, "HoverPopover packet must declare classnames runtime dependency")
assert(!packet.runtimeDependencies.motion, "HoverPopover packet must not declare Motion")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "HoverPopover packet must record default-contract theme pressure")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(
    defaultContractRequirement.cssVariables.includes(cssVariable),
    `HoverPopover packet must record ${cssVariable}`,
  )
})
const actionColorsRequirement = packet.themeRequirements.find((requirement) =>
  requirement.files?.some((file) => file.sourcePath === "packages/react/src/theme/action-colors.css"),
)
assert(actionColorsRequirement, "HoverPopover packet must record action-colors theme support")
requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsRequirement.cssVariables.includes(cssVariable), `HoverPopover packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "HoverPopover packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/theme-order",
  ),
  "HoverPopover packet must record theme-order token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--shadow_1") && resolution.replacementSource.includes("--cui-shadow-1"),
  ),
  "HoverPopover packet must record shadow CSS variable rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes(".tooltip__overlayArrow") &&
      resolution.replacementSource.includes(".hoverPopover__overlayArrow"),
  ),
  "HoverPopover packet must record overlay-arrow selector correction",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/HoverPopoverRadix/HoverPopoverRadix.tsx"),
  "HoverPopoverRadix must stay out",
)
assert(packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Menu/Menu.tsx"), "Menu must stay out")
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Modal/Modal.tsx"),
  "Modal must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/AlertDialog/AlertDialog.tsx"),
  "AlertDialog must stay out",
)

assert(
  packet.notes.some((note) => note.includes("React Aria hover overlay companion")),
  "Packet must record HoverPopover proof scope",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a hover-popover manifest item")),
  "Packet must keep manifest activation separate from source receipt",
)

assert(
  packetWrapperSource.includes("hoverPopoverIngestPacketData as TRegistryIngestPacket"),
  "HoverPopover packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { hoverPopoverIngestPacket } from "./hover-popover-ingest-packet"'),
  "Registry index must export HoverPopover ingest packet",
)

console.log("[hover-popover-proof] verified HoverPopover source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
