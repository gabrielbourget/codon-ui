import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const cardSourcePath = path.join(packageRoot, "src/components/Card/Card.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Card/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Card/CardStyles.module.css")
const cardIndexPath = path.join(packageRoot, "src/components/Card/index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/card-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/card-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[card-proof] ${message}`)
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
const forbiddenLegacyCssPattern = /--distance_|--border_radius_|--shadow_|theme\/card-compatibility/u

const cardSource = readRequiredText(cardSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const cardIndexSource = readRequiredText(cardIndexPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Card/Card.tsx",
  "packages/react/src/components/Card/helpers.ts",
  "packages/react/src/components/Card/CardStyles.module.css",
  "packages/react/src/components/Card/__tests__/Card.test.tsx",
]
const requiredTargetPaths = [
  "Cards/Card/Card.tsx",
  "Cards/Card/helpers.ts",
  "Cards/Card/CardStyles.module.css",
  "Cards/Card/__tests__/Card.test.tsx",
]
const requiredStyleSelectors = [".card", ".card--raised"]
const requiredDefaultThemeVariables = ["--aui-space-3", "--aui-shadow-1"]

assert(cardSource.includes('from "motion/react"'), "Card must import Motion")
assert(cardSource.includes("<motion.div"), "Card must render a Motion div")
assert(cardSource.includes("layout={layoutMode}"), "Card must preserve Motion layout forwarding")
assert(cardSource.includes("normalizeDimension"), "Card must preserve dimension normalization")
assert(cardSource.includes('borderRadius = "10"'), "Card default border radius must stay")
assert(cardSource.includes('"--height": normalizedHeight'), "Card must set local height CSS hook")
assert(cardSource.includes('"--width": normalizedWidth'), "Card must set local width CSS hook")
assert(cardSource.includes('"--borderRadius": normalizedBorderRadius'), "Card must set local border-radius CSS hook")

assert(helpersSource.includes('from "motion/react"'), "Card helpers must import Motion prop types")
assert(helpersSource.includes("export type TCardProps"), "Card helpers must export local props")
assert(helpersSource.includes("HTMLMotionProps"), "Card props must extend Motion div props")
assert(helpersSource.includes("layoutMode?:"), "Card props must preserve layoutMode")
assert(helpersSource.includes("export const calibrateComponent"), "Card calibration helper must remain local")
assert(helpersSource.includes("raised = true"), "Card raised default must stay in calibration")
;[cardSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Card runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Card CSS module must include ${selector}`)
})
;[
  "var(--height, auto)",
  "var(--width, auto)",
  "var(--borderRadius, 10px)",
  "var(--aui-space-3)",
  "var(--aui-shadow-1)",
].forEach((cssValue) => {
  assert(stylesSource.includes(cssValue), `Card CSS must read ${cssValue}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Card CSS must not read legacy Wavemap aliases")

requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})

assert(publicIndexSource.includes('export { Card } from "./components/Card"'), "Package index must export Card")
assert(
  publicIndexSource.includes('export type { CardProps } from "./components/Card"'),
  "Package index must export CardProps",
)
assert(!publicIndexSource.includes("TCardProps"), "Package index must not export Card internals directly")
assert(cardIndexSource.includes('export { default as Card } from "./Card"'), "Card index must export component")
assert(cardIndexSource.includes("TCardProps as CardProps"), "Card index must export props alias")
assert(!cardIndexSource.includes("calibrateComponent"), "Card index must not export internals")

assert(packageJson.dependencies.classnames, "Card package must keep classnames runtime dependency")
assert(packageJson.dependencies.motion, "Card package must declare Motion as a runtime dependency")
assert(packageJson.peerDependencies.react, "Card package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Card package must keep React DOM peer dependency")

assert(packet.name === "card", "Card packet must describe the card item")
assert(packet.type === "component", "Card packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Card packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Card packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#card-next-candidate-planning-checkpoint"),
  "Card packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Card packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Card packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Card packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Card" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Card/Card.tsx",
  ),
  "Card packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "CardProps" &&
      publicExport.localName === "TCardProps" &&
      publicExport.sourcePath === "packages/react/src/components/Card/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Card packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Card packet must depend on default theme")
assert(packet.registryDependencies.length === 1, "Card packet must not pull additional registry dependencies")
assert(!packet.registryDependencies.includes("theme/card-compatibility"), "Card must not need a bridge item")
assert(!packet.peerDependencies["react-aria-components"], "Card packet must not declare a React Aria peer")
assert(packet.runtimeDependencies.classnames, "Card packet must declare classnames runtime dependency")
assert(packet.runtimeDependencies.motion, "Card packet must declare Motion runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "Card packet must record default-contract theme pressure")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Card packet must record ${cssVariable}`)
})
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--distance_3") && resolution.replacementSource === "--aui-space-3",
  ),
  "Card packet must record distance alias rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) => resolution.importSource.includes("--shadow_1") && resolution.replacementSource === "--aui-shadow-1",
  ),
  "Card packet must record shadow alias rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Cards/ArtistCard/ArtistCard.tsx"),
  "ArtistCard must stay out",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Filtering/FilterClauseRow/FilterClauseRow.tsx",
  ),
  "Filtering source must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/VisualUtilities/Indicator/Indicator.tsx"),
  "Indicator must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/SortParameterList/SortParameterList.tsx"),
  "SortParameterList must stay out",
)
assert(
  packet.notes.some((note) => note.includes("Motion-backed layout primitive proof")),
  "Packet must record Card scope",
)

assert(
  packetWrapperSource.includes("cardIngestPacketData as TRegistryIngestPacket"),
  "Card packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { cardIngestPacket } from "./card-ingest-packet"'),
  "Registry index must export Card ingest packet",
)

console.log("[card-proof] verified Card source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
