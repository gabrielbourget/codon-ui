import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const tagSourcePath = path.join(packageRoot, "src/components/Tag/Tag.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Tag/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Tag/TagStyles.module.css")
const compatibilityBridgePath = path.join(packageRoot, "src/components/Tag/tag-compatibility.css")
const tagIndexPath = path.join(packageRoot, "src/components/Tag/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/tag-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/tag-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[tag-proof] ${message}`)
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
const tagSource = readRequiredText(tagSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const compatibilityBridgeSource = readRequiredText(compatibilityBridgePath)
const tagIndexSource = readRequiredText(tagIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/Tag/Tag.tsx",
  "packages/react/src/components/Tag/helpers.ts",
  "packages/react/src/components/Tag/TagStyles.module.css",
  "packages/react/src/components/Tag/__tests__/Tag.test.tsx",
]
const requiredTargetPaths = ["Tag/Tag.tsx", "Tag/helpers.ts", "Tag/TagStyles.module.css", "Tag/__tests__/Tag.test.tsx"]
const requiredStyleSelectors = [
  ".tag",
  ".tag--pressable:hover",
  ".tag--pressable:hover:focus-visible",
  ".tag--rounded",
  ".tag--round",
  ".tag--raised",
  ".tag--disabled",
  ".tag--active",
  ".tag--inactive",
]
const requiredCompatibilityAliases = [
  "--distance_1: var(--cui-space-1)",
  "--border_radius_1: var(--cui-radius-1)",
  "--shadow_1: var(--cui-shadow-1)",
  "--focus-ring-color: var(--cui-focus-ring)",
  "--disabledOpacity: var(--cui-opacity-disabled)",
  "--bgColorTransition: var(--cui-transition-background-color)",
  "--colorTransition: var(--cui-transition-color)",
  "--borderColorTransition: var(--cui-transition-border-color)",
  "--boxShadowTransition: var(--cui-transition-box-shadow)",
]

assert(tagSource.startsWith('"use client"'), "Tag must preserve the client component boundary")
assert(tagSource.includes("FC<PropsWithChildren<TTagProps>>"), "Tag must preserve the current prop wrapper shape")
assert(tagSource.includes("isPressable(props)"), "Tag must preserve the pressable branch guard")
assert(tagSource.includes('type="button"'), "Tag pressable branch must render a button")
assert(tagSource.includes('data-testid="tag"'), "Tag must preserve the root test id fallback")
assert(helpersSource.includes('from "../../tokens/geometry"'), "Tag helpers must import package-local geometry tokens")
assert(helpersSource.includes("export type TTagProps"), "Tag helpers must export the local props type")
assert(helpersSource.includes("export const isPressable"), "Tag pressable guard must remain local")
assert(helpersSource.includes("export const calibrateComponent"), "Tag calibration helper must remain local")
;[tagSource, helpersSource, stylesSource, compatibilityBridgeSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Tag runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Tag CSS module must include ${selector}`)
})
requiredCompatibilityAliases.forEach((cssVariable) => {
  assert(compatibilityBridgeSource.includes(cssVariable), `Tag compatibility bridge must define ${cssVariable}`)
})
assert(
  stylesSource.includes("var(--cui-control-selected-background)"),
  "Tag styles must read selected control defaults",
)
assert(stylesSource.includes("var(--cui-control-background)"), "Tag styles must read control background defaults")
assert(stylesSource.includes("var(--cui-border-muted)"), "Tag styles must read muted border defaults")

assert(publicIndexSource.includes('export { Tag } from "./components/Tag"'), "Package index must export Tag")
assert(
  publicIndexSource.includes('export type { TagProps } from "./components/Tag"'),
  "Package index must export TagProps",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export Tag calibration internals")
assert(tagIndexSource.includes('export { default as Tag } from "./Tag"'), "Tag index must export the component")
assert(tagIndexSource.includes("TTagProps as TagProps"), "Tag index must export props alias")
assert(!tagIndexSource.includes("calibrateComponent"), "Tag index must not export calibration internals")
assert(!tagIndexSource.includes("isPressable"), "Tag index must not export local helper internals")

assert(packet.name === "tag", "Tag packet must describe the tag item")
assert(packet.type === "component", "Tag packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Tag packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Tag packet must record Wavemap as the analyzed source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#tag-next-candidate-planning-checkpoint"),
  "Tag packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Tag packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Tag packet must target ${targetPath}`,
  )
})

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Tag" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Tag/Tag.tsx",
  ),
  "Tag packet must define the public Tag export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TagProps" &&
      publicExport.localName === "TTagProps" &&
      publicExport.sourcePath === "packages/react/src/components/Tag/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Tag packet must define the public TagProps type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Tag packet must depend on the default theme")
assert(
  packet.registryDependencies.includes("theme/tag-compatibility"),
  "Tag packet must include the Tag proof compatibility bridge",
)
assert(packet.registryDependencies.includes("tokens/geometry"), "Tag packet must depend on geometry tokens")
assert(!packet.registryDependencies.includes("text"), "Tag packet must not depend on Text")
assert(packet.peerDependencies.react, "Tag packet must declare the React peer dependency")
assert(packet.peerDependencies["react-dom"], "Tag packet must declare the React DOM peer dependency")
assert(!packet.peerDependencies["react-aria-components"], "Tag packet must not require React Aria")
assert(packet.runtimeDependencies.classnames, "Tag packet must declare the classnames runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "Tag packet must record default theme contract pressure")
assert(
  defaultContractRequirement.cssVariables.includes("--cui-control-selected-background") &&
    defaultContractRequirement.cssVariables.includes("--cui-control-background") &&
    defaultContractRequirement.cssVariables.includes("--cui-border-muted"),
  "Tag packet must record default control role pressure",
)

const compatibilityBridgeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "proof-compatibility-bridge",
)
assert(compatibilityBridgeRequirement, "Tag packet must record proof compatibility bridge pressure")
requiredCompatibilityAliases.forEach((cssVariable) => {
  const cssVariableName = cssVariable.split(":")[0]
  assert(
    compatibilityBridgeRequirement.cssVariables.includes(cssVariableName),
    `Tag packet must record bridge pressure for ${cssVariableName}`,
  )
})
assert(
  compatibilityBridgeRequirement.files.some(
    (file) => file.sourcePath === "packages/react/src/components/Tag/tag-compatibility.css",
  ),
  "Tag packet must point at the separate Tag compatibility bridge",
)
assert(
  compatibilityBridgeRequirement.notes.some((note) =>
    note.includes("do not fold these aliases into prior component bridges"),
  ),
  "Tag packet must preserve bridge separation intent",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Tag packet must record the geometry import rewrite",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "Tag packet must point at the package-side proof harness",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react typecheck"),
  "Tag packet must point at package typecheck verification",
)
assert(
  packet.notes.some((note) => note.includes("geometry treated as installed registry support")),
  "Tag packet must explicitly record geometry dependency boundary",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a tag manifest item")),
  "Tag packet must keep manifest activation separate from source receipt",
)
assert(
  packetWrapperSource.includes("tagIngestPacketData") && packetWrapperSource.includes("tag-ingest-packet.data.json"),
  "Tag packet wrapper must import the packet data",
)
assert(registryIndexSource.includes("tagIngestPacket"), "Registry index must export the Tag ingest packet")

if (process.exitCode) process.exit(process.exitCode)
console.log("[tag-proof] source receipt proof passed")
