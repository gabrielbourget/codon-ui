import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const packetSourcePath = path.join(packageRoot, "src/registry/date-time-picker-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/date-time-picker-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const manifestPath = path.join(packageRoot, "src/registry/manifest.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[date-time-picker-proof] ${message}`)
  process.exitCode = 1
}

const assert = (condition, message) => {
  if (!condition) fail(message)
}

const readRequiredText = (filePath) => {
  assert(existsSync(filePath), `missing ${path.relative(packageRoot, filePath)}`)

  return readFileSync(filePath, "utf8")
}

const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const manifestSource = readRequiredText(manifestPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPlannedSourcePaths = [
  "packages/react/src/components/DateTimePicker/DateTimePicker.tsx",
  "packages/react/src/components/DateTimePicker/helpers.tsx",
  "packages/react/src/components/DateTimePicker/labels.ts",
  "packages/react/src/components/DateTimePicker/DefaultDateTimePickerIcons.tsx",
  "packages/react/src/components/DateTimePicker/DateTimePickerStyles.module.css",
  "packages/react/src/components/DateTimePicker/CalendarStyles.module.css",
]
const expectedRegistryDependencies = [
  "theme-css",
  "theme/action-colors",
  "tokens/geometry",
  "tokens/placement",
  "text",
  "button",
]
const expectedPublicExports = [
  "DateTimePicker",
  "DateTimePickerProps",
  "DateTimePickerLabels",
  "PartialDateTimePickerLabels",
  "DEFAULT_DATE_TIME_PICKER_LABELS",
  "resolveDateTimePickerLabels",
]
const expectedDefaultThemeVariables = [
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-control-background",
  "--aui-control-border",
  "--aui-control-foreground",
  "--aui-control-placeholder",
  "--aui-control-selected-background",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-radius-1",
  "--aui-shadow-1",
  "--aui-space-1",
  "--aui-surface",
  "--aui-transition-border-color",
  "--aui-transition-color",
]

assert(packet.name === "date-time-picker", "DateTimePicker packet must use the date-time-picker registry name")
assert(packet.type === "component", "DateTimePicker packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "DateTimePicker packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "DateTimePicker packet must record Wavemap as source repository")
assert(
  packet.sourceRef === "docs/roadmaps/date-time-picker-receipt-plan.md",
  "DateTimePicker packet must point at the Amino receipt plan",
)

requiredPlannedSourcePaths.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `DateTimePicker packet must include ${sourcePath}`,
  )
  assert(
    !existsSync(path.join(packageRoot, sourcePath.replace("packages/react/", ""))),
    `metadata-only boundary must not move ${sourcePath}`,
  )
})
assert(packet.files.length === 6, "DateTimePicker packet must stay scoped to six runtime files")
assert(
  packet.files.every((file) => file.role !== "test"),
  "DateTimePicker packet must not receive focused tests as runtime files",
)

expectedPublicExports.forEach((exportedName) => {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportedName),
    `DateTimePicker packet must record public export intent for ${exportedName}`,
  )
})
expectedRegistryDependencies.forEach((registryDependency) => {
  assert(
    packet.registryDependencies.includes(registryDependency),
    `DateTimePicker packet must depend on ${registryDependency}`,
  )
})
assert(packet.peerDependencies.react, "DateTimePicker packet must declare React peer dependency")
assert(packet.peerDependencies["react-dom"], "DateTimePicker packet must declare React DOM peer dependency")
assert(
  packet.peerDependencies["react-aria-components"] === "^1.17.0",
  "DateTimePicker packet must declare React Aria Components peer dependency",
)
assert(packet.runtimeDependencies.classnames === "^2.3.2", "DateTimePicker packet must declare classnames")
assert(
  !packet.runtimeDependencies["@internationalized/date"],
  "DateTimePicker packet must not declare @internationalized/date for this component source",
)
assert(
  !packageJson.dependencies["@internationalized/date"],
  "metadata-only boundary must not add @internationalized/date",
)

assert(
  packet.themeRequirements.some((requirement) =>
    expectedDefaultThemeVariables.every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
  ),
  "DateTimePicker packet must record default theme pressure",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "button" && resolution.replacementSource === "../Button/Button",
  ),
  "DateTimePicker packet must record Button import rewrite",
)
assert(
  packet.importResolutions.some((resolution) => resolution.registryDependencyName === "tokens/placement"),
  "DateTimePicker packet must record placement token import rewrite",
)
assert(
  packet.importResolutions.some((resolution) => resolution.registryDependencyName === "text"),
  "DateTimePicker packet must record Text style dependency",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/DateTimePicker/i18n.ts"),
  "DateTimePicker packet must exclude Wavemap i18n adapter",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/DateTimeRangePicker/**"),
  "DateTimePicker packet must exclude DateTimeRangePicker",
)
assert(
  packet.notes.some((note) => note.includes("does not move Wavemap DateTimePicker source")),
  "DateTimePicker packet must document metadata-only boundary",
)

assert(
  packetWrapperSource.includes("dateTimePickerIngestPacketData as TRegistryIngestPacket"),
  "DateTimePicker packet wrapper must type the JSON packet",
)
assert(
  registryIndexSource.includes('export { dateTimePickerIngestPacket } from "./date-time-picker-ingest-packet"'),
  "Registry index must export DateTimePicker ingest packet",
)
assert(
  !manifestSource.includes('name: "date-time-picker"'),
  "metadata-only boundary must not activate a date-time-picker manifest item",
)
assert(
  !publicIndexSource.includes('export { DateTimePicker } from "./components/DateTimePicker"'),
  "metadata-only boundary must not export DateTimePicker publicly yet",
)
assert(
  packageJson.scripts.test.includes("verify-date-time-picker-proof.mjs"),
  "Package test script must run DateTimePicker metadata proof",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[date-time-picker-proof] verified DateTimePicker metadata-only receipt packet")
