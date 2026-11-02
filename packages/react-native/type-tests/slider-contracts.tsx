import { createRef } from "react"
import { PlatformColor, StyleSheet, View } from "react-native"

import {
  NativeSliderContext,
  NativeSliderStateContext,
  NativeThemeProvider,
  Slider,
  Text,
  type SliderProps,
  type TNativeSliderRef,
  type TNativeSliderState,
} from "../src"

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
  thumbNames: ["start", "end"],
}
const styles = StyleSheet.create({ root: { width: 0 }, thumb: { borderRadius: 0 } })
const ref = createRef<TNativeSliderRef>()
const samples = [
  <NativeThemeProvider overrides={{ colors: { controlDraggedBackground: PlatformColor("labelColor") } }}>
    <Slider label="Themed quantity" />
  </NativeThemeProvider>,
  <NativeSliderContext.Provider value={{ label: "Context quantity", value: 0 }}>
    <Slider slot="" />
  </NativeSliderContext.Provider>,
  <Slider aria-labelledby="external-label" />,
  <Slider
    label="Range"
    labelID="range-label"
    aria-describedby="hint first-help"
    aria-details="details"
    accessibilityLabelledBy={["native-label"]}
  />,
  <NativeSliderContext.Provider value={{ value: 0, accessibilityLabel: "Inherited quantity" }}>
    <Slider
      label="Quantity"
      onChange={(value) => {
        const actual: number | number[] = value
        void actual
      }}
      onChangeEnd={(value) => {
        const actual: number | number[] = value
        void actual
      }}
    />
  </NativeSliderContext.Provider>,
  <Slider
    label="Anchored scalar"
    defaultValue={0}
    onChange={(value) => {
      const actual: number = value
      void actual
    }}
  />,
  <Slider
    label="Anchored array"
    defaultValue={[0]}
    onChange={(value) => {
      const actual: number[] = value
      void actual
    }}
  />,
  <NativeSliderStateContext.Consumer>
    {(current) => {
      const values: readonly number[] | undefined = current?.values
      void values
      return null
    }}
  </NativeSliderStateContext.Consumer>,
  <Slider
    label="Custom root"
    render={(props, current) => {
      const values: readonly number[] = current.state.values
      void values
      return <View {...props} />
    }}
  />,
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
    slot={null}
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
// @ts-expect-error thumb names are strings
const names = <Slider label="Value" thumbNames={[0]} />
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

// @ts-expect-error render must return a native React element, not a string
const invalidRender = <Slider label="Value" render={() => "not a root"} />
void invalidRender

// @ts-expect-error an unanchored callback can receive a scalar supplied through context
const unsafeContextArray = <Slider label="Value" onChange={(_value: number[]) => undefined} />
// @ts-expect-error an unanchored end callback can receive an array supplied through context
const unsafeContextScalar = <Slider label="Value" onChangeEnd={(_value: number) => undefined} />
void [unsafeContextArray, unsafeContextScalar]

// @ts-expect-error canonical described-by IDs use a whitespace-separated string
const invalidDescriptionIDs = <Slider label="Range" aria-describedby={["hint"]} />
void invalidDescriptionIDs

// @ts-expect-error opting out of context still requires an explicit name or label reference
const unnamedIndependent = <Slider slot={null} value={0} />
void unnamedIndependent

const unsupportedNativeSliderRootInert = (
  // @ts-expect-error Shared native View-root boundary rejects subtree inertness rather than partially masking input or AT.
  <Slider label="Value" {...{ inert: true }} />
)
const unsupportedNativeSliderRootBrowserService = (
  // @ts-expect-error HTML browser services are not implemented by the native View root.
  <Slider label="Value" {...{ translate: "no" as const, contentEditable: true }} />
)
const unsupportedNativeSliderRootAdvancedARIA = (
  // @ts-expect-error Generic root active-descendant/ownership does not replace the original adjustable thumbs.
  <Slider label="Value" {...{ "aria-activedescendant": "thumb", "aria-owns": "child" }} />
)
const unsupportedNativeSliderRootARIAFlow = (
  // @ts-expect-error Generic advanced root ARIA relationships are explicitly excluded by the approved shared boundary.
  <Slider label="Value" aria-flowto="other" />
)
const unsupportedNativeSliderRootInputDelegation = (
  // @ts-expect-error Root browser composition callbacks do not intercept a child native editor's IME events.
  <Slider label="Value" {...{ onCompositionStart: () => undefined }} />
)
const unsupportedNativeSliderRootFormDelegation = (
  // @ts-expect-error NativeForm owns form callbacks; Slider retains numeric defaults and onChange.
  <Slider label="Value" {...{ onSubmit: () => undefined }} />
)
const unsupportedNativeSliderRootCSSClock = (
  // @ts-expect-error Native theme motion does not promise a browser transition event stream.
  <Slider label="Value" {...{ onTransitionEnd: () => undefined }} />
)
const unsupportedNativeSliderRootMarkup = (
  // @ts-expect-error The wrapper retains owned native children and cannot render browser markup.
  <Slider label="Value" {...{ dangerouslySetInnerHTML: { __html: "<input>" } }} />
)
const unsupportedNativeSliderRootScroll = (
  // @ts-expect-error A native View root does not create a scroller or observe descendant ScrollView completion.
  <Slider label="Value" {...{ onScrollEnd: () => undefined }} />
)
const unsupportedNativeSliderRootBrowserMetadata = (
  // @ts-expect-error Generic HTML root metadata is excluded; use explicit native layout/localization/help.
  <Slider label="Value" {...{ lang: "fr", dir: "auto", title: "Help" }} />
)
void [
  unsupportedNativeSliderRootInert,
  unsupportedNativeSliderRootBrowserService,
  unsupportedNativeSliderRootAdvancedARIA,
  unsupportedNativeSliderRootARIAFlow,
  unsupportedNativeSliderRootInputDelegation,
  unsupportedNativeSliderRootFormDelegation,
  unsupportedNativeSliderRootCSSClock,
  unsupportedNativeSliderRootMarkup,
  unsupportedNativeSliderRootScroll,
  unsupportedNativeSliderRootBrowserMetadata,
]

// @ts-expect-error Original-thumb admission stays private; Slider does not expose a replacement keyboard backend.
const privateKeyPolicy = <Slider label="Value" nativeKeyPolicy={{}} />
void privateKeyPolicy
