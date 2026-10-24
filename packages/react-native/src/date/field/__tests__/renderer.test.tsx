import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { createRef, useContext, type Ref } from "react"
import {
  AccessibilityInfo,
  Animated,
  I18nManager,
  Platform,
  PlatformColor,
  processColor,
  StyleSheet,
  Text,
  View,
} from "react-native"
import type * as RN from "react-native"

import type { TNativeFieldInputScope, TNativeFieldKeyEvent } from "../../../input/fieldInput"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import type { TNativeKeyboardEvent } from "../../../input/types"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"
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
  default: jest
    .requireActual("react")
    .forwardRef((props: object, ref: Ref<View>) =>
      jest
        .requireActual("react")
        .createElement(jest.requireActual("react-native").View, { ...props, ref, testID: "field-metadata" }),
    ),
}))
jest.mock("../../../input/NativeFocusView", () => ({ NativeFocusHost: jest.requireActual("react-native").View }))
let mockFieldScope: TNativeFieldInputScope | null = null
jest.mock("../../../input/useFieldInputBinding", () => ({
  useNativeFieldInputBinding: () => ({
    scope: mockFieldScope,
    metadata: { binding: () => "", commit: () => {} },
    status: { ready: false },
  }),
}))

let tags: WeakMap<object, number>, nextTag: number
beforeEach(() => {
  mockFieldScope = null
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
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
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
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
  expect(
    within(screen.getByTestId("time-picker-group")).getByTestId("field-metadata", { includeHiddenElements: true }),
  ).toBeTruthy()
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

it.each([false, true])(
  "binds complete original segments and live description/error slots: invalid=%s",
  async (invalid) => {
    await render(
      <NativeTimePickerRenderer
        value={new Time(13, 45)}
        validationBehavior="aria"
        validate={() => (invalid ? "Rejected clock" : null)}
        nativeAccessibilityLabels={{ required: "Obligatoire", readOnly: "Lecture seule" }}
        render={(props) => (
          <NativeFocusHost {...props}>
            <NativeTimeFieldLabel testID="semantic-label">Clock label</NativeTimeFieldLabel>
            <NativeTimeFieldText slot="description" testID="semantic-description">
              Time helper
            </NativeTimeFieldText>
            {props.children}
            <NativeTimeFieldError testID="semantic-error" />
          </NativeFocusHost>
        )}
      />,
    )
    const metadata = () => screen.getByTestId("field-metadata", { includeHiddenElements: true })
    expect(metadata().props.semanticBinding).toBe("")
    await send(0)
    expect(metadata().props.semanticBinding).toBe("")
    await send(1)
    const owned = JSON.parse(metadata().props.ownedEditorBinding),
      frame = JSON.parse(metadata().props.semanticBinding)
    expect(owned.segments).toHaveLength(2)
    expect(frame.dateField.firstEditableTarget).toBe(owned.segments[0].target)
    expect(frame.invalid).toBe(invalid)
    expect(frame.labels).toMatchObject({ required: "Obligatoire", readOnly: "Lecture seule" })
    expect(frame.labelledBy).toEqual([screen.getByTestId("semantic-label").props.nativeID])
    expect(frame.describedBy).toEqual([
      screen.getByTestId("time-picker-selected-description", { includeHiddenElements: true }).props.nativeID,
      screen.getByTestId("semantic-description").props.nativeID,
    ])
    expect(frame.errorMessageBy).toEqual(invalid ? [screen.getByTestId("semantic-error").props.nativeID] : [])
    expect(frame.aliases.map((entry: { id: string }) => entry.id)).toEqual(
      expect.arrayContaining([...frame.labelledBy, ...frame.describedBy, ...frame.errorMessageBy]),
    )
  },
)

it("keeps parent form metadata ahead of an independently owned field in the icon slot", async () => {
  await render(
    <NativeTimePickerRenderer
      value={new Time(13, 45)}
      name="parent"
      ComponentIcon={<NativeTimePickerRenderer value={new Time(9, 20)} name="nested" testID="nested-time-picker" />}
    />,
  )
  const parentGroup = within(screen.getByTestId("time-picker-group"))
  const metadata = parentGroup.getAllByTestId("field-metadata", { includeHiddenElements: true })
  const nested = within(screen.getByTestId("nested-time-picker-group")).getByTestId("field-metadata", {
    includeHiddenElements: true,
  })
  expect(metadata).toHaveLength(2)
  expect(metadata[0]).not.toBe(nested)
  expect(metadata[1]).toBe(nested)
})

const rendererScope = (): TNativeFieldInputScope => ({
  bindingId: "renderer",
  bindingRevision: "renderer:1",
  current: () => true,
  native: {
    getLease: () => "module:renderer",
    acceptsField: () => true,
    settleField: () => true,
    moveFieldFocus: () =>
      JSON.stringify({
        requested: true,
        observed: true,
        current: true,
        target: 102,
        nativeInstance: "component:102",
        editorInstance: "editor:102",
        error: "",
      }),
  },
})
const rendererDispatch = (phase: "down" | "up") =>
  JSON.stringify({
    moduleLease: "module:renderer",
    token: phase === "down" ? 1 : 2,
    eventId: phase === "down" ? 1 : 2,
    phase,
    identity: {
      ownerId: "renderer",
      bindingId: "renderer",
      bindingRevision: "renderer:1",
      metadataTarget: 15,
      outerTarget: 2,
      inputTarget: 3,
      surfaceId: 11,
      target: 101,
      documentId: "document",
      documentRevision: "1",
      windowId: "window",
      mountRevision: "mount",
      outerInstance: "outer",
      inputInstance: "input",
      nativeInstance: "component:101",
      editorInstance: "editor:101",
      epoch: 1,
    },
    groups: [3, 2].map((target) => ({
      target,
      bindingId: "renderer",
      bindingRevision: "renderer:1",
      scopeTarget: 2,
      containsTarget: true,
    })),
  })

const rendererKeyEvent = (phase: "down" | "up", key: string) => {
  let prevented = false,
    stopped = false
  return {
    nativeEvent: {
      kind: "keyboard",
      ownerId: "window",
      target: 101,
      key,
      nativeCode: 82,
      characters: "",
      phase,
      repeat: false,
      cancelled: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: true,
      timestamp: 100,
      fieldDispatch: rendererDispatch(phase),
    },
    persist: jest.fn(),
    preventDefault: jest.fn(() => {
      prevented = true
    }),
    stopPropagation: jest.fn(() => {
      stopped = true
    }),
    isPropagationStopped: () => stopped,
    isDefaultPrevented: () => prevented,
    get defaultPrevented() {
      return prevented
    },
  } as unknown as TNativeFieldKeyEvent
}

it("routes an accepted key release to onKeyUp once per source group without repeating key-down effects", async () => {
  mockFieldScope = rendererScope()
  const order: string[] = [],
    down = jest.fn((event: TNativeKeyboardEvent) => order.push(`down:${event.nativeEvent.phase}`)),
    up = jest.fn((event: TNativeKeyboardEvent) => order.push(`up:${event.nativeEvent.phase}`))
  await render(
    <NativeTimePickerRenderer
      value={new Time(13, 45)}
      onChange={() => order.push("change")}
      onKeyDown={down}
      onKeyUp={up}
    />,
  )
  await send(0)
  await send(0, { kind: "focus", focused: true, sequence: 2 })
  const pressed = rendererKeyEvent("down", "ArrowUp"),
    released = rendererKeyEvent("up", "ArrowUp")
  await act(() => segment(0).props.onNativeFieldKey(pressed))
  await act(() => screen.getByTestId("time-picker-input").props.nativeFieldGroupHandler(pressed, 3))
  await act(() => screen.getByTestId("time-picker-group").props.nativeFieldGroupHandler(pressed, 2))
  await act(() => segment(0).props.onNativeFieldKey(released))
  await act(() => screen.getByTestId("time-picker-input").props.nativeFieldGroupHandler(released, 3))
  await act(() => screen.getByTestId("time-picker-group").props.nativeFieldGroupHandler(released, 2))
  expect(order).toEqual(["change", "down:down", "down:down", "up:up", "up:up"])
  expect(down.mock.calls.every(([value]) => value === pressed)).toBe(true)
  expect(up.mock.calls.every(([value]) => value === released)).toBe(true)
})

it("retains the same-group callback after navigation stops propagation to the outer group", async () => {
  mockFieldScope = rendererScope()
  const down = jest.fn()
  await render(<NativeTimePickerRenderer value={new Time(13, 45)} onKeyDown={down} />)
  await send(0)
  await send(0, { kind: "focus", focused: true, sequence: 2 })
  const event = rendererKeyEvent("down", "ArrowRight")
  await act(() => screen.getByTestId("time-picker-input").props.nativeFieldGroupHandler(event, 3))
  await act(() => screen.getByTestId("time-picker-group").props.nativeFieldGroupHandler(event, 2))
  expect(event.preventDefault).toHaveBeenCalledTimes(1)
  expect(event.stopPropagation).toHaveBeenCalledTimes(1)
  expect(down).toHaveBeenCalledTimes(1)
  expect(down).toHaveBeenCalledWith(event)
})

const colorAt = (
  id: string,
  name:
    | "color"
    | "borderColor"
    | "borderTopColor"
    | "borderBottomColor"
    | "borderLeftColor"
    | "borderRightColor" = "borderColor",
) => StyleSheet.flatten(screen.getByTestId(id).props.style)[name]
const rgbAt = (
  id: string,
  name:
    | "color"
    | "borderColor"
    | "borderTopColor"
    | "borderBottomColor"
    | "borderLeftColor"
    | "borderRightColor" = "borderColor",
) => processColor(colorAt(id, name))

it("transitions original root/group borders for250ms and inherited group text for350ms without changing state or refs", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timing = jest.spyOn(Animated, "timing"),
    ref = createRef<View>(),
    onChange = jest.fn(),
    value = new Time(13, 45)
  const node = (color: string) => (
    <NativeTimePickerRenderer
      ref={ref}
      value={value}
      onChange={onChange}
      customStyles={{ borderWidth: 1, borderColor: color }}
      customInputIconGroupStyles={{ borderColor: color, color }}
    />
  )
  const { rerender } = await render(node("red"))
  const original = ref.current,
    originalFocus = original?.focus,
    wire = segment().props.bindingRevision
  await rerender(node("blue"))
  await act(() => jest.advanceTimersByTime(125))
  for (const id of ["time-picker", "time-picker-group"]) {
    expect(rgbAt(id)).not.toBe(processColor("red"))
    expect(rgbAt(id)).not.toBe(processColor("blue"))
  }
  await act(() => jest.advanceTimersByTime(150))
  expect(rgbAt("time-picker")).toBe(processColor("blue"))
  expect(rgbAt("time-picker-group")).toBe(processColor("blue"))
  const text = () => within(segment()).getByText("13")
  expect(processColor(StyleSheet.flatten(text().props.style).color)).not.toBe(processColor("blue"))
  await act(() => jest.advanceTimersByTime(150))
  expect(processColor(StyleSheet.flatten(text().props.style).color)).toBe(processColor("blue"))
  const configs = timing.mock.calls.map(([, config]) => config)
  expect(configs.some((config) => config.duration === 250)).toBe(true)
  expect(configs.some((config) => config.duration === 350)).toBe(true)
  expect(configs.every((config) => config.useNativeDriver === false && config.isInteraction === false)).toBe(true)
  expect(configs.every((config) => Math.abs(config.easing!(0.5) - 0.5) < 0.001)).toBe(true)
  expect(onChange).not.toHaveBeenCalled()
  expect(ref.current).toBe(original)
  expect(ref.current?.focus).toBe(originalFocus)
  expect(segment().props.bindingRevision).toBe(wire)
  expect(segment().props.displayText).toBe("13")
})

it("keeps each side's transition deadline and interrupts changed colors at the current frame", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const node = (top: string, bottom: string) => (
    <NativeTimePickerRenderer customStyles={{ borderWidth: 1, borderTopColor: top, borderBottomColor: bottom }} />
  )
  const { rerender } = await render(node("red", "red"))
  await rerender(node("blue", "blue"))
  await act(() => jest.advanceTimersByTime(125))
  const before = rgbAt("time-picker", "borderBottomColor")
  await rerender(node("blue", "green"))
  expect(rgbAt("time-picker", "borderBottomColor")).toBe(before)
  await act(() => jest.advanceTimersByTime(150))
  expect(rgbAt("time-picker", "borderTopColor")).toBe(processColor("blue"))
  expect(rgbAt("time-picker", "borderBottomColor")).not.toBe(processColor("green"))
  await act(() => jest.advanceTimersByTime(150))
  expect(rgbAt("time-picker", "borderBottomColor")).toBe(processColor("green"))
})

