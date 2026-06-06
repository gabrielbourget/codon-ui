import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const modalSourcePath = path.join(packageRoot, "src/components/Modal/Modal.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Modal/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Modal/ModalStyles.module.css")
const modalIndexPath = path.join(packageRoot, "src/components/Modal/index.ts")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const a11yTokenPath = path.join(packageRoot, "src/tokens/a11y.ts")
const geometryTokenPath = path.join(packageRoot, "src/tokens/geometry.ts")
const themeOrderTokenPath = path.join(packageRoot, "src/tokens/theme-order.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/modal-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/modal-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[modal-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|query|api-contract|shared-utils|window|localStorage|@\/src\/|@radix-ui|@internationalized\/date/u
const forbiddenLegacyCssPattern =
  /--distance_|--fadeInAnimation|--fadeOutAnimation|--border_radius_|--shadow_1|--focus-ring-color|theme\/modal-compatibility/u

const modalSource = readRequiredText(modalSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const modalIndexSource = readRequiredText(modalIndexPath)
const actionColorsSource = readRequiredText(actionColorsPath)
const a11yTokenSource = readRequiredText(a11yTokenPath)
const geometryTokenSource = readRequiredText(geometryTokenPath)
const themeOrderTokenSource = readRequiredText(themeOrderTokenPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Modal/Modal.tsx",
  "packages/react/src/components/Modal/helpers.ts",
  "packages/react/src/components/Modal/ModalStyles.module.css",
  "packages/react/src/components/Modal/__tests__/Modal.test.tsx",
]
const requiredTargetPaths = [
  "Modal/Modal.tsx",
  "Modal/helpers.ts",
  "Modal/ModalStyles.module.css",
  "Modal/__tests__/Modal.test.tsx",
]
const requiredStyleSelectors = [
  ".modal",
  ".modal[data-entering]",
  ".modal[data-exiting]",
  ".modal--raised",
  ".modal--rounded",
  ".modal--primary",
  ".modal--quintenary",
  ".modal__overlay",
  ".modal__overlay--blur",
  ".modal__overlay[data-entering]",
  ".modal__overlay[data-exiting]",
  ".modal__dialog",
  ".modal__dialog:focus",
]
const requiredDefaultThemeVariables = [
  "--aui-surface",
  "--aui-surface-foreground",
  "--aui-space-1",
  "--aui-space-2",
  "--aui-space-3",
  "--aui-radius-1",
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-shadow-1",
  "--aui-focus-ring",
]
const requiredActionColorVariables = [
  "--aui-color-primary-500",
  "--aui-color-secondary-500",
  "--aui-color-tertiary-500",
  "--aui-color-quaternary-500",
  "--aui-color-quintenary-500",
]

assert(modalSource.includes('from "react-aria-components"'), "Modal must import React Aria")
assert(modalSource.includes("ModalOverlay"), "Modal must preserve ModalOverlay composition")
assert(modalSource.includes("AdobeModal"), "Modal must preserve React Aria Modal composition")
assert(modalSource.includes("Dialog"), "Modal must preserve React Aria Dialog composition")
assert(modalSource.includes("Header"), "Modal must preserve default Header composition")
assert(modalSource.includes('from "../Button/Button"'), "Modal must import package-local Button")
assert(modalSource.includes('from "../Text/Text"'), "Modal must import package-local Text")
assert(modalSource.includes('from "../Text/TextStyles.module.css"'), "Modal must import package-local Text styles")
assert(modalSource.includes('data-testid={dataTestID ?? "modal"}'), "Modal root test id fallback must stay")
assert(modalSource.includes('data-testid="modal-overlay"'), "Modal overlay test id fallback must stay")
assert(modalSource.includes('dialogRole = "dialog"'), "Modal must default to dialog role")
assert(modalSource.includes("children ??"), "Modal must preserve default placeholder content")
assert(modalSource.includes('closeButtonText = "Close Modal"'), "Modal must preserve default close text")
assert(modalSource.includes('Modal.displayName = "Modal"'), "Modal display name must be set")

assert(helpersSource.includes('from "../../tokens/a11y"'), "Modal helpers must import package-local a11y tokens")
assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Modal helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Modal helpers must import package-local theme-order tokens",
)
assert(helpersSource.includes("export type TModalProps"), "Modal helpers must export local Modal props")
assert(helpersSource.includes("export const calibrateComponent"), "Modal calibration helper must remain local")
;[modalSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Modal runtime source must not import consumer-only modules")
})

