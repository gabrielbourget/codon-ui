import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const thumbnailImageRoot = path.join(packageRoot, "src/components/ThumbnailImage")
const thumbnailImageSourcePath = path.join(thumbnailImageRoot, "ThumbnailImage.tsx")
const thumbnailImageIndexPath = path.join(thumbnailImageRoot, "index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/thumbnail-image-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/thumbnail-image-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const manifestPath = path.join(packageRoot, "src/registry/manifest.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[thumbnail-image-proof] ${message}`)
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
  /@wavemap|next\/|router|route|media|api-contract|shared-utils|localStorage|@\/src\/|classnames|react-aria|\.module\.css/u

const thumbnailImageSource = readRequiredText(thumbnailImageSourcePath)
const thumbnailImageIndexSource = readRequiredText(thumbnailImageIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const manifestSource = readRequiredText(manifestPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = ["packages/react/src/components/ThumbnailImage/ThumbnailImage.tsx"]
const requiredTargetPaths = ["ThumbnailImage/ThumbnailImage.tsx"]
const expectedPublicExports = [
  "ThumbnailImage",
  "ThumbnailImageProps",
  "ThumbnailImageErrorHandler",
  "ThumbnailImageRenderImageArgs",
  "ThumbnailImageRenderImageProps",
]

assert(thumbnailImageSource.startsWith('"use client"'), "ThumbnailImage must preserve the client boundary")
assert(
  thumbnailImageSource.includes("createElement") &&
    thumbnailImageSource.includes('createElement("img", resolvedImageProps)'),
  "ThumbnailImage must keep the native img default renderer",
)
assert(thumbnailImageSource.includes("renderImage?:"), "ThumbnailImage must expose injected renderer support")
assert(thumbnailImageSource.includes("srcCandidates?:"), "ThumbnailImage must expose source-candidate fallback support")
assert(
  thumbnailImageSource.includes("JSON.stringify(resolvedSrcCandidates)"),
  "ThumbnailImage must key fallback resets by candidate contents",
)
assert(
  thumbnailImageSource.includes("setSrcCandidateIndex((currentIndex) => currentIndex + 1)"),
  "ThumbnailImage must advance through source candidates after image errors",
)
assert(
  thumbnailImageSource.includes("if (!resolvedSrc) return <>{fallback}</>"),
  "ThumbnailImage must render fallback after candidates are exhausted",
)
assert(!forbiddenConsumerImportsPattern.test(thumbnailImageSource), "ThumbnailImage source must stay consumer-neutral")
assert(!thumbnailImageSource.includes('from "next/image"'), "ThumbnailImage must not import Next image")
assert(!thumbnailImageSource.includes("TMedia"), "ThumbnailImage must not depend on Wavemap media types")

assert(
  thumbnailImageIndexSource.includes('export { default as ThumbnailImage } from "./ThumbnailImage"'),
  "ThumbnailImage index must export the component",
)
for (const exportName of expectedPublicExports.slice(1)) {
  assert(thumbnailImageIndexSource.includes(exportName), `ThumbnailImage index must export ${exportName}`)
}
assert(
  publicIndexSource.includes('export { ThumbnailImage } from "./components/ThumbnailImage"'),
  "Package root index must export ThumbnailImage",
)
for (const exportName of expectedPublicExports.slice(1)) {
  assert(publicIndexSource.includes(exportName), `Package root index must export ${exportName}`)
}

assert(packet.name === "thumbnail-image", "ThumbnailImage packet must describe the public item")
assert(packet.type === "component", "ThumbnailImage packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "ThumbnailImage packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "ThumbnailImage packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#thumbnailimage-extraction-planning-checkpoint"),
  "ThumbnailImage packet must point at the Wavemap planning checkpoint",
)
assert(
  packet.files.length === requiredPackageFileSources.length,
  "ThumbnailImage packet must list only approved source",
)
for (const requiredSourcePath of requiredPackageFileSources) {
  assert(
    packet.files.some((file) => file.sourcePath === requiredSourcePath),
    `ThumbnailImage packet must list ${requiredSourcePath}`,
  )
}
for (const requiredTargetPath of requiredTargetPaths) {
  assert(
    packet.files.some((file) => file.targetPath === requiredTargetPath),
    `ThumbnailImage packet must target ${requiredTargetPath}`,
  )
}
assert(
  packet.files.every((file) => file.role === "source"),
  "ThumbnailImage packet must not include styles or tests",
)
for (const exportName of expectedPublicExports) {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportName),
    `ThumbnailImage packet must document ${exportName} public export`,
  )
}
assert(packet.registryDependencies.length === 0, "ThumbnailImage packet must not declare registry dependencies")
assert(
  Object.keys(packet.runtimeDependencies).length === 0,
  "ThumbnailImage packet must not declare runtime dependencies",
)
assert(packet.peerDependencies.react, "ThumbnailImage packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "ThumbnailImage packet must declare React DOM peer dependency")
assert(!packet.peerDependencies.next, "ThumbnailImage packet must not declare Next peer dependency")
assert(
  !packet.peerDependencies["react-aria-components"],
  "ThumbnailImage packet must not declare React Aria peer dependency",
)
assert(packet.themeRequirements.length === 0, "ThumbnailImage packet must not declare theme requirements")
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/MediaThumbnailImage/**"),
  "ThumbnailImage packet must exclude the Wavemap MediaThumbnailImage adapter",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/utils/media/**"),
  "ThumbnailImage packet must exclude Wavemap media helpers",
)

assert(
  packetWrapperSource.includes("thumbnailImageIngestPacketData") &&
    packetWrapperSource.includes("TRegistryIngestPacket"),
  "ThumbnailImage packet wrapper must expose typed packet data",
)
assert(
  registryIndexSource.includes('export { thumbnailImageIngestPacket } from "./thumbnail-image-ingest-packet"'),
  "Registry index must export ThumbnailImage packet",
)
assert(manifestSource.includes('name: "thumbnail-image"'), "ThumbnailImage manifest item must be active")
for (const requiredSourcePath of requiredPackageFileSources) {
  assert(
    manifestSource.includes(`sourcePath: "${requiredSourcePath}"`),
    `ThumbnailImage manifest must list ${requiredSourcePath}`,
  )
}
assert(
  manifestSource.includes('targetPath: "ThumbnailImage/ThumbnailImage.tsx"'),
  "ThumbnailImage manifest must target the component source path",
)
assert(
  packageJson.scripts.test.includes("verify-thumbnail-image-proof.mjs"),
  "Package test script must run ThumbnailImage proof",
)

if (process.exitCode) process.exit(process.exitCode)

console.log("[thumbnail-image-proof] verified ThumbnailImage source receipt packet")