it("retains root/group/input text ownership while the group color transitions", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const node = (color: string) => (
    <NativeTimePickerRenderer
      value={new Time(13, 45)}
      customStyles={{ color: "red" }}
      customInputIconGroupStyles={{ color }}
      customInputStyles={{ color: "blue" }}
      ComponentIcon={
        <NativeTimeFieldText slot={null} testID="group-text-icon">
          Text icon
        </NativeTimeFieldText>
      }
      render={(props) => (
        <NativeFocusHost {...props}>
          <NativeTimeFieldText slot={null} testID="root-text">
            Outside group
          </NativeTimeFieldText>
          {props.children}
        </NativeFocusHost>
      )}
    />
  )
  const { rerender } = await render(node("green"))
  expect(processColor(colorAt("root-text", "color"))).toBe(processColor("red"))
  expect(processColor(colorAt("group-text-icon", "color"))).toBe(processColor("green"))
  expect(processColor(StyleSheet.flatten(within(segment()).getByText("13").props.style).color)).toBe(
    processColor("blue"),
  )
  await rerender(node("purple"))
  await act(() => jest.advanceTimersByTime(125))
  expect(processColor(colorAt("root-text", "color"))).toBe(processColor("red"))
  expect(processColor(colorAt("group-text-icon", "color"))).not.toBe(processColor("purple"))
  expect(processColor(StyleSheet.flatten(within(segment()).getByText("13").props.style).color)).toBe(
    processColor("blue"),
  )
  await act(() => jest.advanceTimersByTime(300))
  expect(processColor(colorAt("group-text-icon", "color"))).toBe(processColor("purple"))
})

