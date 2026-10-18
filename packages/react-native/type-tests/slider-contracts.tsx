import { createRef } from "react"
import { PlatformColor, StyleSheet } from "react-native"

import { Slider, Text, type SliderProps, type TNativeSliderRef, type TNativeSliderState } from "../src"

const scalar: SliderProps<number> = {
  accessibilityLabel: "Quantity",
  value: 0,
  onChange: (next) => {
    const number: number = next
    void number
  },
  onChangeEnd: (next) => next.toFixed(2),
}
const range: SliderProps<readonly number[]> = {
  label: "Range",
  value: [],
  defaultValue: [0, 100],
  onChange: (next) => next.push(3),
  thumbAriaLabels: ["Start", "End"],
}
const styles = StyleSheet.create({ root: { width: 0 }, thumb: { borderRadius: 0 } })
const ref = createRef<TNativeSliderRef>()
const samples = [
  <Slider
    {...scalar}
    ref={ref}
    minValue={-1}
    maxValue={1}
    step={0.1}
    direction="rtl"
    orientation="vertical"
    height={300}
    width="50%"
    maxWidth="100%"
    thumbColor={PlatformColor("labelColor")}
    customStyles={styles.root}
    customThumbStyles={styles.thumb}
  />,
  <Slider
    {...range}
    locale="fr-CA"
    formatOptions={{ style: "currency", currency: "CAD" }}
    customOutputFormatter={(values) => values.join(" – ")}
    style={({ state, defaultStyle }) => ({ ...defaultStyle, opacity: state.isThumbDragging(0) ? 0.8 : 1 })}
  />,
  <Slider
    aria-label="Scalar"
    value={0}
    onChange={(value) => {
      const number: number = value
      void number
    }}
  />,
  <Slider
    label="Default array"
    onChange={(values) => {
      const list: number[] = values
      void list
    }}
  />,
  <Slider
    label="Range"
    value={[0, 50]}
    onChange={(values) => {
      const list: number[] = values
      void list
    }}
  />,
]
void samples
const state = (_state: TNativeSliderState) => undefined
void state
// @ts-expect-error a native name or visible label is required
const missingName = <Slider value={0} />
// @ts-expect-error values cannot be nullable
const nullable = <Slider label="Value" value={null} />
// @ts-expect-error callbacks infer numeric scalar values
const wrongScalar = <Slider label="Value" value={0} onChange={(_values: number[]) => undefined} />
// @ts-expect-error callbacks infer array values
const wrongArray = <Slider label="Range" value={[0, 50]} onChange={(_value: number) => undefined} />
// @ts-expect-error named dimensions reject CSS units
const css = <Slider label="Value" width="2rem" />
// @ts-expect-error native root has no DOM class
const className = <Slider label="Value" className="slider" />
// @ts-expect-error browser form registration remains an open inherited mapping
const names = <Slider label="Value" thumbNames={["start", "end"]} />
// @ts-expect-error read-only is not part of the canonical Slider API
const readOnly = <Slider label="Value" isReadOnly />
// @ts-expect-error owned root role cannot replace adjustable thumb bindings
const role = <Slider label="Value" role="button" />
const children = (
  // @ts-expect-error the wrapper consumes rather than renders caller children
  <Slider label="Value">
    <Text>Ignored</Text>
  </Slider>
)
const mutation = (
  <Slider
    label="Value"
    style={({ state }) => {
      // @ts-expect-error exposed state values are readonly
      state.values.push(1)
      return {}
    }}
  />
)
void [missingName, nullable, wrongScalar, wrongArray, css, className, names, readOnly, role, children, mutation]
