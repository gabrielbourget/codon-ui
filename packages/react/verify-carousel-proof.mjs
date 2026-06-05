import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const componentRoot = path.join(packageRoot, "src/components/Carousel")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageIndexPath = path.join(componentRoot, "index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/carousel-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/carousel-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")

const fail = (message) => {
  console.error(`[carousel-proof] ${message}`)
  process.exitCode = 1
}

const assert = (condition, message) => {
  if (!condition) fail(message)
}

const readRequiredText = (filePath) => {
  assert(existsSync(filePath), `missing ${path.relative(packageRoot, filePath)}`)

  return readFileSync(filePath, "utf8")
}

const runtimeFilePaths = [
  "Carousel.tsx",
  "helpers.ts",
  "CarouselStyles.module.css",
  "components/CarouselDots/CarouselDots.tsx",
  "components/CarouselDots/helpers.tsx",
  "components/CarouselDots/CarouselDotsStyles.module.css",
  "components/CarouselCounter/CarouselCounter.tsx",
  "components/CarouselCounter/helpers.ts",
  "components/CarouselCounter/CarouselCounterStyles.module.css",
  "components/CarouselPrevButton/CarouselPrevButton.tsx",
  "components/CarouselPrevButton/helpers.tsx",
  "components/CarouselPrevButton/DefaultPrevIcon.tsx",
  "components/CarouselNextButton/CarouselNextButton.tsx",
  "components/CarouselNextButton/helpers.tsx",
  "components/CarouselNextButton/DefaultNextIcon.tsx",
  "components/CarouselCloseButton/CarouselCloseButton.tsx",
  "components/CarouselCloseButton/helpers.tsx",
  "components/CarouselCloseButton/DefaultCloseIcon.tsx",
]
const forbiddenConsumerImportsPattern =
  /@wavemap|i18n|next\/|router|route|MediaCarousel|query|api-contract|shared-utils|@\/src\/|@radix-ui|@internationalized\/date/u
const forbiddenLegacyCssPattern =
  /--distance_|--focus-ring-color|--shadow_|--opacityTransition|theme\/carousel-compatibility/u

const runtimeSources = runtimeFilePaths.map((relativePath) => ({
  relativePath,
  source: readRequiredText(path.join(componentRoot, relativePath)),
}))
const carouselSource = runtimeSources.find((file) => file.relativePath === "Carousel.tsx")?.source ?? ""
const helpersSource = runtimeSources.find((file) => file.relativePath === "helpers.ts")?.source ?? ""
const dotsSource =
  runtimeSources.find((file) => file.relativePath === "components/CarouselDots/CarouselDots.tsx")?.source ?? ""
const dotsHelpersSource =
  runtimeSources.find((file) => file.relativePath === "components/CarouselDots/helpers.tsx")?.source ?? ""
const dotsStylesSource =
  runtimeSources.find((file) => file.relativePath === "components/CarouselDots/CarouselDotsStyles.module.css")
    ?.source ?? ""
const counterStylesSource =
  runtimeSources.find((file) => file.relativePath === "components/CarouselCounter/CarouselCounterStyles.module.css")
    ?.source ?? ""
