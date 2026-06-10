import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const lineSegmentSourcePath = path.join(packageRoot, "src/components/LineSegment/LineSegment.tsx")
const lineSegmentIndexPath = path.join(packageRoot, "src/components/LineSegment/index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/line-segment-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/line-segment-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[line-segment-proof] ${message}`)
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
const requiredPackageFileSources = [
  "packages/react/src/components/LineSegment/LineSegment.tsx",
  "packages/react/src/components/LineSegment/__tests__/LineSegment.test.tsx",
]
const requiredTargetPaths = [
  "VisualUtilities/LineSegment/LineSegment.tsx",
  "VisualUtilities/LineSegment/__tests__/LineSegment.test.tsx",
]

const lineSegmentSource = readRequiredText(lineSegmentSourcePath)
const lineSegmentIndexSource = readRequiredText(lineSegmentIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(lineSegmentSource.startsWith('"use client"'), "LineSegment must preserve the client component boundary")
assert(lineSegmentSource.includes('import classNames from "classnames"'), "LineSegment must import classnames")
assert(lineSegmentSource.includes("ComponentPropsWithoutRef"), "LineSegment must preserve native div props typing")
assert(lineSegmentSource.includes("CSSProperties"), "LineSegment must preserve style typing")
assert(
  lineSegmentSource.includes('LINE_SEGMENT_DIRECTION__HORIZONTAL = "horizontal"'),
  "LineSegment must export horizontal direction constant",
)
assert(
  lineSegmentSource.includes('LINE_SEGMENT_DIRECTION__VERTICAL = "vertical"'),
  "LineSegment must export vertical direction constant",
)
assert(
  lineSegmentSource.includes("export const AVAILABLE_LINE_SEGMENT_DIRECTIONS") &&
    lineSegmentSource.includes("TAvailableLineSegmentDirections"),
  "LineSegment must preserve its local direction vocabulary",
)
assert(lineSegmentSource.includes("export type TLineSegmentProps"), "LineSegment must export local props")
assert(lineSegmentSource.includes('color = "var(--cui-border)"'), "LineSegment must use the Amino border default")
assert(
  lineSegmentSource.includes("direction = LINE_SEGMENT_DIRECTION__HORIZONTAL"),
  "LineSegment must default horizontal",
)
assert(lineSegmentSource.includes("height = 50"), "LineSegment must preserve default height")
assert(lineSegmentSource.includes("width = 50"), "LineSegment must preserve default width")
assert(lineSegmentSource.includes("size = 2.5"), "LineSegment must preserve default size")
assert(lineSegmentSource.includes("width: size"), "Horizontal LineSegment must size width from size")
assert(lineSegmentSource.includes("height: size"), "Vertical LineSegment must size height from size")
assert(
  lineSegmentSource.includes("style={{ ...styles, ...customStyles, ...style }}"),
  "LineSegment must let custom and native styles override computed styles",
)
assert(
  lineSegmentSource.includes("classNames(customClassName, className)"),
  "LineSegment must merge custom and native class names",
)
;["color: _color", "direction: _direction", "height: _height", "size: _size", "width: _width"].forEach(
  (consumedPropPattern) => {
    assert(lineSegmentSource.includes(consumedPropPattern), `LineSegment must consume ${consumedPropPattern}`)
  },
)
assert(!forbiddenConsumerImportsPattern.test(lineSegmentSource), "LineSegment must not import consumer-only modules")
assert(!lineSegmentSource.includes("theme/line-segment-compatibility"), "LineSegment must not need a bridge item")

assert(themeCSS.includes("--cui-border:"), "theme.css must declare --cui-border")
assert(
  publicIndexSource.includes('export { LineSegment } from "./components/LineSegment"'),
  "Package index must export LineSegment",
)
assert(
  publicIndexSource.includes('export type { LineSegmentProps } from "./components/LineSegment"'),
  "Package index must export LineSegment public type",
)
assert(!publicIndexSource.includes("LINE_SEGMENT_DIRECTION"), "Package index must not export LineSegment constants")
assert(
  lineSegmentIndexSource.includes('export { default as LineSegment } from "./LineSegment"'),
  "LineSegment index must export component",
)
assert(
  lineSegmentIndexSource.includes("TLineSegmentProps as LineSegmentProps"),
  "LineSegment index must export props type",
)
assert(!lineSegmentIndexSource.includes("LINE_SEGMENT_DIRECTION"), "LineSegment index must keep constants source-local")

assert(packageJson.dependencies.classnames, "LineSegment package must keep classnames runtime dependency")
assert(packageJson.peerDependencies.react, "LineSegment package must keep React peer dependency")
assert(
  packageJson.scripts.test.includes("verify-line-segment-proof.mjs"),
  "Package test script must run LineSegment proof",
)

assert(packet.name === "line-segment", "LineSegment packet must describe the line-segment item")
assert(packet.type === "component", "LineSegment packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "LineSegment packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "LineSegment packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#linesegment-next-candidate-planning-checkpoint"),
  "LineSegment packet must point at the Wavemap planning checkpoint",
)
requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `LineSegment packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `LineSegment packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "LineSegment packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "LineSegment" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/LineSegment/LineSegment.tsx",
  ),
  "LineSegment packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "LineSegmentProps" &&
      publicExport.localName === "TLineSegmentProps" &&
      publicExport.sourcePath === "packages/react/src/components/LineSegment/LineSegment.tsx" &&
      publicExport.typeOnly === true,
  ),
  "LineSegment packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "LineSegment packet must depend on theme-css")
assert(
  !packet.registryDependencies.includes("theme/line-segment-compatibility"),
  "LineSegment must not need a bridge item",
)
assert(packet.peerDependencies.react, "LineSegment packet must declare React peer dependency")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "LineSegment packet must declare classnames")
assert(
  packet.themeRequirements.some((requirement) => requirement.cssVariables.includes("--cui-border")),
  "LineSegment packet must record the default border variable",
)
assert(packet.importResolutions.length === 0, "LineSegment packet must not need import rewrites")

assert(
  packetWrapperSource.includes("lineSegmentIngestPacketData") && packetWrapperSource.includes("TRegistryIngestPacket"),
  "LineSegment packet wrapper must type the JSON packet",
)
assert(
  registryIndexSource.includes('export { lineSegmentIngestPacket } from "./line-segment-ingest-packet"'),
  "Registry index must export LineSegment ingest packet",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[line-segment-proof] Source receipt checks passed.")
