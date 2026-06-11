import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const clickPopoverSourcePath = path.join(packageRoot, "src/components/ClickPopover/ClickPopover.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/ClickPopover/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/ClickPopover/ClickPopoverStyles.module.css")
const clickPopoverIndexPath = path.join(packageRoot, "src/components/ClickPopover/index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const packetSourcePath = path.join(packageRoot, "src/registry/click-popover-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/click-popover-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[click-popover-proof] ${message}`)
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
const requiredPackageFileSources = [
  "packages/react/src/components/ClickPopover/ClickPopover.tsx",
  "packages/react/src/components/ClickPopover/helpers.ts",
  "packages/react/src/components/ClickPopover/ClickPopoverStyles.module.css",
  "packages/react/src/components/ClickPopover/__tests__/ClickPopover.test.tsx",
]
const requiredTargetPaths = [
  "ClickPopover/ClickPopover.tsx",
  "ClickPopover/helpers.ts",
  "ClickPopover/ClickPopoverStyles.module.css",
  "ClickPopover/__tests__/ClickPopover.test.tsx",
]
const requiredStyleSelectors = [
  ".clickPopover",
  ".clickPopover[data-entering]",
  ".clickPopover[data-exiting]",
  ".clickPopover--raised",
  ".clickPopover--rounded",
  ".clickPopover--primary",
  ".clickPopover--secondary",
  ".clickPopover--tertiary",
  ".clickPopover--quaternary",
  ".clickPopover--quintenary",
  ".clickPopover__overlayArrow svg",
  ".clickPopover__dialog",
]
const requiredDefaultVariables = [
  "--cui-animation-fade-in",
  "--cui-animation-fade-out",
  "--cui-focus-ring",
  "--cui-radius-1",
  "--cui-shadow-1",
  "--cui-space-1",
  "--cui-space-2",
  "--cui-space-3",
  "--cui-surface",
  "--cui-surface-foreground",
]
const requiredActionVariables = [
  "--cui-color-primary-500",
  "--cui-color-secondary-500",
  "--cui-color-tertiary-500",
  "--cui-color-quaternary-500",
  "--cui-color-quintenary-500",
]

const clickPopoverSource = readRequiredText(clickPopoverSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const clickPopoverIndexSource = readRequiredText(clickPopoverIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const actionColorsCSS = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(clickPopoverSource.includes('from "react-aria-components"'), "ClickPopover must import React Aria")
assert(clickPopoverSource.includes("Popover as AdobePopover"), "ClickPopover must render React Aria Popover")
assert(clickPopoverSource.includes("<OverlayArrow"), "ClickPopover must preserve optional overlay arrow support")
assert(clickPopoverSource.includes("<Dialog"), "ClickPopover must preserve optional Dialog wrapping")
assert(
  clickPopoverSource.includes('data-testid={dataTestID ?? "click-popover"}'),
  "ClickPopover root test id fallback must stay",
)
assert(
  clickPopoverSource.includes('data-testid="click-popover-overlay-arrow"'),
  "ClickPopover overlay arrow test id fallback must stay",
)
assert(
  clickPopoverSource.includes('data-testid="click-popover-dialog"'),
  "ClickPopover dialog test id fallback must stay",
)

assert(
  helpersSource.includes('from "../../tokens/geometry"') && helpersSource.includes("type TCornerGeometry"),
  "ClickPopover helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"') && helpersSource.includes("type TThemingOrderCode"),
  "ClickPopover helpers must import package-local theme-order tokens",
)
assert(helpersSource.includes("export type TClickPopoverProps"), "ClickPopover helpers must export local props")
assert(helpersSource.includes("export const calibrateComponent"), "ClickPopover calibration helper must remain local")
assert(helpersSource.includes("THEME_ORDER_CODE__QUINTENARY"), "ClickPopover must preserve quintenary order support")
assert(helpersSource.includes("customDialogClassName"), "ClickPopover must preserve custom dialog class support")
;[clickPopoverSource, helpersSource, stylesSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "ClickPopover runtime source must not import consumer-only modules",
  )
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `ClickPopover CSS module must include ${selector}`)
})
requiredDefaultVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `ClickPopover CSS must read ${cssVariable}`)
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
})
requiredActionVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `ClickPopover CSS must read ${cssVariable}`)
  assert(actionColorsCSS.includes(`${cssVariable}:`), `action-colors.css must declare ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "ClickPopover CSS must not read legacy Wavemap aliases")
