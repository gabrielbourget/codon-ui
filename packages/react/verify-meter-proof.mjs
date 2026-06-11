import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const meterSourcePath = path.join(packageRoot, "src/components/Meter/Meter.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Meter/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Meter/MeterStyles.module.css")
const meterIndexPath = path.join(packageRoot, "src/components/Meter/index.ts")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const packetSourcePath = path.join(packageRoot, "src/registry/meter-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/meter-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[meter-proof] ${message}`)
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
const forbiddenLegacyCssPattern = /--shadow_1|--border_radius_1/u

const meterSource = readRequiredText(meterSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const meterIndexSource = readRequiredText(meterIndexPath)
const actionColorsSource = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Meter/Meter.tsx",
  "packages/react/src/components/Meter/helpers.ts",
  "packages/react/src/components/Meter/MeterStyles.module.css",
  "packages/react/src/components/Meter/__tests__/Meter.test.tsx",
]
const requiredTargetPaths = [
  "Meter/Meter.tsx",
  "Meter/helpers.ts",
  "Meter/MeterStyles.module.css",
  "Meter/__tests__/Meter.test.tsx",
]
const requiredStyleSelectors = [
  ".meter",
  ".meter--horizontal",
  ".meter--vertical",
  ".meter--dirLeft",
  ".meter--dirDown",
  ".meter__track",
  ".meter__track--raised",
  ".meter__track--rounded",
  ".meter__track--round",
  ".meter__bar",
  ".meter__bar--rounded",
  ".meter__bar--round",
  ".meter__bar--primary",
  ".meter__bar--quintenary",
]
const requiredActionColorVariables = [
  "--cui-color-primary-500",
  "--cui-color-secondary-500",
  "--cui-color-tertiary-500",
  "--cui-color-quaternary-500",
  "--cui-color-quintenary-500",
]

assert(meterSource.includes('from "motion/react"'), "Meter must import Motion")
assert(meterSource.includes("<motion.div"), "Meter must animate the bar with Motion")
assert(meterSource.includes('from "react-aria-components"'), "Meter must import React Aria")
assert(meterSource.includes("<AdobeMeter"), "Meter must render React Aria Meter")
assert(meterSource.includes("forwardRef<HTMLDivElement, TMeterProps>"), "Meter must forward a div ref")
assert(meterSource.includes('data-testid={dataTestID ?? "meter"}'), "Meter root test id fallback must stay")
assert(
  meterSource.includes('transition={{ ease: "easeInOut", duration: 0.25 }}'),
  "Meter Motion transition must stay bounded",
)
assert(meterSource.includes('Meter.displayName = "Meter"'), "Meter display name must be set")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Meter helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Meter helpers must import package-local theme-order tokens",
)
assert(helpersSource.includes("export type TMeterProps"), "Meter helpers must export local props")
assert(
  helpersSource.includes('export const METER_ORIENTATION__HORIZONTAL = "horizontal"'),
  "Meter horizontal orientation constant must stay local",
)
assert(helpersSource.includes("export const calibrateComponent"), "Meter calibration helper must remain local")
;[meterSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Meter runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Meter CSS module must include ${selector}`)
})
;[
  "var(--cui-control-border)",
  "var(--cui-control-selected-background)",
  "var(--cui-shadow-1)",
  "var(--cui-radius-1)",
  "var(--cui-color-primary-500)",
  "var(--cui-color-quintenary-500)",
].forEach((cssValue) => {
  assert(stylesSource.includes(cssValue), `Meter CSS must read ${cssValue}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Meter CSS must not read legacy Wavemap aliases")

requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsSource.includes(cssVariable), `action-colors CSS must define ${cssVariable}`)
})

assert(publicIndexSource.includes('export { Meter } from "./components/Meter"'), "Package index must export Meter")
assert(
  publicIndexSource.includes('export type { MeterProps } from "./components/Meter"'),
  "Package index must export MeterProps",
)
assert(!publicIndexSource.includes("METER_DIRECTION__"), "Package index must not export Meter internals")
assert(meterIndexSource.includes('export { default as Meter } from "./Meter"'), "Meter index must export component")
assert(meterIndexSource.includes("TMeterProps as MeterProps"), "Meter index must export props alias")
assert(!meterIndexSource.includes("calibrateComponent"), "Meter index must not export internals")

assert(packageJson.dependencies.classnames, "Meter package must keep classnames runtime dependency")
assert(packageJson.dependencies.motion, "Meter package must declare Motion as a runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Meter React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "Meter package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Meter package must keep React DOM peer dependency")

assert(packet.name === "meter", "Meter packet must describe the meter item")
assert(packet.type === "component", "Meter packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Meter packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Meter packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#meter-next-candidate-planning-checkpoint"),
  "Meter packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Meter packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Meter packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Meter packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Meter" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Meter/Meter.tsx",
  ),
  "Meter packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "MeterProps" &&
      publicExport.localName === "TMeterProps" &&
      publicExport.sourcePath === "packages/react/src/components/Meter/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Meter packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Meter packet must depend on default theme")
assert(packet.registryDependencies.includes("theme/action-colors"), "Meter packet must depend on action colors")
assert(packet.registryDependencies.includes("tokens/geometry"), "Meter packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Meter packet must depend on theme-order tokens")
assert(!packet.registryDependencies.includes("theme/meter-compatibility"), "Meter must not need a bridge item")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Meter packet must declare React Aria peer")
assert(packet.runtimeDependencies.classnames, "Meter packet must declare classnames runtime dependency")
assert(packet.runtimeDependencies.motion, "Meter packet must declare Motion runtime dependency")

const actionColorsRequirement = packet.themeRequirements.find((requirement) =>
  requirement.files?.some((file) => file.sourcePath === "packages/react/src/theme/action-colors.css"),
)
assert(actionColorsRequirement, "Meter packet must record action-colors theme support")
requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsRequirement.cssVariables.includes(cssVariable), `Meter packet must record ${cssVariable}`)
})
const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "Meter packet must record default-contract theme pressure")
;["--cui-control-border", "--cui-control-selected-background", "--cui-radius-1", "--cui-shadow-1"].forEach(
  (cssVariable) => {
    assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Meter packet must record ${cssVariable}`)
  },
)

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Meter packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/theme-order",
  ),
  "Meter packet must record theme-order token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--shadow_1") && resolution.replacementSource.includes("--cui-shadow-1"),
  ),
  "Meter packet must record legacy CSS variable rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/LinearProgress/LinearProgress.tsx"),
  "LinearProgress must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Cards/Card/Card.tsx"),
  "Card must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Select/Select.tsx"),
  "Select must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/ComboBox/ComboBox.tsx"),
  "ComboBox must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/TagComboBox/TagComboBox.tsx"),
  "TagComboBox must stay out",
)
assert(
  packet.notes.some((note) => note.includes("second Motion-backed progress component proof")),
  "Packet must record Motion scope",
)

assert(
  packetWrapperSource.includes("meterIngestPacketData as TRegistryIngestPacket"),
  "Meter packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { meterIngestPacket } from "./meter-ingest-packet"'),
  "Registry index must export Meter ingest packet",
)

console.log("[meter-proof] verified Meter source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
