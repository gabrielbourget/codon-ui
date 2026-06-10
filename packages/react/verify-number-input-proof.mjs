import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const numberInputSourcePath = path.join(packageRoot, "src/components/NumberInput/NumberInput.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/NumberInput/helpers.tsx")
const labelsSourcePath = path.join(packageRoot, "src/components/NumberInput/labels.ts")
const incrementIconSourcePath = path.join(packageRoot, "src/components/NumberInput/DefaultIncrementIcon.tsx")
const decrementIconSourcePath = path.join(packageRoot, "src/components/NumberInput/DefaultDecrementIcon.tsx")
const stylesSourcePath = path.join(packageRoot, "src/components/NumberInput/NumberInputStyles.module.css")
const numberInputIndexPath = path.join(packageRoot, "src/components/NumberInput/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/number-input-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/number-input-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[number-input-proof] ${message}`)
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
  /--distance_1|--disabledOpacity|--border_radius_1|--borderColorTransition|--colorTransition|--focus-ring-color|--cui-validation-error-border|--cui-validation-warning-border|--cui-validation-success-border/u

const numberInputSource = readRequiredText(numberInputSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const incrementIconSource = readRequiredText(incrementIconSourcePath)
const decrementIconSource = readRequiredText(decrementIconSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const numberInputIndexSource = readRequiredText(numberInputIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/NumberInput/NumberInput.tsx",
  "packages/react/src/components/NumberInput/helpers.tsx",
  "packages/react/src/components/NumberInput/labels.ts",
  "packages/react/src/components/NumberInput/DefaultIncrementIcon.tsx",
  "packages/react/src/components/NumberInput/DefaultDecrementIcon.tsx",
  "packages/react/src/components/NumberInput/NumberInputStyles.module.css",
  "packages/react/src/components/NumberInput/__tests__/NumberInput.test.tsx",
]
const requiredTargetPaths = [
  "NumberInput/NumberInput.tsx",
  "NumberInput/helpers.tsx",
  "NumberInput/labels.ts",
  "NumberInput/DefaultIncrementIcon.tsx",
  "NumberInput/DefaultDecrementIcon.tsx",
  "NumberInput/NumberInputStyles.module.css",
  "NumberInput/__tests__/NumberInput.test.tsx",
]
const requiredExcludedSources = [
  "apps/wavemap-front-end/src/components/NumberInput/i18n.ts",
  "apps/wavemap-front-end/src/components/Stepper/Stepper.tsx",
  "apps/wavemap-front-end/src/components/Stepper/helpers.tsx",
  "apps/wavemap-front-end/src/components/Stepper/i18n.ts",
  "apps/wavemap-front-end/src/components/Filtering/labels.ts",
  "apps/wavemap-front-end/src/components/Pagination/helpers.tsx",
]
const requiredStyleSelectors = [
  ".numberInput",
  ".numberInput--rounded",
  ".numberInput--round",
  ".numberInput--applyFocusStyle",
  ".numberInput--noFocusStyle",
  ".numberInput--offsetFocusRing",
  ".numberInput::placeholder",
  ".numberInput[data-disabled]",
  ".numberInput--errorState",
  ".numberInput--warningState",
  ".numberInput--successState",
  ".numberInput__group",
  ".numberInput__buttonColumn",
  ".numberInput__icon",
]
const requiredDefaultThemeVariables = [
  "--cui-space-1",
  "--cui-radius-1",
  "--cui-focus-ring",
  "--cui-opacity-disabled",
  "--cui-transition-border-color",
  "--cui-transition-color",
  "--cui-control-background",
  "--cui-control-border",
  "--cui-control-foreground",
  "--cui-control-placeholder",
  "--cui-state-danger",
  "--cui-state-warning",
  "--cui-state-success",
]

assert(numberInputSource.startsWith('"use client"'), "NumberInput must preserve the client component boundary")
assert(
  numberInputSource.includes('import { NumberField as AdobeNumberField, Group } from "react-aria-components"'),
  "NumberInput must use React Aria NumberField and Group",
)
assert(numberInputSource.includes('import Button from "../Button/Button"'), "NumberInput must use installed Button")
assert(numberInputSource.includes('import Input from "../Input/Input"'), "NumberInput must use installed Input")
assert(
  numberInputSource.includes('import { type TNumberInputProps, calibrateComponent } from "./helpers"'),
  "NumberInput must use local calibration helpers",
)
assert(
  numberInputSource.includes('import { resolveNumberInputLabels } from "./labels"'),
  "NumberInput must resolve local labels",
)
assert(
  numberInputSource.includes("forwardRef<HTMLInputElement, TNumberInputProps>"),
  "NumberInput must forward an HTMLInputElement ref",
)
assert(numberInputSource.includes("isDisabled={isDisabled}"), "NumberInput must preserve disabled mapping")
assert(numberInputSource.includes("isReadOnly={isReadOnly}"), "NumberInput must preserve read-only mapping")
assert(
  numberInputSource.includes('data-testid={dataTestID ?? "number-input"}'),
  "NumberInput must preserve the root test id fallback",
)
assert(
  numberInputSource.includes("aria-label={resolvedLabels.inputButtonGroupAriaLabel}"),
  "NumberInput group must receive resolved label text",
)
assert(numberInputSource.includes('slot="increment"'), "NumberInput must keep the increment button slot")
assert(numberInputSource.includes('slot="decrement"'), "NumberInput must keep the decrement button slot")
assert(numberInputSource.includes('NumberInput.displayName = "NumberInput"'), "NumberInput must set displayName")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "NumberInput helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('import DefaultIncrementIcon from "./DefaultIncrementIcon"'),
  "helpers must import increment icon",
)
assert(
  helpersSource.includes('import DefaultDecrementIcon from "./DefaultDecrementIcon"'),
  "helpers must import decrement icon",
)
assert(helpersSource.includes('export const INPUT_SIZE__SM = "small"'), "NumberInput helpers must keep size constants")
assert(helpersSource.includes("export type TNumberInputProps"), "NumberInput helpers must export local props")
assert(helpersSource.includes("labels?: TPartialNumberInputLabels"), "NumberInput props must keep partial labels")
assert(helpersSource.includes("IncrementIcon?: ReactNode"), "NumberInput props must keep custom increment icon")
assert(helpersSource.includes("DecrementIcon?: ReactNode"), "NumberInput props must keep custom decrement icon")
assert(helpersSource.includes("export const calibrateComponent"), "NumberInput calibration helper must remain local")
assert(
  helpersSource.includes('styles["numberInput--errorState"]'),
  "NumberInput helpers must preserve error style precedence",
)
assert(
  helpersSource.includes("<DefaultIncrementIcon size={15}"),
  "NumberInput helpers must preserve default increment icon size",
)
assert(
  helpersSource.includes("<DefaultDecrementIcon size={15}"),
  "NumberInput helpers must preserve default decrement icon size",
)
assert(labelsSource.includes("DEFAULT_NUMBER_INPUT_LABELS"), "NumberInput labels must keep defaults")
assert(labelsSource.includes("resolveNumberInputLabels"), "NumberInput labels must keep resolver")
;[numberInputSource, helpersSource, labelsSource, incrementIconSource, decrementIconSource, stylesSource].forEach(
  (source) => {
    assert(
      !forbiddenConsumerImportsPattern.test(source),
      "NumberInput runtime source must not import consumer-only modules",
    )
  },
)
assert(!incrementIconSource.includes("TIconProps"), "Increment icon must not import Wavemap icon props")
assert(!decrementIconSource.includes("TIconProps"), "Decrement icon must not import Wavemap icon props")
assert(
  incrementIconSource.includes("type TNumberInputDefaultIconProps") &&
    decrementIconSource.includes("type TNumberInputDefaultIconProps"),
  "Default icons must keep local private prop types",
)
assert(incrementIconSource.includes("currentColor"), "Increment icon must preserve currentColor fallback")
assert(decrementIconSource.includes("currentColor"), "Decrement icon must preserve currentColor fallback")

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `NumberInput CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `NumberInput CSS must read ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "NumberInput CSS must not read legacy Wavemap aliases")

assert(
  publicIndexSource.includes('export { NumberInput } from "./components/NumberInput"'),
  "Package index must export NumberInput",
)
assert(
  publicIndexSource.includes('export type { NumberInputProps } from "./components/NumberInput"'),
  "Package index must export NumberInputProps",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export NumberInput internals")
assert(!publicIndexSource.includes("INPUT_SIZE__"), "Package index must not export NumberInput size constants")
assert(
  numberInputIndexSource.includes('export { default as NumberInput } from "./NumberInput"'),
  "NumberInput index must export the component",
)
assert(
  numberInputIndexSource.includes("TNumberInputProps as NumberInputProps"),
  "NumberInput index must export props alias",
)
assert(
  !numberInputIndexSource.includes("calibrateComponent"),
  "NumberInput index must not export calibration internals",
)
assert(!numberInputIndexSource.includes("INPUT_SIZE__"), "NumberInput index must not export size constants")

assert(packageJson.peerDependencies.react, "NumberInput package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "NumberInput package must keep React DOM peer dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "NumberInput RAC peer range must match plan",
)
assert(packageJson.dependencies.classnames, "NumberInput package must keep classnames runtime dependency")

assert(packet.name === "number-input", "NumberInput packet must describe the number-input item")
assert(packet.type === "component", "NumberInput packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "NumberInput packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "NumberInput packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#numberinput-next-candidate-planning-checkpoint"),
  "NumberInput packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `NumberInput packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `NumberInput packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "NumberInput packet test files must remain optional source evidence",
)

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "NumberInput" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/NumberInput/NumberInput.tsx",
  ),
  "NumberInput packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "NumberInputProps" &&
      publicExport.localName === "TNumberInputProps" &&
      publicExport.sourcePath === "packages/react/src/components/NumberInput/helpers.tsx" &&
      publicExport.typeOnly === true,
  ),
  "NumberInput packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "NumberInput packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/geometry"), "NumberInput packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("input"), "NumberInput packet must depend on installed Input")
