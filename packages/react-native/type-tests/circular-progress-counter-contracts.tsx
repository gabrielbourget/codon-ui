import { createRef } from "react"
import { PlatformColor, StyleSheet, Text as RNText, type View } from "react-native"

import {
  CircularProgress,
  Counter,
  Text,
  NativeCircularProgressContext,
  NativeCircularProgressLabel,
  NativeCircularProgressLabelContext,
  NativeFocusView,
  type TNativeTextRef,
  type CircularProgressProps,
  type CounterProps,
} from "../src"

const styles = StyleSheet.create({ root: { opacity: 0.9 }, text: { color: "purple", fontWeight: "bold" as const } })
export const circularProps: CircularProgressProps = {
  value: 0,
  minValue: -100,
  maxValue: 100,
  isIndeterminate: false,
  height: 0,
  width: "100%",
  backgroundColor: PlatformColor("systemBackgroundColor"),
  backgroundPadding: 0,
  pathColor: "red",
  trackColor: "blue",
  order: "quintenary",
  circleRatio: 0,
  strokeWidth: 0,
  strokeLineCap: "square",
  counterClockwise: false,
  text: "",
  valueLabel: 0,
  locale: "fr-CA",
  formatOptions: { style: "percent" },
  customStyles: [styles.root, { color: "purple" }],
  style: ({ percentage, valueText, isIndeterminate, defaultStyle }) => [
    defaultStyle,
    { opacity: percentage === 0 && !isIndeterminate && valueText ? 1 : 0.5 },
  ],
  customSVGStyles: { opacity: 0.5, color: "blue", width: "75%" },
  customPathStyles: { stroke: "currentColor", strokeWidth: 3, strokeDasharray: [1, 2] },
  customTrackStyles: { stroke: "none", strokeLinecap: "round" },
  customTextStyles: { fill: "red", textAnchor: "middle", fontSize: 18, alignmentBaseline: "middle" },
  customBackgroundStyles: { fill: "navy", r: 40 },
  onLayout: (event) => {
    const width: number = event.nativeEvent.layout.width
    void width
  },
}
export const Circular = <CircularProgress {...circularProps} ref={createRef<View>()} />
export const counterProps: CounterProps = {
  value: "000",
  maxValue: "0",
  showMaxValue: true,
  showProgressIndicator: false,
  color: "blue",
  warningPercentageThreshold: 0,
  errorOrDangerPercentageThreshold: 0,
  customStyles: { color: "red" },
  style: { height: 0 },
  customTextStyles: styles.text,
  customProgressIndicatorStyles: { width: 18 },
  children: <Text>After count</Text>,
}
export const RawCounter = <Counter {...counterProps} ref={createRef<View>()} />
// @ts-expect-error The caller owns the required current value.
export const MissingCircular = <CircularProgress />
// @ts-expect-error A display has no uncontrolled/default value.
export const DefaultCircular = <CircularProgress value={0} defaultValue={25} />
// @ts-expect-error SVG cap values are explicit native choices.
export const InvalidCap = <CircularProgress value={0} strokeLineCap="triangle" />
// @ts-expect-error Owned vector children cannot be replaced.
export const OwnedChildren = <CircularProgress value={0} children={<Text>Child</Text>} />
// @ts-expect-error CSS style strings cannot cross the native boundary.
export const CssPath = <CircularProgress value={0} customPathStyles="stroke: red" />
// @ts-expect-error Native roots require native View refs.
export const DomRef = <CircularProgress value={0} ref={createRef<HTMLDivElement>()} />
export const NativeDescription = (
  <CircularProgress
    value={0}
    aria-describedby="description"
    ariaDetails="details"
    labels={{ descriptionLabel: "Description", detailsLabel: "Détails" }}
  />
)
// @ts-expect-error Native relationships take ID strings, not DOM nodes.
export const DomDescription = <CircularProgress value={0} aria-describedby={document.body} />
const richLabel = <Text>Progress</Text>
export const RichLabel = (
  <CircularProgress
    value={0}
    valueLabel={richLabel}
    style={({ valueText, defaultStyle }) => [defaultStyle, { opacity: valueText === richLabel ? 1 : 0.5 }]}
  />
)
const semanticLabels: CircularProgressProps["valueLabel"][] = [
  undefined,
  null,
  false,
  "",
  0,
  0n,
  4,
  4n,
  "0",
  true,
  "One quarter",
  ["1", " of ", 4],
  <>One quarter</>,
  richLabel,
  Promise.resolve("One quarter"),
]
export const SemanticLabelCases = semanticLabels.map((valueLabel, index) => (
  <CircularProgress
    key={index}
    value={0}
    valueLabel={valueLabel}
    style={({ valueText }) => ({ opacity: typeof valueText === "string" && valueText.length ? 1 : 0.5 })}
  />
))
// @ts-expect-error Value semantics are derived from authoritative value/range.
export const OverrideNow = <CircularProgress value={0} aria-valuenow={30} />
// @ts-expect-error Counter requires raw caller-owned text or number.
export const MissingCounter = <Counter />
// @ts-expect-error Counter does not introduce an uncontrolled value.
export const DefaultCounter = <Counter value={0} defaultValue={1} />
// @ts-expect-error DOM events cannot replace native layout payloads.
export const DomEvent = <Counter value={0} onLayout={(event: React.MouseEvent<HTMLDivElement>) => void event} />
export const CounterRelationships = <Counter value={0} ariaDetails="details" ariaDescribedBy="first second" />
// @ts-expect-error Native relationship targets use ID strings, never DOM objects.
export const DomCounterDetails = <Counter value={0} ariaDetails={{ id: "details" }} />

export const ScopedCircular = (
  <NativeCircularProgressContext.Provider
    value={{
      slots: {
        task: {
          ref: createRef<View>(),
          maxValue: 200,
          style: ({ percentage, valueText, isIndeterminate, defaultStyle }) => [
            defaultStyle,
            { opacity: percentage === 0 || isIndeterminate || !valueText ? 0 : 1 },
          ],
          render: (props, state) => {
            const percentage: number | undefined = state.percentage
            void percentage
            return <NativeFocusView {...props} />
          },
        },
      },
    }}
  >
    <CircularProgress value={0} slot="task" />
    <CircularProgress value={0} slot={null} />
  </NativeCircularProgressContext.Provider>
)
export const ProgressLabel = (
  <NativeCircularProgressLabelContext.Provider
    value={{
      ref: createRef<TNativeTextRef>(),
      style: { letterSpacing: 0 },
      render: (props, state) => {
        const empty: undefined = state
        void empty
        return <RNText {...props} />
      },
    }}
  >
    <NativeCircularProgressLabel slot={null}>Transfer</NativeCircularProgressLabel>
  </NativeCircularProgressLabelContext.Provider>
)
export const CounterTypography = <Counter value={0} customStyles={{ fontStyle: "italic", letterSpacing: 0 }} />
// @ts-expect-error Counter exposes no automatic empty-child layout flag.
export const PrivateCounterLayout = <Counter value={0} nativeCounterEmptyChildren />
// @ts-expect-error The retired Counter flag is not part of the public focus host API.
export const PrivateFocusLayout = <NativeFocusView nativeCounterEmptyChildren />
// @ts-expect-error Label refs must expose actual native Text methods.
export const DOMProgressLabelRef = <NativeCircularProgressLabel ref={createRef<HTMLLabelElement>()} />
export const IncorrectLabelState = (
  // @ts-expect-error The label renderer receives no invented progress state.
  <NativeCircularProgressLabel render={(props, _state: { percentage: number }) => <RNText {...props} />} />
)
