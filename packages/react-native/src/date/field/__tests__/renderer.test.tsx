import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useContext } from "react"
import { Text, View } from "react-native"
import type * as RN from "react-native"

import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { packet } from "../../input/__tests__/packet"
import type { TNativeDateSegmentInput } from "../../input/NativeDateSegment"
import type { TimeValue } from "../../state/types"
import { NativeTimeFieldStateContext } from "../context"
import { NativeTimeFieldInputContext, NativeTimeFieldErrorContext } from "../descendants"
import { NativeTimePickerRenderer } from "../NativeTimePickerRenderer"
import { NativeTimeFieldError, NativeTimeFieldLabel, NativeTimeFieldText } from "../parts"

jest.mock("../../../input/specs/CUIDateSegmentNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/NativeFocusView", () => ({ NativeFocusHost: jest.requireActual("react-native").View }))
jest.mock("../../../input/NativeKeyboardScope", () => ({ useNativeKeyPolicy: jest.fn() }))

let tags: WeakMap<object, number>, nextTag: number
beforeEach(() => {
  tags = new WeakMap()
  nextTag = 100
  jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockImplementation((target) => {
    if (!target || typeof target !== "object") return typeof target === "number" ? target : null
    let tag = tags.get(target)
    if (!tag) {
      tag = ++nextTag
      tags.set(target, tag)
    }
    return tag
  })
})
afterEach(() => jest.restoreAllMocks())
const segment = (index = 0) =>
  screen.getAllByTestId(/^time-picker-segment-/).filter((node) => node.props.ownerId)[index]
const send = async (index: number, extra: Parameters<typeof packet>[0] = {}) => {
  const host = segment(index)
  const event = {
    nativeEvent: packet({
      ownerId: host.props.ownerId,
      segmentId: host.props.segmentId,
      bindingRevision: host.props.bindingRevision,
      target: 101 + index,
      nativeInstance: `original:${index}`,
      ...extra,
    }),
  } as TNativeDateSegmentInput
  await act(() => host.props.onNativeSegmentInput(event))
  return event
}

it("renders owned segments, literal separators and the exact default clock with 24-hour leading-zero defaults", async () => {
  await render(
    <NativeLocaleProvider locale="en-US">
      <NativeTimePickerRenderer defaultValue={new Time(3, 5, 7)} granularity="second" />
    </NativeLocaleProvider>,
  )
  expect(screen.getByText("03")).toBeTruthy()
  expect(screen.getByText("05")).toBeTruthy()
  expect(screen.getByText("07")).toBeTruthy()
  expect(screen.queryByText("AM")).toBeNull()
  expect(segment().props.displayText).toBe("03")
  const literals = screen.getAllByTestId(/^time-picker-segment-/).filter((node) => !node.props.ownerId)
  expect(literals.length).toBeGreaterThan(0)
  expect(literals.every((node) => node.props.accessible === false)).toBe(true)
  expect(screen.getByTestId("time-picker-clock").props).toMatchObject({
    width: 15,
    height: 15,
    vbWidth: 24,
    vbHeight: 24,
  })
  expect(screen.getByTestId("time-picker-group")).toHaveStyle({ borderWidth: 1, borderRadius: 5 })
  expect(screen.getByTestId("time-picker-input")).toHaveStyle({
    padding: 3.5,
    borderWidth: 0,
    backgroundColor: "transparent",
  })
})

it.each([
  new Time(13, 45, 7),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
])("retains class/date/zone and repeated owner veto through the actual segment receiver: %s", async (value) => {
  const requests: Array<TimeValue | null> = []
  await render(
    <NativeLocaleProvider locale="en-GB">
      <NativeTimePickerRenderer value={value} onChange={(next) => requests.push(next)} granularity="second" />
    </NativeLocaleProvider>,
  )
  await send(0)
  await send(0, { kind: "focus", sequence: 2, focused: true })
  await send(0, {
    kind: "insert",
    sequence: 3,
    focused: true,
    text: "2",
    document: "2",
    selectionStart: 1,
    selectionEnd: 1,
  })
  await send(0, { kind: "blur", sequence: 4, focused: false })
  await send(0, { kind: "focus", sequence: 5, focused: true })
  await send(0, {
    kind: "insert",
    sequence: 6,
    focused: true,
    text: "2",
    document: "2",
    selectionStart: 1,
    selectionEnd: 1,
  })
  expect(requests).toHaveLength(2)
  expect(requests[0]?.constructor).toBe(value.constructor)
  expect(requests[0]?.toString()).toBe(value.set({ hour: 2 }).toString())
  expect(requests[1]?.toString()).toBe(requests[0]?.toString())
  expect(segment().props.displayText).toBe("13")
})

