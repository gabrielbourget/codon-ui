import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const sliderSourcePath = path.join(packageRoot, "src/components/Slider/Slider.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Slider/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Slider/SliderStyles.module.css")
const compatibilityBridgePath = path.join(packageRoot, "src/components/Slider/slider-compatibility.css")
const sliderIndexPath = path.join(packageRoot, "src/components/Slider/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/slider-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/slider-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[slider-proof] ${message}`)
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
const sliderSource = readRequiredText(sliderSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const compatibilityBridgeSource = readRequiredText(compatibilityBridgePath)
const sliderIndexSource = readRequiredText(sliderIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/Slider/Slider.tsx",
  "packages/react/src/components/Slider/helpers.ts",
  "packages/react/src/components/Slider/SliderStyles.module.css",
  "packages/react/src/components/Slider/__tests__/Slider.test.tsx",
]
const requiredTargetPaths = [
  "Slider/Slider.tsx",
  "Slider/helpers.ts",
  "Slider/SliderStyles.module.css",
  "Slider/__tests__/Slider.test.tsx",
]
const requiredStyleSelectors = [
  ".slider",
  ".slider__track",
  ".slider__thumb",
  ".slider__thumb--primary",
  ".slider__thumb--quintenary",
  ".slider__thumb--applyFocusStyle",
]
const requiredCompatibilityAliases = [
  "--border_radius_1: var(--cui-radius-1)",
  "--shadow_1: var(--cui-shadow-1)",
  "--neutral_6: var(--cui-neutral-600)",
  "--focus-ring-color: var(--cui-focus-ring)",
  "--bgColorTransition: var(--cui-transition-background-color)",
  "--cui-color-primary-500",
  "--cui-color-primary-600",
  "--cui-color-quintenary-500",
  "--cui-color-quintenary-600",
]

assert(sliderSource.startsWith('"use client"'), "Slider must preserve the client component boundary")
assert(
  sliderSource.includes(
    'import { Slider as AdobeSlider, SliderOutput, SliderThumb, SliderTrack } from "react-aria-components"',
  ),
  "Slider must use the React Aria Slider primitives",
)
assert(sliderSource.includes('import Text from "../Text/Text"'), "Slider must compose the package Text component")
assert(sliderSource.includes("forwardRef<HTMLDivElement, TSliderProps>"), "Slider must forward a div ref")
assert(sliderSource.includes('data-testid={dataTestID ?? "slider"}'), "Slider must preserve root test id fallback")
assert(sliderSource.includes('Slider.displayName = "Slider"'), "Slider must set displayName")
assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Slider helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Slider helpers must import package-local theme-order tokens",
)
assert(
  helpersSource.includes('from "../Text/TextStyles.module.css"'),
  "Slider helpers must import installed Text styles by sibling path",
)
assert(helpersSource.includes("export type TSliderProps"), "Slider helpers must export the local props type")
assert(helpersSource.includes("export const calibrateComponent"), "Slider calibration helper must remain local")
assert(
  helpersSource.includes("export const toCSSSize"),
  "Slider size normalization helper must remain available locally",
)
;[sliderSource, helpersSource, stylesSource, compatibilityBridgeSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Slider runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Slider CSS module must include ${selector}`)
})
requiredCompatibilityAliases.forEach((cssVariable) => {
  assert(compatibilityBridgeSource.includes(cssVariable), `Slider compatibility bridge must define ${cssVariable}`)
})
assert(stylesSource.includes("var(--cui-control-border)"), "Slider styles must read the default control border role")
assert(
  stylesSource.includes("var(--cui-control-foreground)"),
  "Slider styles must read the default control foreground role",
)

assert(publicIndexSource.includes('export { Slider } from "./components/Slider"'), "Package index must export Slider")
assert(
  publicIndexSource.includes('export type { SliderProps } from "./components/Slider"'),
  "Package index must export SliderProps",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export Slider calibration internals")
assert(
  sliderIndexSource.includes('export { default as Slider } from "./Slider"'),
  "Slider index must export the component",
)
assert(sliderIndexSource.includes("TSliderProps as SliderProps"), "Slider index must export props alias")
assert(!sliderIndexSource.includes("calibrateComponent"), "Slider index must not export calibration internals")
assert(!sliderIndexSource.includes("toCSSSize"), "Slider index must not export local helper internals")

assert(packet.name === "slider", "Slider packet must describe the slider item")
assert(packet.type === "component", "Slider packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Slider packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Slider packet must record Wavemap as the analyzed source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#slider-next-candidate-planning-checkpoint"),
  "Slider packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Slider packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Slider packet must target ${targetPath}`,
  )
})

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Slider" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Slider/Slider.tsx",
  ),
  "Slider packet must define the public Slider export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "SliderProps" &&
      publicExport.localName === "TSliderProps" &&
      publicExport.sourcePath === "packages/react/src/components/Slider/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Slider packet must define the public SliderProps type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Slider packet must depend on the default theme")
