import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const checkboxSourcePath = path.join(packageRoot, "src/components/Checkbox/Checkbox.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Checkbox/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Checkbox/CheckboxStyles.module.css")
const compatibilityBridgePath = path.join(packageRoot, "src/components/Checkbox/checkbox-compatibility.css")
const checkboxIndexPath = path.join(packageRoot, "src/components/Checkbox/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/checkbox-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/checkbox-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[checkbox-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\//u
const checkboxSource = readRequiredText(checkboxSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const compatibilityBridgeSource = readRequiredText(compatibilityBridgePath)
const checkboxIndexSource = readRequiredText(checkboxIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const requiredPackageFileSources = [
  "packages/react/src/components/Checkbox/Checkbox.tsx",
  "packages/react/src/components/Checkbox/helpers.ts",
  "packages/react/src/components/Checkbox/CheckboxStyles.module.css",
  "packages/react/src/components/Checkbox/__tests__/Checkbox.test.tsx",
]
const requiredTargetPaths = [
  "Checkbox/Checkbox.tsx",
  "Checkbox/helpers.ts",
  "Checkbox/CheckboxStyles.module.css",
  "Checkbox/__tests__/Checkbox.test.tsx",
]
const requiredExcludedConsumers = [
  "apps/wavemap-front-end/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/BooleanTypeFilterArgument/BooleanTypeFilterArgument.tsx",
  "apps/wavemap-front-end/src/components/Table/components/TableHeader/TableHeader.tsx",
  "apps/wavemap-front-end/src/components/Table/components/TableRow/TableRow.tsx",
  "apps/wavemap-front-end/src/components/FileUploadSurface/InternalComponents/ImagePreviewItem/ImagePreviewItem.tsx",
]
const requiredThemePressure = [
  "--distance_1",
  "--text-color",
  "--cui-color-primary-100",
  "--cui-color-primary-700",
  "--cui-action-primary-background",
  "--cui-action-quintenary-foreground",
]
const requiredCompatibilityAliases = [
  "--distance_1: var(--cui-space-1)",
  "--text-color: var(--cui-foreground)",
  "--disabledOpacity: var(--cui-opacity-disabled)",
  "--cui-action-primary-background",
  "--cui-action-quintenary-foreground",
]

assert(checkboxSource.startsWith('"use client"'), "Checkbox must preserve the client component boundary")
assert(
  checkboxSource.includes(
    'import { Checkbox as AdobeCheckbox, type CheckboxRenderProps } from "react-aria-components"',
  ),
  "Checkbox must use React Aria Checkbox",
)
assert(
  checkboxSource.includes('import { calibrateComponent, type TCheckboxProps } from "./helpers"'),
  "Checkbox must use local calibration helpers",
)
assert(
  checkboxSource.includes("forwardRef<HTMLLabelElement, TCheckboxProps>"),
  "Checkbox must forward an HTMLLabelElement ref",
)
assert(
  checkboxSource.includes("isIndeterminate !== undefined") &&
    checkboxSource.includes("checkboxRenderProps.isIndeterminate"),
  "Checkbox must preserve slot-context-aware indeterminate handling",
)
assert(
  checkboxSource.includes('data-testid={dataTestID ?? "checkbox"}'),
  "Checkbox must preserve the root test id fallback",
)
assert(checkboxSource.includes('data-testid="checkbox-shape"'), "Checkbox must preserve the shape test id")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Checkbox helpers must import geometry tokens from the package",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Checkbox helpers must import theme-order tokens from the package",
)
assert(
  helpersSource.includes("export const calibrateComponent"),
  "Checkbox calibration helper must remain available to Checkbox",
)
assert(!forbiddenConsumerImportsPattern.test(checkboxSource), "Checkbox source must not import consumer-only modules")
assert(!forbiddenConsumerImportsPattern.test(helpersSource), "Checkbox helpers must not import consumer-only modules")
assert(!forbiddenConsumerImportsPattern.test(stylesSource), "Checkbox styles must not reference consumer-only modules")
assert(
  !forbiddenConsumerImportsPattern.test(compatibilityBridgeSource),
  "Checkbox compatibility bridge must not reference consumer-only modules",
)

const requiredStyleSelectors = [
  ".checkbox",
  ".shape",
  ".shape--fallback",
  ".shape--primary",
  ".checkbox[data-selected] .shape--primary",
  ".checkbox[data-indeterminate] .shape--primary",
  ".svg",
]

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Checkbox CSS module must include ${selector}`)
})
requiredCompatibilityAliases.forEach((cssVariable) => {
  assert(compatibilityBridgeSource.includes(cssVariable), `Checkbox compatibility bridge must define ${cssVariable}`)
})

assert(
  publicIndexSource.includes('export { Checkbox } from "./components/Checkbox"'),
  "Package index must export Checkbox",
)
assert(
  publicIndexSource.includes('export type { CheckboxProps } from "./components/Checkbox"'),
  "Package index must export CheckboxProps",
)
assert(
  !publicIndexSource.includes("calibrateComponent"),
  "Package index must not export Checkbox calibration internals",
)
assert(
  checkboxIndexSource.includes('export { default as Checkbox } from "./Checkbox"'),
  "Checkbox index must export the component",
)
assert(
  checkboxIndexSource.includes("TCheckboxProps as CheckboxProps"),
  "Checkbox index must export the public prop alias",
)

assert(packet.name === "checkbox", "Checkbox packet must describe the checkbox item")
assert(packet.type === "component", "Checkbox packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Checkbox packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Checkbox packet must record Wavemap as the analyzed source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#checkbox-source-receipt-checkpoint"),
  "Checkbox packet must point at the Wavemap source receipt checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Checkbox packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Checkbox packet must target ${targetPath}`,
  )
})

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Checkbox" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Checkbox/Checkbox.tsx",
  ),
  "Checkbox packet must define the public Checkbox export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "CheckboxProps" &&
      publicExport.localName === "TCheckboxProps" &&
      publicExport.sourcePath === "packages/react/src/components/Checkbox/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Checkbox packet must define the public CheckboxProps type alias intent",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry" &&
      resolution.replacementSource === "../../tokens/geometry",
  ),
  "Checkbox packet must map geometry token imports to package-local support",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/theme-order" &&
      resolution.replacementSource === "../../tokens/theme-order",
  ),
  "Checkbox packet must map theme-order token imports to package-local support",
)

