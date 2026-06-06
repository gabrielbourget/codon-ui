import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const dateTimePickerRoot = path.join(packageRoot, "src/components/DateTimePicker")
const dateTimePickerSourcePath = path.join(dateTimePickerRoot, "DateTimePicker.tsx")
const helpersSourcePath = path.join(dateTimePickerRoot, "helpers.tsx")
const labelsSourcePath = path.join(dateTimePickerRoot, "labels.ts")
const iconsSourcePath = path.join(dateTimePickerRoot, "DefaultDateTimePickerIcons.tsx")
const stylesSourcePath = path.join(dateTimePickerRoot, "DateTimePickerStyles.module.css")
const calendarStylesSourcePath = path.join(dateTimePickerRoot, "CalendarStyles.module.css")
const dateTimePickerIndexPath = path.join(dateTimePickerRoot, "index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
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

const forbiddenConsumerImportsPattern =
  /@wavemap|i18n|next\/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@\/src\/|motion\/react|@internationalized\/date/u
const forbiddenLegacyCssPattern =
  /--distance_|--disabledOpacity|--border_radius_|--borderColorTransition|--bgColorTransition|--boxShadowTransition|--colorTransition|--focus-ring-color|--shadow_1|--fade|--Z_INDEX_MODAL|--aui-validation-|body\[data-theme/u

const dateTimePickerSource = readRequiredText(dateTimePickerSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const iconsSource = readRequiredText(iconsSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const calendarStylesSource = readRequiredText(calendarStylesSourcePath)
const dateTimePickerIndexSource = readRequiredText(dateTimePickerIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const actionColorsCSS = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const manifestSource = readRequiredText(manifestPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/DateTimePicker/DateTimePicker.tsx",
  "packages/react/src/components/DateTimePicker/helpers.tsx",
  "packages/react/src/components/DateTimePicker/labels.ts",
  "packages/react/src/components/DateTimePicker/DefaultDateTimePickerIcons.tsx",
  "packages/react/src/components/DateTimePicker/DateTimePickerStyles.module.css",
  "packages/react/src/components/DateTimePicker/CalendarStyles.module.css",
]
const requiredTargetPaths = [
  "DateTimePicker/DateTimePicker.tsx",
  "DateTimePicker/helpers.tsx",
  "DateTimePicker/labels.ts",
  "DateTimePicker/DefaultDateTimePickerIcons.tsx",
  "DateTimePicker/DateTimePickerStyles.module.css",
  "DateTimePicker/CalendarStyles.module.css",
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
  "--aui-control-hover-background",
  "--aui-control-placeholder",
  "--aui-control-pressed-background",
  "--aui-control-selected-background",
  "--aui-focus-ring",
  "--aui-opacity-disabled",
  "--aui-radius-1",
  "--aui-shadow-1",
  "--aui-space-1",
  "--aui-state-danger",
  "--aui-state-success",
  "--aui-state-warning",
  "--aui-surface",
  "--aui-transition-background-color",
  "--aui-transition-border-color",
  "--aui-transition-box-shadow",
  "--aui-transition-color",
  "--aui-z-index-modal",
]
const expectedActionVariables = [
  "--aui-color-primary-100",
  "--aui-color-primary-200",
  "--aui-color-primary-400",
  "--aui-color-primary-500",
]
const requiredDateTimePickerSelectors = [
  ".dateTimePicker",
  ".dateTimePicker[data-disabled]",
  ".dateTimePicker::placeholder",
  ".dateTimePicker__calendarRow",
  ".dateTimeInput",
  ".dateTimeSegment",
  ".dateTimeSegment[data-focused]",
  ".inputButtonGroup",
  ".inputButtonGroup--rounded",
  ".inputButtonGroup--round",
  ".inputButtonGroup--applyFocusStyle",
  ".inputButtonGroup--noFocusStyle",
  ".inputButtonGroup--offsetFocusRing",
  ".inputButtonGroup--errorState",
  ".inputButtonGroup--warningState",
  ".inputButtonGroup--successState",
  ".popover[data-entering]",
  ".popover[data-exiting]",
  ".dialog",
]
const requiredCalendarSelectors = [
  ".calendar",
  ".calendar__topRow",
  ".calendar__header",
  ".calendar__grid",
  ".calendar__grid__header",
  ".calendar__grid__header__cell",
  ".calendar__grid__body",
  ".calendar__grid__body__cell",
  ".calendar__grid__body__cell[data-hovered]",
  ".calendar__grid__body__cell[data-focused]",
  ".calendar__grid__body__cell[data-outside-month]",
  ".calendar__grid__body__cell[data-selected]",
  ".calendar__grid__body__cell[data-selection-start]",
  ".calendar__grid__body__cell[data-selection-end]",
  '[data-theme="dark"] .calendar__grid__body__cell[data-hovered]',
]

assert(dateTimePickerSource.startsWith('"use client"'), "DateTimePicker must preserve the client component boundary")
assert(
  dateTimePickerSource.includes("DatePicker as DateTimePickerAdobe") &&
    dateTimePickerSource.includes("Calendar") &&
    dateTimePickerSource.includes("CalendarCell") &&
    dateTimePickerSource.includes("DateInput") &&
    dateTimePickerSource.includes("Popover"),
  "DateTimePicker must use React Aria date-picker and calendar primitives",
)
assert(
  dateTimePickerSource.includes('import Button from "../Button/Button"'),
  "DateTimePicker must import package-local Button",
)
assert(
  dateTimePickerSource.includes('import { type TDateTimePickerProps, calibrateComponent } from "./helpers"'),
  "DateTimePicker must use local calibration helpers",
)
assert(
  dateTimePickerSource.includes('import { resolveDateTimePickerLabels } from "./labels"'),
  "DateTimePicker must resolve labels",
)
assert(
  dateTimePickerSource.includes("forwardedRef: ForwardedRef<HTMLDivElement>"),
  "DateTimePicker must forward a div ref",
)
assert(dateTimePickerSource.includes("isDisabled={isDisabled}"), "DateTimePicker must preserve disabled mapping")
assert(dateTimePickerSource.includes("isReadOnly={isReadOnly}"), "DateTimePicker must preserve read-only mapping")
assert(dateTimePickerSource.includes("isOpen={isOpen}"), "DateTimePicker must preserve controlled open mapping")
assert(dateTimePickerSource.includes("onOpenChange={onOpenChange}"), "DateTimePicker must preserve open-change mapping")
assert(
  dateTimePickerSource.includes("shouldForceLeadingZeros={shouldForceLeadingZeros}"),
  "DateTimePicker must keep leading-zero forwarding",
)
assert(dateTimePickerSource.includes("hourCycle={hourCycle}"), "DateTimePicker must keep hour-cycle forwarding")
assert(
  dateTimePickerSource.includes("visibleDuration={multiMonth ? { months: 2 } : undefined}"),
  "DateTimePicker must keep multi-month support",
)
assert(
  dateTimePickerSource.includes('data-testid={dataTestID ?? "datetime-picker"}'),
  "DateTimePicker must preserve test id fallback",
)
assert(
  dateTimePickerSource.includes('DateTimePicker.displayName = "DateTimePicker"'),
  "DateTimePicker must set displayName",
)

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "DateTimePicker helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/placement"'),
  "DateTimePicker helpers must import package-local placement tokens",
)
assert(
  helpersSource.includes('from "../Text/TextStyles.module.css"'),
  "DateTimePicker helpers must import installed Text styles",
)
assert(helpersSource.includes("export type TDateTimePickerProps"), "DateTimePicker helpers must export local props")
assert(helpersSource.includes("export const calibrateComponent"), "DateTimePicker calibration helper must remain local")
assert(
  helpersSource.includes('styles["inputButtonGroup--errorState"]'),
  "DateTimePicker helpers must preserve error precedence",
)
assert(
  helpersSource.includes("<DateTimePickerDefaultCalendarIcon"),
  "DateTimePicker helpers must preserve default calendar icon",
)
assert(labelsSource.includes("DEFAULT_DATE_TIME_PICKER_LABELS"), "DateTimePicker labels must keep defaults")
assert(labelsSource.includes("resolveDateTimePickerLabels"), "DateTimePicker labels must keep resolver")
assert(iconsSource.includes("resolveIconColor"), "DateTimePicker icons must resolve inherited colors")
assert(iconsSource.includes("DateTimePickerDefaultChevronLeftIcon"), "DateTimePicker icons must keep previous icon")
assert(iconsSource.includes("DateTimePickerDefaultChevronRightIcon"), "DateTimePicker icons must keep next icon")
;[dateTimePickerSource, helpersSource, labelsSource, iconsSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "DateTimePicker runtime source must not import consumer-only modules",
  )
})
;[stylesSource, calendarStylesSource].forEach((source) => {
  assert(!forbiddenLegacyCssPattern.test(source), "DateTimePicker CSS must not read legacy Wavemap aliases")
})

requiredDateTimePickerSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `DateTimePicker CSS module must include ${selector}`)
})
requiredCalendarSelectors.forEach((selector) => {
  assert(calendarStylesSource.includes(selector), `DateTimePicker calendar CSS module must include ${selector}`)
})
expectedDefaultThemeVariables.forEach((cssVariable) => {
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
  assert(
    stylesSource.includes(`var(${cssVariable})`) || calendarStylesSource.includes(`var(${cssVariable})`),
    `DateTimePicker CSS must read ${cssVariable}`,
  )
})
expectedActionVariables.forEach((cssVariable) => {
  assert(actionColorsCSS.includes(`${cssVariable}:`), `action-colors.css must declare ${cssVariable}`)
  assert(calendarStylesSource.includes(`var(${cssVariable})`), `DateTimePicker calendar CSS must read ${cssVariable}`)
})