assert(!stylesSource.includes("theme/click-popover-compatibility"), "ClickPopover must not need a bridge item")

assert(
  publicIndexSource.includes('export { ClickPopover } from "./components/ClickPopover"'),
  "Package index must export ClickPopover",
)
assert(
  publicIndexSource.includes('export type { ClickPopoverProps } from "./components/ClickPopover"'),
  "Package index must export ClickPopover public type",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export ClickPopover internals")
assert(
  clickPopoverIndexSource.includes('export { default as ClickPopover } from "./ClickPopover"'),
  "ClickPopover index must export component",
)
assert(
  clickPopoverIndexSource.includes("TClickPopoverProps as ClickPopoverProps"),
  "ClickPopover index must export props type",
)
assert(!clickPopoverIndexSource.includes("calibrateComponent"), "ClickPopover index must not export internals")

assert(packageJson.dependencies.classnames, "ClickPopover package must keep classnames runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "ClickPopover React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "ClickPopover package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "ClickPopover package must keep React DOM peer dependency")
assert(
  packageJson.scripts.test.includes("verify-click-popover-proof.mjs"),
  "Package test script must run ClickPopover proof",
)

assert(packet.name === "click-popover", "ClickPopover packet must describe the click-popover item")
assert(packet.type === "component", "ClickPopover packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "ClickPopover packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "ClickPopover packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#clickpopover-next-candidate-planning-checkpoint"),
  "ClickPopover packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `ClickPopover packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `ClickPopover packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "ClickPopover packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ClickPopover" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/ClickPopover/ClickPopover.tsx",
  ),
  "ClickPopover packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ClickPopoverProps" &&
      publicExport.localName === "TClickPopoverProps" &&
      publicExport.sourcePath === "packages/react/src/components/ClickPopover/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "ClickPopover packet must define the public props type alias intent",
)
;["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order"].forEach((registryDependency) => {
  assert(
    packet.registryDependencies.includes(registryDependency),
    `ClickPopover packet must depend on ${registryDependency}`,
  )
})
assert(
  !packet.registryDependencies.includes("theme/click-popover-compatibility"),
  "ClickPopover must not need a bridge item",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "ClickPopover packet must declare React Aria")
assert(packet.peerDependencies.react, "ClickPopover packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "ClickPopover packet must declare React DOM peer dependency")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "ClickPopover packet must declare classnames")
assert(
  packet.themeRequirements.some((requirement) =>
    ["--cui-space-2", "--cui-radius-1", "--cui-focus-ring", "--cui-shadow-1"].every((cssVariable) =>
      requirement.cssVariables.includes(cssVariable),
    ),
  ),
  "ClickPopover packet must record default theme variables",
)
assert(
  packet.themeRequirements.some((requirement) => requirement.cssVariables.includes("--cui-color-quintenary-500")),
  "ClickPopover packet must record action color variables",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/geometry" &&
      resolution.replacementSource === "../../tokens/geometry",
  ),
  "ClickPopover packet must record geometry import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/theme-order" &&
      resolution.replacementSource === "../../tokens/theme-order",
  ),
  "ClickPopover packet must record theme-order import rewrite",
)

assert(
  packetWrapperSource.includes("clickPopoverIngestPacketData") && packetWrapperSource.includes("TRegistryIngestPacket"),
  "ClickPopover packet wrapper must type the JSON packet",
)
assert(
  registryIndexSource.includes('export { clickPopoverIngestPacket } from "./click-popover-ingest-packet"'),
  "Registry index must export ClickPopover ingest packet",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[click-popover-proof] Source receipt checks passed.")
