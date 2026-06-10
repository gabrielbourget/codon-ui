import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const textSourcePath = path.join(packageRoot, "src/components/Text/Text.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Text/helpers.ts")
const constantsSourcePath = path.join(packageRoot, "src/components/Text/constants.ts")
const typesSourcePath = path.join(packageRoot, "src/components/Text/types.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Text/TextStyles.module.css")
const typographySupportPath = path.join(packageRoot, "src/components/Text/text-typography.css")
const textIndexPath = path.join(packageRoot, "src/components/Text/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/text-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/text-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")

const fail = (message) => {
  console.error(`[text-proof] ${message}`)
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
const forbiddenWavemapTypographyPattern = /--fontface_primary|Switzer|next\/font/u
const textSource = readRequiredText(textSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const constantsSource = readRequiredText(constantsSourcePath)
const typesSource = readRequiredText(typesSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const typographySupportSource = readRequiredText(typographySupportPath)
const textIndexSource = readRequiredText(textIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)

const runtimeSources = [textSource, helpersSource, constantsSource, typesSource, stylesSource, typographySupportSource]
const requiredPackageFileSources = [
  "packages/react/src/components/Text/Text.tsx",
  "packages/react/src/components/Text/helpers.ts",
  "packages/react/src/components/Text/constants.ts",
  "packages/react/src/components/Text/types.ts",
  "packages/react/src/components/Text/TextStyles.module.css",
  "packages/react/src/components/Text/__tests__/Text.test.tsx",
]
const requiredTargetPaths = [
  "Text/Text.tsx",
  "Text/helpers.ts",
  "Text/constants.ts",
  "Text/types.ts",
  "Text/TextStyles.module.css",
  "Text/__tests__/Text.test.tsx",
]
const requiredStyleSelectors = [
  ".base",
  ".base--unselectable",
  ".composedInLink",
  ".d1",
  ".h1-sm",
  ".b10",
  ".b13",
  ".fw-regular",
  ".fw-extrabold",
  ".fs-italic",
]
const requiredTypographyVariables = [
  "--cui-font-family-body",
  "--cui-font-family-heading",
  "--cui-font-family-display",
  "--cui-text-d1-font-size",
  "--cui-text-h1-sm-font-size",
  "--cui-text-b10-font-size",
  "--cui-text-b13-line-height",
  "--cui-font-weight-regular",
  "--cui-font-weight-extrabold",
]
const requiredTypographySupportVariables = [
  "--cui-font-family-system",
  "--cui-font-family-body-override",
  "--cui-font-family-heading-override",
  "--cui-font-family-display-override",
]

assert(textSource.startsWith('"use client"'), "Text must preserve the client component boundary")
assert(textSource.includes("forwardRef<HTMLElement, TTextProps>"), "Text must forward an HTMLElement ref")
assert(textSource.includes('data-testid={dataTestID ?? "text"}'), "Text must preserve the root test id fallback")
assert(helpersSource.includes('from "./constants"'), "Text helpers must import package-local constants")
assert(helpersSource.includes('from "./TextStyles.module.css"'), "Text helpers must import package-local styles")
assert(helpersSource.includes('from "./types"'), "Text helpers must import package-local types")
assert(typesSource.includes('from "./constants"'), "Text types must import package-local constants")
assert(helpersSource.includes("export const calibrateComponent"), "Text calibration helper must remain local")

runtimeSources.forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Text runtime source must not import consumer-only modules")
  assert(!forbiddenWavemapTypographyPattern.test(source), "Text runtime source must not ship Wavemap font assumptions")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Text CSS module must include ${selector}`)
})
requiredTypographyVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(cssVariable), `Text CSS module must read ${cssVariable}`)
  assert(typographySupportSource.includes(cssVariable), `Text typography support must define ${cssVariable}`)
})
requiredTypographySupportVariables.forEach((cssVariable) => {
  assert(typographySupportSource.includes(cssVariable), `Text typography support must define ${cssVariable}`)
})
assert(
  typographySupportSource.includes("system-ui") && typographySupportSource.includes('"BlinkMacSystemFont"'),
  "Text typography support must provide neutral system font defaults",
)
assert(!stylesSource.includes("--colorTransition"), "Text styles must not read the legacy colorTransition alias")

assert(publicIndexSource.includes('Text,\n} from "./components/Text"'), "Package index must export Text")
assert(publicIndexSource.includes("TextProps"), "Package index must export TextProps")
assert(publicIndexSource.includes("TextAvailableFontVariant"), "Package index must export public typography types")
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export Text calibration internals")
assert(textIndexSource.includes('export { default as Text } from "./Text"'), "Text index must export the component")
assert(textIndexSource.includes("TTextProps as TextProps"), "Text index must export the public prop alias")
assert(textIndexSource.includes("FONT_VARIANT__BODY_10"), "Text index must export stable typography constants")

assert(packet.name === "text", "Text packet must describe the text item")
assert(packet.type === "component", "Text packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Text packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Text packet must record Wavemap as the analyzed source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#text-primitive-planning-checkpoint"),
  "Text packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Text packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Text packet must target ${targetPath}`,
  )
})

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Text" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Text/Text.tsx",
  ),
  "Text packet must define the public Text export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TextProps" &&
      publicExport.localName === "TTextProps" &&
      publicExport.sourcePath === "packages/react/src/components/Text/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Text packet must define the public TextProps type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Text packet must depend on the default theme")
assert(
  packet.registryDependencies.includes("theme/text-typography"),
  "Text packet must include the neutral typography support item",
)
assert(
  !packet.registryDependencies.includes("theme/radio-compatibility"),
  "Text packet must not reuse another component compatibility bridge by default",
)
assert(packet.peerDependencies.react, "Text packet must declare the React peer dependency")
assert(packet.peerDependencies["react-dom"], "Text packet must declare the React DOM peer dependency")
assert(!packet.peerDependencies["react-aria-components"], "Text packet must not require React Aria")
assert(packet.runtimeDependencies.classnames, "Text packet must declare the classnames runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "Text packet must record default typography support")
requiredTypographyVariables.forEach((cssVariable) => {
  assert(
    defaultContractRequirement.cssVariables.includes(cssVariable),
    `Text packet must record theme pressure for ${cssVariable}`,
  )
})
requiredTypographySupportVariables.forEach((cssVariable) => {
  assert(
    defaultContractRequirement.cssVariables.includes(cssVariable),
    `Text packet must record theme pressure for ${cssVariable}`,
  )
})
assert(
  defaultContractRequirement.files.some(
    (file) => file.sourcePath === "packages/react/src/components/Text/text-typography.css",
  ),
  "Text packet must point at the neutral typography support CSS",
)
assert(
  defaultContractRequirement.notes.some((note) => note.includes("neutral example preset")),
  "Text packet must record the neutral typography preset intent",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "Text packet must point at the package-side proof harness",
)
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react typecheck"),
  "Text packet must point at package typecheck verification",
)
assert(
  packet.notes.some((note) => note.includes("neutral typography support variables")),
  "Text packet must explicitly record neutral typography source receipt",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a text manifest item")),
  "Text packet must keep manifest activation separate from source receipt",
)
assert(
  packetWrapperSource.includes("textIngestPacketData") && packetWrapperSource.includes("text-ingest-packet.data.json"),
  "Text packet wrapper must import the packet data",
)
assert(registryIndexSource.includes("textIngestPacket"), "Registry index must export the Text ingest packet")

if (process.exitCode) process.exit(process.exitCode)
console.log("[text-proof] source receipt proof passed")
