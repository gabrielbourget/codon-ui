import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const panelSourcePath = path.join(packageRoot, "src/components/Panel/Panel.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Panel/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Panel/PanelStyles.module.css")
const panelIndexPath = path.join(packageRoot, "src/components/Panel/index.ts")
const geometryTokenPath = path.join(packageRoot, "src/tokens/geometry.ts")
const placementTokenPath = path.join(packageRoot, "src/tokens/placement.ts")
const motionTokenPath = path.join(packageRoot, "src/tokens/motion.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/panel-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/panel-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[panel-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|query|api-contract|shared-utils|window|localStorage|@\/src\/|@radix-ui|@internationalized\/date/u
const forbiddenLegacyCssPattern =
  /--Z_INDEX_PANEL|--z-index-content-offset|--z-index-overlay-offset|--border_radius_|--shadow_1|theme\/panel-compatibility/u

const panelSource = readRequiredText(panelSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const panelIndexSource = readRequiredText(panelIndexPath)
const geometryTokenSource = readRequiredText(geometryTokenPath)
const placementTokenSource = readRequiredText(placementTokenPath)
const motionTokenSource = readRequiredText(motionTokenPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Panel/Panel.tsx",
  "packages/react/src/components/Panel/helpers.ts",
  "packages/react/src/components/Panel/PanelStyles.module.css",
  "packages/react/src/components/Panel/__tests__/Panel.test.tsx",
]
const requiredTargetPaths = [
  "Panel/Panel.tsx",
  "Panel/helpers.ts",
  "Panel/PanelStyles.module.css",
  "Panel/__tests__/Panel.test.tsx",
]
const requiredStyleSelectors = [
  ".panel",
  ".panel__overlay",
  ".panel__overlay[data-entering]",
  ".panel__overlay[data-exiting]",
  ".panel__overlay--blur",
  ".panel--raised",
  ".panel--rounded",
  ".panel--round",
  ".panel--left",
  ".panel--right",
  ".panel--open",
]
const requiredDefaultThemeVariables = [
  "--aui-surface",
  "--aui-radius-1",
  "--aui-shadow-1",
  "--aui-z-index-panel",
  "--aui-z-index-content-offset",
  "--aui-z-index-overlay-offset",
]

assert(panelSource.startsWith('"use client"'), "Panel must preserve the client component boundary")
assert(panelSource.includes('from "motion/react"'), "Panel must import Motion")
assert(panelSource.includes('from "react-aria-components"'), "Panel must import React Aria")
assert(panelSource.includes("motion.create(Modal)"), "Panel must preserve Motion Modal composition")
assert(panelSource.includes("motion.create(ModalOverlay)"), "Panel must preserve Motion ModalOverlay composition")
assert(panelSource.includes("AnimatePresence"), "Panel must preserve enter/exit animation wrapping")
assert(panelSource.includes("document.addEventListener"), "Panel must preserve Escape key document listener")
assert(panelSource.includes('event.key !== "Escape"'), "Panel must preserve Escape dismissal guard")
assert(panelSource.includes("onPointerDown"), "Panel must preserve overlay pointer dismissal")
assert(panelSource.includes('data-testid={dataTestID ?? "panel"}'), "Panel root test id fallback must stay")
assert(
  panelSource.includes("duration: DEFAULT_MICROANIMATION_DURATION"),
  "Panel must preserve default microanimation duration",
)

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Panel helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/placement"'),
  "Panel helpers must import package-local placement tokens",
)
assert(helpersSource.includes("export type TPanelProps"), "Panel helpers must export local Panel props")
assert(helpersSource.includes("export const calibrateComponent"), "Panel calibration helper must remain local")
assert(helpersSource.includes("POPOVER_PLACEMENT__LEFT as LEFT"), "Panel must resolve left placement locally")
assert(helpersSource.includes("POPOVER_PLACEMENT__RIGHT as RIGHT"), "Panel must resolve right placement locally")
;[panelSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Panel runtime source must not import consumer-only modules")
})

