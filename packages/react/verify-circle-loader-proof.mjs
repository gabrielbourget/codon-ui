import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const circleLoaderRoot = path.join(packageRoot, "src/components/CircleLoader")
const circleLoaderSourcePath = path.join(circleLoaderRoot, "CircleLoader.tsx")
const circleLoaderStylesPath = path.join(circleLoaderRoot, "CircleLoaderStyles.module.css")
const circleLoaderIndexPath = path.join(circleLoaderRoot, "index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/circle-loader-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/circle-loader-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[circle-loader-proof] ${message}`)
  process.exitCode = 1
}

const assert = (condition, message) => {
  if (!condition) fail(message)
}

const readRequiredText = (filePath) => {
  assert(existsSync(filePath), `missing ${path.relative(packageRoot, filePath)}`)

  return readFileSync(filePath, "utf8")
}

const forbiddenSourcePattern =
  /@wavemap|@\/src\/|next\/|router|route|i18n|media|api-contract|shared-utils|react-aria|motion|UIContext|theme\//u
const requiredPackageFileSources = [
  "packages/react/src/components/CircleLoader/CircleLoader.tsx",
  "packages/react/src/components/CircleLoader/CircleLoaderStyles.module.css",
]
const requiredTargetPaths = [
  "Loaders/CircleLoader/CircleLoader.tsx",
  "Loaders/CircleLoader/CircleLoaderStyles.module.css",
]

const circleLoaderSource = readRequiredText(circleLoaderSourcePath)
const circleLoaderStylesSource = readRequiredText(circleLoaderStylesPath)
const circleLoaderIndexSource = readRequiredText(circleLoaderIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(circleLoaderSource.startsWith('"use client"'), "CircleLoader must preserve the client boundary")
assert(!forbiddenSourcePattern.test(circleLoaderSource), "CircleLoader source must not import consumer-only modules")
assert(!forbiddenSourcePattern.test(circleLoaderStylesSource), "CircleLoader CSS must not import consumer-only modules")
assert(circleLoaderSource.includes('role="status"'), "CircleLoader must keep accessible status role")
assert(circleLoaderSource.includes('ariaLabel = "Loading"'), "CircleLoader must keep default loading label")
assert(
  circleLoaderSource.includes('"--size": formatDimension(size, "24px")'),
  "CircleLoader must format size custom property",
)
assert(
  circleLoaderSource.includes('"--duration": typeof duration === "number" ? `${duration}ms` : duration'),
  "CircleLoader must format numeric duration values",
)
assert(
  circleLoaderSource.includes('spinnerColor = "currentColor"'),
  "CircleLoader default spinner color must inherit currentColor",
)
assert(
  circleLoaderStylesSource.includes("var(--spinner-color)"),
  "CircleLoader CSS must consume local spinner color custom property",
)
assert(!circleLoaderStylesSource.includes("--aui-"), "CircleLoader CSS must not require global theme variables")
assert(
  circleLoaderIndexSource.includes('export { default as CircleLoader } from "./CircleLoader"'),
  "CircleLoader index must export the component",
)
assert(
  circleLoaderIndexSource.includes("TCircleLoaderProps as CircleLoaderProps"),
  "CircleLoader index must export props",
)
assert(
  publicIndexSource.includes('export { CircleLoader } from "./components/CircleLoader"'),
  "Package root must export CircleLoader",
)
assert(publicIndexSource.includes("CircleLoaderProps"), "Package root must export CircleLoaderProps")
assert(!publicIndexSource.includes("formatDimension"), "Package root must not export CircleLoader internals")

assert(packet.name === "circle-loader", "CircleLoader packet must describe the circle-loader item")
assert(packet.type === "component", "CircleLoader packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "CircleLoader packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "CircleLoader packet must record Wavemap source")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#loader-components-next-candidate-planning-checkpoint"),
  "CircleLoader packet must point at the loader planning checkpoint",
)
requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `CircleLoader packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `CircleLoader packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "CircleLoader packet tests must remain optional evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) => publicExport.exportedName === "CircleLoader" && publicExport.localName === "default",
  ),
  "CircleLoader packet must document component export",
)
assert(
  packet.publicExports.some(
    (publicExport) => publicExport.exportedName === "CircleLoaderProps" && publicExport.typeOnly === true,
  ),
  "CircleLoader packet must document props export",
)
assert(packet.registryDependencies.length === 0, "CircleLoader must not require registry dependencies")
assert(packet.themeRequirements.length === 0, "CircleLoader must not require theme support")
assert(packet.peerDependencies.react, "CircleLoader packet must declare React peer dependency")
assert(!packet.peerDependencies["react-dom"], "CircleLoader packet must not declare React DOM peer dependency")
assert(!packet.peerDependencies["react-aria-components"], "CircleLoader packet must not declare React Aria peer")
assert(
  Object.keys(packet.runtimeDependencies).length === 0,
  "CircleLoader packet must not declare runtime dependencies",
)
assert(packetWrapperSource.includes("circleLoaderIngestPacket"), "CircleLoader packet wrapper must export typed packet")
assert(
  registryIndexSource.includes('export { circleLoaderIngestPacket } from "./circle-loader-ingest-packet"'),
  "Registry index must export CircleLoader packet",
)
assert(packageJson.peerDependencies.react, "Package must declare React peer dependency")
assert(
  packageJson.scripts.test.includes("verify-circle-loader-proof.mjs"),
  "Package test script must run CircleLoader proof",
)

if (process.exitCode) process.exit(process.exitCode)

console.log("[circle-loader-proof] verified CircleLoader source receipt packet")
