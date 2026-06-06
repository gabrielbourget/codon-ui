import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const dateTimeRangePickerRoot = path.join(packageRoot, "src/components/DateTimeRangePicker")
const dateTimeRangePickerSourcePath = path.join(dateTimeRangePickerRoot, "DateTimeRangePicker.tsx")
const helpersSourcePath = path.join(dateTimeRangePickerRoot, "helpers.tsx")
const labelsSourcePath = path.join(dateTimeRangePickerRoot, "labels.ts")
const iconsSourcePath = path.join(dateTimeRangePickerRoot, "DefaultDateTimeRangePickerIcons.tsx")
const stylesSourcePath = path.join(dateTimeRangePickerRoot, "DateTimeRangePickerStyles.module.css")
const calendarStylesSourcePath = path.join(dateTimeRangePickerRoot, "CalendarStyles.module.css")
const dateTimeRangePickerIndexPath = path.join(dateTimeRangePickerRoot, "index.ts")
const themeCSSPath = path.join(packageRoot, "theme.css")
const actionColorsPath = path.join(packageRoot, "src/theme/action-colors.css")
const packetSourcePath = path.join(packageRoot, "src/registry/date-time-range-picker-ingest-packet.data.json")
const packetWrapperPath = path.join(packageRoot, "src/registry/date-time-range-picker-ingest-packet.ts")
const registryIndexPath = path.join(packageRoot, "src/registry/index.ts")
const publicIndexPath = path.join(packageRoot, "src/index.ts")
const packageJsonPath = path.join(packageRoot, "package.json")

