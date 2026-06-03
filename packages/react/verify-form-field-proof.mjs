import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const formFieldSourcePath = path.join(packageRoot, "src/components/FormField/FormField.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/FormField/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/FormField/FormFieldStyles.module.css")
const formFieldIndexPath = path.join(packageRoot, "src/components/FormField/index.ts")
const a11yTokensPath = path.join(packageRoot, "src/tokens/a11y.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/form-field-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/form-field-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[form-field-proof] ${message}`)
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

const formFieldSource = readRequiredText(formFieldSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const formFieldIndexSource = readRequiredText(formFieldIndexPath)
const a11yTokensSource = readRequiredText(a11yTokensPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/FormField/FormField.tsx",
  "packages/react/src/components/FormField/helpers.ts",
  "packages/react/src/components/FormField/FormFieldStyles.module.css",
  "packages/react/src/components/FormField/__tests__/FormField.test.tsx",
]
const requiredTargetPaths = [
  "FormField/FormField.tsx",
  "FormField/helpers.ts",
  "FormField/FormFieldStyles.module.css",
  "FormField/__tests__/FormField.test.tsx",
]
const requiredStyleSelectors = [
  ".formField",
  ".formField--raised",
  ".formField__topRow",
  ".formField__topRow--noLeftContent",
  ".formField__bottomRow",
  ".formField__bottomRow--noLeftContent",
  ".formField__validationMessages",
  ".formField__labelContainer",
  ".formfield__requiredIndicator",
]

assert(formFieldSource.includes("forwardRef<HTMLDivElement, TFormFieldProps>"), "FormField must forward a div ref")
assert(formFieldSource.includes('from "../Text/Text"'), "FormField must import installed package-local Text")
assert(
  formFieldSource.includes('data-testid={dataTestID ?? "form-field"}'),
  "FormField root test id fallback must stay",
)
assert(
  formFieldSource.includes("aria-label={ariaLabel ?? ariaLabelAlias}"),
  "FormField must preserve aria label aliases",
)
assert(
  formFieldSource.includes("aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}"),
  "FormField must preserve aria labelledby aliases",
)
assert(
  formFieldSource.includes("aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}"),
  "FormField must preserve aria describedby aliases",
)
assert(
  formFieldSource.includes("aria-details={ariaDetails ?? ariaDetailsAlias}"),
  "FormField must preserve aria details aliases",
)
assert(formFieldSource.includes('elementType="label"'), "FormField must render label text through Text")
assert(
  formFieldSource.includes("styles.formfield__requiredIndicator"),
  "FormField must preserve required marker styling",
)
assert(
  formFieldSource.includes("warningMessages || errorMessages || successMessages || bottomRightContent"),
  "FormField must preserve bottom-row gate",
)
assert(formFieldSource.includes('fontStyle="italic"'), "FormField must preserve italic description copy")
assert(formFieldSource.includes('FormField.displayName = "FormField"'), "FormField display name must be set")

assert(helpersSource.includes('from "../../tokens/a11y"'), "FormField helpers must import package-local a11y tokens")
assert(helpersSource.includes("export type TFormFieldProps"), "FormField helpers must export local props")
assert(helpersSource.includes("PropsWithChildren"), "FormField public props must include children")
assert(helpersSource.includes("export const calibrateComponent"), "FormField calibration helper must remain local")
assert(
  helpersSource.includes("var(--aui-validation-error-foreground, var(--aui-state-danger))"),
  "FormField error color must keep Wavemap alias with default theme fallback",
)
assert(
  helpersSource.includes("var(--aui-validation-warning-foreground, var(--aui-state-warning))"),
  "FormField warning color must keep Wavemap alias with default theme fallback",
)
assert(
  helpersSource.includes("var(--aui-validation-success-foreground, var(--aui-state-success))"),
  "FormField success color must keep Wavemap alias with default theme fallback",
)
;[formFieldSource, helpersSource, stylesSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "FormField runtime source must not import consumer-only modules",
  )
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `FormField CSS module must include ${selector}`)
})
assert(stylesSource.includes("var(--aui-space-1)"), "FormField CSS must read default spacing token")
assert(stylesSource.includes("var(--aui-shadow-1)"), "FormField CSS must read default shadow token")
assert(stylesSource.includes("var(--aui-state-danger)"), "FormField CSS must provide state danger fallback")
assert(!stylesSource.includes("--distance_1"), "FormField CSS must not read legacy distance alias")
assert(!stylesSource.includes("--shadow_1"), "FormField CSS must not read legacy shadow alias")

