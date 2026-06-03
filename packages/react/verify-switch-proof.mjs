import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const switchSourcePath = path.join(packageRoot, "src/components/Switch/Switch.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/Switch/helpers.tsx")
const stylesSourcePath = path.join(packageRoot, "src/components/Switch/SwitchStyles.module.css")
const packetSourcePath = path.join(packageRoot, "src/registry/switch-ingest-packet.data.json")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const switchIndexPath = path.join(packageRoot, "src/components/Switch/index.ts")

const fail = (message) => {
  console.error(`[switch-proof] ${message}`)
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
const switchSource = readRequiredText(switchSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const publicIndexSource = readRequiredText(publicIndexPath)
const switchIndexSource = readRequiredText(switchIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))

assert(switchSource.startsWith('"use client"'), "Switch must preserve the client component boundary")
assert(
  switchSource.includes('import { Switch as AdobeSwitch } from "react-aria-components"'),
  "Switch must use React Aria Switch",
)
assert(
  switchSource.includes('import { calibrateComponent, type TSwitchProps } from "./helpers"'),
  "Switch must use local calibration helpers",
)
assert(
  switchSource.includes('import styles from "./SwitchStyles.module.css"'),
  "Switch must use its package CSS module",
)
assert(
  switchSource.includes("forwardRef<HTMLLabelElement, TSwitchProps>"),
  "Switch must forward an HTMLLabelElement ref",
)
assert(
  switchSource.includes("isSelected={selected}"),
  "Switch must pass controlled/uncontrolled selection to React Aria",
)
assert(switchSource.includes("onChange={onSelectedChange}"), "Switch must pass selection changes to React Aria")
assert(switchSource.includes('data-testid={dataTestID ?? "switch"}'), "Switch must preserve the root test id fallback")
assert(switchSource.includes('data-testid="switch-track"'), "Switch must preserve the track test id")
assert(switchSource.includes('data-testid="switch-indicator"'), "Switch must preserve the indicator test id")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "Switch helpers must import geometry tokens from the package",
)
assert(
  helpersSource.includes('from "../../tokens/theme-order"'),
  "Switch helpers must import theme-order tokens from the package",
)
assert(
  helpersSource.includes("export const calibrateComponent"),
  "Switch calibration helper must remain available to Switch",
)
assert(!forbiddenConsumerImportsPattern.test(switchSource), "Switch source must not import consumer-only modules")
assert(!forbiddenConsumerImportsPattern.test(helpersSource), "Switch helpers must not import consumer-only modules")
assert(!forbiddenConsumerImportsPattern.test(stylesSource), "Switch styles must not reference consumer-only modules")

const requiredStyleSelectors = [
  "._switch",
  "._switch__track",
  "._switch__indicator",
  "._switch__track--fallback",
  "._switch__track--primary",
  "._switch__indicator--applyFocusStyle",
  "._switch[data-selected] ._switch__indicator",
]

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `Switch CSS module must include ${selector}`)
})

assert(publicIndexSource.includes('export { Switch } from "./components/Switch"'), "Package index must export Switch")
assert(
  publicIndexSource.includes('export type { SwitchProps } from "./components/Switch"'),
  "Package index must export SwitchProps",
)
assert(!publicIndexSource.includes("calibrateComponent"), "Package index must not export Switch calibration internals")
assert(!publicIndexSource.includes("DEFAULT_ON_ICON"), "Package index must not export Switch default icon internals")
assert(
  switchIndexSource.includes('export { default as Switch } from "./Switch"'),
  "Switch index must export the component",
)
assert(switchIndexSource.includes("TSwitchProps as SwitchProps"), "Switch index must export the public prop alias")

assert(packet.name === "switch", "Switch ingest packet must describe the switch item")
assert(packet.sourcePackage === "@amino-ui/react", "Switch ingest packet must stay package-owned")
assert(
  packet.files.some((file) => file.sourcePath === "packages/react/src/components/Switch/Switch.tsx"),
  "Switch packet must include component source",
)
assert(
  packet.files.some((file) => file.sourcePath === "packages/react/src/components/Switch/helpers.tsx"),
  "Switch packet must include helper source",
)
assert(
  packet.files.some((file) => file.sourcePath === "packages/react/src/components/Switch/SwitchStyles.module.css"),
  "Switch packet must include CSS module source",
)
assert(packet.registryDependencies.includes("theme-css"), "Switch packet must depend on the default theme")
assert(
  packet.registryDependencies.includes("theme/switch-compatibility"),
  "Switch packet must include the proof compatibility bridge",
)
assert(packet.registryDependencies.includes("tokens/geometry"), "Switch packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("tokens/theme-order"), "Switch packet must depend on theme-order tokens")
assert(packet.peerDependencies.react, "Switch packet must declare the React peer dependency")
assert(packet.peerDependencies["react-dom"], "Switch packet must declare the React DOM peer dependency")
assert(packet.peerDependencies["react-aria-components"], "Switch packet must declare the React Aria peer dependency")
assert(packet.runtimeDependencies.classnames, "Switch packet must declare the classnames runtime dependency")
assert(
  packet.verification.some((step) => step.command === "pnpm -F @amino-ui/react test"),
  "Switch packet must point at the package-side proof harness",
)

if (process.exitCode) process.exit()

console.log("[switch-proof] package-side Switch proof harness verified")
