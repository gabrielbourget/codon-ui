import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const radioSourcePath = path.join(packageRoot, "src/components/Radio/Radio.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Radio/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Radio/RadioStyles.module.css")
const compatibilityBridgePath = path.join(packageRoot, "src/components/Radio/radio-compatibility.css")
const radioIndexPath = path.join(packageRoot, "src/components/Radio/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/radio-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/radio-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[radio-proof] ${message}`)
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
const radioSource = readRequiredText(radioSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const compatibilityBridgeSource = readRequiredText(compatibilityBridgePath)
const radioIndexSource = readRequiredText(radioIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/Radio/Radio.tsx",
  "packages/react/src/components/Radio/helpers.ts",
  "packages/react/src/components/Radio/RadioStyles.module.css",
  "packages/react/src/components/Radio/__tests__/Radio.test.tsx",
]
const requiredTargetPaths = [
  "Radio/Radio.tsx",
  "Radio/helpers.ts",
  "Radio/RadioStyles.module.css",
  "Radio/__tests__/Radio.test.tsx",
]
const requiredThemePressure = [
  "--distance_1",
  "--text-color",
  "--disabledOpacity",
  "--focus-ring-color",
  "--border_radius_1",
  "--aui-color-primary-100",
  "--aui-color-primary-700",
  "--aui-color-quintenary-700",
]
const requiredCompatibilityAliases = [
  "--distance_1: var(--aui-space-1)",
  "--text-color: var(--aui-foreground)",
  "--disabledOpacity: var(--aui-opacity-disabled)",
  "--border_radius_1: var(--aui-radius-1)",
  "--focus-ring-color: var(--aui-focus-ring)",
  "--aui-color-primary-100",
  "--aui-color-quintenary-700",
]

assert(radioSource.startsWith('"use client"'), "Radio must preserve the client component boundary")
assert(
  radioSource.includes('import { Radio as AdobeRadio, type RadioRenderProps } from "react-aria-components"'),
  "Radio must use React Aria Radio",
)
assert(
  radioSource.includes('import { calibrateComponent, type TRadioProps } from "./helpers"'),
  "Radio must use helpers",
)
assert(radioSource.includes("forwardRef<HTMLLabelElement, TRadioProps>"), "Radio must forward an HTMLLabelElement ref")
assert(radioSource.includes('data-testid={dataTestID ?? "radio"}'), "Radio must preserve the root test id fallback")
assert(radioSource.includes('data-testid="radio-shape"'), "Radio must preserve the shape test id")

assert(helpersSource.includes('from "../../tokens/geometry"'), "Radio helpers must import geometry tokens from package")
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Radio helpers must import theme-order tokens from package",
)
assert(helpersSource.includes("export const calibrateComponent"), "Radio calibration helper must remain local")
assert(!forbiddenConsumerImportsPattern.test(radioSource), "Radio source must not import consumer-only modules")
assert(!forbiddenConsumerImportsPattern.test(helpersSource), "Radio helpers must not import consumer-only modules")
assert(!forbiddenConsumerImportsPattern.test(stylesSource), "Radio styles must not reference consumer-only modules")
assert(
  !forbiddenConsumerImportsPattern.test(compatibilityBridgeSource),
  "Radio compatibility bridge must not reference consumer-only modules",
)

const requiredStyleSelectors = [
  ".radio",
  ".shape",
  ".shape--fallback",
  ".shape--primary",
  ".radio[data-selected] .shape--primary",
  'body[data-theme="dark"] .radio[data-selected][data-hovered] .shape--primary',
]

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Radio CSS module must include ${selector}`)
})
requiredCompatibilityAliases.forEach((cssVariable) => {
  assert(compatibilityBridgeSource.includes(cssVariable), `Radio compatibility bridge must define ${cssVariable}`)
})

assert(publicIndexSource.includes('export { Radio } from "./components/Radio"'), "Package index must export Radio")
assert(
  publicIndexSource.includes('export type { RadioProps } from "./components/Radio"'),
  "Package index must export RadioProps",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export Radio calibration internals")
assert(radioIndexSource.includes('export { default as Radio } from "./Radio"'), "Radio index must export the component")
assert(radioIndexSource.includes("TRadioProps as RadioProps"), "Radio index must export the public prop alias")

assert(packet.name === "radio", "Radio packet must describe the radio item")
assert(packet.type === "component", "Radio packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Radio packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Radio packet must record Wavemap as the analyzed source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#radio-next-candidate-planning-checkpoint"),
  "Radio packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Radio packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Radio packet must target ${targetPath}`,
  )
})

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Radio" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Radio/Radio.tsx",
  ),
  "Radio packet must define the public Radio export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "RadioProps" &&
      publicExport.localName === "TRadioProps" &&
      publicExport.sourcePath === "packages/react/src/components/Radio/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Radio packet must define the public RadioProps type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Radio packet must depend on the default theme")
assert(
  packet.registryDependencies.includes("theme/radio-compatibility"),
  "Radio packet must include the Radio proof compatibility bridge",
)
assert(
  !packet.registryDependencies.includes("theme/toggle-button-compatibility"),
  "Radio packet must not reuse another component compatibility bridge by default",
)
assert(packet.registryDependencies.includes("tokens/geometry"), "Radio packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Radio packet must depend on theme-order tokens")
assert(packet.peerDependencies.react, "Radio packet must declare the React peer dependency")
assert(packet.peerDependencies["react-dom"], "Radio packet must declare the React DOM peer dependency")
assert(packet.peerDependencies["react-aria-components"], "Radio packet must declare the React Aria peer dependency")
assert(packet.runtimeDependencies.classnames, "Radio packet must declare the classnames runtime dependency")

const compatibilityBridgeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "proof-compatibility-bridge",
)
assert(compatibilityBridgeRequirement, "Radio packet must record proof compatibility bridge pressure")
requiredThemePressure.forEach((cssVariable) => {
  assert(
    compatibilityBridgeRequirement.cssVariables.includes(cssVariable),
    `Radio packet must record theme pressure for ${cssVariable}`,
  )
})
assert(
  compatibilityBridgeRequirement.files.some(
    (file) => file.sourcePath === "packages/react/src/components/Radio/radio-compatibility.css",
  ),
  "Radio packet must point at the separate Radio compatibility bridge",
)
assert(
  compatibilityBridgeRequirement.notes.some((note) => note.includes("selected one-color exception")),
  "Radio packet must record the selected one-color exception",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @amino-ui/react test"),
  "Radio packet must point at the package-side proof harness",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @amino-ui/react typecheck"),
  "Radio packet must point at package typecheck verification",
)
assert(
  packet.notes.some((note) => note.includes("runtime source has been received")),
  "Radio packet must explicitly record source receipt",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a radio manifest item")),
  "Radio packet must keep manifest activation separate from source receipt",
)
assert(
  packetWrapperSource.includes("radioIngestPacketData") &&
    packetWrapperSource.includes("radio-ingest-packet.data.json"),
  "Radio packet wrapper must import the packet data",
)
assert(registryIndexSource.includes("radioIngestPacket"), "Registry index must export the Radio ingest packet")

if (process.exitCode) process.exit(process.exitCode)
console.log("[radio-proof] source receipt proof passed")
