import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const toggleSwitcherRoot = path.join(packageRoot, "src/components/ToggleSwitcher")
const toggleSwitcherSourcePath = path.join(toggleSwitcherRoot, "ToggleSwitcher.tsx")
const helpersSourcePath = path.join(toggleSwitcherRoot, "helpers.ts")
const stylesSourcePath = path.join(toggleSwitcherRoot, "ToggleSwitcherStyles.module.css")
const toggleSwitcherIndexPath = path.join(toggleSwitcherRoot, "index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const packetSourcePath = path.join(packageRoot, "src/registry/toggle-switcher-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/toggle-switcher-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[toggle-switcher-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\//u
const forbiddenLegacyCssPattern =
  /--distance_|--border_radius_|--shadow_1|--bgColorTransition|--borderColorTransition|--boxShadowTransition|--colorTransition|--focus-ring-color|--disabledOpacity|theme\/toggle-switcher-compatibility/u
const requiredRuntimeFileSources = [
  "packages/react/src/components/ToggleSwitcher/ToggleSwitcher.tsx",
  "packages/react/src/components/ToggleSwitcher/helpers.ts",
  "packages/react/src/components/ToggleSwitcher/ToggleSwitcherStyles.module.css",
]
const requiredTargetPaths = requiredRuntimeFileSources.map((sourcePath) =>
  sourcePath.replace("packages/react/src/components/", ""),
)
const expectedRegistryDependencies = [
  "theme-css",
  "theme/action-colors",
  "tokens/geometry",
  "tokens/theme-order",
  "tokens/motion",
]
const expectedDefaultVariables = [
  "--cui-border-muted",
  "--cui-control-background",
  "--cui-control-foreground",
  "--cui-control-hover-background",
  "--cui-control-selected-background",
  "--cui-focus-ring",
  "--cui-opacity-disabled",
  "--cui-radius-1",
  "--cui-shadow-1",
  "--cui-space-1",
  "--cui-surface-muted",
  "--cui-transition-background-color",
  "--cui-transition-border-color",
  "--cui-transition-box-shadow",
  "--cui-transition-color",
]
const expectedActionVariables = [
  "--cui-color-primary-500",
  "--cui-color-secondary-500",
  "--cui-color-tertiary-500",
  "--cui-color-quaternary-500",
  "--cui-color-quintenary-500",
]

const toggleSwitcherSource = readRequiredText(toggleSwitcherSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const toggleSwitcherIndexSource = readRequiredText(toggleSwitcherIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const actionColorsCSS = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(toggleSwitcherSource.startsWith('"use client"'), "ToggleSwitcher must preserve the client component boundary")
assert(toggleSwitcherSource.includes('from "motion/react"'), "ToggleSwitcher must keep Motion composition")
assert(
  toggleSwitcherSource.includes('from "../../tokens/motion"'),
  "ToggleSwitcher must import motion tokens from package-local support",
)
assert(toggleSwitcherSource.includes("<LayoutGroup"), "ToggleSwitcher must keep the Motion LayoutGroup")
assert(toggleSwitcherSource.includes('layout="position"'), "ToggleSwitcher must keep position layout animation")
assert(
  toggleSwitcherSource.includes('layoutId="selected-surface"'),
  "ToggleSwitcher must keep selected surface layout id",
)
assert(
  toggleSwitcherSource.includes('data-testid={dataTestID ?? "toggle-switcher"}'),
  "ToggleSwitcher must preserve the root test id fallback",
)
assert(
  toggleSwitcherSource.includes('data-testid="toggle-switcher-selected-surface"'),
  "ToggleSwitcher must preserve selected surface test id",
)
assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "ToggleSwitcher helpers must import package-local geometry support",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "ToggleSwitcher helpers must import package-local theme-order support",
)
assert(
  !helpersSource.includes("../Text") && !helpersSource.includes("components/Text"),
  "ToggleSwitcher must not depend on Text",
)
assert(helpersSource.includes("export type TToggleSwitcherFontWeight"), "ToggleSwitcher must localize font weight type")
assert(helpersSource.includes("export type TToggleSwitcherItem"), "ToggleSwitcher helpers must export local item type")
assert(
  helpersSource.includes("export type TToggleSwitcherProps"),
  "ToggleSwitcher helpers must export local props type",
)
assert(helpersSource.includes("export const calibrateComponent"), "ToggleSwitcher calibration helper must stay local")
;[toggleSwitcherSource, helpersSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "ToggleSwitcher runtime source must not import consumer-only modules",
  )
})

assert(!forbiddenLegacyCssPattern.test(stylesSource), "ToggleSwitcher CSS must not read legacy Wavemap aliases")
assert(!stylesSource.includes("theme/toggle-switcher-compatibility"), "ToggleSwitcher must not need a bridge item")
;[".toggleSwitcher", ".toggleSwitcher__option", ".toggleSwitcher__selectedSurface"].forEach((selector) => {
  assert(stylesSource.includes(selector), `ToggleSwitcher CSS module must include ${selector}`)
})
expectedDefaultVariables.forEach((cssVariable) => {
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
  assert(stylesSource.includes(`var(${cssVariable})`), `ToggleSwitcher CSS must read ${cssVariable}`)
})
expectedActionVariables.forEach((cssVariable) => {
  assert(actionColorsCSS.includes(`${cssVariable}:`), `action-colors.css must declare ${cssVariable}`)
  assert(stylesSource.includes(`var(${cssVariable})`), `ToggleSwitcher CSS must read ${cssVariable}`)
})

assert(
  publicIndexSource.includes('export { ToggleSwitcher } from "./components/ToggleSwitcher"'),
  "Package index must export ToggleSwitcher",
)
assert(publicIndexSource.includes("ToggleSwitcherProps"), "Package index must export ToggleSwitcherProps")
assert(publicIndexSource.includes("ToggleSwitcherItem"), "Package index must export ToggleSwitcherItem")
assert(
  !publicIndexSource.includes("TToggleSwitcherProps"),
  "Package index must not export ToggleSwitcher internals directly",
)
assert(
  toggleSwitcherIndexSource.includes('export { default as ToggleSwitcher } from "./ToggleSwitcher"'),
  "ToggleSwitcher index must export component",
)
assert(
  toggleSwitcherIndexSource.includes("TToggleSwitcherProps as ToggleSwitcherProps"),
  "ToggleSwitcher index must export props type alias",
)
assert(
  toggleSwitcherIndexSource.includes("TToggleSwitcherItem as ToggleSwitcherItem"),
  "ToggleSwitcher index must export item type alias",
)

assert(
  packageJson.dependencies.classnames === "^2.3.2",
  "ToggleSwitcher package must keep classnames runtime dependency",
)
assert(packageJson.dependencies.motion === "^12.40.0", "ToggleSwitcher package must keep motion runtime dependency")
assert(packageJson.peerDependencies.react, "ToggleSwitcher package must keep React peer dependency")
assert(
  packageJson.scripts.test.includes("verify-toggle-switcher-proof.mjs"),
  "Package test script must run ToggleSwitcher proof",
)

assert(packet.name === "toggle-switcher", "ToggleSwitcher packet must describe the toggle-switcher item")
assert(packet.type === "component", "ToggleSwitcher packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "ToggleSwitcher packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "ToggleSwitcher packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#toggleswitcher-next-candidate-planning-checkpoint"),
  "ToggleSwitcher packet must point at the Wavemap planning checkpoint",
)
requiredRuntimeFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `ToggleSwitcher packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `ToggleSwitcher packet must target ${targetPath}`,
  )
})
assert(
  packet.files.every((file) => file.role !== "test"),
  "ToggleSwitcher packet must not receive focused tests as source",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/ToggleSwitcher/__tests__/ToggleSwitcher.test.tsx",
  ),
  "ToggleSwitcher packet must exclude focused tests",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Table/components/TableFilterPopover/TableFilterPopover.tsx",
  ),
  "ToggleSwitcher packet must exclude TableFilterPopover consumer source",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Panels/SortAndFilterPanel/InternalComponents/ActiveFilters/ActiveFilters.tsx",
  ),
  "ToggleSwitcher packet must exclude ActiveFilters consumer source",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ToggleSwitcher" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/ToggleSwitcher/ToggleSwitcher.tsx",
  ),
  "ToggleSwitcher packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ToggleSwitcherProps" &&
      publicExport.localName === "TToggleSwitcherProps" &&
      publicExport.typeOnly === true,
  ),
  "ToggleSwitcher packet must define the public props type alias intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ToggleSwitcherItem" &&
      publicExport.localName === "TToggleSwitcherItem" &&
      publicExport.typeOnly === true,
  ),
  "ToggleSwitcher packet must define the public item type alias intent",
)
expectedRegistryDependencies.forEach((registryDependency) => {
  assert(
    packet.registryDependencies.includes(registryDependency),
    `ToggleSwitcher packet must depend on ${registryDependency}`,
  )
})
assert(
  !packet.registryDependencies.includes("theme/toggle-switcher-compatibility"),
  "ToggleSwitcher must not need a bridge item",
)
assert(!packet.registryDependencies.includes("text"), "ToggleSwitcher must not depend on Text for font weight typing")
assert(packet.peerDependencies.react, "ToggleSwitcher packet must declare React peer dependency")
assert(!packet.peerDependencies["react-dom"], "ToggleSwitcher packet must not declare unused React DOM peer dependency")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "ToggleSwitcher packet must declare classnames")
assert(packet.runtimeDependencies.motion === "^12.40.0", "ToggleSwitcher packet must declare motion")
assert(
  packet.themeRequirements.some((requirement) =>
    expectedDefaultVariables.every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
  ),
  "ToggleSwitcher packet must record default theme variables",
)
assert(
  packet.themeRequirements.some((requirement) =>
    expectedActionVariables.every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
  ),
  "ToggleSwitcher packet must record action-color variables",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/motion" && resolution.replacementSource === "../../tokens/motion",
  ),
  "ToggleSwitcher packet must record motion token import rewrite",
)
assert(
  packet.importResolutions.some((resolution) => resolution.importSource === "@/src/components/Text/types"),
  "ToggleSwitcher packet must record font-weight type localization",
)
assert(
  packet.notes.some((note) => note.includes("controlled/uncontrolled selection behavior")),
  "ToggleSwitcher packet must record selection behavior boundary",
)

assert(
  packetWrapperSource.includes("toggleSwitcherIngestPacketData") &&
    packetWrapperSource.includes("TRegistryIngestPacket"),
  "ToggleSwitcher packet wrapper must type the JSON packet",
)
assert(
  registryIndexSource.includes('export { toggleSwitcherIngestPacket } from "./toggle-switcher-ingest-packet"'),
  "Registry index must export ToggleSwitcher ingest packet",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[toggle-switcher-proof] Source receipt checks passed.")