assert(
  geometryTokenSource.includes("export type TCornerGeometry"),
  "Geometry token support must expose corner geometry",
)
assert(placementTokenSource.includes("POPOVER_PLACEMENT__LEFT"), "Placement token support must expose left placement")
assert(placementTokenSource.includes("POPOVER_PLACEMENT__RIGHT"), "Placement token support must expose right placement")
assert(
  motionTokenSource.includes("DEFAULT_MICROANIMATION_DURATION = 0.25"),
  "Motion token support must expose Panel animation duration",
)

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Panel CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `Panel CSS must read ${cssVariable}`)
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Panel CSS must not read legacy Wavemap aliases")

assert(publicIndexSource.includes('export { Panel } from "./components/Panel"'), "Package index must export Panel")
assert(
  publicIndexSource.includes('export type { PanelProps } from "./components/Panel"'),
  "Package index must export PanelProps",
)
assert(!publicIndexSource.includes("TPanelProps"), "Package index must not export Panel internals directly")
assert(panelIndexSource.includes('export { default as Panel } from "./Panel"'), "Panel index must export component")
assert(panelIndexSource.includes("TPanelProps as PanelProps"), "Panel index must export props alias")
assert(!panelIndexSource.includes("calibrateComponent"), "Panel index must not export internals")

assert(packageJson.dependencies.classnames, "Panel package must keep classnames runtime dependency")
assert(packageJson.dependencies.motion, "Panel package must keep Motion runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Panel React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "Panel package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Panel package must keep React DOM peer dependency")

assert(packet.name === "panel", "Panel packet must describe the panel item")
assert(packet.type === "component", "Panel packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Panel packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Panel packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#panel-next-candidate-planning-checkpoint"),
  "Panel packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Panel packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Panel packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Panel packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Panel" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Panel/Panel.tsx",
  ),
  "Panel packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "PanelProps" &&
      publicExport.localName === "TPanelProps" &&
      publicExport.sourcePath === "packages/react/src/components/Panel/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Panel packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Panel packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/geometry"), "Panel packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/placement"), "Panel packet must depend on placement tokens")
assert(packet.registryDependencies.includes("tokens/motion"), "Panel packet must depend on motion tokens")
assert(!packet.registryDependencies.includes("theme/panel-compatibility"), "Panel must not need a bridge item")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Panel packet must declare React Aria peer")
assert(packet.runtimeDependencies.classnames, "Panel packet must declare classnames runtime dependency")
assert(packet.runtimeDependencies.motion, "Panel packet must declare Motion runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "Panel packet must record default-contract theme pressure")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Panel packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Panel packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/placement",
  ),
  "Panel packet must record placement token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/motion",
  ),
  "Panel packet must record motion token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--Z_INDEX_PANEL") &&
      resolution.replacementSource.includes("--aui-z-index-panel"),
  ),
  "Panel packet must record panel z-index CSS variable rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--shadow_1") && resolution.replacementSource.includes("--aui-shadow-1"),
  ),
  "Panel packet must record shadow CSS variable rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Modal/Modal.tsx"),
  "Modal must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/AlertDialog/AlertDialog.tsx"),
  "AlertDialog must stay out",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/SortAndFilterPanel/SortAndFilterPanel.tsx",
  ),
  "SortAndFilterPanel must stay out",
)
assert(packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Link/Link.tsx"), "Link must stay out")
assert(
  packet.notes.some((note) => note.includes("React Aria modal-overlay primitive")),
  "Packet must record Panel proof scope",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a panel manifest item")),
  "Packet must keep manifest activation separate from source receipt",
)

assert(
  packetWrapperSource.includes("panelIngestPacketData as TRegistryIngestPacket"),
  "Panel packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { panelIngestPacket } from "./panel-ingest-packet"'),
  "Registry index must export Panel ingest packet",
)

console.log("[panel-proof] verified Panel source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
