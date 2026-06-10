import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const toggleButtonSourcePath = path.join(packageRoot, "src/components/ToggleButton/ToggleButton.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/ToggleButton/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/ToggleButton/ToggleButtonStyles.module.css")
const compatibilityBridgePath = path.join(packageRoot, "src/components/ToggleButton/toggle-button-compatibility.css")
const toggleButtonIndexPath = path.join(packageRoot, "src/components/ToggleButton/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/toggle-button-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/toggle-button-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[toggle-button-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\//u
const toggleButtonSource = readRequiredText(toggleButtonSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const compatibilityBridgeSource = readRequiredText(compatibilityBridgePath)
const toggleButtonIndexSource = readRequiredText(toggleButtonIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/ToggleButton/ToggleButton.tsx",
  "packages/react/src/components/ToggleButton/helpers.ts",
  "packages/react/src/components/ToggleButton/ToggleButtonStyles.module.css",
  "packages/react/src/components/ToggleButton/__tests__/ToggleButton.test.tsx",
]
const requiredTargetPaths = [
  "ToggleButton/ToggleButton.tsx",
  "ToggleButton/helpers.ts",
  "ToggleButton/ToggleButtonStyles.module.css",
  "ToggleButton/__tests__/ToggleButton.test.tsx",
]
const requiredThemePressure = [
  "--distance_1",
  "--bgColorTransition",
  "--borderColorTransition",
  "--colorTransition",
  "--cui-color-primary-100",
  "--cui-color-primary-700",
  "--cui-action-primary-background",
  "--cui-action-quintenary-foreground",
]
const requiredCompatibilityAliases = [
  "--distance_1: var(--cui-space-1)",
  "--disabledOpacity: var(--cui-opacity-disabled)",
  "--bgColorTransition: var(--cui-transition-background-color)",
  "--borderColorTransition: var(--cui-transition-border-color)",
  "--colorTransition: var(--cui-transition-color)",
  "--cui-action-primary-background",
  "--cui-action-quintenary-foreground",
]

assert(toggleButtonSource.startsWith('"use client"'), "ToggleButton must preserve the client component boundary")
assert(
  toggleButtonSource.includes(
    'import { ToggleButton as AdobeToggleButton, type ToggleButtonRenderProps } from "react-aria-components"',
  ),
  "ToggleButton must use React Aria ToggleButton",
)
assert(
  toggleButtonSource.includes('import { calibrateComponent, type TToggleButtonProps } from "./helpers"'),
  "ToggleButton must use local calibration helpers",
)
assert(
  toggleButtonSource.includes("forwardRef<HTMLButtonElement, TToggleButtonProps>"),
  "ToggleButton must forward an HTMLButtonElement ref",
)
assert(
  toggleButtonSource.includes('data-testid={dataTestID ?? "toggle-button"}'),
  "ToggleButton must preserve the root test id fallback",
)

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "ToggleButton helpers must import geometry tokens from the package",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "ToggleButton helpers must import theme-order tokens from the package",
)
assert(
  helpersSource.includes("export const calibrateComponent"),
  "ToggleButton calibration helper must remain available to ToggleButton",
)
assert(
  !forbiddenConsumerImportsPattern.test(toggleButtonSource),
  "ToggleButton source must not import consumer-only modules",
)
assert(
  !forbiddenConsumerImportsPattern.test(helpersSource),
  "ToggleButton helpers must not import consumer-only modules",
)
assert(
  !forbiddenConsumerImportsPattern.test(stylesSource),
  "ToggleButton styles must not reference consumer-only modules",
)
assert(
  !forbiddenConsumerImportsPattern.test(compatibilityBridgeSource),
  "ToggleButton compatibility bridge must not reference consumer-only modules",
)

const requiredStyleSelectors = [
  ".toggleButton",
  ".toggleButton--no-bg-color-provided-fallback",
  ".toggleButton--primary[data-hovered]",
  ".toggleButton--primary[data-selected]",
  ".toggleButton--quintenary[data-selected][data-pressed]",
  'body[data-theme="dark"] .toggleButton--primary[data-hovered]',
]

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `ToggleButton CSS module must include ${selector}`)
})
requiredCompatibilityAliases.forEach((cssVariable) => {
  assert(
    compatibilityBridgeSource.includes(cssVariable),
    `ToggleButton compatibility bridge must define ${cssVariable}`,
  )
})

