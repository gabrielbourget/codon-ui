import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const textAreaSourcePath = path.join(packageRoot, "src/components/TextArea/TextArea.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/TextArea/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/TextArea/TextAreaStyles.module.css")
const textAreaIndexPath = path.join(packageRoot, "src/components/TextArea/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/text-area-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/text-area-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[text-area-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\/|motion\/react/u
const forbiddenLegacyCssPattern =
  /--distance_1|--disabledOpacity|--border_radius_1|--borderColorTransition|--focus-ring-color|--cui-validation-error-border|--cui-validation-warning-border|--cui-validation-success-border/u

const textAreaSource = readRequiredText(textAreaSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const textAreaIndexSource = readRequiredText(textAreaIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/TextArea/TextArea.tsx",
  "packages/react/src/components/TextArea/helpers.ts",
  "packages/react/src/components/TextArea/TextAreaStyles.module.css",
  "packages/react/src/components/TextArea/__tests__/TextArea.test.tsx",
]
const requiredTargetPaths = [
  "TextArea/TextArea.tsx",
  "TextArea/helpers.ts",
  "TextArea/TextAreaStyles.module.css",
  "TextArea/__tests__/TextArea.test.tsx",
]
const requiredExcludedSources = [
  "apps/wavemap-front-end/src/components/Input/Input.tsx",
  "apps/wavemap-front-end/src/components/NumberInput/NumberInput.tsx",
  "apps/wavemap-front-end/src/components/Stepper/Stepper.tsx",
  "apps/wavemap-front-end/src/components/ComboBox/ComboBox.tsx",
  "apps/wavemap-front-end/src/components/Select/Select.tsx",
  "apps/wavemap-front-end/src/components/TagComboBox/TagComboBox.tsx",
  "apps/wavemap-front-end/src/components/CompactTypeaheadSearch/CompactTypeaheadSearch.tsx",
  "apps/wavemap-front-end/src/components/Filtering/DynamicFilterArgumentInput/DynamicFilterArgumentInput.tsx",
  "apps/wavemap-front-end/src/components/FormField/FormField.tsx",
]
const requiredStyleSelectors = [
  ".textArea",
  ".textArea--rounded",
  ".textArea--round",
  ".textArea--applyFocusStyle",
  ".textArea--noFocusStyle",
  ".textArea--offsetFocusRing",
  ".textArea::placeholder",
  ".textArea[data-disabled]",
  ".textArea--resizeNone",
  ".textArea--resizeVertical",
  ".textArea--resizeHorizontal",
  ".textArea--resizeBoth",
  ".textArea--errorState",
  ".textArea--warningState",
  ".textArea--successState",
]
const requiredDefaultThemeVariables = [
  "--cui-space-1",
  "--cui-radius-1",
  "--cui-focus-ring",
  "--cui-opacity-disabled",
  "--cui-transition-border-color",
  "--cui-control-background",
  "--cui-control-border",
  "--cui-control-foreground",
  "--cui-control-placeholder",
  "--cui-state-danger",
  "--cui-state-warning",
  "--cui-state-success",
]

assert(textAreaSource.startsWith('"use client"'), "TextArea must preserve the client component boundary")
assert(
  textAreaSource.includes('import { TextArea as AdobeTextArea } from "react-aria-components"'),
  "TextArea must use React Aria TextArea",
)
assert(
  textAreaSource.includes('import { calibrateComponent, type TTextAreaProps } from "./helpers"'),
  "TextArea must use local calibration helpers",
)
assert(
  textAreaSource.includes("forwardRef<HTMLTextAreaElement, TTextAreaProps>"),
  "TextArea must forward an HTMLTextAreaElement ref",
)
assert(textAreaSource.includes("disabled={isDisabled}"), "TextArea must preserve disabled mapping")
assert(
  textAreaSource.includes('data-testid={dataTestID ?? "textarea"}'),
  "TextArea must preserve the root test id fallback",
)
assert(textAreaSource.includes('TextArea.displayName = "TextArea"'), "TextArea must set displayName")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "TextArea helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../Text/TextStyles.module.css"'),
  "TextArea helpers must import installed Text styles",
)
assert(helpersSource.includes('export const TEXTAREA_SIZE__SM = "small"'), "TextArea helpers must keep size constants")
assert(
  helpersSource.includes('export const TEXTAREA_RESIZE__VERTICAL = "vertical"'),
  "TextArea helpers must keep resize constants",
)
assert(helpersSource.includes("export type TTextAreaProps"), "TextArea helpers must export local props")
assert(helpersSource.includes("export const calibrateComponent"), "TextArea calibration helper must remain local")
assert(
  helpersSource.includes('styles["textArea--errorState"]'),
  "TextArea helpers must preserve error style precedence",
)
assert(
  helpersSource.includes('styles["textArea--resizeVertical"]'),
  "TextArea helpers must preserve default resize style",
)
assert(helpersSource.includes('textStyles["fw-regular"]'), "TextArea helpers must preserve regular text weight")
;[textAreaSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "TextArea runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `TextArea CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `TextArea CSS must read ${cssVariable}`)
})
assert(!stylesSource.includes("&["), "TextArea CSS module must use flat selectors for focus styles")
assert(!forbiddenLegacyCssPattern.test(stylesSource), "TextArea CSS must not read legacy Wavemap aliases")

