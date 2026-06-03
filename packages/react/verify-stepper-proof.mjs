import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const stepperSourcePath = path.join(packageRoot, "src/components/Stepper/Stepper.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Stepper/helpers.tsx")
const labelsSourcePath = path.join(packageRoot, "src/components/Stepper/labels.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Stepper/StepperStyles.module.css")
const stepperIndexPath = path.join(packageRoot, "src/components/Stepper/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/stepper-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/stepper-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[stepper-proof] ${message}`)
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
  /--disabledOpacity|--border_radius_1|--borderColorTransition|--colorTransition|--focus-ring-color|--aui-validation-error-border|--aui-validation-warning-border|--aui-validation-success-border/u

const stepperSource = readRequiredText(stepperSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const stepperIndexSource = readRequiredText(stepperIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Stepper/Stepper.tsx",
  "packages/react/src/components/Stepper/helpers.tsx",
  "packages/react/src/components/Stepper/labels.ts",
  "packages/react/src/components/Stepper/StepperStyles.module.css",
  "packages/react/src/components/Stepper/__tests__/Stepper.test.tsx",
]
const requiredTargetPaths = [
  "Stepper/Stepper.tsx",
  "Stepper/helpers.tsx",
  "Stepper/labels.ts",
  "Stepper/StepperStyles.module.css",
  "Stepper/__tests__/Stepper.test.tsx",
]
const requiredExcludedSources = [
  "apps/wavemap-front-end/src/components/Stepper/i18n.ts",
  "apps/wavemap-front-end/src/utils/color.ts",
  "apps/wavemap-front-end/src/components/Button/helpers.ts",
  "apps/wavemap-front-end/src/components/Input/Input.tsx",
  "apps/wavemap-front-end/src/components/NumberInput/NumberInput.tsx",
  "apps/wavemap-front-end/src/components/ComboBox/ComboBox.tsx",
  "apps/wavemap-front-end/src/components/Pagination/helpers.tsx",
]
const requiredStyleSelectors = [
  ".stepper",
  ".stepper--applyFocusStyle",
  ".stepper--noFocusStyle",
  ".stepper--offsetFocusRing",
  ".stepper::placeholder",
  ".stepper[data-disabled]",
  ".stepper--errorState",
  ".stepper--warningState",
  ".stepper--successState",
  ".stepper__group",
  ".stepper__group--segmented",
  ".stepper__group--horizontal",
  ".stepper__group--vertical",
  ".stepper__group--rounded",
  ".stepper__group--round",
  ".stepper__group--cohesive--fill",
  ".stepper__group--cohesive--outline",
]
const requiredDefaultThemeVariables = [
  "--aui-radius-1",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-transition-border-color",
  "--aui-transition-color",
  "--aui-control-background",
  "--aui-control-border",
  "--aui-control-foreground",
  "--aui-control-placeholder",
  "--aui-state-danger",
  "--aui-state-warning",
  "--aui-state-success",
  "--aui-color-primary-500",
  "--aui-color-quintenary-500",
  "--aui-action-primary-background",
  "--aui-action-primary-foreground",
  "--aui-action-quintenary-background",
  "--aui-action-quintenary-foreground",
]

assert(stepperSource.startsWith('"use client"'), "Stepper must preserve the client component boundary")
assert(
  stepperSource.includes('import { NumberField as AdobeNumberField, Group } from "react-aria-components"'),
  "Stepper must use React Aria NumberField and Group",
)
assert(stepperSource.includes('import Button from "../Button/Button"'), "Stepper must use installed Button")
assert(stepperSource.includes('import Input from "../Input/Input"'), "Stepper must use installed Input")
assert(
  stepperSource.includes('import { type TStepperProps, useCalibrateComponent } from "./helpers"'),
  "Stepper must use local calibration helpers",
)
assert(stepperSource.includes('import { resolveStepperLabels } from "./labels"'), "Stepper must resolve local labels")
assert(
  stepperSource.includes("forwardRef<HTMLInputElement, TStepperProps>"),
  "Stepper must forward an HTMLInputElement ref",
)
assert(stepperSource.includes("isDisabled={isDisabled}"), "Stepper must preserve disabled mapping")
assert(stepperSource.includes("isReadOnly={isReadOnly}"), "Stepper must preserve read-only mapping")
assert(stepperSource.includes('data-testid={dataTestID ?? "stepper"}'), "Stepper must preserve root test id fallback")
assert(
  stepperSource.includes("aria-label={resolvedLabels.inputButtonGroupAriaLabel}"),
  "Stepper group must receive resolved label text",
)
assert(stepperSource.includes('slot="increment"'), "Stepper must keep the increment button slot")
assert(stepperSource.includes('slot="decrement"'), "Stepper must keep the decrement button slot")
assert(stepperSource.includes('Stepper.displayName = "Stepper"'), "Stepper must set displayName")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Stepper helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Stepper helpers must import package-local theme-order tokens",
)
assert(!helpersSource.includes("@/src/utils/color"), "Stepper must not import Wavemap color utilities")
assert(!helpersSource.includes("../Button/helpers"), "Stepper must not import Button helper support")
assert(helpersSource.includes("type TAvailableButtonColorModes"), "Stepper must keep a local Button color-mode type")
assert(helpersSource.includes("const determineReadableTextColor"), "Stepper must localize readable-color logic")
assert(helpersSource.includes('export const STEPPER_SIZE__SM = "small"'), "Stepper helpers must keep size constants")
assert(
  helpersSource.includes('export const STEPPER_TYPE__COHESIVE = "cohesive"'),
  "Stepper helpers must keep type constants",
)
assert(
  helpersSource.includes('export const ORIENTATION__VERTICAL = "vertical"'),
  "Stepper helpers must keep orientation constants",
)
assert(helpersSource.includes("export type TStepperProps"), "Stepper helpers must export local props")
assert(helpersSource.includes("labels?: TPartialStepperLabels"), "Stepper props must keep partial labels")
assert(helpersSource.includes("PlusIcon?: ReactNode"), "Stepper props must keep custom plus icon")
assert(helpersSource.includes("MinusIcon?: ReactNode"), "Stepper props must keep custom minus icon")
assert(helpersSource.includes("export const useCalibrateComponent"), "Stepper calibration helper must remain local")
assert(helpersSource.includes('styles["stepper--errorState"]'), "Stepper helpers must preserve error style precedence")
assert(helpersSource.includes("<StepperDefaultPlusIcon"), "Stepper helpers must preserve default plus icon")
assert(helpersSource.includes("<StepperDefaultMinusIcon"), "Stepper helpers must preserve default minus icon")
assert(labelsSource.includes("DEFAULT_STEPPER_LABELS"), "Stepper labels must keep defaults")
assert(labelsSource.includes("resolveStepperLabels"), "Stepper labels must keep resolver")
;[stepperSource, helpersSource, labelsSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Stepper runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Stepper CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `Stepper CSS must read ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Stepper CSS must not read legacy Wavemap aliases")

assert(
  publicIndexSource.includes('export { Stepper } from "./components/Stepper"'),
  "Package index must export Stepper",
)
assert(
  publicIndexSource.includes('export type { StepperProps } from "./components/Stepper"'),
  "Package index must export StepperProps",
)
assert(!publicIndexSource.includes("useCalibrateComponent"), "Package index must not export Stepper internals")
assert(!publicIndexSource.includes("STEPPER_SIZE__"), "Package index must not export Stepper size constants")
assert(
  stepperIndexSource.includes('export { default as Stepper } from "./Stepper"'),
  "Stepper index must export component",
)
assert(stepperIndexSource.includes("TStepperProps as StepperProps"), "Stepper index must export props alias")
assert(!stepperIndexSource.includes("useCalibrateComponent"), "Stepper index must not export calibration internals")
assert(!stepperIndexSource.includes("STEPPER_SIZE__"), "Stepper index must not export size constants")

assert(packageJson.peerDependencies.react, "Stepper package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Stepper package must keep React DOM peer dependency")
assert(packageJson.peerDependencies["react-aria-components"] === "^1.17.0", "Stepper RAC peer range must match plan")
assert(packageJson.dependencies.classnames, "Stepper package must keep classnames runtime dependency")

assert(packet.name === "stepper", "Stepper packet must describe the stepper item")
assert(packet.type === "component", "Stepper packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Stepper packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Stepper packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#stepper-next-candidate-planning-checkpoint"),
  "Stepper packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Stepper packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Stepper packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Stepper packet test files must remain optional source evidence",
)

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Stepper" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Stepper/Stepper.tsx",
  ),
  "Stepper packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "StepperProps" &&
      publicExport.localName === "TStepperProps" &&
      publicExport.sourcePath === "packages/react/src/components/Stepper/helpers.tsx" &&
      publicExport.typeOnly === true,
  ),
  "Stepper packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Stepper packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/geometry"), "Stepper packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Stepper packet must depend on theme-order tokens")
assert(packet.registryDependencies.includes("input"), "Stepper packet must depend on installed Input")
assert(packet.registryDependencies.includes("button"), "Stepper packet must depend on installed Button")
assert(
  !packet.registryDependencies.includes("theme/stepper-compatibility"),
  "Stepper must not need a local bridge item",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Stepper packet must declare RAC peer")
assert(packet.runtimeDependencies.classnames, "Stepper packet must declare classnames runtime dependency")

const defaultThemeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultThemeRequirement, "Stepper packet must record default theme requirements")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultThemeRequirement.cssVariables.includes(cssVariable), `Stepper packet must record ${cssVariable}`)
})
assert(
  !packet.themeRequirements.some((requirement) => requirement.strategy === "proof-compatibility-bridge"),
  "Stepper packet must not include proof bridge theme pressure",
)

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Button/Button" && resolution.registryDependencyName === "button",
  ),
  "Stepper packet must record Button import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Input/Input" && resolution.registryDependencyName === "input",
  ),
  "Stepper packet must record Input import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens#geometry" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Stepper packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens#theme-order" &&
      resolution.registryDependencyName === "tokens/theme-order",
  ),
  "Stepper packet must record theme-order token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) => resolution.importSource === "@/src/utils/color#determineReadableTextColor",
  ),
  "Stepper packet must record readable-color helper localization",
)
assert(
  packet.importResolutions.some(
    (resolution) => resolution.importSource === "@/src/components/Button/helpers#TAvailableColorModes",
  ),
  "Stepper packet must record Button helper type localization",
)
requiredExcludedSources.forEach((sourcePath) => {
  assert(packet.excludedSourcePaths.includes(sourcePath), `Stepper packet must exclude ${sourcePath}`)
})
assert(
  packet.verification.some((step) => step.command === "pnpm -F @amino-ui/react test"),
  "Stepper packet must point at the package-side proof harness",
)
assert(
  packet.notes.some((note) => note.includes("Input/Button treated as installed registry dependencies")),
  "Stepper packet must record installed Input/Button dependency boundary",
)
assert(
  packet.notes.some((note) => note.includes("Stepper/i18n.ts")),
  "Stepper packet must record app-local i18n exclusion",
)
assert(
  packet.notes.some((note) => note.includes("Wavemap color utilities")),
  "Stepper packet must record color utility exclusion",
)

assert(packetWrapperSource.includes("stepperIngestPacketData"), "Stepper packet wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { stepperIngestPacket } from "./stepper-ingest-packet"'),
  "Registry index must export Stepper ingest packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[stepper-proof] verified Stepper source receipt packet")