it("uses the final group border override and leaves focus outlines/clock colors immediate", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timing = jest.spyOn(Animated, "timing")
  const { rerender } = await render(<NativeTimePickerRenderer customInputIconGroupStyles={{ borderColor: "orange" }} />)
  await rerender(<NativeTimePickerRenderer errorState customInputIconGroupStyles={{ borderColor: "orange" }} />)
  expect(rgbAt("time-picker-group")).toBe(processColor("orange"))
  expect(timing).not.toHaveBeenCalled()
  await act(() =>
    screen.getByTestId("time-picker-group").props.nativeOnFocusWithin({
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
    }),
  )
  expect(screen.getByTestId("time-picker-group")).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 1.5 })
  expect(screen.getByTestId("time-picker-clock").props.stroke).toBe("#2563eb")
  expect(timing).not.toHaveBeenCalled()
})

it("snaps native semantic colors instead of interpolating a synthetic color", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timing = jest.spyOn(Animated, "timing"),
    semantic = PlatformColor("labelColor")
  const { rerender } = await render(<NativeTimePickerRenderer customStyles={{ borderColor: "red" }} />)
  await rerender(<NativeTimePickerRenderer customStyles={{ borderColor: semantic }} />)
  expect(processColor(colorAt("time-picker"))).toEqual(processColor(semantic))
  expect(timing).not.toHaveBeenCalled()
})

