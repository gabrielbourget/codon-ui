import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const linearProgressSourcePath = path.join(packageRoot, "src/components/LinearProgress/LinearProgress.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/LinearProgress/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/LinearProgress/LinearProgressStyles.module.css")
const linearProgressIndexPath = path.join(packageRoot, "src/components/LinearProgress/index.ts")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const packetSourcePath = path.join(packageRoot, "src/registry/linear-progress-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/linear-progress-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[linear-progress-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\/|@radix-ui|@internationalized\/date/u
const forbiddenLegacyCssPattern = /--shadow_1|--border_radius_1/u

const linearProgressSource = readRequiredText(linearProgressSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const linearProgressIndexSource = readRequiredText(linearProgressIndexPath)
const actionColorsSource = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/LinearProgress/LinearProgress.tsx",
  "packages/react/src/components/LinearProgress/helpers.ts",
  "packages/react/src/components/LinearProgress/LinearProgressStyles.module.css",
  "packages/react/src/components/LinearProgress/__tests__/LinearProgress.test.tsx",
]
const requiredTargetPaths = [
  "LinearProgress/LinearProgress.tsx",
  "LinearProgress/helpers.ts",
  "LinearProgress/LinearProgressStyles.module.css",
  "LinearProgress/__tests__/LinearProgress.test.tsx",
]
const requiredStyleSelectors = [
  ".linearProgress",
  ".linearProgress--horizontal",
  ".linearProgress--vertical",
  ".linearProgress--dirLeft",
  ".linearProgress--dirDown",
  ".linearProgress__track",
  ".linearProgress__track--raised",
  ".linearProgress__track--rounded",
  ".linearProgress__track--round",
  ".linearProgress__bar",
  ".linearProgress__bar--rounded",
  ".linearProgress__bar--round",
  ".linearProgress__bar--primary",
  ".linearProgress__bar--quintenary",
]
const requiredActionColorVariables = [
  "--aui-color-primary-500",
  "--aui-color-secondary-500",
  "--aui-color-tertiary-500",
  "--aui-color-quaternary-500",
  "--aui-color-quintenary-500",
]

assert(linearProgressSource.includes('from "motion/react"'), "LinearProgress must import Motion")
assert(linearProgressSource.includes("<motion.div"), "LinearProgress must animate the progress bar with Motion")
assert(linearProgressSource.includes('from "react-aria-components"'), "LinearProgress must import React Aria")
assert(linearProgressSource.includes("<AdobeProgressBar"), "LinearProgress must render React Aria ProgressBar")
assert(
  linearProgressSource.includes("forwardRef<HTMLDivElement, TLinearProgressProps>"),
  "LinearProgress must forward a div ref",
)
assert(
  linearProgressSource.includes('data-testid={dataTestID ?? "linear-progress"}'),
  "LinearProgress root test id fallback must stay",
)
assert(
  linearProgressSource.includes("percentage ?? 0"),
  "LinearProgress must preserve the zero fallback for indeterminate percentages",
)
assert(
  linearProgressSource.includes('transition={{ ease: "easeInOut", duration: 0.25 }}'),
  "LinearProgress Motion transition must stay bounded",
)
assert(
  linearProgressSource.includes('LinearProgress.displayName = "LinearProgress"'),
  "LinearProgress display name must be set",
)

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "LinearProgress helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "LinearProgress helpers must import package-local theme-order tokens",
)
assert(helpersSource.includes("export type TLinearProgressProps"), "LinearProgress helpers must export local props")
assert(
  helpersSource.includes('export const LINEAR_PROGRESS_ORIENTATION__HORIZONTAL = "horizontal"'),
  "LinearProgress horizontal orientation constant must stay local",
)
assert(helpersSource.includes("export const calibrateComponent"), "LinearProgress calibration helper must remain local")
;[linearProgressSource, helpersSource, stylesSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "LinearProgress runtime source must not import consumer-only modules",
  )
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `LinearProgress CSS module must include ${selector}`)
})
;[
  "var(--aui-control-border)",
  "var(--aui-control-selected-background)",
  "var(--aui-shadow-1)",
  "var(--aui-radius-1)",
  "var(--aui-color-primary-500)",
  "var(--aui-color-quintenary-500)",
].forEach((cssValue) => {
  assert(stylesSource.includes(cssValue), `LinearProgress CSS must read ${cssValue}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "LinearProgress CSS must not read legacy Wavemap aliases")

requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsSource.includes(cssVariable), `action-colors CSS must define ${cssVariable}`)
})

assert(
  publicIndexSource.includes('export { LinearProgress } from "./components/LinearProgress"'),
  "Package index must export LinearProgress",
)
assert(
  publicIndexSource.includes('export type { LinearProgressProps } from "./components/LinearProgress"'),
  "Package index must export LinearProgressProps",
)
assert(
  !publicIndexSource.includes("LINEAR_PROGRESS_DIRECTION__"),
  "Package index must not export LinearProgress internals",
)
assert(
  linearProgressIndexSource.includes('export { default as LinearProgress } from "./LinearProgress"'),
  "LinearProgress index must export component",
)
assert(
  linearProgressIndexSource.includes("TLinearProgressProps as LinearProgressProps"),
  "LinearProgress index must export props alias",
)
assert(!linearProgressIndexSource.includes("calibrateComponent"), "LinearProgress index must not export internals")

assert(packageJson.dependencies.classnames, "LinearProgress package must keep classnames runtime dependency")
assert(packageJson.dependencies.motion, "LinearProgress package must declare Motion as a runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "LinearProgress React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "LinearProgress package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "LinearProgress package must keep React DOM peer dependency")

assert(packet.name === "linear-progress", "LinearProgress packet must describe the linear-progress item")
assert(packet.type === "component", "LinearProgress packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "LinearProgress packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "LinearProgress packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#linearprogress-next-candidate-planning-checkpoint"),
  "LinearProgress packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `LinearProgress packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `LinearProgress packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "LinearProgress packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "LinearProgress" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/LinearProgress/LinearProgress.tsx",
  ),
  "LinearProgress packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "LinearProgressProps" &&
      publicExport.localName === "TLinearProgressProps" &&
      publicExport.sourcePath === "packages/react/src/components/LinearProgress/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "LinearProgress packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "LinearProgress packet must depend on default theme")
assert(
  packet.registryDependencies.includes("theme/action-colors"),
  "LinearProgress packet must depend on action colors",
)
assert(packet.registryDependencies.includes("tokens/geometry"), "LinearProgress packet must depend on geometry tokens")
assert(
  packet.registryDependencies.includes("tokens/theme-order"),
  "LinearProgress packet must depend on theme-order tokens",
)
assert(
  !packet.registryDependencies.includes("theme/linear-progress-compatibility"),
  "LinearProgress must not need a bridge item",
)
assert(
  packet.peerDependencies["react-aria-components"] === "^1.17.0",
  "LinearProgress packet must declare React Aria peer",
)
assert(packet.runtimeDependencies.classnames, "LinearProgress packet must declare classnames runtime dependency")
assert(packet.runtimeDependencies.motion, "LinearProgress packet must declare Motion runtime dependency")

const actionColorsRequirement = packet.themeRequirements.find((requirement) =>
  requirement.files?.some((file) => file.sourcePath === "packages/react/src/theme/action-colors.css"),
)
assert(actionColorsRequirement, "LinearProgress packet must record action-colors theme support")
requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsRequirement.cssVariables.includes(cssVariable), `LinearProgress packet must record ${cssVariable}`)
})
const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "LinearProgress packet must record default-contract theme pressure")
;["--aui-control-border", "--aui-control-selected-background", "--aui-radius-1", "--aui-shadow-1"].forEach(
  (cssVariable) => {
    assert(
      defaultContractRequirement.cssVariables.includes(cssVariable),
      `LinearProgress packet must record ${cssVariable}`,
    )
  },
)

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "LinearProgress packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/theme-order",
  ),
  "LinearProgress packet must record theme-order token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--shadow_1") && resolution.replacementSource.includes("--aui-shadow-1"),
  ),
  "LinearProgress packet must record legacy CSS variable rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Meter/Meter.tsx"),
  "Meter must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Cards/Card/Card.tsx"),
  "Card must stay out",
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
  packet.notes.some((note) => note.includes("first Motion-backed component proof")),
  "Packet must record Motion scope",
)

assert(
  packetWrapperSource.includes("linearProgressIngestPacketData as TRegistryIngestPacket"),
  "LinearProgress packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { linearProgressIngestPacket } from "./linear-progress-ingest-packet"'),
  "Registry index must export LinearProgress ingest packet",
)

console.log("[linear-progress-proof] verified LinearProgress source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