assert(
  dateTimePickerIndexSource.includes('export { default as DateTimePicker } from "./DateTimePicker"'),
  "DateTimePicker index must export component",
)
assert(
  dateTimePickerIndexSource.includes("TDateTimePickerProps as DateTimePickerProps"),
  "DateTimePicker index must export props alias",
)
assert(
  dateTimePickerIndexSource.includes("TDateTimePickerLabels as DateTimePickerLabels"),
  "DateTimePicker index must export labels alias",
)
assert(
  dateTimePickerIndexSource.includes("DEFAULT_DATE_TIME_PICKER_LABELS"),
  "DateTimePicker index must export default labels",
)
assert(
  !dateTimePickerIndexSource.includes("calibrateComponent"),
  "DateTimePicker index must not export calibration internals",
)
assert(
  !dateTimePickerIndexSource.includes("DATETIME_PICKER_SIZE__"),
  "DateTimePicker index must not export size constants",
)
;["DateTimePicker", "DEFAULT_DATE_TIME_PICKER_LABELS", "resolveDateTimePickerLabels"].forEach((exportedName) => {
  assert(
    publicIndexSource.includes(exportedName) && publicIndexSource.includes('from "./components/DateTimePicker"'),
    `Package index must export ${exportedName}`,
  )
})
;["DateTimePickerProps", "DateTimePickerLabels", "PartialDateTimePickerLabels"].forEach((exportedName) => {
  assert(publicIndexSource.includes(exportedName), `Package index must export ${exportedName}`)
})
assert(
  !publicIndexSource.includes("TDateTimePickerProps"),
  "Package index must not export DateTimePicker internals directly",
)

