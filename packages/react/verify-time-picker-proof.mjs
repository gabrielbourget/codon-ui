import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const timePickerSourcePath = path.join(packageRoot, "src/components/TimePicker/TimePicker.tsx")
const helpersSourcePath = path.join(packageRoot, "src/components/TimePicker/helpers.tsx")
const labelsSourcePath = path.join(packageRoot, "src/components/TimePicker/labels.ts")
const clockIconSourcePath = path.join(packageRoot, "src/components/TimePicker/DefaultClockIcon.tsx")
const stylesSourcePath = path.join(packageRoot, "src/components/TimePicker/TimePickerStyles.module.css")
const timePickerIndexPath = path.join(packageRoot, "src/components/TimePicker/index.ts")
const packetSourcePath = path.join(packageRoot, "src/registry/time-picker-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/time-picker-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[time-picker-proof] ${message}`)
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
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\/|motion\/react|@internationalized\/date/u
const forbiddenLegacyCssPattern =
  /--distance_1|--disabledOpacity|--border_radius_1|--borderColorTransition|--focus-ring-color|--aui-validation-error-border|--aui-validation-warning-border|--aui-validation-success-border/u

const timePickerSource = readRequiredText(timePickerSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const clockIconSource = readRequiredText(clockIconSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const timePickerIndexSource = readRequiredText(timePickerIndexPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/TimePicker/TimePicker.tsx",
  "packages/react/src/components/TimePicker/helpers.tsx",
  "packages/react/src/components/TimePicker/labels.ts",
  "packages/react/src/components/TimePicker/DefaultClockIcon.tsx",
  "packages/react/src/components/TimePicker/TimePickerStyles.module.css",
  "packages/react/src/components/TimePicker/__tests__/TimePicker.test.tsx",
]
const requiredTargetPaths = [
  "TimePicker/TimePicker.tsx",
  "TimePicker/helpers.tsx",
  "TimePicker/labels.ts",
  "TimePicker/DefaultClockIcon.tsx",
  "TimePicker/TimePickerStyles.module.css",
  "TimePicker/__tests__/TimePicker.test.tsx",
]
const requiredExcludedSources = [
  "apps/wavemap-front-end/src/components/TimePicker/i18n.ts",
  "apps/wavemap-front-end/src/components/DateTimePicker/DateTimePicker.tsx",
  "apps/wavemap-front-end/src/components/DateTimeRangePicker/DateTimeRangePicker.tsx",
  "apps/wavemap-front-end/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgument.tsx",
]
const requiredStyleSelectors = [
  ".timePicker",
  ".timePicker[data-disabled]",
  ".timePicker::placeholder",
  ".inputIconGroup",
  ".inputIconGroup--rounded",
  ".inputIconGroup--round",
  ".inputIconGroup--applyFocusStyle",
  ".inputIconGroup--noFocusStyle",
  ".inputIconGroup--offsetFocusRing",
  ".inputIconGroup--errorState",
  ".inputIconGroup--warningState",
  ".inputIconGroup--successState",
  ".timeInput",
  ".timeSegment",
  ".timeSegment[data-placeholder]",
  ".timeSegment[data-focused]",
]
const requiredDefaultThemeVariables = [
  "--aui-space-1",
  "--aui-radius-1",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-transition-border-color",
  "--aui-control-border",
  "--aui-control-foreground",
  "--aui-control-placeholder",
  "--aui-control-selected-background",
  "--aui-state-danger",
  "--aui-state-warning",
  "--aui-state-success",
]

assert(timePickerSource.startsWith('"use client"'), "TimePicker must preserve the client component boundary")
assert(
  timePickerSource.includes("TimeField as TimePickerAdobe") &&
    timePickerSource.includes("DateInput") &&
    timePickerSource.includes("DateSegment") &&
    timePickerSource.includes("Group"),
  "TimePicker must use React Aria time-field primitives",
)
assert(
  timePickerSource.includes('import { type TTimePickerProps, calibrateComponent } from "./helpers"'),
  "TimePicker must use local calibration helpers",
)
assert(
  timePickerSource.includes('import { resolveTimePickerLabels } from "./labels"'),
  "TimePicker must resolve labels",
)
assert(timePickerSource.includes("forwardedRef: ForwardedRef<HTMLDivElement>"), "TimePicker must forward a div ref")
assert(timePickerSource.includes("isDisabled={isDisabled}"), "TimePicker must preserve disabled mapping")
assert(timePickerSource.includes("isReadOnly={isReadOnly}"), "TimePicker must preserve read-only mapping")
assert(
  timePickerSource.includes("shouldForceLeadingZeros={shouldForceLeadingZeros}"),
  "TimePicker must keep leading-zero forwarding",
)
assert(timePickerSource.includes("hourCycle={hourCycle}"), "TimePicker must keep hour-cycle forwarding")
assert(timePickerSource.includes("granularity={granularity}"), "TimePicker must keep granularity forwarding")
assert(
  timePickerSource.includes('data-testid={dataTestID ?? "time-picker"}'),
  "TimePicker must preserve test id fallback",
)
assert(timePickerSource.includes('TimePicker.displayName = "TimePicker"'), "TimePicker must set displayName")

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "TimePicker helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../Text/TextStyles.module.css"'),
  "TimePicker helpers must import installed Text styles",
)
assert(
  helpersSource.includes('export const TIME_PICKER_SIZE__SM = "small"'),
  "TimePicker helpers must keep size constants",
)
assert(helpersSource.includes("export type TTimePickerProps"), "TimePicker helpers must export local props")
assert(helpersSource.includes("export const calibrateComponent"), "TimePicker calibration helper must remain local")
assert(
  helpersSource.includes('styles["inputIconGroup--errorState"]'),
  "TimePicker helpers must preserve error precedence",
)
assert(helpersSource.includes("<TimePickerDefaultClockIcon"), "TimePicker helpers must preserve default clock icon")
assert(labelsSource.includes("DEFAULT_TIME_PICKER_LABELS"), "TimePicker labels must keep defaults")
assert(labelsSource.includes("resolveTimePickerLabels"), "TimePicker labels must keep resolver")
assert(
  clockIconSource.includes('stroke = !color || color === "inherit" ? "currentColor"'),
  "Clock icon must inherit currentColor",
)
;[timePickerSource, helpersSource, labelsSource, clockIconSource, stylesSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "TimePicker runtime source must not import consumer-only modules",
  )
})

requiredStyleSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `TimePicker CSS module must include ${selector}`)
})
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(stylesSource.includes(`var(${cssVariable})`), `TimePicker CSS must read ${cssVariable}`)
})
assert(!forbiddenLegacyCssPattern.test(stylesSource), "TimePicker CSS must not read legacy Wavemap aliases")

assert(
  publicIndexSource.includes('export { TimePicker } from "./components/TimePicker"'),
  "Package index must export TimePicker",
)
assert(
  publicIndexSource.includes('export type { TimePickerProps } from "./components/TimePicker"'),
  "Package index must export TimePickerProps",
)
assert(!publicIndexSource.includes("TIME_PICKER_SIZE__"), "Package index must not export TimePicker size constants")
assert(
  timePickerIndexSource.includes('export { default as TimePicker } from "./TimePicker"'),
  "TimePicker index must export component",
)
assert(
  timePickerIndexSource.includes("TTimePickerProps as TimePickerProps"),
  "TimePicker index must export props alias",
)
assert(!timePickerIndexSource.includes("calibrateComponent"), "TimePicker index must not export calibration internals")
assert(!timePickerIndexSource.includes("TIME_PICKER_SIZE__"), "TimePicker index must not export size constants")

assert(packageJson.peerDependencies.react, "TimePicker package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "TimePicker package must keep React DOM peer dependency")
assert(packageJson.peerDependencies["react-aria-components"] === "^1.17.0", "TimePicker RAC peer range must match plan")
assert(packageJson.dependencies.classnames, "TimePicker package must keep classnames runtime dependency")

assert(packet.name === "time-picker", "TimePicker packet must describe the time-picker item")
assert(packet.type === "component", "TimePicker packet must remain a component packet")
assert(packet.sourcePackage === "@codon-ui/react", "TimePicker packet must target @codon-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "TimePicker packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("WAVEMAP_COMPONENT_POLISH_AUDIT.md#timepicker"),
  "TimePicker packet must point at Wavemap planning evidence",
)

requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `TimePicker packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `TimePicker packet must target ${targetPath}`,
  )
})
assert(
  packet.files.filter((file) => file.role === "test").every((file) => file.required === false),
  "TimePicker packet test files must remain optional source evidence",
)

assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TimePicker" &&
      publicExport.localName === "default" &&
      publicExport.sourcePath === "packages/react/src/components/TimePicker/TimePicker.tsx",
  ),
  "TimePicker packet must define the public component export intent",
)
assert(
  packet.publicExports.some(
    (publicExport) =>
      publicExport.exportedName === "TimePickerProps" &&
      publicExport.localName === "TTimePickerProps" &&
      publicExport.sourcePath === "packages/react/src/components/TimePicker/helpers.tsx" &&
      publicExport.typeOnly === true,
  ),
  "TimePicker packet must define the public props type alias intent",
)
assert(packet.registryDependencies.includes("theme-css"), "TimePicker packet must depend on default theme")
assert(packet.registryDependencies.includes("tokens/geometry"), "TimePicker packet must depend on geometry tokens")
assert(packet.registryDependencies.includes("text"), "TimePicker packet must depend on installed Text")
assert(
  !packet.registryDependencies.includes("theme/time-picker-compatibility"),
  "TimePicker must not need a local bridge item",
)
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "TimePicker packet must declare RAC peer")
assert(packet.runtimeDependencies.classnames, "TimePicker packet must declare classnames runtime dependency")

const defaultThemeRequirement = packet.themeRequirements.find(
  (requirement) => requirement.strategy === "default-contract",
)
assert(defaultThemeRequirement, "TimePicker packet must record default theme requirements")
requiredDefaultThemeVariables.forEach((cssVariable) => {
  assert(defaultThemeRequirement.cssVariables.includes(cssVariable), `TimePicker packet must record ${cssVariable}`)
})
assert(
  !packet.themeRequirements.some((requirement) => requirement.strategy === "proof-compatibility-bridge"),
  "TimePicker packet must not include proof bridge theme pressure",
)

assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/_registry/tokens#geometry" &&
      resolution.registryDependencyName === "tokens/geometry",
  ),
  "TimePicker packet must record geometry token import rewrite",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.importSource === "@/src/components/Text/TextStyles.module.css" &&
      resolution.registryDependencyName === "text",
  ),
  "TimePicker packet must record installed Text style import rewrite",
)
requiredExcludedSources.forEach((sourcePath) => {
  assert(packet.excludedSourcePaths.includes(sourcePath), `TimePicker packet must exclude ${sourcePath}`)
})
assert(
  packet.verification.some((step) => step.command === "pnpm -F @codon-ui/react test"),
  "TimePicker packet must point at the package-side proof harness",
)
assert(
  packet.notes.some((note) => note.includes("Text treated as an installed registry dependency")),
  "TimePicker packet must record installed Text dependency boundary",
)
assert(
  packet.notes.some((note) => note.includes("TimePicker/i18n.ts")),
  "TimePicker packet must record app-local i18n exclusion",
)

assert(packetWrapperSource.includes("timePickerIngestPacketData"), "TimePicker packet wrapper must import JSON data")
assert(
  registryIndexSource.includes('export { timePickerIngestPacket } from "./time-picker-ingest-packet"'),
  "Registry index must export TimePicker ingest packet",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("[time-picker-proof] verified TimePicker source receipt packet")
