import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const alertDialogSourcePath = path.join(packageRoot, "src/components/AlertDialog/AlertDialog.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/AlertDialog/helpers.tsx")
const stylesSourcePath = path.join(packageRoot, "src/components/AlertDialog/AlertDialogStyles.module.css")
const defaultIconsSourcePath = path.join(packageRoot, "src/components/AlertDialog/DefaultAlertDialogIcons.tsx")
const labelsSourcePath = path.join(packageRoot, "src/components/AlertDialog/labels.ts")
const alertDialogIndexPath = path.join(packageRoot, "src/components/AlertDialog/index.ts")
const a11yTokenPath = path.join(packageRoot, "src/tokens/a11y.ts")
const geometryTokenPath = path.join(packageRoot, "src/tokens/geometry.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/alert-dialog-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/alert-dialog-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[alert-dialog-proof] ${message}`)
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
  /--distance_|--fadeInAnimation|--fadeOutAnimation|--border_radius_|--shadow_|--focus-ring-color|--Z_INDEX_|theme\/alert-dialog-compatibility/u

const alertDialogSource = readRequiredText(alertDialogSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const defaultIconsSource = readRequiredText(defaultIconsSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const alertDialogIndexSource = readRequiredText(alertDialogIndexPath)
const a11yTokenSource = readRequiredText(a11yTokenPath)
const geometryTokenSource = readRequiredText(geometryTokenPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/AlertDialog/AlertDialog.tsx",
  "packages/react/src/components/AlertDialog/helpers.tsx",
  "packages/react/src/components/AlertDialog/DefaultAlertDialogIcons.tsx",
  "packages/react/src/components/AlertDialog/labels.ts",
  "packages/react/src/components/AlertDialog/AlertDialogStyles.module.css",
  "packages/react/src/components/AlertDialog/__tests__/AlertDialog.test.tsx",
]
const requiredTargetPaths = [
  "AlertDialog/AlertDialog.tsx",
  "AlertDialog/helpers.tsx",
  "AlertDialog/DefaultAlertDialogIcons.tsx",
  "AlertDialog/labels.ts",
  "AlertDialog/AlertDialogStyles.module.css",
  "AlertDialog/__tests__/AlertDialog.test.tsx",
]
const requiredStyleSelectors = [
  ".alertDialog",
  ".alertDialog__topRibbon",
  ".alertDialog__topRibbon--info",
  ".alertDialog__topRibbon--warning",
  ".alertDialog__topRibbon--errorOrDanger",
  ".alertDialog__topRibbon--success",
  ".alertDialog[data-entering]",
  ".alertDialog[data-exiting]",
  ".alertDialog--raised",
  ".alertDialog--rounded",
  ".alertDialog__overlay",
  ".alertDialog__overlay--blur",
  ".alertDialog__overlay[data-entering]",
  ".alertDialog__overlay[data-exiting]",
  ".alertDialog__dialog",
  ".alertDialog__dialog:focus",
  ".alertDialog__dialog__iconCircle",
  ".alertDialog__dialog__buttonRow",
]
const requiredDefaultThemeVariables = [
  "--aui-surface",
  "--aui-surface-foreground",
  "--aui-space-1",
  "--aui-space-2",
  "--aui-space-3",
  "--aui-space-4",
  "--aui-radius-2",
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-shadow-1",
  "--aui-shadow-2",
  "--aui-focus-ring",
  "--aui-z-index-modal",
  "--aui-control-selected-background",
  "--aui-control-selected-foreground",
  "--aui-status-warning",
  "--aui-status-danger",
  "--aui-status-success",
]
const requiredDefaultIconExports = [
  "AlertDialogDefaultCheckmarkIcon",
  "AlertDialogDefaultDeleteIcon",
  "AlertDialogDefaultErrorIcon",
  "AlertDialogDefaultInfoIcon",
  "AlertDialogDefaultOctagonExclamationIcon",
  "AlertDialogDefaultTriangleExclamationIcon",
]

assert(alertDialogSource.includes('from "react-aria-components"'), "AlertDialog must import React Aria")
assert(alertDialogSource.includes("ModalOverlay"), "AlertDialog must preserve ModalOverlay composition")
assert(alertDialogSource.includes("AdobeModal"), "AlertDialog must preserve React Aria Modal composition")
assert(alertDialogSource.includes("Dialog"), "AlertDialog must preserve React Aria Dialog composition")
assert(alertDialogSource.includes("Header"), "AlertDialog must preserve Header composition")
assert(alertDialogSource.includes('from "../Button/Button"'), "AlertDialog must import package-local Button")
assert(alertDialogSource.includes('from "../Text/Text"'), "AlertDialog must import package-local Text")
assert(alertDialogSource.includes('role="alertdialog"'), "AlertDialog must force alertdialog role")
assert(
  alertDialogSource.includes('data-testid={dataTestID ?? "alert-dialog"}'),
  "AlertDialog root test id fallback must stay",
)
assert(alertDialogSource.includes("resolveAlertDialogLabels"), "AlertDialog must resolve labels")
assert(alertDialogSource.includes('AlertDialog.displayName = "AlertDialog"'), "AlertDialog display name must be set")

assert(helpersSource.includes('from "../../tokens/a11y"'), "AlertDialog helpers must import package-local a11y tokens")
assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "AlertDialog helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../Text/TextStyles.module.css"'),
  "AlertDialog helpers must import package-local Text styles",
)
assert(helpersSource.includes("export type TAlertDialogProps"), "AlertDialog helpers must export local props")
assert(helpersSource.includes("export const calibrateComponent"), "AlertDialog calibration helper must remain local")
assert(
  helpersSource.includes("AVAILABLE_ALERT_DIALOG_TYPES"),
  "AlertDialog status type constants must remain available",
)
requiredDefaultIconExports.forEach((exportName) => {
  assert(defaultIconsSource.includes(`export const ${exportName}`), `Default icons must export ${exportName}`)
  assert(helpersSource.includes(exportName), `Helpers must route ${exportName}`)
})
assert(labelsSource.includes("DEFAULT_ALERT_DIALOG_LABELS"), "AlertDialog labels must define defaults")
assert(labelsSource.includes("resolveAlertDialogLabels"), "AlertDialog labels must expose resolver")
;[alertDialogSource, helpersSource, stylesSource, defaultIconsSource, labelsSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "AlertDialog runtime source must not import consumer-only modules",
  )
})
assert(a11yTokenSource.includes("export type TAriaLabelingProps"), "A11y token support must expose labeling props")
assert(
  geometryTokenSource.includes("export type TCornerGeometry"),
  "Geometry token support must expose corner geometry",
)

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `AlertDialog CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(
    stylesSource.includes(`var(${cssVariable})`) ||
      helpersSource.includes(`var(${cssVariable})`) ||
      alertDialogSource.includes(`var(${cssVariable})`),
    `AlertDialog source must read ${cssVariable}`,
  )
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "AlertDialog CSS must not read legacy Wavemap aliases")

assert(
  publicIndexSource.includes('export { AlertDialog } from "./components/AlertDialog"'),
  "Package index must export AlertDialog",
)
assert(publicIndexSource.includes("AlertDialogProps"), "Package index must export AlertDialogProps")
assert(!publicIndexSource.includes("TAlertDialogProps"), "Package index must not export AlertDialog internals directly")
assert(
  alertDialogIndexSource.includes('export { default as AlertDialog } from "./AlertDialog"'),
  "AlertDialog index must export component",
)
assert(
  alertDialogIndexSource.includes("TAlertDialogProps as AlertDialogProps"),
  "AlertDialog index must export props alias",
)
assert(
  alertDialogIndexSource.includes("TAlertDialogLabels as AlertDialogLabels"),
  "AlertDialog index must export label type alias",
)
assert(!alertDialogIndexSource.includes("calibrateComponent"), "AlertDialog index must not export internals")

assert(packageJson.dependencies.classnames, "AlertDialog package must keep classnames runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "AlertDialog React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "AlertDialog package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "AlertDialog package must keep React DOM peer dependency")

assert(packet.name === "alert-dialog", "AlertDialog packet must describe the alert-dialog item")
assert(packet.type === "component", "AlertDialog packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "AlertDialog packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "AlertDialog packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#alertdialog-next-candidate-planning-checkpoint"),
  "AlertDialog packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `AlertDialog packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `AlertDialog packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "AlertDialog packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "AlertDialog" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/AlertDialog/AlertDialog.tsx",
  ),
  "AlertDialog packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "AlertDialogProps" &&
      publicExport.localName === "TAlertDialogProps" &&
      publicExport.sourcePath === "packages/react/src/components/AlertDialog/helpers.tsx" &&
      publicExport.typeOnly === true,
  ),
  "AlertDialog packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "AlertDialog packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/a11y"), "AlertDialog packet must depend on a11y tokens")
assert(packet.registryDependencies.includes("tokens/geometry"), "AlertDialog packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("button"), "AlertDialog packet must depend on Button")
assert(packet.registryDependencies.includes("text"), "AlertDialog packet must depend on Text")
assert(
  !packet.registryDependencies.includes("theme/alert-dialog-compatibility"),
  "AlertDialog must not need a bridge item",
)
assert(
  packet.peerDependencies["react-aria-components"] === "^1.17.0",
  "AlertDialog packet must declare React Aria peer",
)
assert(packet.runtimeDependencies.classnames, "AlertDialog packet must declare classnames runtime dependency")
assert(!packet.runtimeDependencies.motion, "AlertDialog packet must not declare Motion")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "AlertDialog packet must record default-contract theme pressure")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `AlertDialog packet must record ${cssVariable}`)
})
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/AlertDialog/i18n.ts"),
  "AlertDialog packet must explicitly exclude app i18n adapter",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Sheets/MediaSheet/MediaSheet.tsx"),
  "AlertDialog packet must not pull sheet source",
)

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/a11y" &&
      resolution.replacementSource === "../../tokens/a11y",
  ),
  "AlertDialog packet must record a11y token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry" &&
      resolution.replacementSource === "../../tokens/geometry",
  ),
  "AlertDialog packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some((resolution) => resolution.replacementSource === "--aui-z-index-modal"),
  "AlertDialog packet must record modal z-index rewrite",
)

assert(
  packetWrapperSource.includes("alertDialogIngestPacketData as TRegistryIngestPacket"),
  "AlertDialog packet wrapper must type the packet data",
)
assert(
  registryIndexSource.includes('export { alertDialogIngestPacket } from "./alert-dialog-ingest-packet"'),
  "Registry index must export AlertDialog packet",
)

console.log("[alert-dialog-proof] verified AlertDialog source receipt packet")
