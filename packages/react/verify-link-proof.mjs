import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const linkSourcePath = path.join(packageRoot, "src/components/Link/Link.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Link/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Link/LinkStyles.module.css")
const linkIndexPath = path.join(packageRoot, "src/components/Link/index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const packetSourcePath = path.join(packageRoot, "src/registry/link-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/link-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[link-proof] ${message}`)
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
const forbiddenLegacyCssPattern =
  /--distance_|--border_radius_|--focus-ring-color|--disabledOpacity|theme\/link-compatibility/u
const requiredPackageFileSources = [
  "packages/react/src/components/Link/Link.tsx",
  "packages/react/src/components/Link/helpers.ts",
  "packages/react/src/components/Link/LinkStyles.module.css",
]
const requiredTargetPaths = ["Link/Link.tsx", "Link/helpers.ts", "Link/LinkStyles.module.css"]
const requiredDefaultThemeVariables = ["--aui-space-1", "--aui-radius-1", "--aui-focus-ring", "--aui-opacity-disabled"]
const requiredActionColorVariables = [
  "--aui-color-primary-400",
  "--aui-color-primary-500",
  "--aui-color-primary-600",
  "--aui-color-primary-700",
  "--aui-color-secondary-400",
  "--aui-color-secondary-500",
  "--aui-color-secondary-600",
  "--aui-color-secondary-700",
  "--aui-color-tertiary-400",
  "--aui-color-tertiary-500",
  "--aui-color-tertiary-600",
  "--aui-color-tertiary-700",
  "--aui-color-quaternary-400",
  "--aui-color-quaternary-500",
  "--aui-color-quaternary-600",
  "--aui-color-quaternary-700",
  "--aui-color-quintenary-400",
  "--aui-color-quintenary-500",
  "--aui-color-quintenary-600",
  "--aui-color-quintenary-700",
]

const linkSource = readRequiredText(linkSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const linkIndexSource = readRequiredText(linkIndexPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const actionColorsSource = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

assert(linkSource.startsWith('"use client"'), "Link must preserve the client component boundary")
assert(!linkSource.includes("next/link"), "Link must not import next/link")
assert(!helpersSource.includes("next/link"), "Link helpers must not import next/link types")
assert(!linkSource.includes("prefetch"), "Link must not preserve the removed Next prefetch path")
assert(linkSource.includes("<a"), "Link must render a native anchor")
assert(linkSource.includes("forwardRef"), "Link must preserve forwarded refs")
assert(linkSource.includes("href={href}"), "Link must forward href")
assert(linkSource.includes("aria-disabled"), "Link must expose aria-disabled for disabled links")
assert(linkSource.includes("data-disabled"), "Link must expose data-disabled for styling/tests")
assert(linkSource.includes("e.preventDefault()"), "Link must suppress disabled activation")
assert(linkSource.includes("onContextMenu?.(e)"), "Link must preserve context-menu callbacks")
assert(helpersSource.includes('from "../../tokens/a11y"'), "Link must import a11y token types locally")
assert(helpersSource.includes('from "../../tokens/theme-order"'), "Link must import theme-order support locally")
assert(helpersSource.includes("export type TLinkProps"), "Link helpers must export local props")
assert(helpersSource.includes("href: string"), "Link props must require portable string hrefs")
assert(helpersSource.includes("TAriaLabelingProps"), "Link props must preserve aria alias typing")
assert(helpersSource.includes("TThemingOrderCode"), "Link props must preserve theme order typing")
assert(helpersSource.includes("export const calibrateComponent"), "Link calibration helper must remain local")
;[linkSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Link runtime source must not import consumer-only modules")
})
;[".link", ".link--underline", ".link--applyFocusStyle", ".link--primary"].forEach((selector) => {
  assert(stylesSource.includes(selector), `Link CSS module must include ${selector}`)
})
;[
  "var(--aui-radius-1)",
  "var(--aui-space-1)",
  "var(--aui-focus-ring)",
  "var(--aui-opacity-disabled)",
  "var(--aui-color-primary-400)",
  "var(--aui-color-primary-500)",
  "var(--aui-color-primary-600)",
  "var(--aui-color-primary-700)",
].forEach((cssValue) => {
  assert(stylesSource.includes(cssValue), `Link CSS must read ${cssValue}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Link CSS must not read legacy Wavemap aliases")

requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})
requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsSource.includes(`${cssVariable}:`), `action-colors.css must define ${cssVariable}`)
})

