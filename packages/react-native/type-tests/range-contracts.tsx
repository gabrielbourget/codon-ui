import { createRef } from "react"
import { PlatformColor, type View } from "react-native"

import { LinearProgress, Meter, type LinearProgressProps, type MeterProps } from "../src"

export const validProgressProps: LinearProgressProps = {
  value: 0,
  accessibilityLabel: "Upload",
  isIndeterminate: true,
  minValue: -100,
  maxValue: 100,
  locale: "fr-CA",
  valueLabel: "",
  formatOptions: { style: "percent", maximumFractionDigits: 1 },
  width: "100%",
  height: 0,
  barColor: PlatformColor("systemBlueColor"),
  customTrackStyles: [{ borderWidth: 0 }],
  style: ({ percentage, valueText, isIndeterminate, defaultStyle }) => [
    defaultStyle,
    { opacity: isIndeterminate ? 0.8 : percentage === 0 && valueText === "" ? 0.5 : 1 },
  ],
}
export const ValidProgress = <LinearProgress {...validProgressProps} ref={createRef<View>()} />
export const validMeterProps: MeterProps = {
  value: -10,
  "aria-label": "Temperature",
  minValue: -20,
  maxValue: 40,
  orientation: "vertical",
  direction: "down",
  trackGeometry: "orthogonal",
  barGeometry: "rounded",
  order: "tertiary",
  raised: false,
  style: ({ percentage, valueText, defaultStyle }) => [defaultStyle, { opacity: percentage > 0 && valueText ? 1 : 0 }],
}
export const ValidMeter = <Meter {...validMeterProps} ref={createRef<View>()} />
// @ts-expect-error Range displays require an authoritative caller value.
export const InvalidMissingValue = <Meter aria-label="Missing" />
// @ts-expect-error Native range displays require an accessible name.
export const InvalidMissingName = <LinearProgress value={0} />
// @ts-expect-error Measurement has no indeterminate state.
export const InvalidMeterUnknown = <Meter value={0} aria-label="Unknown" isIndeterminate />
// @ts-expect-error No uncontrolled/default value ownership.
export const InvalidDefaultValue = <Meter value={0} aria-label="Default" defaultValue={50} />
// @ts-expect-error A display does not publish editable value changes.
export const InvalidChange = <Meter value={0} aria-label="Change" onChange={() => undefined} />
export const InvalidLabelNode = (
  // @ts-expect-error Native value labels are strings, not arbitrary React elements.
  <Meter value={0} aria-label="Node" valueLabel={<Meter value={1} aria-label="Child" />} />
)
// @ts-expect-error Numeric ownership excludes null.
export const InvalidNullValue = <Meter value={null} aria-label="Null" />
// @ts-expect-error The component owns its range accessibility values.
export const InvalidAccessibleValue = <Meter value={0} aria-label="Value" accessibilityValue={{ now: 90 }} />
// @ts-expect-error ARIA value aliases cannot override the controlled range.
export const InvalidAriaValue = <LinearProgress value={0} aria-label="Value" aria-valuenow={90} />
// @ts-expect-error Native range displays own their semantic role.
export const InvalidRole = <Meter value={0} aria-label="Role" role="slider" />
export const InvalidChildren = (
  // @ts-expect-error The wrappers own the track and bar children.
  <Meter value={0} aria-label="Children">
    Content
  </Meter>
)
// @ts-expect-error Browser class plumbing is not a native range API.
export const InvalidClass = <LinearProgress value={0} aria-label="Class" className="web" />
// @ts-expect-error Dimensions use native logical units or percentages.
export const InvalidDimension = <Meter value={0} aria-label="Dimension" width="2rem" />
// @ts-expect-error The ref is an actual native View, not a browser element.
export const InvalidRef = <Meter value={0} aria-label="Ref" ref={createRef<{ tagName: string }>()} />
export const InvalidMeterState = (
  <Meter
    value={0}
    aria-label="State"
    style={(state) => {
      // @ts-expect-error Meter render state has no progress-only indeterminacy.
      return { opacity: state.isIndeterminate ? 0 : 1 }
    }}
  />
)