const fail = (message) => {
  console.error(`[date-time-range-picker-proof] ${message}`)
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

const dateTimeRangePickerSource = readRequiredText(dateTimeRangePickerSourcePath)
const helpersSource = readRequiredText(helpersSourcePath)
const labelsSource = readRequiredText(labelsSourcePath)
const iconsSource = readRequiredText(iconsSourcePath)
const stylesSource = readRequiredText(stylesSourcePath)
const calendarStylesSource = readRequiredText(calendarStylesSourcePath)
const dateTimeRangePickerIndexSource = readRequiredText(dateTimeRangePickerIndexPath)
const themeCSS = readRequiredText(themeCSSPath)
const actionColorsCSS = readRequiredText(actionColorsPath)
const packet = JSON.parse(readRequiredText(packetSourcePath))
const packetWrapperSource = readRequiredText(packetWrapperPath)
const registryIndexSource = readRequiredText(registryIndexPath)
const publicIndexSource = readRequiredText(publicIndexPath)
const packageJson = JSON.parse(readRequiredText(packageJsonPath))

const requiredPackageFileSources = [
  "packages/react/src/components/DateTimeRangePicker/DateTimeRangePicker.tsx",
  "packages/react/src/components/DateTimeRangePicker/helpers.tsx",
  "packages/react/src/components/DateTimeRangePicker/labels.ts",
  "packages/react/src/components/DateTimeRangePicker/DefaultDateTimeRangePickerIcons.tsx",
  "packages/react/src/components/DateTimeRangePicker/DateTimeRangePickerStyles.module.css",
  "packages/react/src/components/DateTimeRangePicker/CalendarStyles.module.css",
]
const requiredTargetPaths = [
  "DateTimeRangePicker/DateTimeRangePicker.tsx",
  "DateTimeRangePicker/helpers.tsx",
  "DateTimeRangePicker/labels.ts",
  "DateTimeRangePicker/DefaultDateTimeRangePickerIcons.tsx",
  "DateTimeRangePicker/DateTimeRangePickerStyles.module.css",
  "DateTimeRangePicker/CalendarStyles.module.css",
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
  "DateTimeRangePicker",
  "DateTimeRangePickerProps",
  "DateTimeRangePickerLabels",
  "PartialDateTimeRangePickerLabels",
  "DEFAULT_DATE_TIME_RANGE_PICKER_LABELS",
  "resolveDateTimeRangePickerLabels",
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
const requiredDateTimeRangePickerSelectors = [
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

assert(
  dateTimeRangePickerSource.startsWith('"use client"'),
  "DateTimeRangePicker must preserve the client component boundary",
)
assert(
  dateTimeRangePickerSource.includes("DateRangePicker as DateTimeRangePickerAdobe") &&
    dateTimeRangePickerSource.includes("RangeCalendar") &&
    dateTimeRangePickerSource.includes("CalendarCell") &&
    dateTimeRangePickerSource.includes("DateInput") &&
    dateTimeRangePickerSource.includes("Popover"),
  "DateTimeRangePicker must use React Aria range-picker and calendar primitives",
)
assert(
  dateTimeRangePickerSource.includes('import Button from "../Button/Button"'),
  "DateTimeRangePicker must import package-local Button",
)
assert(
  dateTimeRangePickerSource.includes('import { type TDateTimeRangePickerProps, calibrateComponent } from "./helpers"'),
  "DateTimeRangePicker must use local calibration helpers",
)
assert(
  dateTimeRangePickerSource.includes('import { resolveDateTimeRangePickerLabels } from "./labels"'),
  "DateTimeRangePicker must resolve labels",
)
assert(
  dateTimeRangePickerSource.includes("forwardedRef: ForwardedRef<HTMLDivElement>"),
  "DateTimeRangePicker must forward a div ref",
)
assert(dateTimeRangePickerSource.includes('slot="start"'), "DateTimeRangePicker must render start DateInput")
assert(dateTimeRangePickerSource.includes('slot="end"'), "DateTimeRangePicker must render end DateInput")
assert(
  dateTimeRangePickerSource.includes("isDisabled={isDisabled}"),
  "DateTimeRangePicker must preserve disabled mapping",
)
assert(
  dateTimeRangePickerSource.includes("isReadOnly={isReadOnly}"),
  "DateTimeRangePicker must preserve read-only mapping",
)
assert(
  dateTimeRangePickerSource.includes("isOpen={isOpen}"),
  "DateTimeRangePicker must preserve controlled open mapping",
)
assert(dateTimeRangePickerSource.includes("onChange={onChange}"), "DateTimeRangePicker must preserve change mapping")
assert(
  dateTimeRangePickerSource.includes("shouldForceLeadingZeros={shouldForceLeadingZeros}"),
  "DateTimeRangePicker must keep leading-zero forwarding",
)
assert(
  dateTimeRangePickerSource.includes("hourCycle={hourCycle}"),
  "DateTimeRangePicker must keep hour-cycle forwarding",
)
assert(
  dateTimeRangePickerSource.includes("visibleDuration={multiMonth ? { months: 2 } : undefined}"),
  "DateTimeRangePicker must keep multi-month support",
)
assert(
  dateTimeRangePickerSource.includes('data-testid={dataTestID ?? "datetime-range-picker"}'),
  "DateTimeRangePicker must preserve test id fallback",
)

assert(
  helpersSource.includes('from "../../tokens/geometry"'),
  "DateTimeRangePicker helpers must import package-local geometry tokens",
)
assert(
  helpersSource.includes('from "../../tokens/placement"'),
  "DateTimeRangePicker helpers must import package-local placement tokens",
)
assert(
  helpersSource.includes('from "../Text/TextStyles.module.css"'),
  "DateTimeRangePicker helpers must import installed Text styles",
)
assert(helpersSource.includes("export type TDateTimeRangePickerProps"), "DateTimeRangePicker helpers must export props")
assert(
  helpersSource.includes("export const calibrateComponent"),
  "DateTimeRangePicker calibration helper must remain local",
)
assert(
  helpersSource.includes('styles["inputButtonGroup--errorState"]'),
  "DateTimeRangePicker helpers must preserve error precedence",
)
assert(
  helpersSource.includes("<DateTimeRangePickerDefaultCalendarIcon"),
  "DateTimeRangePicker helpers must preserve default calendar icon",
)
assert(
  helpersSource.includes('const calendarButtonIconColor = "currentColor"'),
  "DateTimeRangePicker default icons must inherit current color",
)
assert(labelsSource.includes("DEFAULT_DATE_TIME_RANGE_PICKER_LABELS"), "DateTimeRangePicker labels must keep defaults")
assert(labelsSource.includes("resolveDateTimeRangePickerLabels"), "DateTimeRangePicker labels must keep resolver")
assert(iconsSource.includes("resolveIconColor"), "DateTimeRangePicker icons must resolve inherited colors")
assert(
  iconsSource.includes("DateTimeRangePickerDefaultChevronLeftIcon"),
  "DateTimeRangePicker icons must keep previous icon",
)
assert(
  iconsSource.includes("DateTimeRangePickerDefaultChevronRightIcon"),
  "DateTimeRangePicker icons must keep next icon",
)
;[dateTimeRangePickerSource, helpersSource, labelsSource, iconsSource].forEach((source) => {
  assert(
    !forbiddenConsumerImportsPattern.test(source),
    "DateTimeRangePicker runtime source must not import consumer-only modules",
  )
})
;[stylesSource, calendarStylesSource].forEach((source) => {
  assert(!forbiddenLegacyCssPattern.test(source), "DateTimeRangePicker CSS must not read legacy Wavemap aliases")
})

requiredDateTimeRangePickerSelectors.forEach((selector) => {
  assert(stylesSource.includes(selector), `DateTimeRangePicker CSS module must include ${selector}`)
})
requiredCalendarSelectors.forEach((selector) => {
  assert(calendarStylesSource.includes(selector), `DateTimeRangePicker calendar CSS module must include ${selector}`)
})
expectedDefaultThemeVariables.forEach((cssVariable) => {
  assert(themeCSS.includes(`${cssVariable}:`), `theme.css must declare ${cssVariable}`)
  assert(
    stylesSource.includes(`var(${cssVariable})`) || calendarStylesSource.includes(`var(${cssVariable})`),
    `DateTimeRangePicker CSS must read ${cssVariable}`,
  )
})
expectedActionVariables.forEach((cssVariable) => {
  assert(actionColorsCSS.includes(`${cssVariable}:`), `action-colors.css must declare ${cssVariable}`)
  assert(
    calendarStylesSource.includes(`var(${cssVariable})`),
    `DateTimeRangePicker calendar CSS must read ${cssVariable}`,
  )
})

assert(
  dateTimeRangePickerIndexSource.includes('export { default as DateTimeRangePicker } from "./DateTimeRangePicker"'),
  "DateTimeRangePicker index must export component",
)
assert(
  dateTimeRangePickerIndexSource.includes("TDateTimeRangePickerProps as DateTimeRangePickerProps"),
  "DateTimeRangePicker index must export props alias",
)
assert(
  dateTimeRangePickerIndexSource.includes("TDateTimeRangePickerLabels as DateTimeRangePickerLabels"),
  "DateTimeRangePicker index must export labels alias",
)
assert(
  dateTimeRangePickerIndexSource.includes("DEFAULT_DATE_TIME_RANGE_PICKER_LABELS"),
  "DateTimeRangePicker index must export default labels",
)
assert(
  !dateTimeRangePickerIndexSource.includes("calibrateComponent"),
  "DateTimeRangePicker index must not export calibration internals",
)
assert(
  !dateTimeRangePickerIndexSource.includes("DATETIME_RANGE_PICKER_SIZE__"),
  "DateTimeRangePicker index must not export size constants",
)
;["DateTimeRangePicker", "DEFAULT_DATE_TIME_RANGE_PICKER_LABELS", "resolveDateTimeRangePickerLabels"].forEach(
  (exportedName) => {
    assert(
      publicIndexSource.includes(exportedName) && publicIndexSource.includes('from "./components/DateTimeRangePicker"'),
      `Package index must export ${exportedName}`,
    )
  },
)
;["DateTimeRangePickerProps", "DateTimeRangePickerLabels", "PartialDateTimeRangePickerLabels"].forEach(
  (exportedName) => {
    assert(publicIndexSource.includes(exportedName), `Package index must export ${exportedName}`)
  },
)
assert(
  !publicIndexSource.includes("TDateTimeRangePickerProps"),
  "Package index must not export DateTimeRangePicker internals directly",
)

assert(packageJson.peerDependencies.react, "DateTimeRangePicker package must keep React peer dependency")
assert(packageJson.peerDependencies["react-dom"], "DateTimeRangePicker package must keep React DOM peer dependency")
assert(
  packageJson.peerDependencies["react-aria-components"] === "^1.17.0",
  "DateTimeRangePicker RAC peer range must match plan",
)
assert(packageJson.dependencies.classnames === "^2.3.2", "DateTimeRangePicker package must keep classnames")
assert(
  packageJson.scripts.test.includes("verify-date-time-range-picker-proof.mjs"),
  "Package test script must run DateTimeRangePicker source proof",
)

assert(packet.name === "date-time-range-picker", "DateTimeRangePicker packet must describe the public item")
assert(packet.type === "component", "DateTimeRangePicker packet must remain a component packet")
assert(packet.sourcePackage === "@amino-ui/react", "DateTimeRangePicker packet must target @amino-ui/react ownership")
assert(packet.sourceRepository === "wavemap", "DateTimeRangePicker packet must record Wavemap as source repository")
assert(
  packet.sourceRef.includes("COMPONENT_LIBRARY_EXTRACTION.md#datetimerangepicker-extraction-planning-checkpoint"),
  "DateTimeRangePicker packet must point at the Wavemap planning checkpoint",
)
requiredPackageFileSources.forEach((sourcePath) => {
  assert(
    packet.files.some((file) => file.sourcePath === sourcePath),
    `DateTimeRangePicker packet must include ${sourcePath}`,
  )
})
requiredTargetPaths.forEach((targetPath) => {
  assert(
    packet.files.some((file) => file.targetPath === targetPath),
    `DateTimeRangePicker packet must target ${targetPath}`,
  )
})
assert(packet.files.length === 6, "DateTimeRangePicker packet must stay scoped to six runtime files")
assert(
  packet.files.every((file) => file.role !== "test"),
  "DateTimeRangePicker packet must not receive focused tests",
)
expectedPublicExports.forEach((exportedName) => {
  assert(
    packet.publicExports.some((publicExport) => publicExport.exportedName === exportedName),
    `DateTimeRangePicker packet must record public export intent for ${exportedName}`,
  )
})
expectedRegistryDependencies.forEach((registryDependency) => {
  assert(
    packet.registryDependencies.includes(registryDependency),
    `DateTimeRangePicker packet must depend on ${registryDependency}`,
  )
})
assert(
  packet.peerDependencies["react-aria-components"] === "^1.17.0",
  "DateTimeRangePicker packet must declare RAC peer",
)
assert(packet.runtimeDependencies.classnames === "^2.3.2", "DateTimeRangePicker packet must declare classnames")
assert(
  !packet.runtimeDependencies["@internationalized/date"],
  "DateTimeRangePicker packet must not declare date utility runtime",
)
assert(
  packet.themeRequirements.some((requirement) =>
    expectedDefaultThemeVariables.every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
  ),
  "DateTimeRangePicker packet must record default theme pressure",
)
assert(
  packet.themeRequirements.some((requirement) =>
    expectedActionVariables.every((cssVariable) => requirement.cssVariables.includes(cssVariable)),
  ),
  "DateTimeRangePicker packet must record action-color pressure",
)
assert(
  packet.importResolutions.some(
    (resolution) =>
      resolution.registryDependencyName === "button" && resolution.replacementSource === "../Button/Button",
  ),
  "DateTimeRangePicker packet must record Button import rewrite",
)
assert(
  packet.importResolutions.some((resolution) => resolution.registryDependencyName === "tokens/placement"),
  "DateTimeRangePicker packet must record placement token import rewrite",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/DateTimeRangePicker/i18n.ts"),
  "DateTimeRangePicker packet must exclude Wavemap i18n adapter",
)
assert(
  packet.excludedSourcePaths.includes(
    "apps/wavemap-front-end/src/components/DateTimeRangePicker/__tests__/DateTimeRangePicker.test.tsx",
  ),
  "DateTimeRangePicker packet must exclude focused tests from runtime receipt",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/Search/**"),
  "DateTimeRangePicker packet must exclude search/typeahead source",
)
assert(
  packet.excludedSourcePaths.includes("apps/wavemap-front-end/src/components/FileUploadSurface/**"),
  "DateTimeRangePicker packet must exclude upload/media source",
)
assert(
  packet.notes.some((note) => note.includes("does not activate a date-time-range-picker manifest item")),
  "DateTimeRangePicker packet must keep manifest activation separate from source receipt",
)

assert(
  packetWrapperSource.includes("dateTimeRangePickerIngestPacketData as TRegistryIngestPacket"),
  "DateTimeRangePicker packet wrapper must type the JSON packet",
)
assert(
  registryIndexSource.includes(
    'export { dateTimeRangePickerIngestPacket } from "./date-time-range-picker-ingest-packet"',
  ),
  "Registry index must export DateTimeRangePicker ingest packet",
)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log("[date-time-range-picker-proof] verified DateTimeRangePicker source receipt packet")
