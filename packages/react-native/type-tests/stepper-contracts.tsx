import { createRef } from "react"
import type { TextInput } from "react-native"
import { PlatformColor, StyleSheet } from "react-native"

import { Stepper, Text, type StepperProps, type TNativeStepperRef } from "../src"

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const accept = (_props: StepperProps) => undefined
const styles = StyleSheet.create({ root: { width: 0 }, editor: { color: "red" } })
accept({
  ...names,
  value: null,
  defaultValue: 0,
  step: 0.1,
  minValue: -1,
  maxValue: 1,
  locale: "fr-CA",
  formatOptions: { useGrouping: false, maximumFractionDigits: 6 },
  type: "cohesive",
  orientation: "vertical",
  colorMode: "outline",
  color: PlatformColor("labelColor"),
  order: "primary",
  width: 0,
  height: "50%",
  labels: { inputButtonGroupAriaLabel: "" },
  customStyles: [styles.root, { color: "blue" }],
  customInputStyles: styles.editor,
  customGroupStyles: { gap: 0 },
  customButtonStyles: { color: "yellow", width: 0, height: 0 },
  PlusIcon: false,
  MinusIcon: 0,
})
accept({
  "aria-label": "Quantity",
  incrementLabel: "Add",
  decrementLabel: "Reduce",
  value: 0,
  style: ({ value, inputValue, isReadOnly, defaultStyle }) => ({
    ...defaultStyle,
    opacity: isReadOnly || value === null || inputValue === "" ? 0.5 : 1,
  }),
  inputProps: { onEndEditing: (event) => event.nativeEvent.text, onChange: (event) => event.nativeEvent.eventCount },
})
const ref = createRef<TNativeStepperRef>()
const nativeRef = createRef<TextInput>()
const sample = <Stepper {...names} ref={ref} PlusIcon={<Text>+</Text>} />
const nativeSample = <Stepper {...names} ref={nativeRef} value={0} />
void [sample, nativeSample]
accept({ ...names, customButtonStyles: { fontSize: 20, fontWeight: "700" } })
// @ts-expect-error Container typography is not implemented by Stepper's root View.
accept({ ...names, customStyles: { fontSize: 20 } })
// @ts-expect-error Group View styles do not become Button text styles.
accept({ ...names, customGroupStyles: { fontWeight: "700" } })
// @ts-expect-error an editor name is required
accept({ incrementLabel: "Add", decrementLabel: "Reduce" })
// @ts-expect-error contextual action labels are required
accept({ accessibilityLabel: "Quantity" })
// @ts-expect-error caller values are numeric or null
accept({ ...names, value: "0" })
// @ts-expect-error style state is native, not hidden React Aria state
accept({ ...names, style: ({ state }) => ({ opacity: state.canIncrement ? 1 : 0 }) })
// @ts-expect-error named dimensions use static native units
accept({ ...names, width: "40px" })
// @ts-expect-error unsupported browser class
accept({ ...names, className: "stepper" })
// @ts-expect-error browser form registration remains an open inherited mapping
accept({ ...names, name: "quantity" })
// @ts-expect-error nondecimal formatting remains an open inherited mapping
accept({ ...names, formatOptions: { style: "currency", currency: "CAD" } })
// @ts-expect-error browser non-snap validation remains an open inherited mapping
accept({ ...names, commitBehavior: "validate" })
// @ts-expect-error native editor ownership cannot be replaced
accept({ ...names, inputProps: { value: "3" } })
// @ts-expect-error editor commit and actions are owned
accept({ ...names, inputProps: { onChangeText: () => undefined } })
// @ts-expect-error actions are owned
accept({ ...names, inputProps: { accessibilityActions: [] } })
// @ts-expect-error wrapper has no authored child slot
accept({ ...names, children: <Text>Unexpected</Text> })
// @ts-expect-error orientation is a closed native union
accept({ ...names, orientation: "row" })
// @ts-expect-error canonical icon names are PlusIcon/MinusIcon
accept({ ...names, IncrementIcon: <Text>+</Text> })
