import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const radioGroupSourcePath = path.join(packageRoot, "src/components/RadioGroup/RadioGroup.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/RadioGroup/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/RadioGroup/RadioGroupStyles.module.css")
const compatibilityBridgePath = path.join(packageRoot, "src/components/RadioGroup/radio-group-compatibility.css")
const radioGroupIndexPath = path.join(packageRoot, "src/components/RadioGroup/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/radio-group-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/radio-group-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[radio-group-proof] ${message}`)
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
const radioGroupSource = readRequiredText(radioGroupSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const compatibilityBridgeSource = readRequiredText(compatibilityBridgePath)
const radioGroupIndexSource = readRequiredText(radioGroupIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/RadioGroup/RadioGroup.tsx",
  "packages/react/src/components/RadioGroup/helpers.ts",
  "packages/react/src/components/RadioGroup/RadioGroupStyles.module.css",
  "packages/react/src/components/RadioGroup/__tests__/RadioGroup.test.tsx",
]
const requiredTargetPaths = [
  "RadioGroup/RadioGroup.tsx",
  "RadioGroup/helpers.ts",
  "RadioGroup/RadioGroupStyles.module.css",
  "RadioGroup/__tests__/RadioGroup.test.tsx",
]
const requiredCompatibilityAliases = [
  "--distance_2: var(--cui-space-2)",
  "--disabledOpacity: var(--cui-opacity-disabled)",
]

assert(radioGroupSource.startsWith('"use client"'), "RadioGroup must preserve the client component boundary")
assert(
  radioGroupSource.includes('import { RadioGroup as AdobeRadioGroup } from "react-aria-components"'),
  "RadioGroup must use React Aria RadioGroup",
)
assert(
  radioGroupSource.includes(
    'import { calibrateComponent, ORIENTATION__VERTICAL, type TRadioGroupProps } from "./helpers"',
  ),
  "RadioGroup must use local calibration helpers and default orientation",
)
assert(radioGroupSource.includes("forwardRef<HTMLDivElement, TRadioGroupProps>"), "RadioGroup must forward a div ref")
assert(
  radioGroupSource.includes('data-testid={dataTestID ?? "radio-group"}'),
  "RadioGroup must preserve the root test id fallback",
)
assert(radioGroupSource.includes('RadioGroup.displayName = "RadioGroup"'), "RadioGroup must set displayName")
assert(
  helpersSource.includes("export const ORIENTATION__HORIZONTAL"),
  "RadioGroup helpers must keep orientation constants",
)
assert(helpersSource.includes("export const calibrateComponent"), "RadioGroup calibration helper must remain local")
assert(
  !forbiddenConsumerImportsPattern.test(radioGroupSource),
  "RadioGroup source must not import consumer-only modules",
)
assert(!forbiddenConsumerImportsPattern.test(helpersSource), "RadioGroup helpers must not import consumer-only modules")
assert(
  !forbiddenConsumerImportsPattern.test(stylesSource),
  "RadioGroup styles must not reference consumer-only modules",
)
assert(
  !forbiddenConsumerImportsPattern.test(compatibilityBridgeSource),
  "RadioGroup compatibility bridge must not reference consumer-only modules",
)

const requiredStyleSelectors = [
  ".radioGroup",
  ".radioGroup--horizontal",
  ".radioGroup--vertical",
  ".radioGroup[data-disabled]",
]

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `RadioGroup CSS module must include ${selector}`)
})
requiredCompatibilityAliases.forEach((cssVariable) => {
  assert(compatibilityBridgeSource.includes(cssVariable), `RadioGroup compatibility bridge must define ${cssVariable}`)
})

