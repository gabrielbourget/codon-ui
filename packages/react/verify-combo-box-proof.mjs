import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const comboBoxSourcePath = path.join(packageRoot, "src/components/ComboBox/ComboBox.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/ComboBox/helpers.tsx")
const labelsSourcePath = path.join(packageRoot, "src/components/ComboBox/labels.ts")
const iconSourcePath = path.join(packageRoot, "src/components/ComboBox/DefaultChevronDownIcon.tsx")
const stylesSourcePath = path.join(packageRoot, "src/components/ComboBox/ComboBoxStyles.module.css")
const comboBoxIndexPath = path.join(packageRoot, "src/components/ComboBox/index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/combo-box-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/combo-box-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[combo-box-proof] ${message}`)
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
  /--distance_|--border_radius_|--disabledOpacity|--shadow_1|--borderColorTransition|--focus-ring-color|--fadeInAnimation|--fadeOutAnimation/u
const requiredPackageFileSources = [
  "packages/react/src/components/ComboBox/ComboBox.tsx",
  "packages/react/src/components/ComboBox/helpers.tsx",
  "packages/react/src/components/ComboBox/labels.ts",
  "packages/react/src/components/ComboBox/DefaultChevronDownIcon.tsx",
  "packages/react/src/components/ComboBox/ComboBoxStyles.module.css",
  "packages/react/src/components/ComboBox/__tests__/ComboBox.test.tsx",
]
const requiredTargetPaths = [
  "ComboBox/ComboBox.tsx",
  "ComboBox/helpers.tsx",
  "ComboBox/labels.ts",
  "ComboBox/DefaultChevronDownIcon.tsx",
  "ComboBox/ComboBoxStyles.module.css",
  "ComboBox/__tests__/ComboBox.test.tsx",
]
const requiredStyleSelectors = [
  ".comboBox",
  ".comboBox__emptyList",
  ".comboBox__iconColor",
  ".comboBox[data-disabled]",
  ".inputButtonGroup",
  ".inputButtonGroup--rounded",
  ".inputButtonGroup--round",
  ".inputButtonGroup--applyFocusStyle[data-focus-within]",
  ".inputButtonGroup--errorState",
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
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-radius-1",
  "--aui-shadow-1",
  "--aui-space-1",
  "--aui-surface",
  "--aui-transition-border-color",
  "--aui-validation-error-border",
  "--aui-validation-warning-border",
  "--aui-validation-success-border",
]

const comboBoxSource = readRequiredText(comboBoxSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const iconSource = readRequiredText(iconSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const comboBoxIndexSource = readRequiredText(comboBoxIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(comboBoxSource.includes('from "motion/react"'), "ComboBox must keep Motion chevron animation")
assert(comboBoxSource.includes('from "react-aria-components"'), "ComboBox must import React Aria")
assert(comboBoxSource.includes('from "../Button/Button"'), "ComboBox must compose package-local Button")
assert(comboBoxSource.includes('from "../Input/Input"'), "ComboBox must compose package-local Input")
assert(
  comboBoxSource.includes('from "../Text/variants/PlaceholderText/PlaceholderText"'),
  "ComboBox must compose package-local PlaceholderText",
)
assert(comboBoxSource.includes("<AdobeComboBox"), "ComboBox must render React Aria ComboBox")
assert(comboBoxSource.includes("<Group"), "ComboBox must render React Aria Group")
assert(comboBoxSource.includes("<Popover"), "ComboBox must render React Aria Popover")
assert(comboBoxSource.includes("<ListBox"), "ComboBox must render React Aria ListBox")
assert(comboBoxSource.includes('data-testid={dataTestID ?? "combo-box"}'), "ComboBox root test id fallback must stay")
assert(comboBoxSource.includes("renderEmptyState"), "ComboBox must preserve empty-state rendering")
assert(comboBoxSource.includes("resolveComboBoxLabels"), "ComboBox must resolve local labels")
assert(!comboBoxSource.includes("customStyles__props}"), "ComboBox must not forward customStyles")

assert(
  helpersSource.includes('from "../../tokens/geometry"') && helpersSource.includes("type TCornerGeometry"),
  "ComboBox helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/placement"') &&
    helpersSource.includes("TAvailablePopoverPlacementPositions"),
  "ComboBox helpers must import package-local placement token type",
)
assert(helpersSource.includes("export type TComboBoxProps"), "ComboBox helpers must export local props")
assert(helpersSource.includes("T extends object = object"), "ComboBox props must avoid any default generic")
assert(helpersSource.includes("COMBOBOX_SIZE__SM"), "ComboBox size constants must stay local")
assert(helpersSource.includes("export const calibrateComponent"), "ComboBox calibration helper must remain local")
assert(
  helpersSource.includes("mergeComboBoxClassNames") && helpersSource.includes("computeComboBoxStyle"),
  "ComboBox must preserve native className/style merge helpers",
)

assert(labelsSource.includes("DEFAULT_COMBO_BOX_LABELS"), "ComboBox labels must keep default labels")
assert(labelsSource.includes("TPartialComboBoxLabels"), "ComboBox labels must keep partial label type")
assert(labelsSource.includes("resolveComboBoxLabels"), "ComboBox labels must keep resolver")

assert(iconSource.includes("<svg"), "ComboBox default chevron icon must stay local")
assert(
  iconSource.includes('stroke = !color || color === "inherit" ? "currentColor" : color'),
  "Icon color behavior must stay",
)
;[comboBoxSource, helpersSource, labelsSource, iconSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "ComboBox runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `ComboBox CSS module must include ${selector}`)
})
requiredDefaultVariables
  .filter((cssVariable) => !cssVariable.startsWith("--aui-validation"))
  .forEach((cssVariable) => {
    assert(stylesSource.includes(`var(${cssVariable})`), `ComboBox CSS must read ${cssVariable}`)
  })
assert(!forbiddenLegacyCssPattern.test(stylesSource), "ComboBox CSS must not read legacy Wavemap aliases")
assert(!stylesSource.includes("theme/combobox-compatibility"), "ComboBox must not need a bridge item")

requiredDefaultVariables.forEach((cssVariable) => {
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
})
assert(themeCSS.includes("@keyframes fade-in"), "theme.css must define fade-in keyframes")
assert(themeCSS.includes("@keyframes fade-out"), "theme.css must define fade-out keyframes")

assert(
  publicIndexSource.includes('export { ComboBox } from "./components/ComboBox"'),
  "Package index must export ComboBox",
)
assert(
  publicIndexSource.includes('export type { ComboBoxProps } from "./components/ComboBox"'),
  "Package index must export ComboBoxProps",
)
assert(!publicIndexSource.includes("COMBOBOX_SIZE__"), "Package index must not export ComboBox internals")
assert(
  comboBoxIndexSource.includes('export { default as ComboBox } from "./ComboBox"'),
  "ComboBox index must export component",
)
assert(comboBoxIndexSource.includes("TComboBoxProps as ComboBoxProps"), "ComboBox index must export props")
assert(!comboBoxIndexSource.includes("calibrateComponent"), "ComboBox index must not export internals")
assert(!comboBoxIndexSource.includes("COMBOBOX_SIZE__"), "ComboBox index must not export size constants")

assert(packageJson.dependencies.classnames, "ComboBox package must keep classnames runtime dependency")
assert(packageJson.dependencies.motion === "^12.40.0", "ComboBox package must keep Motion runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "ComboBox React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "ComboBox package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "ComboBox package must keep React DOM peer dependency")
assert(packageJson.scripts.test.includes("verify-combo-box-proof.mjs"), "Package test script must run ComboBox proof")

assert(packet.name === "combo-box", "ComboBox packet must describe the combo-box item")
assert(packet.type === "component", "ComboBox packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "ComboBox packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "ComboBox packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#combobox-next-candidate-planning-checkpoint"),
  "ComboBox packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `ComboBox packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `ComboBox packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "ComboBox packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ComboBox" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/ComboBox/ComboBox.tsx",
  ),
  "ComboBox packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ComboBoxProps" &&
      publicExport.localName === "TComboBoxProps" &&
      publicExport.sourcePath === "packages/react/src/components/ComboBox/helpers.tsx" &&
      publicExport.typeOnly === true,
  ),
  "ComboBox packet must define the public props type alias intent",
)
;["theme-css", "tokens/geometry", "tokens/placement", "button", "input", "placeholder-text"].forEach(
  (registryDependency) => {
    assert(
      packet.registryDependencies.includes(registryDependency),
      `ComboBox packet must depend on ${registryDependency}`,
    )
  },
)
assert(!packet.registryDependencies.includes("list-box-item"), "ListBoxItem must remain example-only for ComboBox")
assert(!packet.registryDependencies.includes("theme/combobox-compatibility"), "ComboBox must not need a bridge item")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "ComboBox packet must declare React Aria")
assert(packet.runtimeDependencies.classnames, "ComboBox packet must declare classnames runtime dependency")
assert(packet.runtimeDependencies.motion === "^12.40.0", "ComboBox packet must declare Motion runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "ComboBox packet must record default-contract theme pressure")
requiredDefaultVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `ComboBox packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Button/Button" && resolution.registryDependencyName === "button",
  ),
  "ComboBox packet must record Button import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Input/Input" && resolution.registryDependencyName === "input",
  ),
  "ComboBox packet must record Input import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/variants/PlaceholderText/PlaceholderText" &&
      resolution.registryDependencyName === "placeholder-text",
  ),
  "ComboBox packet must record PlaceholderText import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/placement" && resolution.replacementSource.includes("placement"),
  ),
  "ComboBox packet must record placement token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--distance_1") && resolution.replacementSource.includes("--aui-space-1"),
  ),
  "ComboBox packet must record legacy CSS variable rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/TagComboBox/TagComboBox.tsx"),
  "TagComboBox must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Pagination/Pagination.tsx"),
  "Pagination must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Breadcrumbs/Breadcrumbs.tsx"),
  "Breadcrumbs must stay out",
)

assert(packetWrapperSource.includes("comboBoxIngestPacketData"), "ComboBox packet wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { comboBoxIngestPacket } from "./combo-box-ingest-packet"'),
  "Registry index must export ComboBox packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[combo-box-proof] source receipt checks passed")
