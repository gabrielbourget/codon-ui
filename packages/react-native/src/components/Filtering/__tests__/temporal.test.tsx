import "../../../collection/__tests__/nativeReceipts"

import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"
import { renderHook } from "@testing-library/react-native"
import { createRef, type Ref, type RefAttributes, type ReactElement } from "react"
import { StyleSheet, type View } from "react-native"

import { renderWithNativeCollections as render, screen } from "../../../collection/__tests__/nativeReceipts"
import type { TNativeFieldInputScope } from "../../../input/fieldInput"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeThemeProvider } from "../../../theme"
import { resolveNativeTableFilteringLabels } from "../../Table/filterLabels"
import { DynamicFilterArgumentInput, type TNativeDynamicFilterArgumentInputProps } from "../DynamicFilterArgumentInput"
import { TemporalFilterArgument, type TTemporalFilterArgumentProps } from "../TemporalArgument"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIDateSegmentNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
}))
jest.mock("../../../input/useFieldInputBinding", () => ({
  useNativeFieldInputBinding: () => ({
    scope: null as TNativeFieldInputScope | null,
    metadata: { binding: () => "", commit: () => {}, receive: () => {} },
    status: { ready: false },
  }),
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest
    .requireActual("react")
    .forwardRef((props: object, ref: Ref<View>) =>
      jest.requireActual("react").createElement(jest.requireActual("react-native").View, { ...props, ref }),
    ),
}))
const cases = [
  { dataType: "date", text: "2026-10-25", next: new CalendarDate(2026, 10, 26) },
  { dataType: "date-time", text: "2026-10-25T13:45:07", next: new CalendarDateTime(2026, 10, 26, 19, 15, 3) },
  { dataType: "time", text: "00:00:00", next: new Time(23, 59, 59) },
] as const
const propsFor = (
  extra: Partial<TNativeDynamicFilterArgumentInputProps & RefAttributes<View>>,
): TNativeDynamicFilterArgumentInputProps & RefAttributes<View> => ({
  dataType: "date",
  filterArgumentType: "Input",
  onArgumentChange: jest.fn(),
  nativeLabels: resolveNativeTableFilteringLabels().native,
  ...extra,
})
const wrap = (props: TNativeDynamicFilterArgumentInputProps & RefAttributes<View>) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost>
      <DynamicFilterArgumentInput {...props} />
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)

type TPickerProps = { value: { toString(): string } | null; onChange: (value: unknown) => void; granularity: string }
const pickerProps = (field: ReactElement) =>
  (field as ReactElement<{ children: ReactElement<TPickerProps> }>).props.children.props
const wrapper = ({ children }: { children: React.ReactNode }) => <NativeThemeProvider>{children}</NativeThemeProvider>

it.each(cases)(
  "mounts the complete $dataType picker and retains its original wrapper on echo",
  async ({ dataType, text, next }) => {
    const ref = createRef<View>()
    const props = propsFor({
      dataType,
      argument: text,
      ref,
      customFieldStyles: { marginTop: 7 },
      customInputStyles: { width: "80%", marginBottom: 9 },
    })
    const view = await render(wrap(props))
    const root = ref.current
    expect(root).not.toBeNull()
    const segments = screen.getAllByTestId(/-segment-/)
    expect(segments.length).toBeGreaterThan(0)
    const original = segments[0]
    expect(StyleSheet.flatten(screen.getByTestId("form-field").props.style)).toMatchObject({ marginTop: 7 })
    expect(props.onArgumentChange).not.toHaveBeenCalled()
    await view.rerender(wrap({ ...props, argument: next.toString() }))
    expect(ref.current).toBe(root)
    expect(screen.getAllByTestId(/-segment-/)[0]).toBe(original)
    await view.rerender(wrap({ ...props, argument: null }))
    expect(ref.current).toBe(root)
    expect(props.onArgumentChange).not.toHaveBeenCalled()
  },
)

it.each(cases)(
  "composes $dataType ISO and clear requests with current callbacks and vetoes",
  async ({ dataType, text, next }) => {
    let active = true
    const props: TTemporalFilterArgumentProps = {
      dataType,
      argument: text,
      canAct: () => active,
      onArgumentChange: jest.fn(),
    }
    const hook = await renderHook((current: TTemporalFilterArgumentProps) => TemporalFilterArgument(current), {
      initialProps: props,
      wrapper,
    })
    const getPicker = () => pickerProps(hook.result.current!)
    const saved = getPicker().onChange
    expect(getPicker().value?.toString()).toBe(text)
    expect(getPicker().granularity).toBe(dataType === "date" ? "day" : "second")
    saved(null)
    saved(next)
    expect(jest.mocked(props.onArgumentChange).mock.calls).toEqual([
      [{ argument: null }],
      [{ argument: next.toString() }],
    ])
    expect(getPicker().value?.toString()).toBe(text)
    const current = { ...props, argument: next.toString(), onArgumentChange: jest.fn() }
    await hook.rerender(current)
    expect(getPicker().value?.toString()).toBe(next.toString())
    active = false
    saved(null)
    expect(current.onArgumentChange).not.toHaveBeenCalled()
    active = true
    saved(null)
    expect(current.onArgumentChange).toHaveBeenCalledWith({ argument: null })
    await hook.unmount()
    current.onArgumentChange.mockClear()
    saved(next)
    expect(current.onArgumentChange).not.toHaveBeenCalled()
  },
)

it.each(cases)(
  "keeps partial $dataType bounds and reads the latest untouched sibling",
  async ({ dataType, text, next }) => {
    const props: TTemporalFilterArgumentProps = {
      dataType,
      range: true,
      argument: [undefined, text],
      onArgumentChange: jest.fn(),
      customRowStyles: { marginTop: 12 },
    }
    const hook = await renderHook((current: TTemporalFilterArgumentProps) => TemporalFilterArgument(current), {
      initialProps: props,
      wrapper,
    })
    const getFields = () =>
      (hook.result.current as ReactElement<{ children: ReactElement[] }>).props.children.map(pickerProps)
    expect(getFields()[0].value).toBeNull()
    const lower = getFields()[0].onChange,
      upper = getFields()[1].onChange
    lower(next)
    upper(null)
    expect(jest.mocked(props.onArgumentChange).mock.calls).toEqual([
      [{ argument: [next.toString(), text] }],
      [{ argument: [undefined, null] }],
    ])
    const current = { ...props, argument: ["", next.toString()], onArgumentChange: jest.fn() }
    await hook.rerender(current)
    lower(null)
    expect(current.onArgumentChange).toHaveBeenCalledWith({ argument: [null, next.toString()] })
    expect(StyleSheet.flatten((hook.result.current as ReactElement<{ style: object }>).props.style)).toMatchObject({
      flexDirection: dataType === "date-time" ? "column" : "row",
      marginTop: 12,
    })
  },
)
