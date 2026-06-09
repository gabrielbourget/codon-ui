import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const listBoxItemSourcePath = path.join(packageRoot, "src/components/ListBoxItem/ListBoxItem.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/ListBoxItem/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/ListBoxItem/ListBoxItemStyles.module.css")
const listBoxItemIndexPath = path.join(packageRoot, "src/components/ListBoxItem/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/list-box-item-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/list-box-item-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[list-box-item-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\/|motion\/react|@radix-ui|@internationalized\/date/u
const forbiddenLegacyCssPattern = /--distance_|--border_radius_|--bgColorTransition|--disabledOpacity/u
const requiredPackageFileSources = [
  "packages/react/src/components/ListBoxItem/ListBoxItem.tsx",
  "packages/react/src/components/ListBoxItem/helpers.ts",
  "packages/react/src/components/ListBoxItem/ListBoxItemStyles.module.css",
  "packages/react/src/components/ListBoxItem/__tests__/ListBoxItem.test.tsx",
]
const requiredTargetPaths = [
  "ListBoxItem/ListBoxItem.tsx",
  "ListBoxItem/helpers.ts",
  "ListBoxItem/ListBoxItemStyles.module.css",
  "ListBoxItem/__tests__/ListBoxItem.test.tsx",
]
const requiredStyleSelectors = [
  ".listBoxItem",
  ".listBoxItem[data-hovered]",
  ".listBoxItem[data-focused]",
  ".listBoxItem[data-selected]",
  '.listBoxItem[data-disabled="true"]',
  ".listBoxItem:link",
  ".listBoxItem:visited",
]
const requiredDefaultVariables = [
  "--aui-space-1",
  "--aui-radius-1",
  "--aui-transition-background-color",
  "--aui-control-hover-background",
  "--aui-opacity-disabled",
]

const listBoxItemSource = readRequiredText(listBoxItemSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const listBoxItemIndexSource = readRequiredText(listBoxItemIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(listBoxItemSource.includes('from "react-aria-components"'), "ListBoxItem must import React Aria")
assert(listBoxItemSource.includes("<AdobeListBoxItem"), "ListBoxItem must render React Aria ListBoxItem")
assert(listBoxItemSource.includes("FC<TListBoxItemProps<object>>"), "ListBoxItem props type must stay explicit")
assert(
  listBoxItemSource.includes('data-testid={dataTestID ?? "listbox-item"}'),
  "ListBoxItem root test id fallback must stay",
)
assert(listBoxItemSource.includes("{...rest}"), "ListBoxItem must forward React Aria props")
assert(!listBoxItemSource.includes("customStyles__props}"), "ListBoxItem must not forward customStyles")

assert(
  helpersSource.includes('from "../Text/TextStyles.module.css"'),
  "ListBoxItem helpers must import package-local Text styles",
)
assert(helpersSource.includes("type RequiresID"), "ListBoxItem id/textValue requirement must stay private")
assert(helpersSource.includes("id: Key"), "ListBoxItem must keep required id typing")
assert(helpersSource.includes("export type TListBoxItemProps"), "ListBoxItem helpers must export local props")
assert(helpersSource.includes("LISTBOX_ITEM__SIZE_SM"), "ListBoxItem size constants must stay local")
assert(helpersSource.includes("export const calibrateComponent"), "ListBoxItem calibration helper must remain local")
assert(helpersSource.includes('textStyles["fw-regular"]'), "ListBoxItem must apply regular Text weight")
assert(
  helpersSource.includes("mergeListBoxItemClassNames") && helpersSource.includes("computeListBoxItemStyle"),
  "ListBoxItem must preserve native className/style merge helpers",
)
;[listBoxItemSource, helpersSource, stylesSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "ListBoxItem runtime source must not import consumer-only modules",
  )
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `ListBoxItem CSS module must include ${selector}`)
})
requiredDefaultVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `ListBoxItem CSS must read ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "ListBoxItem CSS must not read legacy Wavemap aliases")
assert(!stylesSource.includes("theme/list-box-item-compatibility"), "ListBoxItem must not need a bridge item")

assert(
  publicIndexSource.includes('export { ListBoxItem } from "./components/ListBoxItem"'),
  "Package index must export ListBoxItem",
)
assert(
  publicIndexSource.includes('export type { ListBoxItemProps } from "./components/ListBoxItem"'),
  "Package index must export ListBoxItemProps",
)
assert(!publicIndexSource.includes("LISTBOX_ITEM__SIZE_"), "Package index must not export ListBoxItem internals")
assert(
  listBoxItemIndexSource.includes('export { default as ListBoxItem } from "./ListBoxItem"'),
  "ListBoxItem index must export component",
)
assert(listBoxItemIndexSource.includes("TListBoxItemProps as ListBoxItemProps"), "ListBoxItem index must export props")
assert(!listBoxItemIndexSource.includes("calibrateComponent"), "ListBoxItem index must not export internals")
assert(!listBoxItemIndexSource.includes("LISTBOX_ITEM__SIZE_"), "ListBoxItem index must not export size constants")

assert(packageJson.dependencies.classnames, "ListBoxItem package must keep classnames runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "ListBoxItem React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "ListBoxItem package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "ListBoxItem package must keep React DOM peer dependency")

assert(packet.name === "list-box-item", "ListBoxItem packet must describe the list-box-item item")
assert(packet.type === "component", "ListBoxItem packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "ListBoxItem packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "ListBoxItem packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#listboxitem-next-candidate-planning-checkpoint"),
  "ListBoxItem packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `ListBoxItem packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `ListBoxItem packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "ListBoxItem packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ListBoxItem" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/ListBoxItem/ListBoxItem.tsx",
  ),
  "ListBoxItem packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ListBoxItemProps" &&
      publicExport.localName === "TListBoxItemProps" &&
      publicExport.sourcePath === "packages/react/src/components/ListBoxItem/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "ListBoxItem packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "ListBoxItem packet must depend on default theme")
assert(packet.registryDependencies.includes("text"), "ListBoxItem packet must depend on installed Text")
assert(
  !packet.registryDependencies.includes("theme/list-box-item-compatibility"),
  "ListBoxItem must not need a bridge item",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "ListBoxItem packet must declare React Aria")
assert(packet.runtimeDependencies.classnames, "ListBoxItem packet must declare classnames runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "ListBoxItem packet must record default-contract theme pressure")
requiredDefaultVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `ListBoxItem packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/TextStyles.module.css" &&
      resolution.registryDependencyName === "text",
  ),
  "ListBoxItem packet must record Text style import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--distance_1") && resolution.replacementSource.includes("--aui-space-1"),
  ),
  "ListBoxItem packet must record legacy CSS variable rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Select/Select.tsx"),
  "Select must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/ComboBox/ComboBox.tsx"),
  "ComboBox must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/TagComboBox/TagComboBox.tsx"),
  "TagComboBox must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Pagination/Pagination.tsx"),
  "Pagination must stay out",
)

assert(packetWrapperSource.includes("listBoxItemIngestPacketData"), "ListBoxItem packet wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { listBoxItemIngestPacket } from "./list-box-item-ingest-packet"'),
  "Registry index must export ListBoxItem packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[list-box-item-proof] source receipt checks passed")