assert(packageJson.peerDependencies.react, "DateTimePicker package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "DateTimePicker package must keep React DOM peer dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "DateTimePicker RAC peer range must match plan",
)
assert(packageJson.dependencies.classnames === "^2.3.2", "DateTimePicker package must keep classnames")

assert(packet.name === "date-time-picker", "DateTimePicker packet must describe the date-time-picker item")
assert(packet.type === "component", "DateTimePicker packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "DateTimePicker packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "DateTimePicker packet must record Wavemap as source repository")
assert(
  packet.sourceRef === "docs/roadmaps/date-time-picker-receipt-plan.md",
  "DateTimePicker packet must point at the Amino receipt plan",
)
requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `DateTimePicker packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `DateTimePicker packet must target ${targetPath}`,
  )
})
assert(packet.files.length === 6, "DateTimePicker packet must stay scoped to six runtime files")
assert(
  packet.files.every((file) => file.role !== "test"),
  "DateTimePicker packet must not receive focused tests",
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
assert(packet.peerDependencies["react-aria-components"] === "^1.17.0", "DateTimePicker packet must declare RAC peer")
assert(packet.runtimeDependencies.classnames === "^2.3.2", "DateTimePicker packet must declare classnames")
assert(
  !packet.runtimeDependencies["@internationalized/date"],
  "DateTimePicker packet must not declare date utility runtime",
)

assert(
  packet.themeRequirements.some((requirement) =>
    expectedDefaultThemeVariables
      .filter((cssVariable) => cssVariable !== "--aui-z-index-modal")
      .every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
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
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/DateTimePicker/i18n.ts"),
  "DateTimePicker packet must exclude Wavemap i18n adapter",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/DateTimeRangePicker/**"),
  "DateTimePicker packet must exclude DateTimeRangePicker",
)
assert(
  packet.notes.some((note) => note.includes("source receipt now activates")),
  "DateTimePicker packet must document source receipt activation",
)

assert(
  packetWrapperSource.includes("dateTimePickerIngestPacketData as TRegistryIngestPacket"),
  "DateTimePicker packet wrapper must type the JSON packet",
)
assert(
  registryIndexSource.includes('export { dateTimePickerIngestPacket } from "./date-time-picker-ingest-packet"'),
  "Registry index must export DateTimePicker ingest packet",
)
assert(manifestSource.includes('name: "date-time-picker"'), "DateTimePicker manifest item must be active")
assert(
  packageJson.scripts.test.includes("verify-date-time-picker-proof.mjs"),
  "Package test script must run DateTimePicker source proof",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[date-time-picker-proof] verified DateTimePicker source receipt packet")