assert(
  packet.registryDependencies.includes("theme/slider-compatibility"),
  "Slider packet must include the Slider proof compatibility bridge",
)
assert(packet.registryDependencies.includes("tokens/geometry"), "Slider packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Slider packet must depend on theme-order tokens")
assert(packet.registryDependencies.includes("text"), "Slider packet must depend on the installed Text component")
assert(
  !packet.registryDependencies.includes("theme/text-typography"),
  "Slider packet should rely on Text for typography support transitively",
)
assert(packet.peerDependencies.react, "Slider packet must declare the React peer dependency")
assert(packet.peerDependencies["react-dom"], "Slider packet must declare the React DOM peer dependency")
assert(packet.peerDependencies["react-aria-components"], "Slider packet must declare the React Aria peer dependency")
assert(packet.runtimeDependencies.classnames, "Slider packet must declare the classnames runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "Slider packet must record default theme contract pressure")
assert(
  defaultContractRequirement.cssVariables.includes("--cui-control-border") &&
    defaultContractRequirement.cssVariables.includes("--cui-control-foreground"),
  "Slider packet must record default control role pressure",
)

const compatibilityBridgeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "proof-compatibility-bridge",
)
assert(compatibilityBridgeRequirement, "Slider packet must record proof compatibility bridge pressure")
requiredCompatibilityAliases.forEach((cssVariable) => {
  const cssVariableName = cssVariable.split(":")[0]
  assert(
    compatibilityBridgeRequirement.cssVariables.includes(cssVariableName),
    `Slider packet must record bridge pressure for ${cssVariableName}`,
  )
})
assert(
  compatibilityBridgeRequirement.files.some(
    (file) => file.sourcePath === "packages/react/src/components/Slider/slider-compatibility.css",
  ),
  "Slider packet must point at the separate Slider compatibility bridge",
)
assert(
  compatibilityBridgeRequirement.notes.some((note) =>
    note.includes("do not fold these aliases into prior component bridges"),
  ),
  "Slider packet must preserve bridge separation intent",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/Text" && resolution.registryDependencyName === "text",
  ),
  "Slider packet must record the Text component import rewrite",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "Slider packet must point at the package-side proof harness",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react typecheck"),
  "Slider packet must point at package typecheck verification",
)
assert(
  packet.notes.some((note) => note.includes("Text treated as an installed registry dependency")),
  "Slider packet must explicitly record Text dependency boundary",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a slider manifest item")),
  "Slider packet must keep manifest activation separate from source receipt",
)
assert(
  packetWrapperSource.includes("sliderIngestPacketData") &&
    packetWrapperSource.includes("slider-ingest-packet.data.json"),
  "Slider packet wrapper must import the packet data",
)
assert(registryIndexSource.includes("sliderIngestPacket"), "Registry index must export the Slider ingest packet")

if (process.exitCode) process.exit(process.exitCode)
console.log("[slider-proof] source receipt proof passed")