const packageIndexSource = readRequiredText(packageIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

runtimeSources.forEach(({ relativePath, source }) => {
  assert(!forbiddenConsumerImportsPattern.test(source), `${relativePath} must not import consumer-only modules`)
})

assert(carouselSource.includes('from "embla-carousel-react"'), "Carousel must import Embla React")
assert(helpersSource.includes('from "embla-carousel"'), "Carousel helpers must import Embla types")
assert(helpersSource.includes("export const clamp"), "Carousel must localize clamp support")
assert(dotsHelpersSource.includes('from "../../helpers"'), "CarouselDots must use package-local helper imports")
assert(dotsSource.includes('styles["sr-only"]'), "CarouselDots must use CSS-module sr-only class")
;[dotsStylesSource, counterStylesSource].forEach((source) => {
  assert(!forbiddenLegacyCssPattern.test(source), "Carousel CSS must not read legacy Wavemap aliases")
})
;[
  "var(--aui-space-1)",
  "var(--aui-focus-ring)",
  "var(--aui-shadow-1)",
  "var(--aui-control-border)",
  "var(--aui-control-selected-background)",
  "var(--aui-surface)",
  "opacity 250ms ease",
].forEach((cssValue) => {
  const source = cssValue === "var(--aui-surface)" ? counterStylesSource : dotsStylesSource + counterStylesSource
  assert(source.includes(cssValue), `Carousel CSS must read ${cssValue}`)
})
;[
  "--aui-space-1",
  "--aui-focus-ring",
  "--aui-shadow-1",
  "--aui-control-border",
  "--aui-control-selected-background",
  "--aui-surface",
].forEach((cssVariable) => {
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})

assert(
  packageIndexSource.includes('export { default as Carousel } from "./Carousel"'),
  "Carousel index must export root",
)
;["CarouselDots", "CarouselCounter", "CarouselPrevButton", "CarouselNextButton", "CarouselCloseButton"].forEach(
  (exportedName) => {
    assert(packageIndexSource.includes(`default as ${exportedName}`), `Carousel index must export ${exportedName}`)
    assert(publicIndexSource.includes(exportedName), `Package index must export ${exportedName}`)
  },
)
assert(publicIndexSource.includes("CarouselProps"), "Package index must export CarouselProps")
assert(!publicIndexSource.includes("TCarouselProps"), "Package index must not export Carousel internals directly")

assert(packageJson.dependencies.classnames, "Carousel package must keep classnames runtime dependency")
assert(packageJson.dependencies["embla-carousel"], "Carousel package must declare embla-carousel dependency")
assert(
  packageJson.dependencies["embla-carousel-react"],
  "Carousel package must declare embla-carousel-react dependency",
)
assert(packageJson.peerDependencies.react, "Carousel package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Carousel package must keep React DOM peer dependency")

assert(packet.name === "carousel", "Carousel packet must describe the carousel item")
assert(packet.type === "component", "Carousel packet must remain a component packet")
assert(packet.sourceRepository === "wavemap", "Carousel packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#carousel-next-candidate-planning-checkpoint"),
  "Carousel packet must point at the Wavemap planning checkpoint",
)
runtimeFilePaths.forEach((relativePath) => {
  const sourcePath = `packages/react/src/components/Carousel/${relativePath}`
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Carousel packet must include ${sourcePath}`,
  )
})
assert(packet.registryDependencies.includes("theme-css"), "Carousel packet must depend on default theme")
;["button", "counter", "text"].forEach((dependencyName) => {
  assert(packet.registryDependencies.includes(dependencyName), `Carousel packet must depend on ${dependencyName}`)
})
assert(!packet.registryDependencies.includes("theme/carousel-compatibility"), "Carousel must not need a bridge item")
assert(packet.runtimeDependencies.classnames, "Carousel packet must declare classnames runtime dependency")
assert(packet.runtimeDependencies["embla-carousel"], "Carousel packet must declare embla-carousel runtime dependency")
assert(
  packet.runtimeDependencies["embla-carousel-react"],
  "Carousel packet must declare embla-carousel-react runtime dependency",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Carousels/MediaCarousel/MediaCarousel.tsx",
  ),
  "MediaCarousel must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Carousel/testUtils/emblaTestHarness.tsx"),
  "Carousel test harness must stay out",
)
assert(
  packet.notes.some((note) => note.includes("Embla-backed nested component-family proof")),
  "Packet must record scope",
)

assert(
  packetWrapperSource.includes("carouselIngestPacketData as TRegistryIngestPacket"),
  "Carousel packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { carouselIngestPacket } from "./carousel-ingest-packet"'),
  "Registry index must export Carousel ingest packet",
)

console.log("[carousel-proof] verified Carousel source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
