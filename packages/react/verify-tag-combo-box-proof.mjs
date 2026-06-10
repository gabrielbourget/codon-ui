import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const tagComboBoxSourcePath = path.join(packageRoot, "src/components/TagComboBox/TagComboBox.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/TagComboBox/helpers.ts")
const labelsSourcePath = path.join(packageRoot, "src/components/TagComboBox/labels.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/TagComboBox/TagComboBoxStyles.module.css")
const tagComboBoxIndexPath = path.join(packageRoot, "src/components/TagComboBox/index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/tag-combo-box-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/tag-combo-box-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[tag-combo-box-proof] ${message}`)
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
const forbiddenLegacyCssPattern =
  /--distance_|--border_radius_|--disabledOpacity|--borderColorTransition|--focus-ring-color/u
const requiredPackageFileSources = [
  "packages/react/src/components/TagComboBox/TagComboBox.tsx",
  "packages/react/src/components/TagComboBox/helpers.ts",
  "packages/react/src/components/TagComboBox/labels.ts",
  "packages/react/src/components/TagComboBox/TagComboBoxStyles.module.css",
  "packages/react/src/components/TagComboBox/__tests__/TagComboBox.test.tsx",
]
const requiredTargetPaths = [
  "TagComboBox/TagComboBox.tsx",
  "TagComboBox/helpers.ts",
  "TagComboBox/labels.ts",
  "TagComboBox/TagComboBoxStyles.module.css",
  "TagComboBox/__tests__/TagComboBox.test.tsx",
]
const requiredStyleSelectors = [
  ".tagComboBox",
  '.tagComboBox[aria-disabled="true"]',
  ".tagComboBox--rounded",
  ".tagComboBox--round",
  ".tagComboBox--applyFocusStyle[data-focus-within]",
  ".tagComboBox--errorState",
  ".tagComboBox--warningState",
  ".tagComboBox--successState",
]
const requiredDefaultVariables = [
  "--aui-control-border",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-radius-1",
  "--aui-space-1",
  "--aui-transition-border-color",
  "--aui-validation-error-border",
  "--aui-validation-warning-border",
  "--aui-validation-success-border",
]

const tagComboBoxSource = readRequiredText(tagComboBoxSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const tagComboBoxIndexSource = readRequiredText(tagComboBoxIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(tagComboBoxSource.startsWith('"use client"'), "TagComboBox must preserve the client component boundary")
assert(tagComboBoxSource.includes('from "react-aria-components"'), "TagComboBox must import React Aria")
assert(tagComboBoxSource.includes('from "../ComboBox/ComboBox"'), "TagComboBox must compose package-local ComboBox")
assert(tagComboBoxSource.includes('from "../TagGroup/AdobeTag/AdobeTag"'), "TagComboBox must compose nested Tag")
assert(tagComboBoxSource.includes('from "../TagGroup/TagGroup"'), "TagComboBox must compose package-local TagGroup")
assert(tagComboBoxSource.includes('from "../Text/Text"'), "TagComboBox must compose package-local Text")
assert(tagComboBoxSource.includes("<Group"), "TagComboBox must render React Aria Group")
assert(tagComboBoxSource.includes("<TagGroup"), "TagComboBox must render selected TagGroup")
assert(tagComboBoxSource.includes("<Tag"), "TagComboBox must render selected tags")
assert(tagComboBoxSource.includes("<ComboBox"), "TagComboBox must render the installed ComboBox")
assert(
  tagComboBoxSource.includes('data-testid={dataTestID ?? "tag-combobox"}'),
  "TagComboBox root test id fallback must stay",
)
assert(tagComboBoxSource.includes("selectedKeySet"), "TagComboBox must filter already-selected items")
assert(tagComboBoxSource.includes("onSelectedItemsChange"), "TagComboBox must preserve selected-item callback")
assert(tagComboBoxSource.includes('action: "add"'), "TagComboBox must preserve add change detail")
assert(tagComboBoxSource.includes('action: "remove"'), "TagComboBox must preserve remove change detail")
assert(tagComboBoxSource.includes("customTagGroupProps"), "TagComboBox must preserve custom TagGroup prop bag")
assert(tagComboBoxSource.includes("customComboBoxProps"), "TagComboBox must preserve custom ComboBox prop bag")
assert(tagComboBoxSource.includes("resolveTagComboBoxLabels"), "TagComboBox must resolve local labels")

assert(
  helpersSource.includes('from "../../tokens/geometry"') && helpersSource.includes("type TCornerGeometry"),
  "TagComboBox helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/placement"') &&
    helpersSource.includes("TAvailablePopoverPlacementPositions"),
  "TagComboBox helpers must import package-local placement token type",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"') && helpersSource.includes("TThemingOrderCode"),
  "TagComboBox helpers must import package-local theme-order token type",
)
assert(helpersSource.includes('from "../ComboBox/helpers"'), "TagComboBox helpers must import ComboBox props locally")
assert(
  helpersSource.includes('from "../TagGroup/AdobeTag/helpers"'),
  "TagComboBox helpers must import Tag props locally",
)
assert(helpersSource.includes('from "../TagGroup/helpers"'), "TagComboBox helpers must import TagGroup props locally")
assert(helpersSource.includes('from "../Text/constants"'), "TagComboBox helpers must import Text constants locally")
assert(helpersSource.includes('from "../Text/types"'), "TagComboBox helpers must import Text types locally")
assert(helpersSource.includes("export type TTagComboBoxProps"), "TagComboBox helpers must export local props")
assert(helpersSource.includes("T extends object = object"), "TagComboBox props must avoid any default generic")
assert(
  helpersSource.includes("export type TTagComboBoxChangeDetails"),
  "TagComboBox helpers must export change-detail type",
)
assert(helpersSource.includes("TAGCOMBOBOX_SIZE__SM"), "TagComboBox size constants must stay local")
assert(helpersSource.includes("export const calibrateComponent"), "TagComboBox calibration helper must remain local")

assert(labelsSource.includes("DEFAULT_TAG_COMBO_BOX_LABELS"), "TagComboBox labels must keep default labels")
assert(labelsSource.includes("TPartialTagComboBoxLabels"), "TagComboBox labels must keep partial label type")
assert(labelsSource.includes("resolveTagComboBoxLabels"), "TagComboBox labels must keep resolver")
;[tagComboBoxSource, helpersSource, labelsSource, stylesSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "TagComboBox runtime source must not import consumer-only modules",
  )
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `TagComboBox CSS module must include ${selector}`)
})
requiredDefaultVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `TagComboBox CSS must read ${cssVariable}`)
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "TagComboBox CSS must not read legacy Wavemap aliases")
assert(!stylesSource.includes("theme/tag-combo-box-compatibility"), "TagComboBox must not need a bridge item")

