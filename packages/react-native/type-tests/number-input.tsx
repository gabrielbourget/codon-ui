import { View } from "react-native"

import type { TNativeNumberInputProps, TNativeStepperProps } from "../src"

const base = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const accept = (_props: TNativeNumberInputProps) => undefined
accept({
  ...base,
  value: null,
  defaultValue: 0,
  step: 0.1,
  locale: "fr-CA",
  formatOptions: { maximumFractionDigits: 6 },
})
// @ts-expect-error numbers cannot be strings
accept({ ...base, value: "1" })
// @ts-expect-error an editor name is required
accept({ incrementLabel: "Add", decrementLabel: "Reduce" })
// @ts-expect-error contextual step labels are required
accept({ accessibilityLabel: "Quantity" })
// @ts-expect-error decimal-only format
accept({ ...base, formatOptions: { style: "percent" } })
// @ts-expect-error significant digits are outside the contract
accept({ ...base, formatOptions: { maximumSignificantDigits: 3 } })
// @ts-expect-error owned editor value
accept({ ...base, inputProps: { value: "1" } })
// @ts-expect-error owned editor mutation
accept({ ...base, inputProps: { onChangeText: () => undefined } })
// @ts-expect-error native editing aliases are not public
accept({ ...base, readOnly: true })
// @ts-expect-error actions are owned
accept({ ...base, inputProps: { accessibilityActions: [] } })
// @ts-expect-error native role is owned
accept({ ...base, role: "spinbutton" })
// @ts-expect-error no DOM/form props
accept({ ...base, name: "quantity" })
// @ts-expect-error no React Aria state
accept({ ...base, style: (state) => ({ opacity: state.isFocusVisible ? 1 : 0 }) })

accept({
  ...base,
  render: (props, state) => <View {...props} nativeID={String(state.value)} />,
})
// @ts-expect-error Root rendering does not receive a DOM root ref; the public ref remains the native editor.
accept({ ...base, render: (_props: { ref: HTMLDivElement }) => <View /> })
// @ts-expect-error Canonical NumberInput owns its children; arbitrary children remain excluded.
accept({ ...base, children: <View /> })
accept({
  ...base,
  render: (props, state) => {
    // @ts-expect-error Native numeric state has no React Aria NumberFieldState object.
    void state.state
    return <View {...props} />
  },
})

// @ts-expect-error Stepper does not inherit NumberInput root rendering without its own implementation.
const unsupportedStepperRender: TNativeStepperProps = { ...base, render: () => <View /> }
void unsupportedStepperRender
