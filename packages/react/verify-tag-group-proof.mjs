import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const tagGroupSourcePath = path.join(packageRoot, "src/components/TagGroup/TagGroup.tsx")
const tagGroupHelpersSourcePath = path.join(packageRoot, "src/components/TagGroup/helpers.ts")
const tagGroupStylesSourcePath = path.join(packageRoot, "src/components/TagGroup/TagGroupStyles.module.css")
const adobeTagSourcePath = path.join(packageRoot, "src/components/TagGroup/AdobeTag/AdobeTag.tsx")
const adobeTagHelpersSourcePath = path.join(packageRoot, "src/components/TagGroup/AdobeTag/helpers.tsx")
const adobeTagStylesSourcePath = path.join(packageRoot, "src/components/TagGroup/AdobeTag/AdobeTagStyles.module.css")
const defaultCloseIconSourcePath = path.join(packageRoot, "src/components/TagGroup/AdobeTag/DefaultCloseIcon.tsx")
const compatibilityBridgePath = path.join(packageRoot, "src/components/TagGroup/tag-group-compatibility.css")
const tagGroupIndexPath = path.join(packageRoot, "src/components/TagGroup/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/tag-group-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/tag-group-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[tag-group-proof] ${message}`)
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
const tagGroupSource = readRequiredText(tagGroupSourcePath)
const tagGroupHelpersSource = readRequiredText(tagGroupHelpersSourcePath)
const tagGroupStylesSource = readRequiredText(tagGroupStylesSourcePath)
const adobeTagSource = readRequiredText(adobeTagSourcePath)
const adobeTagHelpersSource = readRequiredText(adobeTagHelpersSourcePath)
const adobeTagStylesSource = readRequiredText(adobeTagStylesSourcePath)
const defaultCloseIconSource = readRequiredText(defaultCloseIconSourcePath)
const compatibilityBridgeSource = readRequiredText(compatibilityBridgePath)
const tagGroupIndexSource = readRequiredText(tagGroupIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/TagGroup/TagGroup.tsx",
  "packages/react/src/components/TagGroup/helpers.ts",
  "packages/react/src/components/TagGroup/TagGroupStyles.module.css",
  "packages/react/src/components/TagGroup/AdobeTag/AdobeTag.tsx",
  "packages/react/src/components/TagGroup/AdobeTag/helpers.tsx",
  "packages/react/src/components/TagGroup/AdobeTag/AdobeTagStyles.module.css",
  "packages/react/src/components/TagGroup/AdobeTag/DefaultCloseIcon.tsx",
  "packages/react/src/components/TagGroup/__tests__/TagGroup.test.tsx",
  "packages/react/src/components/TagGroup/AdobeTag/__tests__/AdobeTag.test.tsx",
]
const requiredTargetPaths = [
  "TagGroup/TagGroup.tsx",
  "TagGroup/helpers.ts",
  "TagGroup/TagGroupStyles.module.css",
  "TagGroup/AdobeTag/AdobeTag.tsx",
  "TagGroup/AdobeTag/helpers.tsx",
  "TagGroup/AdobeTag/AdobeTagStyles.module.css",
  "TagGroup/AdobeTag/DefaultCloseIcon.tsx",
  "TagGroup/__tests__/TagGroup.test.tsx",
  "TagGroup/AdobeTag/__tests__/AdobeTag.test.tsx",
]
const requiredStyleSelectors = [
  ".tagGroup",
  ".tagList",
  ".tagList--horizontal",
  ".tagList--vertical",
  ".tag",
  ".tag__removeButton",
  ".tag--default[data-selected]",
  ".tag--primary[data-selected]",
  ".tag--quintenary[data-selected]",
]
const requiredCompatibilityAliases = [
  "--distance_1: var(--cui-space-1)",
  "--border_radius_1: var(--cui-radius-1)",
  "--shadow_1: var(--cui-shadow-1)",
  "--focus-ring-color: var(--cui-focus-ring)",
  "--disabledOpacity: var(--cui-opacity-disabled)",
  "--bgColorTransition: var(--cui-transition-background-color)",
  "--borderColorTransition: var(--cui-transition-border-color)",
  "--colorTransition: var(--cui-transition-color)",
  "--cui-tag-primary-selected-background",
  "--cui-tag-primary-selected-foreground",
  "--cui-tag-quintenary-selected-background",
  "--cui-tag-quintenary-selected-foreground",
]

assert(tagGroupSource.startsWith('"use client"'), "TagGroup must preserve the client component boundary")
assert(adobeTagSource.startsWith('"use client"'), "AdobeTag must preserve the client component boundary")
assert(
  tagGroupSource.includes('import { TagGroup as AdobeTagGroup, TagList } from "react-aria-components"'),
  "TagGroup must use React Aria collection primitives",
)
assert(
  adobeTagSource.includes('import { Button, Tag as AdobeTagHeadless } from "react-aria-components"'),
  "AdobeTag must use React Aria Tag and Button primitives",
)
assert(!adobeTagSource.includes("@/src/components/Button/Button"), "AdobeTag must not import Wavemap Button")
assert(adobeTagSource.includes('slot="remove"'), "AdobeTag must preserve the React Aria remove slot")
assert(adobeTagSource.includes('data-testid={dataTestID ?? "tag"}'), "AdobeTag must preserve root test id fallback")
assert(tagGroupSource.includes('data-testid={dataTestID ?? "tag-group"}'), "TagGroup must preserve test id fallback")
assert(
  tagGroupSource.includes("renderEmptyState={resolvedRenderEmptyState}"),
  "TagGroup must preserve empty-state slot",
)
assert(
  tagGroupHelpersSource.includes("export type TTagGroupProps"),
  "TagGroup helpers must export the local props type",
)
assert(
  tagGroupHelpersSource.includes("export const ORIENTATION__HORIZONTAL"),
  "TagGroup helpers must export horizontal orientation",
)
assert(
  adobeTagHelpersSource.includes('from "../../../tokens/geometry"'),
  "AdobeTag helpers must import package-local geometry tokens",
)
assert(
  adobeTagHelpersSource.includes('from "../../../tokens/theme-order"'),
  "AdobeTag helpers must import package-local theme-order tokens",
)
assert(adobeTagHelpersSource.includes("export type TTagProps"), "AdobeTag helpers must export the local props type")
assert(
  adobeTagHelpersSource.includes("export const calibrateComponent"),
  "AdobeTag calibration helper must remain local",
)
assert(defaultCloseIconSource.includes("resolveIconColor"), "Default close icon helper must remain local")
;[
  tagGroupSource,
  tagGroupHelpersSource,
  tagGroupStylesSource,
  adobeTagSource,
  adobeTagHelpersSource,
  adobeTagStylesSource,
  defaultCloseIconSource,
  compatibilityBridgeSource,
].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "TagGroup runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(
    tagGroupStylesSource.includes(selector) || adobeTagStylesSource.includes(selector),
    `TagGroup CSS modules must include ${selector}`,
  )
})
requiredCompatibilityAliases.forEach((cssVariable) => {
  assert(compatibilityBridgeSource.includes(cssVariable), `TagGroup compatibility bridge must define ${cssVariable}`)
})
assert(tagGroupStylesSource.includes("var(--cui-control-placeholder)"), "TagGroup styles must read placeholder roles")
assert(adobeTagStylesSource.includes("var(--cui-control-border)"), "AdobeTag styles must read control border roles")
assert(
  adobeTagStylesSource.includes("var(--cui-tag-primary-selected-background)"),
  "AdobeTag styles must read tag roles",
)

