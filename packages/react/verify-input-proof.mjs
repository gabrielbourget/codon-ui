import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const inputSourcePath = path.join(packageRoot, "src/components/Input/Input.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Input/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Input/InputStyles.module.css")
const inputIndexPath = path.join(packageRoot, "src/components/Input/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/input-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/input-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[input-proof] ${message}`)
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
  /--distance_1|--disabledOpacity|--border_radius_1|--borderColorTransition|--focus-ring-color|--aui-validation-error-border|--aui-validation-warning-border|--aui-validation-success-border/u

const inputSource = readRequiredText(inputSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const inputIndexSource = readRequiredText(inputIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Input/Input.tsx",
  "packages/react/src/components/Input/helpers.ts",
  "packages/react/src/components/Input/InputStyles.module.css",
  "packages/react/src/components/Input/__tests__/Input.test.tsx",
]
const requiredTargetPaths = [
  "Input/Input.tsx",
  "Input/helpers.ts",
  "Input/InputStyles.module.css",
  "Input/__tests__/Input.test.tsx",
]
const requiredExcludedSources = [
  "apps/wavemap-front-end/src/components/TextArea/TextArea.tsx",
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
  ".input",
  ".input--rounded",
  ".input--round",
  ".input--applyFocusStyle",
  ".input--noFocusStyle",
  ".input--offsetFocusRing",
  ".input::placeholder",
  ".input[data-disabled]",
  ".input--errorState",
  ".input--warningState",
  ".input--successState",
]
const requiredDefaultThemeVariables = [
  "--aui-space-1",
  "--aui-radius-1",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-transition-border-color",
  "--aui-control-background",
  "--aui-control-border",
  "--aui-control-foreground",
  "--aui-control-placeholder",
  "--aui-state-danger",
  "--aui-state-warning",
  "--aui-state-success",
]

assert(inputSource.startsWith('"use client"'), "Input must preserve the client component boundary")
assert(
  inputSource.includes('import { Input as AdobeInput } from "react-aria-components"'),
  "Input must use React Aria Input",
)
assert(
  inputSource.includes('import { calibrateComponent, type TInputProps } from "./helpers"'),
  "Input must use local calibration helpers",
)
assert(inputSource.includes("forwardRef<HTMLInputElement, TInputProps>"), "Input must forward an HTMLInputElement ref")
assert(inputSource.includes("disabled={isDisabled}"), "Input must preserve disabled mapping")
assert(inputSource.includes('data-testid={dataTestID ?? "input"}'), "Input must preserve the root test id fallback")
assert(inputSource.includes('Input.displayName = "Input"'), "Input must set displayName")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Input helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../Text/TextStyles.module.css"'),
  "Input helpers must import installed Text styles",
)
assert(helpersSource.includes('export const INPUT_SIZE__SM = "small"'), "Input helpers must keep size constants")
assert(helpersSource.includes("export type TInputProps"), "Input helpers must export local props")
assert(helpersSource.includes("export const calibrateComponent"), "Input calibration helper must remain local")
assert(helpersSource.includes('styles["input--errorState"]'), "Input helpers must preserve error style precedence")
assert(helpersSource.includes('textStyles["fw-regular"]'), "Input helpers must preserve regular text weight")
;[inputSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Input runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Input CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `Input CSS must read ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Input CSS must not read legacy Wavemap aliases")

assert(publicIndexSource.includes('export { Input } from "./components/Input"'), "Package index must export Input")
assert(
  publicIndexSource.includes('export type { InputProps } from "./components/Input"'),
  "Package index must export InputProps",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export Input internals")
assert(!publicIndexSource.includes("INPUT_SIZE__"), "Package index must not export Input size constants")
assert(inputIndexSource.includes('export { default as Input } from "./Input"'), "Input index must export the component")
assert(inputIndexSource.includes("TInputProps as InputProps"), "Input index must export props alias")
assert(!inputIndexSource.includes("calibrateComponent"), "Input index must not export calibration internals")
assert(!inputIndexSource.includes("INPUT_SIZE__"), "Input index must not export size constants")

assert(packageJson.peerDependencies.react, "Input package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Input package must keep React DOM peer dependency")
assert(packageJson.peerDependencies["react-aria-components"] === "^1.17.0", "Input RAC peer range must match plan")
assert(packageJson.dependencies.classnames, "Input package must keep classnames runtime dependency")

assert(packet.name === "input", "Input packet must describe the input item")
assert(packet.type === "component", "Input packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Input packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Input packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#input-next-candidate-planning-checkpoint"),
  "Input packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Input packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Input packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Input packet test files must remain optional source evidence",
)

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Input" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Input/Input.tsx",
  ),
  "Input packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "InputProps" &&
      publicExport.localName === "TInputProps" &&
      publicExport.sourcePath === "packages/react/src/components/Input/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Input packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Input packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/geometry"), "Input packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("text"), "Input packet must depend on installed Text")
assert(!packet.registryDependencies.includes("theme/input-compatibility"), "Input must not need a local bridge item")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Input packet must declare RAC peer")
assert(packet.runtimeDependencies.classnames, "Input packet must declare classnames runtime dependency")

const defaultThemeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultThemeRequirement, "Input packet must record default theme requirements")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultThemeRequirement.cssVariables.includes(cssVariable), `Input packet must record ${cssVariable}`)
})
assert(
  !packet.themeRequirements.some((requirement) => requirement.strategy === "proof-compatibility-bridge"),
  "Input packet must not include proof bridge theme pressure",
)

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens#geometry" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Input packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/TextStyles.module.css" &&
      resolution.registryDependencyName === "text",
  ),
  "Input packet must record installed Text style import rewrite",
)
requiredExcludedSources.forEach((sourcePath) => {
  assert(packet.excludedSourcePaths.includes(sourcePath), `Input packet must exclude ${sourcePath}`)
})
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "Input packet must point at the package-side proof harness",
)
assert(
  packet.notes.some((note) => note.includes("Text treated as an installed registry dependency")),
  "Input packet must record installed Text dependency boundary",
)

assert(packetWrapperSource.includes("inputIngestPacketData"), "Input packet wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { inputIngestPacket } from "./input-ingest-packet"'),
  "Registry index must export Input ingest packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[input-proof] verified Input source receipt packet")