assert(
  publicIndexSource.includes('export { RadioGroup } from "./components/RadioGroup"'),
  "Package index must export RadioGroup",
)
assert(
  publicIndexSource.includes('export type { RadioGroupProps } from "./components/RadioGroup"'),
  "Package index must export RadioGroupProps",
)
assert(
  !publicIndexSource.includes("calibrateComponent"),
  "Package index must not export RadioGroup calibration internals",
)
assert(!publicIndexSource.includes("ORIENTATION__"), "Package index must not export RadioGroup orientation constants")
assert(
  radioGroupIndexSource.includes('export { default as RadioGroup } from "./RadioGroup"'),
  "RadioGroup index must export the component",
)
assert(
  radioGroupIndexSource.includes("TRadioGroupProps as RadioGroupProps"),
  "RadioGroup index must export props alias",
)
assert(!radioGroupIndexSource.includes("calibrateComponent"), "RadioGroup index must not export calibration internals")
assert(!radioGroupIndexSource.includes("ORIENTATION__"), "RadioGroup index must not export orientation constants")

assert(packet.name === "radio-group", "RadioGroup packet must describe the radio-group item")
assert(packet.type === "component", "RadioGroup packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "RadioGroup packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "RadioGroup packet must record Wavemap as the analyzed source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#radiogroup-sequential-planning-checkpoint"),
  "RadioGroup packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `RadioGroup packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `RadioGroup packet must target ${targetPath}`,
  )
})

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "RadioGroup" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/RadioGroup/RadioGroup.tsx",
  ),
  "RadioGroup packet must define the public RadioGroup export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "RadioGroupProps" &&
      publicExport.localName === "TRadioGroupProps" &&
      publicExport.sourcePath === "packages/react/src/components/RadioGroup/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "RadioGroup packet must define the public RadioGroupProps type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "RadioGroup packet must depend on the default theme")
assert(
  packet.registryDependencies.includes("theme/radio-group-compatibility"),
  "RadioGroup packet must include the RadioGroup proof compatibility bridge",
)
assert(packet.registryDependencies.includes("radio"), "RadioGroup packet must depend on the installed Radio component")
assert(
  !packet.registryDependencies.includes("theme/radio-compatibility"),
  "RadioGroup packet must not directly reuse the Radio compatibility bridge",
)
assert(packet.peerDependencies.react, "RadioGroup packet must declare the React peer dependency")
assert(packet.peerDependencies["react-dom"], "RadioGroup packet must declare the React DOM peer dependency")
assert(
  packet.peerDependencies["react-aria-components"],
  "RadioGroup packet must declare the React Aria peer dependency",
)
assert(packet.runtimeDependencies.classnames, "RadioGroup packet must declare the classnames runtime dependency")

const compatibilityBridgeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "proof-compatibility-bridge",
)
assert(compatibilityBridgeRequirement, "RadioGroup packet must record proof compatibility bridge pressure")
assert(
  compatibilityBridgeRequirement.cssVariables.includes("--distance_2") &&
    compatibilityBridgeRequirement.cssVariables.includes("--disabledOpacity"),
  "RadioGroup packet must record spacing and disabled opacity bridge pressure",
)
assert(
  compatibilityBridgeRequirement.files.some(
    (file) => file.sourcePath === "packages/react/src/components/RadioGroup/radio-group-compatibility.css",
  ),
  "RadioGroup packet must point at the separate RadioGroup compatibility bridge",
)
assert(
  compatibilityBridgeRequirement.notes.some((note) => note.includes("Radio source is not part")),
  "RadioGroup packet must record Radio dependency boundary",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "RadioGroup packet must point at the package-side proof harness",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react typecheck"),
  "RadioGroup packet must point at package typecheck verification",
)
assert(
  packet.notes.some((note) => note.includes("runtime source has been received")),
  "RadioGroup packet must explicitly record source receipt",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a radio-group manifest item")),
  "RadioGroup packet must keep manifest activation separate from source receipt",
)
assert(
  packetWrapperSource.includes("radioGroupIngestPacketData") &&
    packetWrapperSource.includes("radio-group-ingest-packet.data.json"),
  "RadioGroup packet wrapper must import the packet data",
)
assert(
  registryIndexSource.includes("radioGroupIngestPacket"),
  "Registry index must export the RadioGroup ingest packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[radio-group-proof] source receipt proof passed")