assert(
  publicIndexSource.includes('export { TagGroup } from "./components/TagGroup"'),
  "Package index must export TagGroup",
)
assert(
  publicIndexSource.includes('export type { TagGroupOrientation, TagGroupProps } from "./components/TagGroup"'),
  "Package index must export TagGroup types without colliding with standalone TagProps",
)
assert(!publicIndexSource.includes('export { Tag } from "./components/TagGroup"'), "Package index must not shadow Tag")
assert(
  tagGroupIndexSource.includes('export { default as TagGroup } from "./TagGroup"'),
  "TagGroup index must export root",
)
assert(
  tagGroupIndexSource.includes('export { default as Tag } from "./AdobeTag/AdobeTag"'),
  "TagGroup index must export the nested Tag intent",
)
assert(tagGroupIndexSource.includes("TTagGroupProps as TagGroupProps"), "TagGroup index must export props alias")
assert(tagGroupIndexSource.includes("TTagProps as TagProps"), "TagGroup index must export nested Tag props alias")
assert(!tagGroupIndexSource.includes("calibrateComponent"), "TagGroup index must not export calibration internals")

assert(packet.name === "tag-group", "TagGroup packet must describe the tag-group item")
assert(packet.type === "component", "TagGroup packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "TagGroup packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "TagGroup packet must record Wavemap as the analyzed source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#taggroup-next-candidate-planning-checkpoint"),
  "TagGroup packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `TagGroup packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `TagGroup packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "TagGroup packet test files must remain optional source evidence",
)

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TagGroup" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/TagGroup/TagGroup.tsx",
  ),
  "TagGroup packet must define the public TagGroup export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Tag" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/TagGroup/AdobeTag/AdobeTag.tsx",
  ),
  "TagGroup packet must define the nested Tag export intent",
)
assert(packet.registryDependencies.includes("theme-css"), "TagGroup packet must depend on the default theme")
assert(
  packet.registryDependencies.includes("theme/tag-group-compatibility"),
  "TagGroup packet must include the TagGroup proof compatibility bridge",
)
assert(packet.registryDependencies.includes("tokens/geometry"), "TagGroup packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "TagGroup packet must depend on theme-order tokens")
assert(!packet.registryDependencies.includes("button"), "TagGroup packet must not depend on Wavemap Button")
assert(packet.peerDependencies.react, "TagGroup packet must declare the React peer dependency")
assert(packet.peerDependencies["react-dom"], "TagGroup packet must declare the React DOM peer dependency")
assert(packet.peerDependencies["react-aria-components"], "TagGroup packet must declare the React Aria peer dependency")
assert(packet.runtimeDependencies.classnames, "TagGroup packet must declare the classnames runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "TagGroup packet must record default theme contract pressure")
assert(
  defaultContractRequirement.cssVariables.includes("--cui-control-placeholder") &&
    defaultContractRequirement.cssVariables.includes("--cui-control-selected-background") &&
    defaultContractRequirement.cssVariables.includes("--cui-state-danger"),
  "TagGroup packet must record control and status role pressure",
)

const compatibilityBridgeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "proof-compatibility-bridge",
)
assert(compatibilityBridgeRequirement, "TagGroup packet must record proof compatibility bridge pressure")
requiredCompatibilityAliases.forEach((cssVariable) => {
  const cssVariableName = cssVariable.split(":")[0]
  assert(
    compatibilityBridgeRequirement.cssVariables.includes(cssVariableName),
    `TagGroup packet must record bridge pressure for ${cssVariableName}`,
  )
})
assert(
  compatibilityBridgeRequirement.files.some(
    (file) => file.sourcePath === "packages/react/src/components/TagGroup/tag-group-compatibility.css",
  ),
  "TagGroup packet must point at the separate TagGroup compatibility bridge",
)
assert(
  compatibilityBridgeRequirement.notes.some((note) => note.includes("standalone Tag bridge")),
  "TagGroup packet must preserve bridge separation intent",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "TagGroup packet must record the geometry import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Button/Button" &&
      resolution.replacementSource === "react-aria-components#Button",
  ),
  "TagGroup packet must record the bounded remove-button rewrite",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "TagGroup packet must point at the package-side proof harness",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react typecheck"),
  "TagGroup packet must point at package typecheck verification",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a tag-group manifest item")),
  "TagGroup packet must keep manifest activation separate from source receipt",
)
assert(
  packetWrapperSource.includes("tagGroupIngestPacketData") &&
    packetWrapperSource.includes("tag-group-ingest-packet.data.json"),
  "TagGroup packet wrapper must import the packet data",
)
assert(registryIndexSource.includes("tagGroupIngestPacket"), "Registry index must export the TagGroup ingest packet")

if (process.exitCode) process.exit(process.exitCode)
console.log("[tag-group-proof] source receipt proof passed")
