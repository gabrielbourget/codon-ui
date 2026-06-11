import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const checkboxGroupSourcePath = path.join(packageRoot, "src/components/CheckboxGroup/CheckboxGroup.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/CheckboxGroup/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/CheckboxGroup/CheckboxGroupStyles.module.css")
const checkboxGroupIndexPath = path.join(packageRoot, "src/components/CheckboxGroup/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/checkbox-group-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/checkbox-group-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[checkbox-group-proof] ${message}`)
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
const forbiddenLegacyCssPattern = /--distance_2|--disabledOpacity/u

const checkboxGroupSource = readRequiredText(checkboxGroupSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const checkboxGroupIndexSource = readRequiredText(checkboxGroupIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/CheckboxGroup/CheckboxGroup.tsx",
  "packages/react/src/components/CheckboxGroup/helpers.ts",
  "packages/react/src/components/CheckboxGroup/CheckboxGroupStyles.module.css",
  "packages/react/src/components/CheckboxGroup/__tests__/CheckboxGroup.test.tsx",
]
const requiredTargetPaths = [
  "CheckboxGroup/CheckboxGroup.tsx",
  "CheckboxGroup/helpers.ts",
  "CheckboxGroup/CheckboxGroupStyles.module.css",
  "CheckboxGroup/__tests__/CheckboxGroup.test.tsx",
]
const requiredExcludedSources = [
  "apps/wavemap-front-end/src/app/[locale]/component-showcase/page.tsx",
  "apps/wavemap-front-end/src/components/Checkbox/Checkbox.tsx",
  "apps/wavemap-front-end/src/components/Checkbox/__tests__/Checkbox.test.tsx",
]
const requiredStyleSelectors = [
  ".checkboxGroup",
  ".checkboxGroup--horizontal",
  ".checkboxGroup--vertical",
  ".checkboxGroup[data-disabled]",
]

assert(checkboxGroupSource.startsWith('"use client"'), "CheckboxGroup must preserve the client component boundary")
assert(
  checkboxGroupSource.includes('import { CheckboxGroup as AdobeCheckboxGroup } from "react-aria-components"'),
  "CheckboxGroup must use React Aria CheckboxGroup",
)
assert(
  checkboxGroupSource.includes('import { calibrateComponent, type TCheckboxGroupProps } from "./helpers"'),
  "CheckboxGroup must use local calibration helpers",
)
assert(
  checkboxGroupSource.includes("forwardRef<HTMLDivElement, TCheckboxGroupProps>"),
  "CheckboxGroup must forward a div ref",
)
assert(
  checkboxGroupSource.includes('data-testid={dataTestID ?? "checkbox-group"}'),
  "CheckboxGroup must preserve the root test id fallback",
)
assert(
  checkboxGroupSource.includes('CheckboxGroup.displayName = "CheckboxGroup"'),
  "CheckboxGroup must set displayName",
)
assert(
  checkboxGroupSource.includes("orientation: _orientation"),
  "CheckboxGroup must consume wrapper-only orientation before spreading root props",
)

assert(helpersSource.includes("export const ORIENTATION__HORIZONTAL"), "CheckboxGroup helpers must keep orientations")
assert(helpersSource.includes("export const calibrateComponent"), "CheckboxGroup calibration helper must remain local")
assert(!forbiddenConsumerImportsPattern.test(checkboxGroupSource), "CheckboxGroup source must not import consumer code")
assert(!forbiddenConsumerImportsPattern.test(helpersSource), "CheckboxGroup helpers must not import consumer code")
assert(!forbiddenConsumerImportsPattern.test(stylesSource), "CheckboxGroup styles must not reference consumer code")

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `CheckboxGroup CSS module must include ${selector}`)
})
;["var(--cui-space-2)", "var(--cui-opacity-disabled)"].forEach((cssValue) => {
  assert(stylesSource.includes(cssValue), `CheckboxGroup CSS must read ${cssValue}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "CheckboxGroup CSS must not read legacy Wavemap aliases")

assert(
  publicIndexSource.includes('export { CheckboxGroup } from "./components/CheckboxGroup"'),
  "Package index must export CheckboxGroup",
)
assert(
  publicIndexSource.includes('export type { CheckboxGroupProps } from "./components/CheckboxGroup"'),
  "Package index must export CheckboxGroupProps",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export CheckboxGroup internals")
assert(
  !publicIndexSource.includes("ORIENTATION__"),
  "Package index must not export CheckboxGroup orientation constants",
)
assert(
  checkboxGroupIndexSource.includes('export { default as CheckboxGroup } from "./CheckboxGroup"'),
  "CheckboxGroup index must export the component",
)
assert(
  checkboxGroupIndexSource.includes("TCheckboxGroupProps as CheckboxGroupProps"),
  "CheckboxGroup index must export props alias",
)
assert(
  !checkboxGroupIndexSource.includes("calibrateComponent"),
  "CheckboxGroup index must not export calibration internals",
)
assert(!checkboxGroupIndexSource.includes("ORIENTATION__"), "CheckboxGroup index must not export orientation constants")

assert(packageJson.peerDependencies.react, "CheckboxGroup package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "CheckboxGroup package must keep React DOM peer dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "CheckboxGroup React Aria peer range must match plan",
)
assert(packageJson.dependencies.classnames, "CheckboxGroup package must keep classnames runtime dependency")

assert(packet.name === "checkbox-group", "CheckboxGroup packet must describe the checkbox-group item")
assert(packet.type === "component", "CheckboxGroup packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "CheckboxGroup packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "CheckboxGroup packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#checkboxgroup-next-candidate-planning-checkpoint"),
  "CheckboxGroup packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `CheckboxGroup packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `CheckboxGroup packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "CheckboxGroup packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "CheckboxGroup" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/CheckboxGroup/CheckboxGroup.tsx",
  ),
  "CheckboxGroup packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "CheckboxGroupProps" &&
      publicExport.localName === "TCheckboxGroupProps" &&
      publicExport.sourcePath === "packages/react/src/components/CheckboxGroup/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "CheckboxGroup packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "CheckboxGroup packet must depend on default theme")
assert(packet.registryDependencies.includes("checkbox"), "CheckboxGroup packet must depend on installed Checkbox")
assert(
  !packet.registryDependencies.includes("theme/checkbox-group-compatibility"),
  "CheckboxGroup packet must not need a local compatibility bridge",
)
assert(
  !packet.registryDependencies.includes("theme/checkbox-compatibility"),
  "CheckboxGroup packet must not directly depend on the Checkbox bridge",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "CheckboxGroup packet must declare RAC peer")
assert(packet.runtimeDependencies.classnames, "CheckboxGroup packet must declare classnames runtime dependency")

const defaultThemeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultThemeRequirement, "CheckboxGroup packet must record default theme requirements")
assert(defaultThemeRequirement.cssVariables.includes("--cui-space-2"), "CheckboxGroup packet must record spacing token")
assert(
  defaultThemeRequirement.cssVariables.includes("--cui-opacity-disabled"),
  "CheckboxGroup packet must record disabled opacity token",
)
assert(
  !packet.themeRequirements.some((requirement) => requirement.strategy === "proof-compatibility-bridge"),
  "CheckboxGroup packet must not include proof bridge theme pressure",
)

requiredExcludedSources.forEach((sourcePath) => {
  assert(packet.excludedSourcePaths.includes(sourcePath), `CheckboxGroup packet must exclude ${sourcePath}`)
})
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Checkbox/Checkbox" &&
      resolution.registryDependencyName === "checkbox",
  ),
  "CheckboxGroup packet must record Checkbox child dependency boundary",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "CheckboxGroup packet must point at the package-side proof harness",
)
assert(
  packet.notes.some((note) => note.includes("Checkbox treated as an installed registry dependency")),
  "CheckboxGroup packet must record installed Checkbox dependency boundary",
)

assert(packetWrapperSource.includes("checkboxGroupIngestPacketData"), "CheckboxGroup wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { checkboxGroupIngestPacket } from "./checkbox-group-ingest-packet"'),
  "Registry index must export CheckboxGroup ingest packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[checkbox-group-proof] verified CheckboxGroup source receipt packet")
