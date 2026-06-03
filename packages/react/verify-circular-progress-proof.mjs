import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const circularProgressSourcePath = path.join(packageRoot, "src/components/CircularProgress/CircularProgress.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/CircularProgress/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/CircularProgress/CircularProgressStyles.module.css")
const pathSourcePath = path.join(packageRoot, "src/components/CircularProgress/Path/Path.tsx")
const pathHelpersSourcePath = path.join(packageRoot, "src/components/CircularProgress/Path/helpers.ts")
const compatibilityBridgePath = path.join(
  packageRoot,
  "src/components/CircularProgress/circular-progress-compatibility.css",
)
const circularProgressIndexPath = path.join(packageRoot, "src/components/CircularProgress/index.ts")
const svgTokensPath = path.join(packageRoot, "src/tokens/svg.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/circular-progress-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/circular-progress-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[circular-progress-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\/|Switzer|motion\/react/u
const circularProgressSource = readRequiredText(circularProgressSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const pathSource = readRequiredText(pathSourcePath)
const pathHelpersSource = readRequiredText(pathHelpersSourcePath)
const compatibilityBridgeSource = readRequiredText(compatibilityBridgePath)
const circularProgressIndexSource = readRequiredText(circularProgressIndexPath)
const svgTokensSource = readRequiredText(svgTokensPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/CircularProgress/CircularProgress.tsx",
  "packages/react/src/components/CircularProgress/helpers.ts",
  "packages/react/src/components/CircularProgress/CircularProgressStyles.module.css",
  "packages/react/src/components/CircularProgress/Path/Path.tsx",
  "packages/react/src/components/CircularProgress/Path/helpers.ts",
  "packages/react/src/components/CircularProgress/__tests__/CircularProgress.test.tsx",
]
const requiredTargetPaths = [
  "CircularProgress/CircularProgress.tsx",
  "CircularProgress/helpers.ts",
  "CircularProgress/CircularProgressStyles.module.css",
  "CircularProgress/Path/Path.tsx",
  "CircularProgress/Path/helpers.ts",
  "CircularProgress/__tests__/CircularProgress.test.tsx",
]
const requiredStyleSelectors = [
  ".circularProgress",
  ".circularProgress__svg",
  ".circularProgress__path",
  ".circularProgress__track",
  ".circularProgress__text",
  ".circularProgress__background",
  ".circularProgress__path--primary",
  ".circularProgress__path--quintenary",
]
const requiredCompatibilityAliases = [
  "--aui-color-primary-500",
  "--aui-color-secondary-500",
  "--aui-color-tertiary-500",
  "--aui-color-quaternary-500",
  "--aui-color-quintenary-500",
]

assert(
  circularProgressSource.startsWith('"use client"'),
  "CircularProgress must preserve the client component boundary",
)
assert(
  circularProgressSource.includes('import { ProgressBar as AdobeProgressBar } from "react-aria-components"'),
  "CircularProgress must use the React Aria ProgressBar primitive",
)
assert(
  circularProgressSource.includes('from "../../tokens/svg"'),
  "CircularProgress source must import package-local SVG tokens",
)
assert(
  helpersSource.includes('from "../../tokens/svg"'),
  "CircularProgress helpers must import package-local SVG tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "CircularProgress helpers must import package-local theme-order tokens",
)
assert(
  pathHelpersSource.includes('from "../../../tokens/svg"'),
  "CircularProgress path helpers must import package-local SVG tokens",
)
assert(helpersSource.includes("export type TCircularProgressProps"), "CircularProgress helpers must export local props")
assert(
  helpersSource.includes("export const calibrateComponent"),
  "CircularProgress calibration helper must remain local",
)
assert(circularProgressSource.includes('data-testid={dataTestID ?? "circular-progress"}'), "Root test id must stay")
assert(circularProgressSource.includes('CircularProgress.displayName = "CircularProgress"'), "Display name must be set")
assert(pathSource.includes("computeDashStyle"), "Path must preserve dash-style helper usage")
assert(pathHelpersSource.includes("computePathDescription"), "Path helpers must preserve path description helper")
assert(pathHelpersSource.includes("strokeDasharray"), "Path helpers must preserve stroke dash style computation")
assert(svgTokensSource.includes("VIEWBOX_CENTER_X"), "SVG token support must include viewBox center constants")
assert(svgTokensSource.includes("AVAILABLE_STROKE_LINECAPS"), "SVG token support must include stroke-linecap options")
assert(svgTokensSource.includes("as const"), "SVG token support must preserve literal stroke-linecap types")
;[
  circularProgressSource,
  helpersSource,
  stylesSource,
  pathSource,
  pathHelpersSource,
  compatibilityBridgeSource,
].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "CircularProgress runtime source must not import consumer-only modules",
  )
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `CircularProgress CSS module must include ${selector}`)
})
requiredCompatibilityAliases.forEach((cssVariable) => {
  assert(
    compatibilityBridgeSource.includes(cssVariable),
    `CircularProgress compatibility bridge must define ${cssVariable}`,
  )
})
assert(
  stylesSource.includes("var(--aui-font-family-body, sans-serif)"),
  "CircularProgress text must use neutral typography fallback",
)
assert(stylesSource.includes("var(--aui-surface-muted)"), "CircularProgress styles must read surface-muted role")
assert(
  stylesSource.includes("var(--aui-control-selected-background)"),
  "CircularProgress styles must read selected control role",
)

