import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const menuSourcePath = path.join(packageRoot, "src/components/Menu/Menu.tsx")
const menuItemSourcePath = path.join(packageRoot, "src/components/Menu/components/MenuItem.tsx")
const menuSeparatorSourcePath = path.join(packageRoot, "src/components/Menu/components/MenuSeparator.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Menu/helpers.ts")
const stylesSourcePath = path.join(packageRoot, "src/components/Menu/MenuStyles.module.css")
const menuIndexPath = path.join(packageRoot, "src/components/Menu/index.ts")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const themeCSSPath = path.join(packageRoot, "theme.css")
const packetSourcePath = path.join(packageRoot, "src/registry/menu-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/menu-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[menu-proof] ${message}`)
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
  /--distance_|--border_radius_|--fadeInAnimation|--fadeOutAnimation|--shadow_1|--bgColorTransition|--focus-ring-color|--disabledOpacity|--aui-status-danger|theme\/menu-compatibility/u

const menuSource = readRequiredText(menuSourcePath)
const menuItemSource = readRequiredText(menuItemSourcePath)
const menuSeparatorSource = readRequiredText(menuSeparatorSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const menuIndexSource = readRequiredText(menuIndexPath)
const actionColorsSource = readRequiredText(actionColorsPath)
const themeCSSSource = readRequiredText(themeCSSPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/Menu/Menu.tsx",
  "packages/react/src/components/Menu/helpers.ts",
  "packages/react/src/components/Menu/components/MenuItem.tsx",
  "packages/react/src/components/Menu/components/MenuSeparator.tsx",
  "packages/react/src/components/Menu/MenuStyles.module.css",
  "packages/react/src/components/Menu/__tests__/Menu.test.tsx",
]
const requiredTargetPaths = [
  "Menu/Menu.tsx",
  "Menu/helpers.ts",
  "Menu/components/MenuItem.tsx",
  "Menu/components/MenuSeparator.tsx",
  "Menu/MenuStyles.module.css",
  "Menu/__tests__/Menu.test.tsx",
]
const requiredStyleSelectors = [
  ".menu",
  ".menu--raised",
  ".menu--rounded",
  ".menu--primary",
  ".menu--quintenary",
  ".menu__menuList",
  ".menuItem",
  ".menuItem[data-hovered]",
  ".menuItem[data-focus-visible]",
  ".menuItem[data-disabled]",
  ".menuItem--destructive",
  ".menuItem__icon",
  ".menuSeparator",
]
const requiredActionColorVariables = [
  "--aui-color-primary-500",
  "--aui-color-secondary-500",
  "--aui-color-tertiary-500",
  "--aui-color-quaternary-500",
  "--aui-color-quintenary-500",
]
const requiredDefaultThemeVariables = [
  "--aui-surface",
  "--aui-surface-foreground",
  "--aui-space-1",
  "--aui-radius-1",
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-shadow-1",
  "--aui-transition-background-color",
  "--aui-control-hover-background",
  "--aui-control-pressed-background",
  "--aui-control-disabled-opacity",
  "--aui-border-muted",
  "--aui-focus-ring",
  "--aui-state-danger",
]

assert(menuSource.startsWith('"use client"'), "Menu must preserve the client component boundary")
assert(menuItemSource.startsWith('"use client"'), "MenuItem must preserve the client component boundary")
assert(menuSeparatorSource.startsWith('"use client"'), "MenuSeparator must preserve the client component boundary")
assert(menuSource.includes('from "react-aria-components"'), "Menu must import React Aria")
assert(menuSource.includes("Popover"), "Menu must preserve React Aria Popover composition")
assert(menuSource.includes("AdobeMenu"), "Menu must preserve React Aria Menu composition")
assert(menuSource.includes('data-testid={dataTestID ?? "menu"}'), "Menu root test id fallback must stay")
assert(menuSource.includes("aria-label={menuAriaLabel}"), "Menu must forward menuAriaLabel to the menu list")
assert(menuSource.includes('Menu.displayName = "Menu"'), "Menu display name must be set")
assert(menuItemSource.includes("AdobeMenuItem"), "MenuItem must wrap React Aria MenuItem")
assert(menuItemSource.includes("menuItem__icon"), "MenuItem must preserve the icon slot")
assert(menuSeparatorSource.includes("Separator"), "MenuSeparator must wrap React Aria Separator")

assert(helpersSource.includes('from "../../tokens/geometry"'), "Menu helpers must import package-local geometry tokens")
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Menu helpers must import package-local theme-order tokens",
)
assert(helpersSource.includes("export type TMenuProps"), "Menu helpers must export local Menu props")
assert(helpersSource.includes("export type TMenuItemProps"), "Menu helpers must export local MenuItem props")
assert(helpersSource.includes("export type TMenuSeparatorProps"), "Menu helpers must export local MenuSeparator props")
assert(helpersSource.includes("export const calibrateComponent"), "Menu calibration helper must remain local")
assert(helpersSource.includes("export const calibrateMenuItem"), "MenuItem calibration helper must remain local")
assert(helpersSource.includes("export const calibrateSeparator"), "MenuSeparator calibration helper must remain local")
;[menuSource, menuItemSource, menuSeparatorSource, helpersSource, stylesSource].forEach((source) => {
  assert(!forbiddenConsumerImportsPattern.test(source), "Menu runtime source must not import consumer-only modules")
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Menu CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `Menu CSS must read ${cssVariable}`)
  assert(themeCSSSource.includes(`${cssVariable}:`), `theme.css must define ${cssVariable}`)
})
requiredActionColorVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `Menu CSS must read ${cssVariable}`)
  assert(actionColorsSource.includes(cssVariable), `action-colors CSS must define ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "Menu CSS must not read legacy Wavemap aliases")

assert(
  publicIndexSource.includes('export { Menu, MenuItem, MenuSeparator } from "./components/Menu"'),
  "Package index must export Menu surfaces",
)
assert(publicIndexSource.includes("MenuProps"), "Package index must export MenuProps")
assert(publicIndexSource.includes("MenuItemProps"), "Package index must export MenuItemProps")
assert(publicIndexSource.includes("MenuSeparatorProps"), "Package index must export MenuSeparatorProps")
assert(!publicIndexSource.includes("TMenuProps"), "Package index must not export Menu internals directly")
assert(menuIndexSource.includes('export { default as Menu } from "./Menu"'), "Menu index must export Menu")
assert(
  menuIndexSource.includes('export { default as MenuItem } from "./components/MenuItem"'),
  "Menu index must export MenuItem",
)
assert(
  menuIndexSource.includes('export { default as MenuSeparator } from "./components/MenuSeparator"'),
  "Menu index must export MenuSeparator",
)
assert(menuIndexSource.includes("TMenuProps as MenuProps"), "Menu index must export props alias")
assert(!menuIndexSource.includes("calibrateComponent"), "Menu index must not export internals")

assert(packageJson.dependencies.classnames, "Menu package must keep classnames runtime dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "Menu React Aria peer range must match plan",
)
assert(packageJson.peerDependencies.react, "Menu package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "Menu package must keep React DOM peer dependency")

assert(packet.name === "menu", "Menu packet must describe the menu item")
assert(packet.type === "component", "Menu packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "Menu packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "Menu packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#menu-next-candidate-planning-checkpoint"),
  "Menu packet must point at the Wavemap planning checkpoint",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `Menu packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `Menu packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "Menu packet test files must remain optional source evidence",
)
assert(
  packet.publicExports.some(
    (publicExport) => publicExport.exportedName === "Menu" && publicExport.localName === "default",
  ),
  "Menu packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) => publicExport.exportedName === "MenuItem" && publicExport.localName === "default",
  ),
  "Menu packet must define the public MenuItem export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) => publicExport.exportedName === "MenuSeparator" && publicExport.localName === "default",
  ),
  "Menu packet must define the public MenuSeparator export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "MenuProps" &&
      publicExport.localName === "TMenuProps" &&
      publicExport.typeOnly === true,
  ),
  "Menu packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "Menu packet must depend on default theme")
assert(packet.registryDependencies.includes("theme/action-colors"), "Menu packet must depend on action colors")
assert(packet.registryDependencies.includes("tokens/geometry"), "Menu packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Menu packet must depend on theme-order tokens")
assert(!packet.registryDependencies.includes("theme/menu-compatibility"), "Menu must not need a bridge item")
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "Menu packet must declare React Aria peer")
assert(packet.runtimeDependencies.classnames, "Menu packet must declare classnames runtime dependency")
assert(!packet.runtimeDependencies.motion, "Menu packet must not declare Motion")

const defaultContractRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract" && !requirement.files,
)
assert(defaultContractRequirement, "Menu packet must record default-contract theme pressure")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultContractRequirement.cssVariables.includes(cssVariable), `Menu packet must record ${cssVariable}`)
})
const actionColorsRequirement = packet.themeRequirements.find((requirement) =>
  requirement.files?.some((file) => file.sourcePath === "packages/react/src/theme/action-colors.css"),
)
assert(actionColorsRequirement, "Menu packet must record action-colors theme support")
requiredActionColorVariables.forEach((cssVariable) => {
  assert(actionColorsRequirement.cssVariables.includes(cssVariable), `Menu packet must record ${cssVariable}`)
})

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "Menu packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens" &&
      resolution.registryDependencyName === "tokens/theme-order",
  ),
  "Menu packet must record theme-order token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--shadow_1") && resolution.replacementSource.includes("--aui-shadow-1"),
  ),
  "Menu packet must record shadow CSS variable rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--bgColorTransition") &&
      resolution.replacementSource.includes("--aui-transition-background-color"),
  ),
  "Menu packet must record transition CSS variable rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource.includes("--aui-status-danger") &&
      resolution.replacementSource.includes("--aui-state-danger"),
  ),
  "Menu packet must record destructive color variable rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Breadcrumbs/Breadcrumbs.tsx"),
  "Breadcrumbs must stay out",
)
assert(packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Link/Link.tsx"), "Link must stay out")
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/Tables/FileUploadTable/components/UploadItemContextMenu/UploadItemContextMenu.tsx",
  ),
  "UploadItemContextMenu must stay out",
)
assert(
  packet.notes.some((note) => note.includes("React Aria menu and popover composition primitive")),
  "Packet must record Menu proof scope",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a menu manifest item")),
  "Packet must keep manifest activation separate from source receipt",
)

assert(
  packetWrapperSource.includes("menuIngestPacketData as TRegistryIngestPacket"),
  "Menu packet wrapper must type the JSON payload",
)
assert(
  registryIndexSource.includes('export { menuIngestPacket } from "./menu-ingest-packet"'),
  "Registry index must export Menu ingest packet",
)

console.log("[menu-proof] verified Menu source receipt packet")

if (process.exitCode) process.exit(process.exitCode)