assert(
  publicIndexSource.includes('export { TextArea } from "./components/TextArea"'),
  "Package index must export TextArea",
)
assert(
  publicIndexSource.includes('export type { TextAreaProps } from "./components/TextArea"'),
  "Package index must export TextAreaProps",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export TextArea internals")
assert(!publicIndexSource.includes("TEXTAREA_SIZE__"), "Package index must not export TextArea size constants")
assert(
  textAreaIndexSource.includes('export { default as TextArea } from "./TextArea"'),
  "TextArea index must export the component",
)
assert(textAreaIndexSource.includes("TTextAreaProps as TextAreaProps"), "TextArea index must export props alias")
assert(!textAreaIndexSource.includes("calibrateComponent"), "TextArea index must not export calibration internals")
assert(!textAreaIndexSource.includes("TEXTAREA_SIZE__"), "TextArea index must not export size constants")

assert(packageJson.peerDependencies.react, "TextArea package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "TextArea package must keep React DOM peer dependency")
assert(packageJson.peerDependencies["react-aria-components"] === "^1.17.0", "TextArea RAC peer range must match plan")
assert(packageJson.dependencies.classnames, "TextArea package must keep classnames runtime dependency")

assert(packet.name === "text-area", "TextArea packet must describe the text-area item")
assert(packet.type === "component", "TextArea packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "TextArea packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "TextArea packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#textarea-next-candidate-planning-checkpoint"),
  "TextArea packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `TextArea packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `TextArea packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "TextArea packet test files must remain optional source evidence",
)

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TextArea" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/TextArea/TextArea.tsx",
  ),
  "TextArea packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TextAreaProps" &&
      publicExport.localName === "TTextAreaProps" &&
      publicExport.sourcePath === "packages/react/src/components/TextArea/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "TextArea packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "TextArea packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/geometry"), "TextArea packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("text"), "TextArea packet must depend on installed Text")
assert(
  !packet.registryDependencies.includes("theme/text-area-compatibility"),
  "TextArea must not need a local bridge item",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "TextArea packet must declare RAC peer")
assert(packet.runtimeDependencies.classnames, "TextArea packet must declare classnames runtime dependency")

const defaultThemeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultThemeRequirement, "TextArea packet must record default theme requirements")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultThemeRequirement.cssVariables.includes(cssVariable), `TextArea packet must record ${cssVariable}`)
})
assert(
  !packet.themeRequirements.some((requirement) => requirement.strategy === "proof-compatibility-bridge"),
  "TextArea packet must not include proof bridge theme pressure",
)

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens#geometry" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "TextArea packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/TextStyles.module.css" &&
      resolution.registryDependencyName === "text",
  ),
  "TextArea packet must record installed Text style import rewrite",
)
requiredExcludedSources.forEach((sourcePath) => {
  assert(packet.excludedSourcePaths.includes(sourcePath), `TextArea packet must exclude ${sourcePath}`)
})
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "TextArea packet must point at the package-side proof harness",
)
assert(
  packet.notes.some((note) => note.includes("Text treated as an installed registry dependency")),
  "TextArea packet must record installed Text dependency boundary",
)

assert(packetWrapperSource.includes("textAreaIngestPacketData"), "TextArea packet wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { textAreaIngestPacket } from "./text-area-ingest-packet"'),
  "Registry index must export TextArea ingest packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[text-area-proof] verified TextArea source receipt packet")