requiredExcludedConsumers.forEach((sourcePath) => {
  assert(packet.excludedSourcePaths.includes(sourcePath), `Checkbox packet must exclude consumer ${sourcePath}`)
})
assert(packet.registryDependencies.includes("theme-css"), "Checkbox packet must depend on the default theme")
assert(
  packet.registryDependencies.includes("theme/checkbox-compatibility"),
  "Checkbox packet must include the Checkbox proof compatibility bridge",
)
assert(
  !packet.registryDependencies.includes("theme/switch-compatibility"),
  "Checkbox packet must not reuse the Switch-only compatibility bridge by default",
)
assert(packet.registryDependencies.includes("tokens/geometry"), "Checkbox packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Checkbox packet must depend on theme-order tokens")
assert(packet.peerDependencies.react, "Checkbox packet must declare the React peer dependency")
assert(packet.peerDependencies["react-dom"], "Checkbox packet must declare the React DOM peer dependency")
assert(packet.peerDependencies["react-aria-components"], "Checkbox packet must declare the React Aria peer dependency")
assert(packet.runtimeDependencies.classnames, "Checkbox packet must declare the classnames runtime dependency")

const compatibilityBridgeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "proof-compatibility-bridge",
)
assert(compatibilityBridgeRequirement, "Checkbox packet must record proof compatibility bridge pressure")
requiredThemePressure.forEach((cssVariable) => {
  assert(
    compatibilityBridgeRequirement.cssVariables.includes(cssVariable),
    `Checkbox packet must record theme pressure for ${cssVariable}`,
  )
})
assert(
  compatibilityBridgeRequirement.files.some(
    (file) => file.sourcePath === "packages/react/src/components/Checkbox/checkbox-compatibility.css",
  ),
  "Checkbox packet must point at the separate Checkbox compatibility bridge",
)
assert(
  compatibilityBridgeRequirement.notes.some((note) => note.includes("--checkbox-selected-foreground")),
  "Checkbox packet must classify --checkbox-selected-foreground as component-local pressure",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "Checkbox packet must point at the package-side proof harness",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react typecheck"),
  "Checkbox packet must point at package typecheck verification",
)
assert(
  packet.notes.some((note) => note.includes("runtime source has been received")),
  "Checkbox packet must explicitly record source receipt",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a checkbox manifest item")),
  "Checkbox packet must keep manifest activation separate from source receipt",
)
assert(
  packetWrapperSource.includes("checkboxIngestPacketData") &&
    packetWrapperSource.includes("checkbox-ingest-packet.data.json"),
  "Checkbox packet wrapper must import the packet data",
)
assert(
  registryIndexSource.includes('export { checkboxIngestPacket } from "./checkbox-ingest-packet"'),
  "Registry index must export checkboxIngestPacket",
)

if (process.exitCode) process.exit()

console.log("[checkbox-proof] package-side Checkbox proof harness verified")
