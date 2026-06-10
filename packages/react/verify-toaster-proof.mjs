import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const toasterSourcePath = path.join(packageRoot, "src/components/Toaster/Toaster.tsx")
const toasterHelpersSourcePath = path.join(packageRoot, "src/components/Toaster/helpers.ts")
const toasterStateSourcePath = path.join(packageRoot, "src/components/Toaster/stateManagement.ts")
const toasterStylesSourcePath = path.join(packageRoot, "src/components/Toaster/ToasterStyles.module.css")
const toastSourcePath = path.join(packageRoot, "src/components/Toaster/Toast/Toast.tsx")
const toastHelpersSourcePath = path.join(packageRoot, "src/components/Toaster/Toast/helpers.tsx")
const toastLabelsSourcePath = path.join(packageRoot, "src/components/Toaster/Toast/labels.ts")
const toastIconsSourcePath = path.join(packageRoot, "src/components/Toaster/Toast/DefaultToastIcons.tsx")
const toastStylesSourcePath = path.join(packageRoot, "src/components/Toaster/Toast/ToastStyles.module.css")
const toasterIndexPath = path.join(packageRoot, "src/components/Toaster/index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/toaster-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/toaster-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const manifestPath = path.join(packageRoot, "src/registry/manifest.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[toaster-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|api-contract|shared-utils|localStorage|@\/src\/|@internationalized\/date/u
const forbiddenLegacyCssPattern =
  /--distance_|--border_radius_|--shadow_1|--focus-ring-color|--Z_INDEX|theme\/toaster-compatibility/u

const toasterSource = readRequiredText(toasterSourcePath)
const toasterHelpersSource = readRequiredText(toasterHelpersSourcePath)
const toasterStateSource = readRequiredText(toasterStateSourcePath)
const toasterStylesSource = readRequiredText(toasterStylesSourcePath)
const toastSource = readRequiredText(toastSourcePath)
const toastHelpersSource = readRequiredText(toastHelpersSourcePath)
const toastLabelsSource = readRequiredText(toastLabelsSourcePath)
const toastIconsSource = readRequiredText(toastIconsSourcePath)
const toastStylesSource = readRequiredText(toastStylesSourcePath)
const toasterIndexSource = readRequiredText(toasterIndexPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const manifestSource = readRequiredText(manifestPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Toaster/Toaster.tsx",
  "packages/react/src/components/Toaster/helpers.ts",
  "packages/react/src/components/Toaster/stateManagement.ts",
  "packages/react/src/components/Toaster/ToasterStyles.module.css",
  "packages/react/src/components/Toaster/Toast/Toast.tsx",
  "packages/react/src/components/Toaster/Toast/helpers.tsx",
  "packages/react/src/components/Toaster/Toast/labels.ts",
  "packages/react/src/components/Toaster/Toast/DefaultToastIcons.tsx",
  "packages/react/src/components/Toaster/Toast/ToastStyles.module.css",
]
const requiredDefaultThemeVariables = [
  "--cui-surface",
  "--cui-surface-foreground",
  "--cui-space-1",
  "--cui-space-2",
  "--cui-space-3",
  "--cui-radius-1",
  "--cui-radius-2",
  "--cui-shadow-1",
  "--cui-focus-ring",
  "--cui-z-index-toast",
  "--cui-control-placeholder",
  "--cui-control-selected-background",
  "--cui-control-selected-foreground",
  "--cui-status-warning",
  "--cui-status-danger",
  "--cui-status-success",
]
const expectedPublicExports = [
  "Toaster",
  "toast",
  "ToasterProps",
  "ExternalToast",
  "ToastPayload",
  "ToastProps",
  "AvailableToastPositions",
  "AvailableToastTypes",
  "ToastLabels",
  "PartialToastLabels",
]
const expectedRegistryDependencies = [
  "theme-css",
  "theme/action-colors",
  "tokens/a11y",
  "tokens/geometry",
  "button",
  "text",
]

;[
  toasterSource,
  toasterHelpersSource,
  toasterStateSource,
  toasterStylesSource,
  toastSource,
  toastHelpersSource,
  toastLabelsSource,
  toastIconsSource,
  toastStylesSource,
].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Toaster runtime source must not import consumer-only modules")
})
assert(!forbiddenLegacyCssPattern.test(toasterStylesSource), "Toaster CSS must not read legacy Wavemap aliases")
assert(!forbiddenLegacyCssPattern.test(toastStylesSource), "Toast CSS must not read legacy Wavemap aliases")

assert(toasterSource.includes("ReactDOM.flushSync"), "Toaster must preserve sync toast transition publication")
assert(toasterSource.includes("ToasterObserver.subscribe"), "Toaster must subscribe to published toast events")
assert(toasterSource.includes('data-testid={dataTestID ?? "toaster"}'), "Toaster test id fallback must stay")
assert(toasterSource.includes("Ghost hover bridges"), "Toaster must preserve expanded-stack hover bridges")
assert(
  toasterHelpersSource.includes('from "../../tokens/a11y"'),
  "Toaster helpers must import package-local a11y tokens",
)
assert(
  toastHelpersSource.includes('from "../../../tokens/geometry"'),
  "Toast helpers must import package-local geometry tokens",
)
assert(toastHelpersSource.includes('from "date-fns"'), "Toast helpers must import date-fns timestamp formatter")
assert(
  toastHelpersSource.includes('from "../../Text/TextStyles.module.css"'),
  "Toast helpers must reuse package-local Text styles",
)
assert(toastSource.includes('from "../../Button/Button"'), "Toast must import package-local Button")
assert(toastSource.includes('from "../../Text/Text"'), "Toast must import package-local Text")
assert(toastSource.includes("const useIsomorphicLayoutEffect"), "Toast must own its isomorphic layout effect helper")
assert(toastSource.includes("const useIsDocumentHidden"), "Toast must own its document visibility helper")
assert(toastLabelsSource.includes("DEFAULT_TOAST_LABELS"), "Toast labels must define defaults")
assert(toastLabelsSource.includes("resolveToastLabels"), "Toast labels must expose resolver")
assert(toastIconsSource.includes("ToastDefaultCloseIcon"), "Default toast close icon must stay available")
assert(toastHelpersSource.includes("AVAILABLE_TOAST_TYPES"), "Toast type constants must remain available")
assert(toasterHelpersSource.includes("AVAILABLE_TOAST_POSITIONS"), "Toast position constants must remain available")

requiredDefaultThemeVariables.forEach((cssVariable) => {
  const sourceReadsVariable =
    toasterStylesSource.includes(`var(${cssVariable})`) ||
    toastStylesSource.includes(`var(${cssVariable})`) ||
    toastHelpersSource.includes(`var(${cssVariable})`)
  assert(sourceReadsVariable, `Toaster source must read ${cssVariable}`)
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})

assert(packageJson.dependencies.classnames === "^2.3.2", "Toaster package must declare classnames")
assert(packageJson.dependencies["date-fns"] === "^4.1.0", "Toaster package must declare date-fns")
assert(packageJson.peerDependencies.react, "Toaster package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Toaster package must keep React DOM peer dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Toaster package must keep React Aria Components peer dependency",
)

assert(
  toasterIndexSource.includes("export { default as Toaster, toast }"),
  "Toaster index must export component and toast",
)
expectedPublicExports.forEach((exportedName) => {
  assert(publicIndexSource.includes(exportedName), `Package index must export ${exportedName}`)
  assert(toasterIndexSource.includes(exportedName), `Toaster index must export ${exportedName}`)
})
assert(!publicIndexSource.includes("TToasterProps"), "Package index must not export Toaster internals directly")
assert(!toasterIndexSource.includes("ToasterObserver"), "ToasterObserver must not be package public API")

assert(packet.name === "toaster", "Toaster packet must describe the toaster item")
assert(packet.type === "component", "Toaster packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Toaster packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Toaster packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#toaster-extraction-planning-checkpoint"),
  "Toaster packet must point at the Wavemap planning checkpoint",
)
requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Toaster packet must include ${sourcePath}`,
  )
  assert(manifestSource.includes(`sourcePath: "${sourcePath}"`), `Toaster manifest must include ${sourcePath}`)
})
assert(
  packet.files.every((file) => file.role !== "test"),
  "Toaster packet must not receive focused tests",
)
expectedPublicExports.forEach((exportedName) => {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportedName),
    `Toaster packet must record ${exportedName} export intent`,
  )
})
expectedRegistryDependencies.forEach((registryDependency) => {
  assert(
    packet.registryDependencies.includes(registryDependency),
    `Toaster packet must depend on ${registryDependency}`,
  )
  assert(manifestSource.includes(`"${registryDependency}"`), `Toaster manifest must depend on ${registryDependency}`)
})
assert(!packet.registryDependencies.includes("theme/toaster-compatibility"), "Toaster must not need a bridge item")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Toaster packet must declare React Aria peer")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "Toaster packet must declare classnames")
assert(packet.runtimeDependencies["date-fns"] === "^4.1.0", "Toaster packet must declare date-fns")
assert(manifestSource.includes('name: "toaster"'), "Toaster manifest item must be active")
assert(manifestSource.includes('"date-fns": "^4.1.0"'), "Toaster manifest must declare date-fns")
const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "Toaster packet must record default-contract theme pressure")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Toaster packet must record ${cssVariable}`)
})
assert(
  packet.importResolutions.some((resolution) => resolution.replacementSource === "--cui-z-index-toast"),
  "Toaster packet must record toast z-index rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Toaster/Toast/i18n.ts"),
  "Toaster packet must explicitly exclude app i18n adapter",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/FileUploadSurface/**"),
  "Toaster packet must not pull FileUploadSurface source",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a toaster manifest item")),
  "Packet must keep manifest activation separate from source receipt",
)

assert(
  packetWrapperSource.includes("toasterIngestPacketData as TRegistryIngestPacket"),
  "Toaster packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { toasterIngestPacket } from "./toaster-ingest-packet"'),
  "Registry index must export Toaster ingest packet",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[toaster-proof] verified Toaster source receipt packet")
