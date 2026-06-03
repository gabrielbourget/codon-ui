import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const buttonSourcePath = path.join(packageRoot, "src/components/Button/Button.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Button/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Button/ButtonStyles.module.css")
const buttonIndexPath = path.join(packageRoot, "src/components/Button/index.ts")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const packetSourcePath = path.join(packageRoot, "src/registry/button-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/button-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[button-proof] ${message}`)
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
  /--distance_1|--disabledOpacity|--border_radius_1|--focus-ring-color|--shadow_1|--bgColorTransition|--borderColorTransition|--boxShadowTransition|--background\)/u

const buttonSource = readRequiredText(buttonSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const buttonIndexSource = readRequiredText(buttonIndexPath)
const actionColorsSource = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Button/Button.tsx",
  "packages/react/src/components/Button/helpers.ts",
  "packages/react/src/components/Button/ButtonStyles.module.css",
  "packages/react/src/components/Button/__tests__/Button.test.tsx",
]
const requiredTargetPaths = [
  "Button/Button.tsx",
  "Button/helpers.ts",
  "Button/ButtonStyles.module.css",
  "Button/__tests__/Button.test.tsx",
]
const requiredStyleSelectors = [
  ".button",
  ".button--transparent",
  ".button--fill",
  ".button--outline",
  ".button--primary--fill",
  ".button--primary--outline",
  ".button--rounded",
  ".button--round",
  ".button--raised",
]
const requiredActionColorVariables = [
  "--aui-color-primary-100",
  "--aui-color-primary-200",
  "--aui-color-primary-500",
  "--aui-color-primary-600",
  "--aui-color-primary-700",
  "--aui-action-primary-background",
  "--aui-action-primary-background-hover",
  "--aui-action-primary-background-pressed",
  "--aui-action-primary-border",
  "--aui-action-primary-foreground",
  "--aui-action-quintenary-background",
  "--aui-action-quintenary-background-hover",
  "--aui-action-quintenary-background-pressed",
  "--aui-action-quintenary-border",
  "--aui-action-quintenary-foreground",
]

assert(buttonSource.includes('from "react-aria-components"'), "Button must import React Aria Button")
assert(buttonSource.includes("<AriaButton"), "Button must render React Aria Button")
assert(buttonSource.includes("isDisabled={isDisabled}"), "Button must preserve disabled mapping")
assert(buttonSource.includes('data-testid={dataTestID ?? "button"}'), "Button root test id fallback must stay")
assert(buttonSource.includes('Button.displayName = "Button"'), "Button display name must be set")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Button helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Button helpers must import package-local theme-order tokens",
)
assert(helpersSource.includes("export type TButtonProps"), "Button helpers must export local props")
assert(helpersSource.includes('export const COLOR_MODE__FILL = "fill"'), "Button fill color mode constant must stay")
assert(
  helpersSource.includes('export const COLOR_MODE__OUTLINE = "outline"'),
  "Button outline color mode constant must stay",
)
assert(helpersSource.includes("export const calibrateComponent"), "Button calibration helper must remain local")
assert(helpersSource.includes('"--btn-bg"'), "Button helpers must emit background CSS variable")
assert(helpersSource.includes('"--btn-hover-bg"'), "Button helpers must emit hover background CSS variable")
;[buttonSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Button runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Button CSS module must include ${selector}`)
})
;[
  "var(--aui-space-1)",
  "var(--aui-opacity-disabled)",
  "var(--aui-focus-ring)",
  "var(--aui-radius-1)",
  "var(--aui-shadow-1)",
  "var(--aui-transition-background-color)",
  "var(--aui-transition-border-color)",
  "var(--aui-transition-box-shadow)",
  "var(--aui-background)",
  "var(--aui-action-primary-background)",
  "var(--aui-action-primary-background-hover)",
  "var(--aui-action-primary-background-pressed)",
].forEach((cssValue) => {
  assert(stylesSource.includes(cssValue), `Button CSS must read ${cssValue}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Button CSS must not read legacy Wavemap aliases")

requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsSource.includes(cssVariable), `action-colors CSS must define ${cssVariable}`)
})
assert(!actionColorsSource.includes("--distance_1"), "action-colors must not define legacy spacing aliases")
assert(!actionColorsSource.includes("--shadow_1"), "action-colors must not define legacy shadow aliases")

assert(publicIndexSource.includes('export { Button } from "./components/Button"'), "Package index must export Button")
assert(
  publicIndexSource.includes('export type { ButtonProps } from "./components/Button"'),
  "Package index must export ButtonProps",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export Button internals")
assert(buttonIndexSource.includes('export { default as Button } from "./Button"'), "Button index must export component")
assert(buttonIndexSource.includes("TButtonProps as ButtonProps"), "Button index must export props alias")

assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Button React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "Button package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Button package must keep React DOM peer dependency")
assert(packageJson.dependencies.classnames, "Button package must keep classnames runtime dependency")

assert(packet.name === "button", "Button packet must describe the button item")
assert(packet.type === "component", "Button packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Button packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Button packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#button-next-candidate-planning-checkpoint"),
  "Button packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Button packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Button packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Button packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Button" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Button/Button.tsx",
  ),
  "Button packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ButtonProps" &&
      publicExport.localName === "TButtonProps" &&
      publicExport.sourcePath === "packages/react/src/components/Button/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Button packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Button packet must depend on default theme")
assert(packet.registryDependencies.includes("theme/action-colors"), "Button packet must depend on action colors")
assert(packet.registryDependencies.includes("tokens/geometry"), "Button packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Button packet must depend on theme-order tokens")
assert(!packet.registryDependencies.includes("theme/button-compatibility"), "Button must not need a local bridge item")
assert(
  !packet.registryDependencies.includes("theme/toggle-button-compatibility"),
  "Button must not depend on ToggleButton bridge",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Button packet must declare React Aria peer")
assert(packet.runtimeDependencies.classnames, "Button packet must declare classnames runtime dependency")

const actionColorsRequirement = packet.themeRequirements.find((requirement) =>
  requirement.files?.some((file) => file.sourcePath === "packages/react/src/theme/action-colors.css"),
)
assert(actionColorsRequirement, "Button packet must record action-colors theme support")
requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsRequirement.cssVariables.includes(cssVariable), `Button packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens#geometry" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Button packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens#theme-order" &&
      resolution.registryDependencyName === "tokens/theme-order",
  ),
  "Button packet must record theme-order token import rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Stepper/Stepper.tsx"),
  "Button packet must exclude Stepper consumers",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Toaster/Toast/helpers.tsx"),
  "Button packet must exclude Toaster helpers",
)

assert(packetWrapperSource.includes("buttonIngestPacketData"), "Button packet wrapper must import JSON data")
assert(registryIndexSource.includes('export { buttonIngestPacket } from "./button-ingest-packet"'))

if (process.exitCode) process.exit(process.exitCode)
console.log("[button-proof] verified Button source receipt packet")
