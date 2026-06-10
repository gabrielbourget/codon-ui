import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const placeholderTextSourcePath = path.join(
  packageRoot,
  "src/components/Text/variants/PlaceholderText/PlaceholderText.tsx",
)
const helpersSourcePath = path.join(packageRoot, "src/components/Text/variants/PlaceholderText/helpers.ts")
const stylesSourcePath = path.join(
  packageRoot,
  "src/components/Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
)
const placeholderTextIndexPath = path.join(packageRoot, "src/components/Text/variants/PlaceholderText/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/placeholder-text-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/placeholder-text-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[placeholder-text-proof] ${message}`)
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

const placeholderTextSource = readRequiredText(placeholderTextSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const placeholderTextIndexSource = readRequiredText(placeholderTextIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Text/variants/PlaceholderText/PlaceholderText.tsx",
  "packages/react/src/components/Text/variants/PlaceholderText/helpers.ts",
  "packages/react/src/components/Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
  "packages/react/src/components/Text/variants/PlaceholderText/__tests__/PlaceholderText.test.tsx",
]
const requiredTargetPaths = [
  "Text/variants/PlaceholderText/PlaceholderText.tsx",
  "Text/variants/PlaceholderText/helpers.ts",
  "Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
  "Text/variants/PlaceholderText/__tests__/PlaceholderText.test.tsx",
]

assert(placeholderTextSource.includes('from "../../Text"'), "PlaceholderText must import installed package-local Text")
assert(placeholderTextSource.includes('variant="b11"'), "PlaceholderText must keep the sealed b11 variant")
assert(placeholderTextSource.includes('fontStyle="italic"'), "PlaceholderText must keep italic font style")
assert(
  placeholderTextSource.includes('data-testid={props["data-testid"] ?? "placeholder-text"}'),
  "PlaceholderText root test id fallback must stay",
)
assert(placeholderTextSource.includes("{...rest}"), "PlaceholderText must forward remaining Text props")

assert(helpersSource.includes('from "../../helpers"'), "PlaceholderText helpers must import package-local Text props")
assert(helpersSource.includes("export type TPlaceholderTextProps"), "PlaceholderText helpers must export local props")
assert(
  helpersSource.includes("PLACEHOLDER_TEXT_ALIGNMENT__LEFT"),
  "PlaceholderText alignment constants must stay local",
)
assert(
  helpersSource.includes("export const calibrateComponent"),
  "PlaceholderText calibration helper must remain local",
)
;[placeholderTextSource, helpersSource, stylesSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "PlaceholderText runtime source must not import consumer-only modules",
  )
})

assert(stylesSource.includes(".placeholderText"), "PlaceholderText CSS module must include root selector")
assert(stylesSource.includes(".placeholderText--alignCenter"), "PlaceholderText CSS must include center alignment")
assert(stylesSource.includes(".placeholderText--alignLeft"), "PlaceholderText CSS must include left alignment")
assert(
  stylesSource.includes("var(--aui-control-placeholder)"),
  "PlaceholderText CSS must read default placeholder color",
)
assert(!stylesSource.includes("--distance_"), "PlaceholderText CSS must not read legacy distance aliases")
assert(!stylesSource.includes("theme/placeholder-text-compatibility"), "PlaceholderText must not need a bridge item")

assert(
  publicIndexSource.includes('export { PlaceholderText } from "./components/Text/variants/PlaceholderText"'),
  "Package index must export PlaceholderText",
)
assert(
  publicIndexSource.includes('export type { PlaceholderTextProps } from "./components/Text/variants/PlaceholderText"'),
  "Package index must export PlaceholderTextProps",
)
assert(
  !publicIndexSource.includes("PLACEHOLDER_TEXT_ALIGNMENT__"),
  "Package index must not export PlaceholderText internals",
)
assert(
  placeholderTextIndexSource.includes('export { default as PlaceholderText } from "./PlaceholderText"'),
  "PlaceholderText index must export component",
)
assert(
  placeholderTextIndexSource.includes("TPlaceholderTextProps as PlaceholderTextProps"),
  "PlaceholderText index must export props alias",
)
assert(!placeholderTextIndexSource.includes("calibrateComponent"), "PlaceholderText index must not export internals")

assert(packageJson.dependencies.classnames, "PlaceholderText package must keep classnames runtime dependency")
assert(packageJson.peerDependencies.react, "PlaceholderText package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "PlaceholderText package must keep React DOM peer dependency")

assert(packet.name === "placeholder-text", "PlaceholderText packet must describe the placeholder-text item")
assert(packet.type === "component", "PlaceholderText packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "PlaceholderText packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "PlaceholderText packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#placeholdertext-next-candidate-planning-checkpoint"),
  "PlaceholderText packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `PlaceholderText packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `PlaceholderText packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "PlaceholderText packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "PlaceholderText" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Text/variants/PlaceholderText/PlaceholderText.tsx",
  ),
  "PlaceholderText packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "PlaceholderTextProps" &&
      publicExport.localName === "TPlaceholderTextProps" &&
      publicExport.sourcePath === "packages/react/src/components/Text/variants/PlaceholderText/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "PlaceholderText packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "PlaceholderText packet must depend on default theme")
assert(packet.registryDependencies.includes("text"), "PlaceholderText packet must depend on installed Text")
assert(
  !packet.registryDependencies.includes("theme/placeholder-text-compatibility"),
  "PlaceholderText must not need a bridge item",
)
assert(packet.runtimeDependencies.classnames, "PlaceholderText packet must declare classnames runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "PlaceholderText packet must record default-contract theme pressure")
assert(
  defaultContractRequirement.cssVariables.includes("--aui-control-placeholder"),
  "PlaceholderText packet must record placeholder color pressure",
)

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/Text" && resolution.registryDependencyName === "text",
  ),
  "PlaceholderText packet must record Text component import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/helpers" && resolution.registryDependencyName === "text",
  ),
  "PlaceholderText packet must record Text helper import rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/ListBoxItem/ListBoxItem.tsx"),
  "ListBoxItem must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Select/Select.tsx"),
  "Select must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/ComboBox/ComboBox.tsx"),
  "ComboBox must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/TagComboBox/TagComboBox.tsx"),
  "TagComboBox must stay out",
)

assert(
  packetWrapperSource.includes("placeholderTextIngestPacketData"),
  "PlaceholderText packet wrapper must import JSON data",
)
assert(
  registryIndexSource.includes('export { placeholderTextIngestPacket } from "./placeholder-text-ingest-packet"'),
  "Registry index must export PlaceholderText packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[placeholder-text-proof] source receipt checks passed")