assert(packet.registryDependencies.includes("button"), "NumberInput packet must depend on installed Button")
assert(
  !packet.registryDependencies.includes("theme/number-input-compatibility"),
  "NumberInput must not need a local bridge item",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "NumberInput packet must declare RAC peer")
assert(packet.runtimeDependencies.classnames, "NumberInput packet must declare classnames runtime dependency")

const defaultThemeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultThemeRequirement, "NumberInput packet must record default theme requirements")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultThemeRequirement.cssVariables.includes(cssVariable), `NumberInput packet must record ${cssVariable}`)
})
assert(
  !packet.themeRequirements.some((requirement) => requirement.strategy === "proof-compatibility-bridge"),
  "NumberInput packet must not include proof bridge theme pressure",
)

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Button/Button" && resolution.registryDependencyName === "button",
  ),
  "NumberInput packet must record Button import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Input/Input" && resolution.registryDependencyName === "input",
  ),
  "NumberInput packet must record Input import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens#geometry" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "NumberInput packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.filter((resolution) => resolution.importSource === "@/src/types/icon").length === 2,
  "NumberInput packet must record both default icon type rewrites",
)
requiredExcludedSources.forEach((sourcePath) => {
  assert(packet.excludedSourcePaths.includes(sourcePath), `NumberInput packet must exclude ${sourcePath}`)
})
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "NumberInput packet must point at the package-side proof harness",
)
assert(
  packet.notes.some((note) => note.includes("Input/Button treated as installed registry dependencies")),
  "NumberInput packet must record installed Input/Button dependency boundary",
)
assert(
  packet.notes.some((note) => note.includes("NumberInput/i18n.ts")),
  "NumberInput packet must record app-local i18n exclusion",
)

assert(packetWrapperSource.includes("numberInputIngestPacketData"), "NumberInput packet wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { numberInputIngestPacket } from "./number-input-ingest-packet"'),
  "Registry index must export NumberInput ingest packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[number-input-proof] verified NumberInput source receipt packet")