it("echoes native segment edits into the uncontrolled display and keeps the original root ref", async () => {
  const ref = createRef<View>()
  const view = await render(<NativeTimePickerRenderer ref={ref} defaultValue={new Time(13, 45)} />)
  const original = ref.current
  expect(original?.measure).toEqual(expect.any(Function))
  await send(0)
  await send(0, { kind: "focus", sequence: 2, focused: true })
  await send(0, {
    kind: "insert",
    sequence: 3,
    focused: true,
    text: "2",
    document: "2",
    selectionStart: 1,
    selectionEnd: 1,
  })
  expect(segment().props.displayText).toBe("02")
  expect(ref.current).toBe(original)
  await view.rerender(<NativeTimePickerRenderer ref={ref} defaultValue={new Time(19, 20)} />)
  expect(segment().props.displayText).toBe("02")
  expect(ref.current).toBe(original)
})

it.each(["isDisabled", "isReadOnly"] as const)("retains guards and rejects edit packets while %s", async (guard) => {
  const onChange = jest.fn()
  await render(<NativeTimePickerRenderer value={new Time(13, 45)} onChange={onChange} {...{ [guard]: true }} />)
  await send(0)
  await send(0, {
    kind: "insert",
    sequence: 2,
    focused: true,
    text: "2",
    document: "2",
    selectionStart: 1,
    selectionEnd: 1,
  })
  expect(onChange).not.toHaveBeenCalled()
  expect(segment().props.segmentDisabled).toBe(guard === "isDisabled")
  expect(segment().props.segmentReadOnly).toBe(guard === "isReadOnly")
})

it("keeps root, group and input styles separate and forwards the original layout event", async () => {
  const onLayout = jest.fn(),
    authoredStyle = jest.fn(() => ({ height: 9 }))
  await render(
    <NativeTimePickerRenderer
      width={0}
      height={0}
      customStyles={{ width: 8 }}
      style={authoredStyle}
      customInputIconGroupStyles={{ borderWidth: 3 }}
      customInputStyles={{ padding: 0 }}
      onLayout={onLayout}
    />,
  )
  expect(screen.getByTestId("time-picker")).toHaveStyle({ width: 8, height: 9 })
  expect(screen.getByTestId("time-picker-group")).toHaveStyle({ borderWidth: 3 })
  expect(screen.getByTestId("time-picker-input")).toHaveStyle({ padding: 0 })
  expect(authoredStyle).toHaveBeenCalledWith(expect.objectContaining({ defaultStyle: {}, isDisabled: false }))
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 8, height: 9 } } }
  await fireEvent(screen.getByTestId("time-picker"), "layout", event)
  expect(onLayout).toHaveBeenCalledWith(event)
})

it.each([false, null, 0, ""])("preserves canonical falsy icon fallback %j", async (ComponentIcon) => {
  await render(<NativeTimePickerRenderer ComponentIcon={ComponentIcon} />)
  expect(screen.getByTestId("time-picker-clock")).toBeTruthy()
})