assert(
  publicIndexSource.includes('export { TagComboBox } from "./components/TagComboBox"'),
  "Package index must export TagComboBox",
)
assert(
  publicIndexSource.includes(
    'export type { TagComboBoxChangeDetails, TagComboBoxProps } from "./components/TagComboBox"',
  ),
  "Package index must export TagComboBox public types",
)
assert(!publicIndexSource.includes("TAGCOMBOBOX_SIZE__"), "Package index must not export TagComboBox internals")
assert(
  tagComboBoxIndexSource.includes('export { default as TagComboBox } from "./TagComboBox"'),
  "TagComboBox index must export component",
)
assert(tagComboBoxIndexSource.includes("TTagComboBoxProps as TagComboBoxProps"), "TagComboBox index must export props")
assert(
  tagComboBoxIndexSource.includes("TTagComboBoxChangeDetails as TagComboBoxChangeDetails"),
  "TagComboBox index must export change details",
)
assert(!tagComboBoxIndexSource.includes("calibrateComponent"), "TagComboBox index must not export internals")
assert(!tagComboBoxIndexSource.includes("TAGCOMBOBOX_SIZE__"), "TagComboBox index must not export size constants")

assert(packageJson.dependencies.classnames, "TagComboBox package must keep classnames runtime dependency")
assert(packageJson.dependencies.motion === "^12.40.0", "TagComboBox package must keep Motion runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "TagComboBox React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "TagComboBox package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "TagComboBox package must keep React DOM peer dependency")
assert(
  packageJson.scripts.test.includes("verify-tag-combo-box-proof.mjs"),
  "Package test script must run TagComboBox proof",
)

assert(packet.name === "tag-combo-box", "TagComboBox packet must describe the tag-combo-box item")
assert(packet.type === "component", "TagComboBox packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "TagComboBox packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "TagComboBox packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#tagcombobox-next-candidate-planning-checkpoint"),
  "TagComboBox packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `TagComboBox packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `TagComboBox packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "TagComboBox packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TagComboBox" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/TagComboBox/TagComboBox.tsx",
  ),
  "TagComboBox packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TagComboBoxProps" &&
      publicExport.localName === "TTagComboBoxProps" &&
      publicExport.sourcePath === "packages/react/src/components/TagComboBox/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "TagComboBox packet must define the public props type alias intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TagComboBoxChangeDetails" &&
      publicExport.localName === "TTagComboBoxChangeDetails" &&
      publicExport.sourcePath === "packages/react/src/components/TagComboBox/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "TagComboBox packet must define the public change-details type alias intent",
)
;["theme-css", "tokens/geometry", "tokens/placement", "tokens/theme-order", "text", "combo-box", "tag-group"].forEach(
  (registryDependency) => {
    assert(
      packet.registryDependencies.includes(registryDependency),
      `TagComboBox packet must depend on ${registryDependency}`,
    )
  },
)
assert(!packet.registryDependencies.includes("list-box-item"), "ListBoxItem must remain example-only for TagComboBox")
assert(
  !packet.registryDependencies.includes("theme/tag-combo-box-compatibility"),
  "TagComboBox must not need a bridge item",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "TagComboBox packet must declare React Aria")
