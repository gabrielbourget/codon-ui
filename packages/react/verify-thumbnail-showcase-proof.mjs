import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const componentRoot = path.join(packageRoot, "src/components/ThumbnailShowcase")
const componentSourcePath = path.join(componentRoot, "ThumbnailShowcase.tsx")
const helpersSourcePath = path.join(componentRoot, "helpers.ts")
const stylesSourcePath = path.join(componentRoot, "ThumbnailShowcaseStyles.module.css")
const componentIndexPath = path.join(componentRoot, "index.ts")
const packetPath = path.join(packageRoot, "src/registry/thumbnail-showcase-ingest-packet.data.json")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const manifestPath = path.join(packageRoot, "src/registry/manifest.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[thumbnail-showcase-proof] ${message}`)
  process.exitCode = 1
}

const assert = (condition, message) => {
  if (!condition) fail(message)
}

const readRequiredText = (filePath) => {
  assert(existsSync(filePath), `missing ${path.relative(packageRoot, filePath)}`)
  return readFileSync(filePath, "utf8")
}

const componentSource = readRequiredText(componentSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const componentIndexSource = readRequiredText(componentIndexPath)
const packet = JSON.parse(readRequiredText(packetPath))
const registryIndexSource = readRequiredText(registryIndexPath)
const manifestSource = readRequiredText(manifestPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))
const runtimeSource = `${componentSource}\n${helpersSource}\n${stylesSource}`
const forbiddenConsumerImportsPattern = /@wavemap|next\//u

assert(
  componentSource.includes("showSecondary && hasAvailableMedia"),
  "ThumbnailShowcase must suppress its secondary rail when no media is available",
)
assert(
  componentSource.includes("primaryContent ?? primaryPlaceholder"),
  "ThumbnailShowcase must retain primary fallback",
)
assert(componentSource.includes("renderOverflow"), "ThumbnailShowcase must delegate overflow presentation")
assert(helpersSource.includes("AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES"), "Rendering modes must be canonical")
assert(stylesSource.includes("gap: 10px"), "ThumbnailShowcase must own its portable layout spacing")
assert(!forbiddenConsumerImportsPattern.test(runtimeSource), "ThumbnailShowcase runtime must remain consumer-neutral")
assert(!runtimeSource.includes("TMediaItem"), "ThumbnailShowcase must not own a product media DTO")
assert(!runtimeSource.includes("useIsHydrated"), "ThumbnailShowcase must not own consumer hydration behavior")
assert(
  componentIndexSource.includes('export { default as ThumbnailShowcase } from "./ThumbnailShowcase"'),
  "Component index must export ThumbnailShowcase",
)
assert(
  publicIndexSource.includes("ThumbnailShowcase,\n  THUMBNAIL_SHOWCASE_RENDERING_MODE__ALL"),
  "Package index must export ThumbnailShowcase",
)
assert(packet.name === "thumbnail-showcase", "Ingest packet must describe ThumbnailShowcase")
assert(packet.registryDependencies.length === 0, "ThumbnailShowcase must not force a registry theme dependency")
assert(packet.runtimeDependencies.classnames, "ThumbnailShowcase must declare classnames")
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/MediaThumbnailImage/**"),
  "Wavemap media adapters must remain excluded",
)
assert(
  registryIndexSource.includes('export { thumbnailShowcaseIngestPacket } from "./thumbnail-showcase-ingest-packet"'),
  "Registry index must export the ingest packet",
)
assert(manifestSource.includes('name: "thumbnail-showcase"'), "Registry manifest must activate ThumbnailShowcase")
assert(
  packageJson.scripts.test.includes("verify-thumbnail-showcase-proof.mjs"),
  "Package tests must run the ThumbnailShowcase proof",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[thumbnail-showcase-proof] verified ThumbnailShowcase source and registry boundary")