assert(
  publicIndexSource.includes('export { ToggleButton } from "./components/ToggleButton"'),
  "Package index must export ToggleButton",
)
assert(
  publicIndexSource.includes('export type { ToggleButtonProps } from "./components/ToggleButton"'),
  "Package index must export ToggleButtonProps",
)
assert(
  !publicIndexSource.includes("calibrateComponent"),
  "Package index must not export ToggleButton calibration internals",
)
assert(
  toggleButtonIndexSource.includes('export { default as ToggleButton } from "./ToggleButton"'),
  "ToggleButton index must export the component",
)
assert(
  toggleButtonIndexSource.includes("TToggleButtonProps as ToggleButtonProps"),
  "ToggleButton index must export the public prop alias",
)

assert(packet.name === "toggle-button", "ToggleButton packet must describe the toggle-button item")
assert(packet.type === "component", "ToggleButton packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "ToggleButton packet must target @codon-ui/react ownership")
assert(
  packet.sourceRepository === "wavemap",
  "ToggleButton packet must record Wavemap as the analyzed source repository",
)
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#togglebutton-next-candidate-planning-checkpoint"),
  "ToggleButton packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `ToggleButton packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `ToggleButton packet must target ${targetPath}`,
  )
})

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ToggleButton" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/ToggleButton/ToggleButton.tsx",
  ),
  "ToggleButton packet must define the public ToggleButton export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ToggleButtonProps" &&
      publicExport.localName === "TToggleButtonProps" &&
      publicExport.sourcePath === "packages/react/src/components/ToggleButton/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "ToggleButton packet must define the public ToggleButtonProps type alias intent",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry" &&
      resolution.replacementSource === "../../tokens/geometry",
  ),
  "ToggleButton packet must map geometry token imports to package-local support",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/theme-order" &&
      resolution.replacementSource === "../../tokens/theme-order",
  ),
  "ToggleButton packet must map theme-order token imports to package-local support",
)

assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/app/[locale]/component-showcase/page.tsx"),
  "ToggleButton packet must exclude the component-showcase consumer",
)
assert(packet.registryDependencies.includes("theme-css"), "ToggleButton packet must depend on the default theme")
assert(
  packet.registryDependencies.includes("theme/toggle-button-compatibility"),
  "ToggleButton packet must include the ToggleButton proof compatibility bridge",
)
assert(
  !packet.registryDependencies.includes("theme/switch-compatibility") &&
    !packet.registryDependencies.includes("theme/checkbox-compatibility"),
  "ToggleButton packet must not reuse another component's compatibility bridge by default",
)
assert(packet.registryDependencies.includes("tokens/geometry"), "ToggleButton packet must depend on geometry tokens")
assert(
  packet.registryDependencies.includes("tokens/theme-order"),
  "ToggleButton packet must depend on theme-order tokens",
)
assert(packet.peerDependencies.react, "ToggleButton packet must declare the React peer dependency")
assert(packet.peerDependencies["react-dom"], "ToggleButton packet must declare the React DOM peer dependency")
assert(
  packet.peerDependencies["react-aria-components"],
  "ToggleButton packet must declare the React Aria peer dependency",
)
assert(packet.runtimeDependencies.classnames, "ToggleButton packet must declare the classnames runtime dependency")

const compatibilityBridgeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "proof-compatibility-bridge",
)
assert(compatibilityBridgeRequirement, "ToggleButton packet must record proof compatibility bridge pressure")
requiredThemePressure.forEach((cssVariable) => {
  assert(
    compatibilityBridgeRequirement.cssVariables.includes(cssVariable),
    `ToggleButton packet must record theme pressure for ${cssVariable}`,
  )
})
assert(
  compatibilityBridgeRequirement.files.some(
    (file) => file.sourcePath === "packages/react/src/components/ToggleButton/toggle-button-compatibility.css",
  ),
  "ToggleButton packet must point at the separate ToggleButton compatibility bridge",
)

assert(
  packetWrapperSource.includes("toggleButtonIngestPacketData") && packetWrapperSource.includes("TRegistryIngestPacket"),
  "ToggleButton packet wrapper must expose typed packet data",
)
assert(
  registryIndexSource.includes('export { toggleButtonIngestPacket } from "./toggle-button-ingest-packet"'),
  "Registry index must export the ToggleButton ingest packet",
)

if (process.exitCode) {
  process.exit()
}

console.log("[toggle-button-proof] source receipt proof passed")