assert(packet.runtimeDependencies.classnames, "TagComboBox packet must declare classnames runtime dependency")
assert(packet.runtimeDependencies.motion === "^12.40.0", "TagComboBox packet must record Motion graph dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "TagComboBox packet must record default-contract theme pressure")
requiredDefaultVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `TagComboBox packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/ComboBox/ComboBox" &&
      resolution.registryDependencyName === "combo-box",
  ),
  "TagComboBox packet must record ComboBox import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/TagGroup/TagGroup" &&
      resolution.registryDependencyName === "tag-group",
  ),
  "TagComboBox packet must record TagGroup import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/TagGroup/AdobeTag/AdobeTag" &&
      resolution.registryDependencyName === "tag-group",
  ),
  "TagComboBox packet must record nested Tag import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/Text" && resolution.registryDependencyName === "text",
  ),
  "TagComboBox packet must record Text import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/placement" && resolution.replacementSource.includes("placement"),
  ),
  "TagComboBox packet must record placement token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/theme-order" &&
      resolution.replacementSource.includes("theme-order"),
  ),
  "TagComboBox packet must record theme-order token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--distance_1") && resolution.replacementSource.includes("--aui-space-1"),
  ),
  "TagComboBox packet must record legacy CSS variable rewrite",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/MultiSelectTypeFilterArgument/MultiSelectTypeFilterArgument.tsx",
  ),
  "MultiSelectTypeFilterArgument must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Pagination/Pagination.tsx"),
  "Pagination must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Breadcrumbs/Breadcrumbs.tsx"),
  "Breadcrumbs must stay out",
)

assert(
  packet.notes.some((note) => note.includes("does not activate a tag-combo-box manifest item")),
  "TagComboBox packet must keep manifest activation separate from source receipt",
)
assert(packetWrapperSource.includes("tagComboBoxIngestPacketData"), "TagComboBox packet wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { tagComboBoxIngestPacket } from "./tag-combo-box-ingest-packet"'),
  "Registry index must export TagComboBox packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[tag-combo-box-proof] source receipt checks passed")
