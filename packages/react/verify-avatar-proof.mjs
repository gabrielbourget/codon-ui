import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const avatarSourcePath = path.join(packageRoot, "src/components/Avatar/Avatar.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Avatar/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Avatar/AvatarStyles.module.css")
const avatarIndexPath = path.join(packageRoot, "src/components/Avatar/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/avatar-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/avatar-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[avatar-proof] ${message}`)
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
const avatarSource = readRequiredText(avatarSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const avatarIndexSource = readRequiredText(avatarIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Avatar/Avatar.tsx",
  "packages/react/src/components/Avatar/helpers.ts",
  "packages/react/src/components/Avatar/AvatarStyles.module.css",
  "packages/react/src/components/Avatar/__tests__/Avatar.test.tsx",
]
const requiredTargetPaths = [
  "Avatar/Avatar.tsx",
  "Avatar/helpers.ts",
  "Avatar/AvatarStyles.module.css",
  "Avatar/__tests__/Avatar.test.tsx",
]
const requiredStyleSelectors = [
  ".avatar",
  ".avatar--clickable:hover",
  ".avatar--raised",
  ".avatar--rounded",
  ".avatar--round",
  ".avatar__image",
  ".avatar__fallback",
]

assert(avatarSource.includes('from "@radix-ui/react-avatar"'), "Avatar must import Radix Avatar")
assert(avatarSource.includes('from "../Text/Text"'), "Avatar must import installed package-local Text")
assert(avatarSource.includes('data-testid={dataTestID ?? "avatar"}'), "Avatar root test id fallback must stay")
assert(
  avatarSource.includes("onClick={clickable && onClick ? onClick : undefined}"),
  "Avatar must keep clickable/onClick gate",
)
assert(avatarSource.includes("delayMs={fallbackDelay}"), "Avatar must preserve fallback delay")
assert(avatarSource.includes("resolvedCustomTextStyles"), "Avatar must merge fallback Text styles")
assert(avatarSource.includes('Avatar.displayName = "Avatar"'), "Avatar display name must be set")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Avatar helpers must import package-local geometry tokens",
)
assert(helpersSource.includes('from "../Text/helpers"'), "Avatar helpers must import package-local Text props")
assert(helpersSource.includes("export type TAvatarProps"), "Avatar helpers must export local props")
assert(helpersSource.includes("export const DEFAULT_AVATAR_LABELS"), "Avatar labels must keep defaults")
assert(helpersSource.includes("export const generateInitials"), "Avatar initials helper must remain local")
assert(helpersSource.includes("export const toCSSSize"), "Avatar size helper must remain local")
assert(helpersSource.includes("export const calibrateComponent"), "Avatar calibration helper must remain local")
assert(helpersSource.includes('"--foreground"'), "Avatar helpers must emit foreground CSS variable")
assert(helpersSource.includes('"--background"'), "Avatar helpers must emit background CSS variable")
assert(helpersSource.includes('"--size"'), "Avatar helpers must emit size CSS variable")
;[avatarSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Avatar runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Avatar CSS module must include ${selector}`)
})
assert(
  stylesSource.includes("var(--background, var(--cui-surface-foreground))"),
  "Avatar CSS must read background fallback",
)
assert(stylesSource.includes("var(--foreground, var(--cui-surface))"), "Avatar CSS must read foreground fallback")
assert(stylesSource.includes("var(--cui-shadow-1)"), "Avatar CSS must read default shadow token")
assert(stylesSource.includes("var(--cui-radius-1)"), "Avatar CSS must read default radius token")
assert(!stylesSource.includes("--shadow_1"), "Avatar CSS must not read legacy shadow alias")
assert(!stylesSource.includes("--border_radius_1"), "Avatar CSS must not read legacy radius alias")

assert(publicIndexSource.includes('export { Avatar } from "./components/Avatar"'), "Package index must export Avatar")
assert(
  publicIndexSource.includes('export type { AvatarProps } from "./components/Avatar"'),
  "Package index must export AvatarProps",
)
assert(!publicIndexSource.includes("generateInitials"), "Package index must not export Avatar internals")
assert(avatarIndexSource.includes('export { default as Avatar } from "./Avatar"'), "Avatar index must export component")
assert(avatarIndexSource.includes("TAvatarProps as AvatarProps"), "Avatar index must export props alias")
assert(!avatarIndexSource.includes("calibrateComponent"), "Avatar index must not export internals")

assert(packageJson.peerDependencies["@radix-ui/react-avatar"] === "^1.1.11", "Avatar Radix peer range must match plan")
assert(
  packageJson.devDependencies["@radix-ui/react-avatar"] === "^1.1.11",
  "Avatar Radix dev dependency must support package typecheck",
)

assert(packet.name === "avatar", "Avatar packet must describe the avatar item")
assert(packet.type === "component", "Avatar packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "Avatar packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Avatar packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#avatar-next-candidate-planning-checkpoint"),
  "Avatar packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Avatar packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Avatar packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Avatar packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "Avatar" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/Avatar/Avatar.tsx",
  ),
  "Avatar packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "AvatarProps" &&
      publicExport.localName === "TAvatarProps" &&
      publicExport.sourcePath === "packages/react/src/components/Avatar/helpers.ts" &&
      publicExport.typeOnly === true,
  ),
  "Avatar packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Avatar packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/geometry"), "Avatar packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("text"), "Avatar packet must depend on installed Text")
assert(!packet.registryDependencies.includes("theme/avatar-compatibility"), "Avatar must not need a bridge item")
assert(packet.peerDependencies["@radix-ui/react-avatar"] === "^1.1.11", "Avatar packet must declare Radix peer")
assert(packet.peerDependencies.react, "Avatar packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "Avatar packet must declare React DOM peer dependency")
assert(!packet.peerDependencies["react-aria-components"], "Avatar must not declare React Aria peer dependency")
assert(packet.runtimeDependencies.classnames, "Avatar packet must declare classnames runtime dependency")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultContractRequirement, "Avatar packet must record default-contract theme pressure")
;["--cui-surface-foreground", "--cui-surface", "--cui-shadow-1", "--cui-radius-1"].forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Avatar packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/Text" && resolution.registryDependencyName === "text",
  ),
  "Avatar packet must record Text import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Avatar packet must record geometry token import rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/NavBar/NavBar.tsx"),
  "Avatar packet must exclude NavBar consumers",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Button/Button.tsx"),
  "Avatar packet must exclude Button",
)

assert(packetWrapperSource.includes("avatarIngestPacketData"), "Avatar packet wrapper must import JSON data")
assert(registryIndexSource.includes('export { avatarIngestPacket } from "./avatar-ingest-packet"'))

if (process.exitCode) process.exit(process.exitCode)
console.log("[avatar-proof] verified Avatar source receipt packet")