it("retains complete state and logical form contexts around an owner render override", async () => {
  const Read = () => {
    const state = useContext(NativeTimeFieldStateContext)!,
      input = useContext(NativeTimeFieldInputContext)!,
      validation = useContext(NativeTimeFieldErrorContext)!
    return (
      <Text testID="contexts">{`${state.timeValue.toString()}|${input.value}|${input.name}|${validation.isInvalid}`}</Text>
    )
  }
  const renderRoot = jest.fn((props) => (
    <View {...props}>
      <Read />
      {props.children}
    </View>
  ))
  await render(
    <NativeTimePickerRenderer
      value={new Time(13, 45)}
      name="clock"
      render={renderRoot}
      ComponentIcon={<Text>Custom clock</Text>}
    />,
  )
  expect(screen.getByTestId("contexts").props.children).toBe("13:45:00|13:45:00|clock|false")
  expect(screen.getByText("Custom clock")).toBeTruthy()
  expect(screen.queryByTestId("time-picker-clock")).toBeNull()
  expect(renderRoot).toHaveBeenCalledWith(
    expect.objectContaining({ testID: "time-picker" }),
    expect.objectContaining({ isDisabled: false, isInvalid: false }),
  )
})

it("mounts the label, description and error slots around an owner render with original text refs", async () => {
  const label = createRef<Text>(),
    description = createRef<Text>(),
    error = createRef<Text>()
  await render(
    <NativeTimePickerRenderer
      value={new Time(13, 45)}
      validationBehavior="aria"
      validate={() => ["First error", "Second error"]}
      render={(props) => (
        <NativeFocusHost {...props}>
          <NativeTimeFieldLabel ref={label} testID="field-label">
            Clock
          </NativeTimeFieldLabel>
          <NativeTimeFieldText ref={description} testID="field-description" slot="description">
            Choose a time
          </NativeTimeFieldText>
          {props.children}
          <NativeTimeFieldError ref={error} testID="field-error" />
        </NativeFocusHost>
      )}
    />,
  )
  expect(screen.getByTestId("field-label").props.nativeID).toMatch(/:label$/)
  expect(screen.getByTestId("field-description").props.nativeID).toMatch(/:description$/)
  expect(screen.getByTestId("field-error").props.nativeID).toMatch(/:error$/)
  expect(screen.getByText("First error Second error")).toBeTruthy()
  expect(label.current?.measure).toEqual(expect.any(Function))
  expect(description.current?.measure).toEqual(expect.any(Function))
  expect(error.current?.measure).toEqual(expect.any(Function))
})

it("keeps group focus styling and owner callbacks tied to the original admitted field event", async () => {
  const onFocus = jest.fn(),
    onBlur = jest.fn(),
    onFocusChange = jest.fn()
  await render(<NativeTimePickerRenderer value={new Time(13, 45)} {...{ onFocus, onBlur, onFocusChange }} />)
  await send(0)
  await send(0, { kind: "focus", sequence: 2, focused: true })
  expect(onFocus).not.toHaveBeenCalled()
  expect(screen.getByTestId("time-picker-group").props.style.outlineWidth).toBeUndefined()
  const event = {
    nativeEvent: {
      ownerId: "field",
      bindingId: "binding",
      target: 5,
      surfaceId: 1,
      windowId: "window",
      scopeOwnerId: "scope",
      scopeEpoch: 1,
      sequence: 1,
      attached: true,
      active: true,
      within: true,
      focusedTarget: 101,
      textInputFocused: true,
      origin: "keyboard",
      observedAt: 20,
      timestamp: 20,
      isFocused: true,
      isFocusVisible: true,
    },
  }
  await act(() => screen.getByTestId("time-picker-group").props.nativeOnFocusWithin(event))
  expect(onFocus).toHaveBeenCalledTimes(1)
  expect(onFocus).toHaveBeenCalledWith(event)
  expect(onFocus.mock.calls[0][0]).toBe(event)
  expect(onFocusChange).toHaveBeenLastCalledWith(true)
  expect(screen.getByTestId("time-picker-group")).toHaveStyle({ outlineWidth: 1.5 })
  const blur = {
    nativeEvent: {
      ...event.nativeEvent,
      sequence: 2,
      within: false,
      focusedTarget: 0,
      textInputFocused: false,
      isFocused: false,
      isFocusVisible: false,
    },
  }
  await act(() => screen.getByTestId("time-picker-group").props.nativeOnFocusWithin(blur))
  expect(onBlur).toHaveBeenCalledWith(blur)
  expect(onFocusChange).toHaveBeenLastCalledWith(false)
})