it("honors a live Reduce Motion event over the late bootstrap query and releases the original subscription", async () => {
  jest.useFakeTimers()
  let settle: (value: boolean) => void = () => undefined
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(
    new Promise((resolve) => {
      settle = resolve
    }),
  )
  const subscribe = jest.spyOn(AccessibilityInfo, "addEventListener"),
    timing = jest.spyOn(Animated, "timing")
  const { rerender, unmount } = await render(
    <NativeTimePickerRenderer customInputIconGroupStyles={{ borderColor: "red" }} />,
  )
  const registration = subscribe.mock.calls.at(-1)!
  expect(registration[0]).toBe("reduceMotionChanged")
  const changed = registration[1] as unknown as (value: boolean) => void
  const subscription = subscribe.mock.results.at(-1)!.value
  await act(() => changed(true))
  await act(() => settle(false))
  await rerender(<NativeTimePickerRenderer customInputIconGroupStyles={{ borderColor: "blue" }} />)
  expect(rgbAt("time-picker-group")).toBe(processColor("blue"))
  expect(timing).not.toHaveBeenCalled()
  await unmount()
  expect(subscription.remove).toHaveBeenCalledTimes(1)
})

it("follows palette replacement and stops a pending transition on unmount", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const onChange = jest.fn(),
    ref = createRef<View>(),
    value = new Time(13, 45),
    error = jest.spyOn(console, "error")
  const node = (border: string, foreground: string) => (
    <NativeThemeProvider overrides={{ colors: { controlBorder: border, foreground } }}>
      <NativeTimePickerRenderer ref={ref} value={value} onChange={onChange} />
    </NativeThemeProvider>
  )
  const { rerender, unmount } = await render(node("red", "red"))
  const original = ref.current
  await rerender(node("blue", "blue"))
  await act(() => jest.advanceTimersByTime(125))
  expect(rgbAt("time-picker-group")).not.toBe(processColor("blue"))
  expect(ref.current).toBe(original)
  await act(() => jest.advanceTimersByTime(300))
  expect(rgbAt("time-picker-group")).toBe(processColor("blue"))
  expect(processColor(StyleSheet.flatten(within(segment()).getByText("13").props.style).color)).toBe(
    processColor("blue"),
  )
  await rerender(node("green", "green"))
  await act(() => jest.advanceTimersByTime(80))
  const stop = jest.spyOn(Animated.Value.prototype, "stopAnimation")
  await unmount()
  expect(stop).toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(500))
  expect(onChange).not.toHaveBeenCalled()
  expect(ref.current).toBeNull()
  expect(error).not.toHaveBeenCalled()
})