assert(a11yTokenSource.includes("export type TAriaLabelingProps"), "A11y token support must expose labeling props")
assert(
  geometryTokenSource.includes("export type TCornerGeometry"),
  "Geometry token support must expose corner geometry",
)
assert(
  themeOrderTokenSource.includes("export type TThemingOrderCode"),
  "Theme-order token support must expose order codes",
)

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Modal CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `Modal CSS must read ${cssVariable}`)
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})
assert(
  helpersSource.includes("var(--aui-control-selected-foreground)"),
  "Modal helpers must read selected foreground for default close-button text",
)
assert(
  themeCSSSource.includes("--aui-control-selected-foreground:"),
  "theme.css must define selected foreground for default Modal close-button text",
)
requiredActionColorVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `Modal CSS must read ${cssVariable}`)
  assert(actionColorsSource.includes(cssVariable), `action-colors CSS must define ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Modal CSS must not read legacy Wavemap aliases")

assert(publicIndexSource.includes('export { Modal } from "./components/Modal"'), "Package index must export Modal")
assert(
  publicIndexSource.includes('export type { ModalProps } from "./components/Modal"'),
  "Package index must export ModalProps",
)
assert(!publicIndexSource.includes("TModalProps"), "Package index must not export Modal internals directly")
assert(modalIndexSource.includes('export { default as Modal } from "./Modal"'), "Modal index must export component")
assert(modalIndexSource.includes("TModalProps as ModalProps"), "Modal index must export props alias")
assert(!modalIndexSource.includes("calibrateComponent"), "Modal index must not export internals")

assert(packageJson.dependencies.classnames, "Modal package must keep classnames runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Modal React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "Modal package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Modal package must keep React DOM peer dependency")

assert(packet.name === "modal", "Modal packet must describe the modal item")
assert(packet.type === "component", "Modal packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Modal packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Modal packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#modal-next-candidate-planning-checkpoint"),
  "Modal packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Modal packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Modal packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Modal packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Modal" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Modal/Modal.tsx",
  ),
  "Modal packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "ModalProps" &&
      publicExport.localName === "TModalProps" &&
      publicExport.sourcePath === "packages/react/src/components/Modal/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Modal packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Modal packet must depend on default theme")
assert(packet.registryDependencies.includes("theme/action-colors"), "Modal packet must depend on action colors")
assert(packet.registryDependencies.includes("tokens/a11y"), "Modal packet must depend on a11y tokens")
assert(packet.registryDependencies.includes("tokens/geometry"), "Modal packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Modal packet must depend on theme-order tokens")
assert(packet.registryDependencies.includes("button"), "Modal packet must depend on Button")
assert(packet.registryDependencies.includes("text"), "Modal packet must depend on Text")
assert(!packet.registryDependencies.includes("theme/modal-compatibility"), "Modal must not need a bridge item")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Modal packet must declare React Aria peer")
assert(packet.runtimeDependencies.classnames, "Modal packet must declare classnames runtime dependency")
assert(!packet.runtimeDependencies.motion, "Modal packet must not declare Motion")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "Modal packet must record default-contract theme pressure")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Modal packet must record ${cssVariable}`)
})
assert(
  defaultContractRequirement.cssVariables.includes("--aui-control-selected-foreground"),
  "Modal packet must record selected foreground theme pressure",
)
const actionColorsRequirement = packet.themeRequirements.find((requirement) =>
  requirement.files?.some((file) => file.sourcePath === "packages/react/src/theme/action-colors.css"),
)
assert(actionColorsRequirement, "Modal packet must record action-colors theme support")
requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsRequirement.cssVariables.includes(cssVariable), `Modal packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/a11y",
  ),
  "Modal packet must record a11y token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Modal packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/theme-order",
  ),
  "Modal packet must record theme-order token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--distance_") && resolution.replacementSource.includes("--aui-space"),
  ),
  "Modal packet must record spacing CSS variable rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--focus-ring-color") &&
      resolution.replacementSource.includes("--aui-focus-ring"),
  ),
  "Modal packet must record focus-ring CSS variable rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/AlertDialog/AlertDialog.tsx"),
  "AlertDialog must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/AlertDialog/DefaultAlertDialogIcons.tsx"),
  "AlertDialog default icons must stay out",
)
assert(packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Link/Link.tsx"), "Link must stay out")
assert(
  packet.notes.some((note) => note.includes("React Aria ModalOverlay / Modal / Dialog primitive")),
  "Packet must record Modal proof scope",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a modal manifest item")),
  "Packet must keep manifest activation separate from source receipt",
)

assert(
  packetWrapperSource.includes("modalIngestPacketData as TRegistryIngestPacket"),
  "Modal packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { modalIngestPacket } from "./modal-ingest-packet"'),
  "Registry index must export Modal ingest packet",
)

console.log("[modal-proof] verified Modal source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
