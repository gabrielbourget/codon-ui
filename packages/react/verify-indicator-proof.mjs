import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const indicatorSourcePath = path.join(packageRoot, "src/components/Indicator/Indicator.tsx")
const indicatorHelpersPath = path.join(packageRoot, "src/components/Indicator/helpers.ts")
const indicatorStylesPath = path.join(packageRoot, "src/components/Indicator/IndicatorStyles.module.css")
const indicatorIndexPath = path.join(packageRoot, "src/components/Indicator/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/indicator-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/indicator-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[indicator-proof] ${message}`)
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
const requiredRuntimeFileSources = [
  "packages/react/src/components/Indicator/Indicator.tsx",
  "packages/react/src/components/Indicator/helpers.ts",
  "packages/react/src/components/Indicator/IndicatorStyles.module.css",
]
const requiredTargetPaths = [
  "VisualUtilities/Indicator/Indicator.tsx",
  "VisualUtilities/Indicator/helpers.ts",
  "VisualUtilities/Indicator/IndicatorStyles.module.css",
]
const requiredPublicExports = [
  "Indicator",
  "IndicatorProps",
  "AvailableIndicatorShape",
  "AVAILABLE_INDICATOR_SHAPES",
  "INDICATOR_SHAPE__CIRCLE",
  "INDICATOR_SHAPE__ROUNDED",
  "INDICATOR_SHAPE__SQUARE",
]

const indicatorSource = readRequiredText(indicatorSourcePath)
const indicatorHelpersSource = readRequiredText(indicatorHelpersPath)
const indicatorStylesSource = readRequiredText(indicatorStylesPath)
const indicatorIndexSource = readRequiredText(indicatorIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(indicatorSource.startsWith('"use client"'), "Indicator must preserve the client component boundary")
assert(
  indicatorSource.includes('import { calibrateComponent, type TIndicatorProps } from "./helpers"'),
  "Indicator must import only its local helper contract",
)
assert(
  indicatorSource.includes("return <div {...rest} className={indicatorClassName} style={indicatorStyle} />"),
  "Indicator must render a native div with computed className and style",
)
;[
  "borderColor: _borderColor",
  "borderWidth: _borderWidth",
  "className: _className",
  "color: _color",
  "customClassName: _customClassName",
  "customStyles: _customStyles",
  "inactiveColor: _inactiveColor",
  "isActive: _isActive",
  "shape: _shape",
  "size: _size",
  "style: _style",
].forEach((consumedPropPattern) => {
  assert(indicatorSource.includes(consumedPropPattern), `Indicator must consume ${consumedPropPattern}`)
})

assert(
  indicatorHelpersSource.includes('import classNames from "classnames"'),
  "Indicator helpers must import classnames",
)
assert(indicatorHelpersSource.includes("ComponentPropsWithoutRef"), "Indicator props must preserve native div typing")
assert(indicatorHelpersSource.includes("CSSProperties"), "Indicator helpers must preserve style typing")
assert(
  indicatorHelpersSource.includes('INDICATOR_SHAPE__CIRCLE = "circle"') &&
    indicatorHelpersSource.includes('INDICATOR_SHAPE__ROUNDED = "rounded"') &&
    indicatorHelpersSource.includes('INDICATOR_SHAPE__SQUARE = "square"'),
  "Indicator helpers must export shape constants",
)
assert(
  indicatorHelpersSource.includes("export const AVAILABLE_INDICATOR_SHAPES") &&
    indicatorHelpersSource.includes("TAvailableIndicatorShape"),
  "Indicator helpers must preserve shape vocabulary",
)
assert(indicatorHelpersSource.includes("export type TIndicatorProps"), "Indicator helpers must export props")
assert(indicatorHelpersSource.includes('color = "currentColor"'), "Indicator must default active color to currentColor")
assert(
  indicatorHelpersSource.includes('inactiveColor = "transparent"'),
  "Indicator must default inactive color to transparent",
)
assert(indicatorHelpersSource.includes("borderWidth = 0"), "Indicator must preserve zero default border width")
assert(indicatorHelpersSource.includes("size = 10"), "Indicator must preserve default size")
assert(
  indicatorHelpersSource.includes('formatCSSSize(borderWidth, "0px")') &&
    indicatorHelpersSource.includes('formatCSSSize(size, "10px")'),
  "Indicator must format numeric CSS sizes",
)
assert(
  indicatorHelpersSource.includes("...customStyles,") && indicatorHelpersSource.includes("...style,"),
  "Indicator must let native style override custom styles",
)
assert(
  indicatorHelpersSource.includes("customClassName, className"),
  "Indicator must merge custom and native class names",
)
assert(
  !forbiddenConsumerImportsPattern.test(`${indicatorSource}\n${indicatorHelpersSource}`),
  "Indicator must not import consumer-only modules",
)
assert(!indicatorSource.includes("theme/indicator-compatibility"), "Indicator must not need a bridge item")

assert(indicatorStylesSource.includes(".indicator"), "Indicator styles must define root class")
assert(indicatorStylesSource.includes("--indicator-size"), "Indicator styles must use local size custom property")
assert(indicatorStylesSource.includes("--indicator-color"), "Indicator styles must use local color custom property")
assert(
  indicatorStylesSource.includes(".indicator--circle") &&
    indicatorStylesSource.includes(".indicator--rounded") &&
    indicatorStylesSource.includes(".indicator--square"),
  "Indicator styles must define all shape classes",
)
assert(!indicatorStylesSource.includes("--aui-"), "Indicator styles must not require global Amino theme variables")

assert(publicIndexSource.includes("export {"), "Package index must expose component values")
assert(
  publicIndexSource.includes("Indicator,") || publicIndexSource.includes("Indicator }"),
  "Package index must export Indicator",
)
assert(
  publicIndexSource.includes('from "./components/Indicator"'),
  "Package index must export from the Indicator component index",
)
assert(
  publicIndexSource.includes("IndicatorProps") && publicIndexSource.includes("AvailableIndicatorShape"),
  "Package index must export Indicator public types",
)
assert(
  !publicIndexSource.includes("calibrateComponent"),
  "Package index must not export Indicator calibration internals",
)
assert(
  indicatorIndexSource.includes('export { default as Indicator } from "./Indicator"'),
  "Indicator index must export component",
)
requiredPublicExports.slice(3).forEach((exportedName) => {
  assert(indicatorIndexSource.includes(exportedName), `Indicator index must export ${exportedName}`)
})
assert(
  indicatorIndexSource.includes("TAvailableIndicatorShape as AvailableIndicatorShape") &&
    indicatorIndexSource.includes("TIndicatorProps as IndicatorProps"),
  "Indicator index must export public type aliases",
)
assert(!indicatorIndexSource.includes("calibrateComponent"), "Indicator index must keep calibration internals private")

assert(packageJson.dependencies.classnames, "Indicator package must keep classnames runtime dependency")
assert(packageJson.peerDependencies.react, "Indicator package must keep React peer dependency")
assert(packageJson.scripts.test.includes("verify-indicator-proof.mjs"), "Package test script must run Indicator proof")

assert(packet.name === "indicator", "Indicator packet must describe the indicator item")
assert(packet.type === "component", "Indicator packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Indicator packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Indicator packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#indicator-extraction-planning-checkpoint"),
  "Indicator packet must point at the Wavemap planning checkpoint",
)
requiredRuntimeFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Indicator packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Indicator packet must target ${targetPath}`,
  )
})
assert(
  packet.files.some(
    (file) => file.role === "test" && file.targetPath === "VisualUtilities/Indicator/__tests__/Indicator.test.tsx",
  ),
  "Indicator packet must preserve optional focused test evidence",
)
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Indicator packet test files must remain optional source evidence",
)
requiredPublicExports.forEach((exportedName) => {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportedName),
    `Indicator packet must define ${exportedName} public export intent`,
  )
})
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "IndicatorProps" &&
      publicExport.localName === "TIndicatorProps" &&
      publicExport.typeOnly === true,
  ),
  "Indicator packet must define the public props type alias intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "AvailableIndicatorShape" &&
      publicExport.localName === "TAvailableIndicatorShape" &&
      publicExport.typeOnly === true,
  ),
  "Indicator packet must define the public shape type alias intent",
)
assert(packet.registryDependencies.length === 0, "Indicator packet must not require registry dependencies")
assert(packet.importResolutions.length === 0, "Indicator packet must not need import rewrites")
assert(packet.themeRequirements.length === 0, "Indicator packet must not require theme variables")
assert(packet.peerDependencies.react, "Indicator packet must declare React peer dependency")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "Indicator packet must declare classnames")
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/StatusMessage/**"),
  "Indicator packet must explicitly exclude StatusMessage",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/icons/**"),
  "Indicator packet must not promote the broad icon folder",
)
assert(
  packet.notes.some((note) => note.includes("does not activate an indicator manifest item")),
  "Packet must keep manifest activation separate from source receipt",
)

assert(
  packetWrapperSource.includes("indicatorIngestPacketData as TRegistryIngestPacket"),
  "Indicator packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { indicatorIngestPacket } from "./indicator-ingest-packet"'),
  "Registry index must export Indicator ingest packet",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[indicator-proof] verified Indicator source receipt packet")