it("animates physical, inline and block border colors on each original owned surface", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const borders = (color: string) => ({
    borderTopColor: color,
    borderRightColor: color,
    borderBottomColor: color,
    borderLeftColor: color,
    borderStartColor: color,
    borderEndColor: color,
    borderBlockColor: color,
    borderBlockStartColor: color,
    borderBlockEndColor: color,
  })
  const node = (color: string) => (
    <NativeTimePickerRenderer customStyles={borders(color)} customInputIconGroupStyles={borders(color)} />
  )
  const { rerender } = await render(node("red"))
  await rerender(node("blue"))
  await act(() => jest.advanceTimersByTime(125))
  for (const id of ["time-picker", "time-picker-group"]) {
    const styles = StyleSheet.flatten(screen.getByTestId(id).props.style)
    expect(processColor(styles.borderLeftColor)).not.toBe(processColor("blue"))
    expect(processColor(styles.borderTopColor)).not.toBe(processColor("blue"))
  }
  await act(() => jest.advanceTimersByTime(200))
  for (const id of ["time-picker", "time-picker-group"]) {
    const styles = StyleSheet.flatten(screen.getByTestId(id).props.style)
    for (const name of ["borderLeftColor", "borderRightColor", "borderTopColor", "borderBottomColor"])
      expect(processColor(styles[name])).toBe(processColor("blue"))
  }
})

