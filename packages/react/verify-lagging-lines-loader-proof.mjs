import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const laggingLinesLoaderRoot = path.join(packageRoot, "src/components/LaggingLinesLoader")
const laggingLinesLoaderSourcePath = path.join(laggingLinesLoaderRoot, "LaggingLinesLoader.tsx")
const laggingLinesLoaderHelpersPath = path.join(laggingLinesLoaderRoot, "helpers.ts")
const laggingLinesLoaderStylesPath = path.join(laggingLinesLoaderRoot, "LaggingLinesLoaderStyles.module.css")
const laggingLinesLoaderIndexPath = path.join(laggingLinesLoaderRoot, "index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/lagging-lines-loader-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/lagging-lines-loader-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[lagging-lines-loader-proof] ${message}`)
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
  "packages/react/src/components/LaggingLinesLoader/LaggingLinesLoader.tsx",
  "packages/react/src/components/LaggingLinesLoader/helpers.ts",
  "packages/react/src/components/LaggingLinesLoader/LaggingLinesLoaderStyles.module.css",
]
const requiredTargetPaths = [
  "Loaders/LaggingLinesLoader/LaggingLinesLoader.tsx",
  "Loaders/LaggingLinesLoader/helpers.ts",
  "Loaders/LaggingLinesLoader/LaggingLinesLoaderStyles.module.css",
]

const laggingLinesLoaderSource = readRequiredText(laggingLinesLoaderSourcePath)
const laggingLinesLoaderHelpersSource = readRequiredText(laggingLinesLoaderHelpersPath)
const laggingLinesLoaderStylesSource = readRequiredText(laggingLinesLoaderStylesPath)
const laggingLinesLoaderIndexSource = readRequiredText(laggingLinesLoaderIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const combinedSource = `${laggingLinesLoaderSource}\n${laggingLinesLoaderHelpersSource}\n${laggingLinesLoaderStylesSource}`

assert(laggingLinesLoaderSource.startsWith('"use client"'), "LaggingLinesLoader must preserve the client boundary")
assert(!forbiddenSourcePattern.test(combinedSource), "LaggingLinesLoader must not import consumer-only modules")
assert(laggingLinesLoaderSource.includes('from "./helpers"'), "LaggingLinesLoader must import local helpers only")
assert(
  laggingLinesLoaderSource.includes('"--width": formatDimension(width)'),
  "LaggingLinesLoader must format width custom property",
)
assert(
  laggingLinesLoaderHelpersSource.includes('import classnames from "classnames"'),
  "LaggingLinesLoader helpers must import classnames",
)
assert(
  laggingLinesLoaderHelpersSource.includes("formatDuration(duration)"),
  "LaggingLinesLoader must format numeric duration values",
)
assert(
  laggingLinesLoaderStylesSource.includes("background: currentcolor"),
  "LaggingLinesLoader CSS must default to currentcolor",
)
assert(
  !laggingLinesLoaderStylesSource.includes("var(--foreground)"),
  "LaggingLinesLoader CSS must not read Wavemap foreground alias",
)
assert(
  !laggingLinesLoaderStylesSource.includes("--aui-"),
  "LaggingLinesLoader CSS must not require global theme variables",
)
assert(
  laggingLinesLoaderIndexSource.includes('export { default as LaggingLinesLoader } from "./LaggingLinesLoader"'),
  "LaggingLinesLoader index must export the component",
)
assert(
  laggingLinesLoaderIndexSource.includes("TLaggingLinesLoaderProps as LaggingLinesLoaderProps"),
  "LaggingLinesLoader index must export props",
)
assert(
  publicIndexSource.includes('export { LaggingLinesLoader } from "./components/LaggingLinesLoader"'),
  "Package root must export LaggingLinesLoader",
)
assert(publicIndexSource.includes("LaggingLinesLoaderProps"), "Package root must export LaggingLinesLoaderProps")
assert(!publicIndexSource.includes("formatDimension"), "Package root must not export LaggingLinesLoader internals")

assert(packet.name === "lagging-lines-loader", "LaggingLinesLoader packet must describe the lagging-lines-loader item")
assert(packet.type === "component", "LaggingLinesLoader packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "LaggingLinesLoader packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "LaggingLinesLoader packet must record Wavemap source")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#loader-components-next-candidate-planning-checkpoint"),
  "LaggingLinesLoader packet must point at the loader planning checkpoint",
)
requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `LaggingLinesLoader packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `LaggingLinesLoader packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "LaggingLinesLoader packet tests must remain optional evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) => publicExport.exportedName === "LaggingLinesLoader" && publicExport.localName === "default",
  ),
  "LaggingLinesLoader packet must document component export",
)
assert(
  packet.publicExports.some(
    (publicExport) => publicExport.exportedName === "LaggingLinesLoaderProps" && publicExport.typeOnly === true,
  ),
  "LaggingLinesLoader packet must document props export",
)
assert(packet.registryDependencies.length === 0, "LaggingLinesLoader must not require registry dependencies")
assert(packet.themeRequirements.length === 0, "LaggingLinesLoader must not require theme support")
assert(packet.peerDependencies.react, "LaggingLinesLoader packet must declare React peer dependency")
assert(!packet.peerDependencies["react-dom"], "LaggingLinesLoader packet must not declare React DOM peer dependency")
assert(!packet.peerDependencies["react-aria-components"], "LaggingLinesLoader packet must not declare React Aria peer")
assert(packet.runtimeDependencies.classnames, "LaggingLinesLoader packet must declare classnames runtime dependency")
assert(!packet.runtimeDependencies.motion, "LaggingLinesLoader packet must not declare Motion runtime dependency")
assert(
  packetWrapperSource.includes("laggingLinesLoaderIngestPacket"),
  "LaggingLinesLoader packet wrapper must export typed packet",
)
assert(
  registryIndexSource.includes('export { laggingLinesLoaderIngestPacket } from "./lagging-lines-loader-ingest-packet"'),
  "Registry index must export LaggingLinesLoader packet",
)
assert(packageJson.dependencies.classnames, "Package must keep classnames runtime dependency")
assert(packageJson.peerDependencies.react, "Package must declare React peer dependency")
assert(
  packageJson.scripts.test.includes("verify-lagging-lines-loader-proof.mjs"),
  "Package test script must run LaggingLinesLoader proof",
)

if (process.exitCode) process.exit(process.exitCode)

console.log("[lagging-lines-loader-proof] verified LaggingLinesLoader source receipt packet")
