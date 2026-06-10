import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const selectSourcePath = path.join(packageRoot, "src/components/Select/Select.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Select/helpers.tsx")
const iconSourcePath = path.join(packageRoot, "src/components/Select/DefaultChevronDownIcon.tsx")
const stylesSourcePath = path.join(packageRoot, "src/components/Select/SelectStyles.module.css")
const selectIndexPath = path.join(packageRoot, "src/components/Select/index.ts")
const placementTokenPath = path.join(packageRoot, "src/tokens/placement.ts")
const tokenIndexPath = path.join(packageRoot, "src/tokens/index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/select-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/select-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[select-proof] ${message}`)
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
  /--distance_|--border_radius_|--disabledOpacity|--shadow_1|--focus-ring-color|--fadeInAnimation|--fadeOutAnimation/u
const requiredPackageFileSources = [
  "packages/react/src/components/Select/Select.tsx",
  "packages/react/src/components/Select/helpers.tsx",
  "packages/react/src/components/Select/DefaultChevronDownIcon.tsx",
  "packages/react/src/components/Select/SelectStyles.module.css",
  "packages/react/src/components/Select/__tests__/Select.test.tsx",
]
const requiredTargetPaths = [
  "Select/Select.tsx",
  "Select/helpers.tsx",
  "Select/DefaultChevronDownIcon.tsx",
  "Select/SelectStyles.module.css",
  "Select/__tests__/Select.test.tsx",
]
const requiredStyleSelectors = [
  ".select",
  ".select--rounded",
  ".select--round",
  ".select__emptyList",
  ".select__iconColor",
  ".select[data-disabled]",
  ".selectedItem[data-placeholder]",
  ".popover[data-entering]",
  ".popover[data-exiting]",
  ".optionsList[data-focused]",
]
const requiredDefaultVariables = [
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-control-background",
  "--aui-control-border",
  "--aui-control-foreground",
  "--aui-control-placeholder",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-radius-1",
  "--aui-shadow-1",
  "--aui-space-1",
  "--aui-surface",
  "--aui-validation-error-border",
  "--aui-validation-warning-border",
  "--aui-validation-success-border",
]

const selectSource = readRequiredText(selectSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const iconSource = readRequiredText(iconSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const selectIndexSource = readRequiredText(selectIndexPath)
const placementTokenSource = readRequiredText(placementTokenPath)
const tokenIndexSource = readRequiredText(tokenIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(selectSource.includes('from "motion/react"'), "Select must keep Motion chevron animation")
assert(selectSource.includes('from "react-aria-components"'), "Select must import React Aria")
assert(selectSource.includes('from "../Button/Button"'), "Select must compose package-local Button")
assert(
  selectSource.includes('from "../Text/variants/PlaceholderText/PlaceholderText"'),
  "Select must compose package-local PlaceholderText",
)
assert(selectSource.includes("<AdobeSelect"), "Select must render React Aria Select")
assert(selectSource.includes("<SelectValue"), "Select must render React Aria SelectValue")
assert(selectSource.includes("<Popover"), "Select must render React Aria Popover")
assert(selectSource.includes("<ListBox"), "Select must render React Aria ListBox")
assert(selectSource.includes('data-testid={dataTestID ?? "select"}'), "Select root test id fallback must stay")
assert(selectSource.includes("renderEmptyState"), "Select must preserve empty-state rendering")
assert(!selectSource.includes("customStyles__props}"), "Select must not forward customStyles")

assert(
  helpersSource.includes('from "../../tokens/geometry"') && helpersSource.includes("type TCornerGeometry"),
  "Select helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/placement"') &&
    helpersSource.includes("TAvailablePopoverPlacementPositions"),
  "Select helpers must import package-local placement token type",
)
assert(
  helpersSource.includes('from "../Text/TextStyles.module.css"'),
  "Select helpers must import package-local Text styles",
)
assert(helpersSource.includes("export type TSelectProps"), "Select helpers must export local props")
assert(helpersSource.includes("SELECT_SIZE__SM"), "Select size constants must stay local")
assert(helpersSource.includes("export const calibrateComponent"), "Select calibration helper must remain local")
assert(helpersSource.includes('textStyles["fw-regular"]'), "Select must apply regular Text weight")
assert(
  helpersSource.includes("var(--aui-validation-error-border)") &&
    helpersSource.includes("var(--aui-validation-warning-border)") &&
    helpersSource.includes("var(--aui-validation-success-border)"),
  "Select must preserve validation border variables",
)
assert(helpersSource.includes("var(--aui-control-border)"), "Select must preserve default control border variable")
assert(
  helpersSource.includes("mergeSelectClassNames") && helpersSource.includes("computeSelectStyle"),
  "Select must preserve native className/style merge helpers",
)

assert(iconSource.includes("<svg"), "Select default chevron icon must stay local")
assert(
  iconSource.includes('stroke = !color || color === "inherit" ? "currentColor" : color'),
  "Icon color behavior must stay",
)
;[selectSource, helpersSource, iconSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Select runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Select CSS module must include ${selector}`)
})
requiredDefaultVariables
  .filter((cssVariable) => !cssVariable.startsWith("--aui-validation") && cssVariable !== "--aui-control-border")
  .forEach((cssVariable) => {
    assert(stylesSource.includes(`var(${cssVariable})`), `Select CSS must read ${cssVariable}`)
  })
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Select CSS must not read legacy Wavemap aliases")
assert(!stylesSource.includes("theme/select-compatibility"), "Select must not need a bridge item")

assert(
  placementTokenSource.includes("AVAILABLE_POPOVER_PLACEMENT_POSITIONS") &&
    placementTokenSource.includes("TAvailablePopoverPlacementPositions"),
  "Placement token support must include constants and derived type",
)
assert(tokenIndexSource.includes("TAvailablePopoverPlacementPositions"), "Token index must export placement type")

requiredDefaultVariables.forEach((cssVariable) => {
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
})
assert(themeCSS.includes("@keyframes fade-in"), "theme.css must define fade-in keyframes")
assert(themeCSS.includes("@keyframes fade-out"), "theme.css must define fade-out keyframes")

assert(publicIndexSource.includes('export { Select } from "./components/Select"'), "Package index must export Select")
assert(
  publicIndexSource.includes('export type { SelectProps } from "./components/Select"'),
  "Package index must export SelectProps",
)
assert(!publicIndexSource.includes("SELECT_SIZE__"), "Package index must not export Select internals")
assert(selectIndexSource.includes('export { default as Select } from "./Select"'), "Select index must export component")
assert(selectIndexSource.includes("TSelectProps as SelectProps"), "Select index must export props")
assert(!selectIndexSource.includes("calibrateComponent"), "Select index must not export internals")
assert(!selectIndexSource.includes("SELECT_SIZE__"), "Select index must not export size constants")

assert(packageJson.dependencies.classnames, "Select package must keep classnames runtime dependency")
assert(packageJson.dependencies.motion === "^12.40.0", "Select package must keep Motion runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Select React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "Select package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Select package must keep React DOM peer dependency")

assert(packet.name === "select", "Select packet must describe the select item")
assert(packet.type === "component", "Select packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Select packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Select packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#select-next-candidate-planning-checkpoint"),
  "Select packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Select packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Select packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Select packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Select" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Select/Select.tsx",
  ),
  "Select packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "SelectProps" &&
      publicExport.localName === "TSelectProps" &&
      publicExport.sourcePath === "packages/react/src/components/Select/helpers.tsx" &&
      publicExport.typeOnly === true,
  ),
  "Select packet must define the public props type alias intent",
)
;["theme-css", "tokens/geometry", "tokens/placement", "text", "button", "placeholder-text"].forEach(
  (registryDependency) => {
    assert(
      packet.registryDependencies.includes(registryDependency),
      `Select packet must depend on ${registryDependency}`,
    )
  },
)
assert(!packet.registryDependencies.includes("list-box-item"), "ListBoxItem must remain example-only for Select")
assert(!packet.registryDependencies.includes("theme/select-compatibility"), "Select must not need a bridge item")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Select packet must declare React Aria")
assert(packet.runtimeDependencies.classnames, "Select packet must declare classnames runtime dependency")
assert(packet.runtimeDependencies.motion === "^12.40.0", "Select packet must declare Motion runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "Select packet must record default-contract theme pressure")
requiredDefaultVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Select packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Button/Button" && resolution.registryDependencyName === "button",
  ),
  "Select packet must record Button import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/variants/PlaceholderText/PlaceholderText" &&
      resolution.registryDependencyName === "placeholder-text",
  ),
  "Select packet must record PlaceholderText import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/placement" && resolution.replacementSource.includes("placement"),
  ),
  "Select packet must record placement token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--border_radius_1") && resolution.replacementSource.includes("--aui-radius-1"),
  ),
  "Select packet must record legacy CSS variable rewrite",
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

assert(packetWrapperSource.includes("selectIngestPacketData"), "Select packet wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { selectIngestPacket } from "./select-ingest-packet"'),
  "Registry index must export Select packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[select-proof] source receipt checks passed")