assert(a11yTokensSource.includes("TAriaLabelingProps"), "A11y token support must export TAriaLabelingProps")
assert(a11yTokensSource.includes('"aria-label"?: string'), "A11y token support must include native aria-label")
assert(a11yTokensSource.includes("ariaLabelledBy?: string"), "A11y token support must include alias props")

assert(
  publicIndexSource.includes('export { FormField } from "./components/FormField"'),
  "Package index must export FormField",
)
assert(
  publicIndexSource.includes('export type { FormFieldProps } from "./components/FormField"'),
  "Package index must export FormFieldProps",
)
assert(!publicIndexSource.includes("VALIDATION_COLOR_ERROR"), "Package index must not export FormField internals")
assert(
  formFieldIndexSource.includes('export { default as FormField } from "./FormField"'),
  "FormField index must export component",
)
assert(formFieldIndexSource.includes("TFormFieldProps as FormFieldProps"), "FormField index must export props alias")
assert(!formFieldIndexSource.includes("calibrateComponent"), "FormField index must not export internals")

assert(packet.name === "form-field", "FormField packet must describe the form-field item")
assert(packet.type === "component", "FormField packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "FormField packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "FormField packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#formfield-next-candidate-planning-checkpoint"),
  "FormField packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `FormField packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `FormField packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "FormField packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "FormField" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/FormField/FormField.tsx",
  ),
  "FormField packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "FormFieldProps" &&
      publicExport.localName === "TFormFieldProps" &&
      publicExport.sourcePath === "packages/react/src/components/FormField/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "FormField packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "FormField packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/a11y"), "FormField packet must depend on a11y tokens")
assert(packet.registryDependencies.includes("text"), "FormField packet must depend on installed Text")
assert(!packet.registryDependencies.includes("theme/form-field-compatibility"), "FormField must not need a bridge item")
assert(packet.peerDependencies.react, "FormField packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "FormField packet must declare React DOM peer dependency")
assert(
  !packet.peerDependencies["react-aria-components"],
  "FormField must inherit React Aria only transitively through Text",
)
assert(packet.runtimeDependencies.classnames, "FormField packet must declare classnames runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "FormField packet must record default-contract theme pressure")
;["--aui-space-1", "--aui-shadow-1", "--aui-state-danger", "--aui-state-warning", "--aui-state-success"].forEach(
  (cssVariable) => {
    assert(defaultContractRequirement.cssVariables.includes(cssVariable), `FormField packet must record ${cssVariable}`)
  },
)
const consumerOwnedRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "consumer-owned",
)
assert(consumerOwnedRequirement, "FormField packet must record consumer-owned validation aliases")
;[
  "--aui-validation-error-foreground",
  "--aui-validation-warning-foreground",
  "--aui-validation-success-foreground",
].forEach((cssVariable) => {
  assert(consumerOwnedRequirement.cssVariables.includes(cssVariable), `FormField packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/Text" && resolution.registryDependencyName === "text",
  ),
  "FormField packet must record Text import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/a11y",
  ),
  "FormField packet must record a11y token import rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Pagination/Pagination.tsx"),
  "FormField packet must exclude Pagination consumers",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Filtering/FilterClauseRow/FilterClauseRow.tsx",
  ),
  "FormField packet must exclude Filtering consumers",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/TagComboBox/TagComboBox.tsx"),
  "FormField packet must exclude TagComboBox",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/DateTimePicker/DateTimePicker.tsx"),
  "FormField packet must exclude DateTimePicker",
)

assert(packetWrapperSource.includes("formFieldIngestPacketData"), "FormField packet wrapper must import JSON data")
assert(registryIndexSource.includes('export { formFieldIngestPacket } from "./form-field-ingest-packet"'))

if (process.exitCode) process.exit(process.exitCode)
console.log("[form-field-proof] verified FormField source receipt packet")