assert(publicIndexSource.includes('export { Link } from "./components/Link"'), "Package index must export Link")
assert(
  publicIndexSource.includes('export type { LinkProps } from "./components/Link"'),
  "Package index must export LinkProps",
)
assert(!publicIndexSource.includes("TLinkProps"), "Package index must not export Link internals directly")
assert(linkIndexSource.includes('export { default as Link } from "./Link"'), "Link index must export component")
assert(linkIndexSource.includes("TLinkProps as LinkProps"), "Link index must export props alias")
assert(!linkIndexSource.includes("calibrateComponent"), "Link index must not export internals")

assert(packageJson.dependencies.classnames, "Link package must keep classnames runtime dependency")
assert(packageJson.peerDependencies.react, "Link package must keep React peer dependency")
assert(!packageJson.peerDependencies.next, "Link package must not declare a Next peer dependency")
assert(packageJson.scripts.test.includes("verify-link-proof.mjs"), "Package test script must run Link proof")

assert(packet.name === "link", "Link packet must describe the link item")
assert(packet.type === "component", "Link packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Link packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Link packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#link-next-candidate-planning-checkpoint"),
  "Link packet must point at the Wavemap planning checkpoint",
)
requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Link packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Link packet must target ${targetPath}`,
  )
})
assert(
  packet.files.every((file) => file.role !== "test"),
  "Link packet must not receive focused tests as source",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Link" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Link/Link.tsx",
  ),
  "Link packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "LinkProps" &&
      publicExport.localName === "TLinkProps" &&
      publicExport.sourcePath === "packages/react/src/components/Link/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Link packet must define the public props type alias intent",
)
;["theme-css", "theme/action-colors", "tokens/a11y", "tokens/theme-order"].forEach((dependencyName) => {
  assert(packet.registryDependencies.includes(dependencyName), `Link packet must depend on ${dependencyName}`)
})
assert(!packet.registryDependencies.includes("theme/link-compatibility"), "Link must not need a bridge item")
assert(packet.peerDependencies.react, "Link packet must declare React peer dependency")
assert(!packet.peerDependencies.next, "Link packet must not declare Next peer dependency")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "Link packet must declare classnames")
assert(packet.themeRequirements.length === 2, "Link packet must record default theme and action-color pressure")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(
    packet.themeRequirements.some((requirement) => requirement.cssVariables.includes(cssVariable)),
    `Link packet must record ${cssVariable}`,
  )
})
requiredActionColorVariables.forEach((cssVariable) => {
  assert(
    packet.themeRequirements.some((requirement) => requirement.cssVariables.includes(cssVariable)),
    `Link packet must record ${cssVariable}`,
  )
})
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/a11y" && resolution.replacementSource === "../../tokens/a11y",
  ),
  "Link packet must record a11y token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "tokens/theme-order" &&
      resolution.replacementSource === "../../tokens/theme-order",
  ),
  "Link packet must record theme-order token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--distance_1") && resolution.replacementSource === "--aui-space-1",
  ),
  "Link packet must record distance alias rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--border_radius_1") && resolution.replacementSource === "--aui-radius-1",
  ),
  "Link packet must record radius alias rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--focus-ring-color") && resolution.replacementSource === "--aui-focus-ring",
  ),
  "Link packet must record focus alias rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--disabledOpacity") &&
      resolution.replacementSource === "--aui-opacity-disabled",
  ),
  "Link packet must record disabled opacity alias rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Breadcrumbs/Breadcrumbs.tsx"),
  "Breadcrumbs must stay out",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Link/__tests__/Link.test.tsx"),
  "Focused tests must stay consumer-side",
)
assert(
  packet.notes.some((note) => note.includes("portable anchor-backed")),
  "Packet must record Link scope",
)

assert(
  packetWrapperSource.includes("linkIngestPacketData as TRegistryIngestPacket"),
  "Link packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { linkIngestPacket } from "./link-ingest-packet"'),
  "Registry index must export Link ingest packet",
)

console.log("[link-proof] verified Link source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