it("transitions removed side overrides to their actual inherited color and resolves RTL/block aliases before painting", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const { rerender } = await render(
    <NativeTimePickerRenderer
      customStyles={{ direction: "ltr", borderColor: "blue", borderTopColor: "red" }}
      customInputIconGroupStyles={{
        direction: "rtl",
        borderColor: "black",
        borderStartColor: "red",
        borderEndColor: "green",
        borderTopColor: "red",
        borderBlockColor: "blue",
      }}
    />,
  )
  expect(rgbAt("time-picker-group", "borderRightColor")).toBe(processColor("red"))
  expect(rgbAt("time-picker-group", "borderLeftColor")).toBe(processColor("green"))
  expect(rgbAt("time-picker-group", "borderTopColor")).toBe(processColor("blue"))
  await rerender(
    <NativeTimePickerRenderer
      customStyles={{ direction: "ltr", borderColor: "blue" }}
      customInputIconGroupStyles={{
        direction: "rtl",
        borderColor: "black",
        borderStartColor: "red",
        borderEndColor: "green",
        borderTopColor: "red",
        borderBlockColor: "blue",
      }}
    />,
  )
  await act(() => jest.advanceTimersByTime(125))
  expect(rgbAt("time-picker", "borderTopColor")).not.toBe(processColor("blue"))
  expect(rgbAt("time-picker", "borderTopColor")).not.toBe(processColor("red"))
  await act(() => jest.advanceTimersByTime(200))
  expect(rgbAt("time-picker", "borderTopColor")).toBe(processColor("blue"))
})

it("keeps painted-edge continuity across Android RTL physical-input swapping", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  jest.replaceProperty(Platform, "OS", "android")
  jest.replaceProperty(I18nManager, "doLeftAndRightSwapInRTL", true)
  const node = (direction: "ltr" | "rtl") => (
    <NativeTimePickerRenderer customStyles={{ direction, borderLeftColor: "red", borderRightColor: "blue" }} />
  )
  const { rerender } = await render(node("ltr"))
  expect(rgbAt("time-picker", "borderLeftColor")).toBe(processColor("red"))
  await rerender(node("rtl"))
  // The pinned Android renderer consumes the opposite physical input in RTL.
  expect(rgbAt("time-picker", "borderRightColor")).toBe(processColor("red"))
  await act(() => jest.advanceTimersByTime(125))
  expect(rgbAt("time-picker", "borderRightColor")).not.toBe(processColor("red"))
  expect(rgbAt("time-picker", "borderRightColor")).not.toBe(processColor("blue"))
  await act(() => jest.advanceTimersByTime(200))
  expect(rgbAt("time-picker", "borderRightColor")).toBe(processColor("blue"))
  expect(rgbAt("time-picker", "borderLeftColor")).toBe(processColor("red"))
})

it("keeps original native aliases when an arbitrary ancestor's inherited direction is unobserved", async () => {
  await render(
    <NativeTimePickerRenderer
      customStyles={{ borderStartColor: "red", borderEndColor: "blue" }}
      customInputIconGroupStyles={{ direction: "inherit", borderStartColor: "green", borderEndColor: "purple" }}
    />,
  )
  expect(screen.getByTestId("time-picker")).toHaveStyle({ borderStartColor: "red", borderEndColor: "blue" })
  expect(screen.getByTestId("time-picker-group")).toHaveStyle({ borderStartColor: "green", borderEndColor: "purple" })
  expect(colorAt("time-picker", "borderLeftColor")).toBeUndefined()
})

it("keeps exact native target colors when explicit direction admission changes", async () => {
  jest.useFakeTimers()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const node = (direction?: "ltr" | "inherit") => (
    <NativeTimePickerRenderer customStyles={{ direction, borderStartColor: "red", borderEndColor: "blue" }} />
  )
  const { rerender } = await render(node())
  await rerender(node("ltr"))
  expect(rgbAt("time-picker", "borderLeftColor")).toBe(processColor("red"))
  expect(rgbAt("time-picker", "borderRightColor")).toBe(processColor("blue"))
  await rerender(node("inherit"))
  expect(screen.getByTestId("time-picker")).toHaveStyle({ borderStartColor: "red", borderEndColor: "blue" })
  expect(colorAt("time-picker", "borderLeftColor")).toBeUndefined()
  await act(() => jest.advanceTimersByTime(500))
  expect(screen.getByTestId("time-picker")).toHaveStyle({ borderStartColor: "red", borderEndColor: "blue" })
})
