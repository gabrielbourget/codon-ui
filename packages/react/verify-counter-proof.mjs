import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const counterSourcePath = path.join(packageRoot, "src/components/Counter/Counter.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Counter/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Counter/CounterStyles.module.css")
const counterIndexPath = path.join(packageRoot, "src/components/Counter/index.ts")
const a11yTokensPath = path.join(packageRoot, "src/tokens/a11y.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/counter-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/counter-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[counter-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\/|motion\/react|@radix-ui/u
const counterSource = readRequiredText(counterSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const counterIndexSource = readRequiredText(counterIndexPath)
const a11yTokensSource = readRequiredText(a11yTokensPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/Counter/Counter.tsx",
  "packages/react/src/components/Counter/helpers.ts",
  "packages/react/src/components/Counter/CounterStyles.module.css",
  "packages/react/src/components/Counter/__tests__/Counter.test.tsx",
]
const requiredTargetPaths = [
  "Counter/Counter.tsx",
  "Counter/helpers.ts",
  "Counter/CounterStyles.module.css",
  "Counter/__tests__/Counter.test.tsx",
]
const requiredStyleSelectors = [".counter", ".counter__textRow", ".counter > :empty"]

assert(
  counterSource.includes("forwardRef<HTMLDivElement, TCounterProps>"),
  "Counter must forward an HTMLDivElement ref",
)
assert(counterSource.includes('data-testid={dataTestID ?? "counter"}'), "Counter root test id fallback must stay")
assert(counterSource.includes('from "../Text/Text"'), "Counter must import installed package-local Text")
assert(
  counterSource.includes('from "../CircularProgress/CircularProgress"'),
  "Counter must import installed package-local CircularProgress",
)
assert(
  counterSource.includes("showProgressIndicator && maxValue"),
  "Counter must keep optional progress indicator gate",
)
assert(counterSource.includes("data-progressindicator"), "Counter must preserve progress indicator marker")
assert(counterSource.includes('Counter.displayName = "Counter"'), "Counter display name must be set")

assert(helpersSource.includes('from "../../tokens/a11y"'), "Counter helpers must import package-local a11y tokens")
assert(helpersSource.includes("export type TCounterProps"), "Counter helpers must export local props")
assert(helpersSource.includes("export const calibrateComponent"), "Counter calibration helper must remain local")
assert(
  helpersSource.includes("var(--cui-status-warning, var(--cui-state-warning))"),
  "Counter warning status must keep Wavemap alias with default theme fallback",
)
assert(
  helpersSource.includes("var(--cui-status-danger, var(--cui-state-danger))"),
  "Counter danger status must keep Wavemap alias with default theme fallback",
)
assert(!helpersSource.includes("--warningState"), "Counter helpers must not read legacy warning aliases")
assert(!helpersSource.includes("--errorOrDangerState"), "Counter helpers must not read legacy danger aliases")
;[counterSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Counter runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Counter CSS module must include ${selector}`)
})
assert(stylesSource.includes("var(--cui-space-1)"), "Counter CSS must read default spacing token")
assert(stylesSource.includes("var(--cui-transition-color)"), "Counter CSS must read default transition token")
assert(!stylesSource.includes("--distance_1"), "Counter CSS must not read legacy distance alias")
assert(!stylesSource.includes("--colorTransition"), "Counter CSS must not read legacy transition alias")

assert(a11yTokensSource.includes("TAriaLabelingProps"), "A11y token support must export TAriaLabelingProps")
assert(a11yTokensSource.includes('"aria-label"?: string'), "A11y token support must include native aria-label")
assert(a11yTokensSource.includes("ariaLabelledBy?: string"), "A11y token support must include alias props")

assert(
  publicIndexSource.includes('export { Counter } from "./components/Counter"'),
  "Package index must export Counter",
)
assert(
  publicIndexSource.includes('export type { CounterProps } from "./components/Counter"'),
  "Package index must export CounterProps",
)
assert(!publicIndexSource.includes("computeStatusColor"), "Package index must not export Counter internals")
assert(
  counterIndexSource.includes('export { default as Counter } from "./Counter"'),
  "Counter index must export component",
)
assert(counterIndexSource.includes("TCounterProps as CounterProps"), "Counter index must export props alias")
assert(!counterIndexSource.includes("calibrateComponent"), "Counter index must not export internals")

assert(packet.name === "counter", "Counter packet must describe the counter item")
assert(packet.type === "component", "Counter packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Counter packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Counter packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#counter-next-candidate-planning-checkpoint"),
  "Counter packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Counter packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Counter packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Counter packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Counter" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Counter/Counter.tsx",
  ),
  "Counter packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "CounterProps" &&
      publicExport.localName === "TCounterProps" &&
      publicExport.sourcePath === "packages/react/src/components/Counter/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Counter packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Counter packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/a11y"), "Counter packet must depend on a11y tokens")
assert(packet.registryDependencies.includes("text"), "Counter packet must depend on installed Text")
assert(
  packet.registryDependencies.includes("circular-progress"),
  "Counter packet must depend on installed CircularProgress",
)
assert(!packet.registryDependencies.includes("theme/counter-compatibility"), "Counter must not need a bridge item")
assert(packet.peerDependencies.react, "Counter packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "Counter packet must declare React DOM peer dependency")
assert(!packet.peerDependencies["react-aria-components"], "Counter must inherit React Aria only transitively")
assert(packet.runtimeDependencies.classnames, "Counter packet must declare classnames runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "Counter packet must record default-contract theme pressure")
;["--cui-space-1", "--cui-transition-color", "--cui-state-warning", "--cui-state-danger"].forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Counter packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/CircularProgress/CircularProgress" &&
      resolution.registryDependencyName === "circular-progress",
  ),
  "Counter packet must record CircularProgress import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/Text" && resolution.registryDependencyName === "text",
  ),
  "Counter packet must record Text import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/a11y",
  ),
  "Counter packet must record a11y token import rewrite",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Carousel/components/CarouselCounter/CarouselCounter.tsx",
  ),
  "Counter packet must exclude CarouselCounter consumers",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Pagination/components/PageCounter/PageCounter.tsx",
  ),
  "Counter packet must exclude PageCounter consumers",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/LinearProgress/LinearProgress.tsx"),
  "Counter packet must exclude LinearProgress",
)

assert(packetWrapperSource.includes("counterIngestPacketData"), "Counter packet wrapper must import JSON data")
assert(registryIndexSource.includes('export { counterIngestPacket } from "./counter-ingest-packet"'))

if (process.exitCode) process.exit(process.exitCode)
console.log("[counter-proof] verified Counter source receipt packet")