assert(
  publicIndexSource.includes('export { CircularProgress } from "./components/CircularProgress"'),
  "Package index must export CircularProgress",
)
assert(
  publicIndexSource.includes('export type { CircularProgressProps } from "./components/CircularProgress"'),
  "Package index must export CircularProgressProps",
)
assert(!publicIndexSource.includes("computeDashStyle"), "Package index must not export SVG/path internals")
assert(
  circularProgressIndexSource.includes('export { default as CircularProgress } from "./CircularProgress"'),
  "CircularProgress index must export the component",
)
assert(
  circularProgressIndexSource.includes("TCircularProgressProps as CircularProgressProps"),
  "CircularProgress index must export props alias",
)
assert(!circularProgressIndexSource.includes("calibrateComponent"), "CircularProgress index must not export internals")

assert(packet.name === "circular-progress", "CircularProgress packet must describe the circular-progress item")
assert(packet.type === "component", "CircularProgress packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "CircularProgress packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "CircularProgress packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#circularprogress-next-candidate-planning-checkpoint"),
  "CircularProgress packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `CircularProgress packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `CircularProgress packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "CircularProgress packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "CircularProgress" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/CircularProgress/CircularProgress.tsx",
  ),
  "CircularProgress packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "CircularProgressProps" &&
      publicExport.localName === "TCircularProgressProps" &&
      publicExport.sourcePath === "packages/react/src/components/CircularProgress/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "CircularProgress packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "CircularProgress packet must depend on default theme")
assert(
  packet.registryDependencies.includes("theme/circular-progress-compatibility"),
  "CircularProgress packet must include the proof compatibility bridge",
)
assert(packet.registryDependencies.includes("tokens/svg"), "CircularProgress packet must depend on SVG tokens")
assert(
  packet.registryDependencies.includes("tokens/theme-order"),
  "CircularProgress packet must depend on theme-order tokens",
)
assert(!packet.registryDependencies.includes("text"), "CircularProgress packet must not copy or depend on Text")
assert(packet.peerDependencies.react, "CircularProgress packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "CircularProgress packet must declare React DOM peer dependency")
assert(
  packet.peerDependencies["react-aria-components"],
  "CircularProgress packet must declare React Aria Components peer dependency",
)
assert(packet.runtimeDependencies.classnames, "CircularProgress packet must declare classnames runtime dependency")

const compatibilityBridgeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "proof-compatibility-bridge",
)
assert(compatibilityBridgeRequirement, "CircularProgress packet must record proof compatibility bridge pressure")
requiredCompatibilityAliases.forEach((cssVariable) => {
  assert(
    compatibilityBridgeRequirement.cssVariables.includes(cssVariable),
    `CircularProgress packet must record bridge pressure for ${cssVariable}`,
  )
})
assert(
  compatibilityBridgeRequirement.files.some(
    (file) => file.sourcePath === "packages/react/src/components/CircularProgress/circular-progress-compatibility.css",
  ),
  "CircularProgress packet must point at the separate compatibility bridge",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/svg",
  ),
  "CircularProgress packet must record SVG token import rewrites",
)
assert(
  packet.importResolutions.some(
    (resolution) => resolution.replacementSource === "var(--aui-font-family-body, sans-serif)",
  ),
  "CircularProgress packet must record typography neutralization",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @amino-ui/react test"),
  "CircularProgress packet must point at package proof harness",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @amino-ui/react typecheck"),
  "CircularProgress packet must point at package typecheck verification",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a circular-progress manifest item")),
  "CircularProgress packet must keep manifest activation separate from source receipt",
)
assert(
  packetWrapperSource.includes("circularProgressIngestPacketData") &&
    packetWrapperSource.includes("circular-progress-ingest-packet.data.json"),
  "CircularProgress packet wrapper must import packet data",
)
assert(
  registryIndexSource.includes("circularProgressIngestPacket"),
  "Registry index must export the CircularProgress ingest packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[circular-progress-proof] source receipt proof passed")
