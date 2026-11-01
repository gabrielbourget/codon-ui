import { CalendarDateTime, parseZonedDateTime } from "@internationalized/date"
import { act, cleanup, render, screen } from "@testing-library/react-native"
import { createRef, type RefAttributes } from "react"
import * as RN from "react-native"

import { DateTimePicker, DateTimeRangePicker } from "../../../index"
import type { TNativeFieldInputScope } from "../../../input/fieldInput"
import { getNativeFocusedTarget, observeNativeFocus } from "../../../input/focus"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { Commands } from "../../../input/specs/CUIDateSegmentNativeComponent"
import type { TNativeFocusViewProps } from "../../../input/types"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"
import { packet, keyPacket } from "../../input/__tests__/packet"
import type { TNativeDateSegmentInput } from "../../input/NativeDateSegment"

const mockSegmentTargets = new Map<string, RN.View>()
const mockNative = {
  getLease: () => "legacy-picker-keys",
  acceptsField: jest.fn(() => true),
  settleField: jest.fn(() => true),
  moveFieldFocus: jest.fn(() => "{}"),
}
const mockScope: TNativeFieldInputScope = {
  bindingId: "legacy-picker",
  bindingRevision: "1",
  current: () => true,
  native: mockNative,
}
// Explicit source models: these records do not establish installed event/focus delivery.
jest.mock("../../../input/specs/CUIDateSegmentNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps>((props, ref) => {
      const bind = React.useCallback(
        (target: RN.View | null) => {
          if (target) mockSegmentTargets.set(props.testID!, target)
          else mockSegmentTargets.delete(props.testID!)
          if (typeof ref === "function") return ref(target)
          if (ref) ref.current = target
        },
        [ref, props.testID],
      )
      return React.createElement(Native.View, { ...props, ref: bind })
    }),
    Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
  }
})
jest.mock("../../../input/NativeFocusView", () => ({
  NativeFocusHost: jest.requireActual("react-native").View,
  NativeFocusView: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/useFieldInputBinding", () => ({
  useNativeFieldInputBinding: (_plan: unknown, enabled = true) => ({
    scope: enabled ? mockScope : null,
    metadata: { binding: () => "", commit: () => {}, receive: () => {} },
    status: { ready: true },
  }),
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../../components/ClickPopover/ClickPopover", () => ({
  NativeFloatingSurface: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
    isOpen ? children : null,
}))

beforeEach(() => {
  mockSegmentTargets.clear()
  jest.clearAllMocks()
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const native = jest.requireActual<typeof RN>("react-native")
  const tags = new WeakMap<object, number>()
  let serial = 10000
  jest.spyOn(native, "findNodeHandle").mockImplementation((target) => {
    if (!target || typeof target !== "object") return typeof target === "number" ? target : null
    if (!tags.has(target)) tags.set(target, ++serial)
    return tags.get(target)!
  })
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
})

const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
const setup = async (
  kind: "single" | "range",
  options: {
    empty?: boolean
    readOnly?: boolean
    composition?: "render" | "icon"
    onChange?: () => void
    onKeyDown?: jest.Mock
  } = {},
) => {
  const root = createRef<RN.View>(),
    custom = createRef<RN.TextInput>(),
    onChange = jest.fn()
  onChange.mockImplementation(() => options.onChange?.())
  const single = parseZonedDateTime("2024-10-01T13:45:07[America/New_York]")
  const range = {
    start: new CalendarDateTime(2024, 10, 1, 13, 45, 7),
    end: new CalendarDateTime(2024, 10, 3, 18, 20, 9),
  }
  const testID = kind === "single" ? "datetime-picker" : "datetime-range-picker"
  const common = {
    ref: root,
    granularity: "second" as const,
    isReadOnly: options.readOnly,
    onKeyDown: options.onKeyDown,
    render:
      options.composition === "render"
        ? (props: TNativeFocusViewProps & RefAttributes<RN.View>) => <NativeFocusHost {...props} />
        : undefined,
    ComponentIcon:
      options.composition === "icon" ? (
        <RN.TextInput ref={custom} testID="custom-picker-editor" value="owned" />
      ) : undefined,
  }
  const result = await render(
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-GB">
        {kind === "single" ? (
          <DateTimePicker
            {...common}
            value={options.empty ? null : single}
            placeholderValue={single}
            onChange={onChange}
          />
        ) : (
          <DateTimeRangePicker
            {...common}
            value={options.empty ? null : range}
            placeholderValue={range.start}
            onChange={onChange}
          />
        )}
      </NativeLocaleProvider>
    </NativeThemeProvider>,
  )
  const segments = (slot = kind === "single" ? "value" : "start") =>
    screen
      .getAllByTestId(new RegExp(`^${testID}-input${kind === "range" ? `-${slot}` : ""}-segment-`), hidden)
      .filter((node) => node.props.ownerId)
  const sequence = new Map<string, number>()
  const send = async (id: string, extra: Parameters<typeof packet>[0] = {}) => {
    const host = row(id),
      target = mockSegmentTargets.get(id)
    expect(target).toBeDefined()
    const serial = (sequence.get(id) ?? 0) + 1
    sequence.set(id, serial)
    const event = {
      nativeEvent: packet({
        ownerId: host.props.ownerId,
        segmentId: host.props.segmentId,
        bindingRevision: host.props.bindingRevision,
        target: jest.requireActual<typeof RN>("react-native").findNodeHandle(target!)!,
        nativeInstance: `original:${id}`,
        windowId: "picker-window",
        sequence: serial,
        ...extra,
      }),
    } as TNativeDateSegmentInput
    await act(() => host.props.onNativeSegmentInput(event))
    return event
  }
  for (const node of [...segments(), ...(kind === "range" ? segments("end") : [])]) await send(node.props.testID)
  return {
    ...result,
    kind,
    root,
    custom,
    onChange,
    single,
    range,
    segments,
    send,
    id: (type: string, slot?: string) =>
      segments(slot).find((node) => node.props.segmentId.endsWith(`:${type}`))!.props.testID as string,
    target: (id: string) => mockSegmentTargets.get(id)!,
  }
}
const edit = { kind: "insert", focused: true, text: "3", document: "3", selectionStart: 1, selectionEnd: 1 }

describe.each(["single", "range"] as const)("%s ordinary date input", (kind) => {
  it("requests the original next segment while preserving controlled value class, zone, root and legacy key/pointer protocol", async () => {
    const f = await setup(kind),
      source = f.id("hour"),
      next = f.id("minute"),
      original = f.root.current
    expect(row(source).props.ordinaryInputEvents).toBe(true)
    await f.send(source, { kind: "focus", focused: true })
    expect(getNativeFocusedTarget() === f.target(source)).toBe(true)
    jest.mocked(Commands.requestSegmentFocus).mockClear()
    await f.send(source, edit)
    expect(f.onChange).toHaveBeenCalledTimes(1)
    const requested = f.onChange.mock.calls[0][0]
    if (kind === "single") {
      expect(requested.constructor).toBe(f.single.constructor)
      expect(requested.toString()).toBe(f.single.set({ hour: 3 }).toString())
    } else {
      expect(requested.start.constructor).toBe(f.range.start.constructor)
      expect(requested.start.hour).toBe(3)
      expect(requested.end.toString()).toBe(f.range.end.toString())
    }
    expect(row(source).props.displayText).toBe("13")
    expect(f.root.current).toBe(original)
    expect(Commands.requestSegmentFocus).toHaveBeenCalledTimes(1)
    expect(jest.mocked(Commands.requestSegmentFocus).mock.calls[0][0]).toBe(f.target(next))
    expect(getNativeFocusedTarget()).toBe(f.target(source))
    expect(mockNative.settleField).not.toHaveBeenCalled()
    expect(mockNative.moveFieldFocus).not.toHaveBeenCalled()
  })
  it("rejects auto-advance from a different observed focus owner", async () => {
    let replacement: RN.View | null = null
    const f = await setup(kind, {
      onChange: () => {
        if (replacement) observeNativeFocus(replacement, true)
      },
    })
    const source = f.id("hour"),
      other = f.id("minute", kind === "range" ? "end" : undefined)
    replacement = f.target(other)
    await f.send(source, { kind: "focus", focused: true })
    expect(getNativeFocusedTarget() === f.target(source)).toBe(true)
    jest.mocked(Commands.requestSegmentFocus).mockClear()
    await f.send(source, edit)
    expect(f.onChange).toHaveBeenCalledTimes(1)
    expect(getNativeFocusedTarget()).toBe(replacement)
    expect(Commands.requestSegmentFocus).not.toHaveBeenCalled()
  })
  it("keeps readonly input guarded on the same original host", async () => {
    const f = await setup(kind, { readOnly: true }),
      source = f.id("hour"),
      original = f.target(source)
    await f.send(source, { kind: "focus", focused: true })
    expect(getNativeFocusedTarget() === f.target(source)).toBe(true)
    jest.mocked(Commands.requestSegmentFocus).mockClear()
    await f.send(source, edit)
    expect(f.onChange).not.toHaveBeenCalled()
    expect(f.target(source)).toBe(original)
    expect(Commands.requestSegmentFocus).not.toHaveBeenCalled()
  })
  it.each(["render", "icon"] as const)(
    "uses ordinary input in custom %s composition without enrolling its independent editor",
    async (composition) => {
      const f = await setup(kind, { composition }),
        source = f.id("hour")
      expect(row(source).props.ordinaryInputEvents).toBe(true)
      const original = f.custom.current
      if (composition === "icon") expect(original).not.toBeNull()
      await f.send(source, { kind: "focus", focused: true })
      expect(getNativeFocusedTarget() === f.target(source)).toBe(true)
      jest.mocked(Commands.requestSegmentFocus).mockClear()
      await f.send(source, edit)
      expect(f.onChange).toHaveBeenCalledTimes(1)
      expect(Commands.requestSegmentFocus).toHaveBeenCalledTimes(1)
      expect(
        f
          .segments()
          .some((node) => f.target(node.props.testID) === jest.mocked(Commands.requestSegmentFocus).mock.calls[0][0]),
      ).toBe(true)
      expect(mockNative.settleField).not.toHaveBeenCalled()
      expect(mockNative.moveFieldFocus).not.toHaveBeenCalled()
      expect(f.custom.current).toBe(original)
    },
  )
})
it("does not auto-advance from the last start segment into the end input", async () => {
  const f = await setup("range"),
    source = f.id("second", "start")
  await f.send(source, { kind: "focus", focused: true })
  jest.mocked(Commands.requestSegmentFocus).mockClear()
  await f.send(source, { ...edit, text: "8", document: "8" })
  expect(f.onChange).toHaveBeenCalledTimes(1)
  expect(Commands.requestSegmentFocus).not.toHaveBeenCalled()
  expect(getNativeFocusedTarget()).toBe(f.target(source))
})
it("does not backspace from the first end placeholder into the start input", async () => {
  const f = await setup("range", { empty: true }),
    source = f.segments("end")[0].props.testID as string
  await f.send(source, { kind: "focus", focused: true })
  jest.mocked(Commands.requestSegmentFocus).mockClear()
  await f.send(source, { kind: "delete", focused: true })
  expect(Commands.requestSegmentFocus).not.toHaveBeenCalled()
  expect(getNativeFocusedTarget()).toBe(f.target(source))
})

it.each(["single", "range"] as const)(
  "uses ordinary keys within the active %s endpoint and opens its calendar with Alt+Arrow",
  async (kind) => {
    const onKeyDown = jest.fn()
    const f = await setup(kind, { onKeyDown }),
      id = f.id("day"),
      host = row(id),
      target = f.target(id)
    await f.send(id, { kind: "focus", focused: true })
    const make = (key: string, sequence: number, altKey = false) => {
      let stopped = false
      return {
        target,
        currentTarget: target,
        nativeEvent: keyPacket({
          ownerId: host.props.ownerId,
          segmentId: host.props.segmentId,
          bindingRevision: host.props.bindingRevision,
          target: jest.requireActual<typeof RN>("react-native").findNodeHandle(target)!,
          nativeInstance: `original:${id}`,
          windowId: "picker-window",
          sequence,
          key,
          altKey,
        }),
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(() => {
          stopped = true
        }),
        isPropagationStopped: () => stopped,
        persist: jest.fn(),
      }
    }
    expect(host.props.ordinaryGroupEvents).toBe(true)
    expect(host.props.pickerKeyboard).toBe(true)
    const group = screen.getByTestId(
      `${kind === "single" ? "datetime-picker" : "datetime-range-picker"}-input${kind === "range" ? "-start" : ""}`,
      hidden,
    )
    expect(group.props.nativeFieldGroupHandler).toBeUndefined()
    expect(group.props.nativeOrdinaryGroupKeyHandler).toEqual(expect.any(Function))
    const arrow = make("ArrowRight", 3)
    await act(() => row(id).props.onNativeDateKey(arrow))
    await act(() => group.props.nativeOrdinaryGroupKeyHandler(arrow))
    expect(Commands.requestSegmentFocus).toHaveBeenCalled()
    const request = jest.mocked(Commands.requestSegmentFocus).mock.calls.at(-1)![0]
    expect(f.segments().some((node) => f.target(node.props.testID) === request)).toBe(true)
    expect(arrow.target).toBe(target)
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(onKeyDown).toHaveBeenCalledWith(arrow)
    const open = make("ArrowDown", 4, true)
    await act(() => row(id).props.onNativeDateKey(open))
    const outer = screen.getByTestId(`${kind === "single" ? "datetime-picker" : "datetime-range-picker"}-group`, hidden)
    await act(() => outer.props.nativeOrdinaryGroupKeyHandler(open))
    expect(open.stopPropagation).toHaveBeenCalled()
    expect(
      screen.getByTestId(`${kind === "single" ? "datetime-picker" : "datetime-range-picker"}-calendar`, hidden),
    ).toBeTruthy()
  },
)

it.each(["single", "range"] as const)("preserves nested native key ownership in the %s picker", async (kind) => {
  const f = await setup(kind, { composition: "icon" })
  const prefix = kind === "single" ? "datetime-picker" : "datetime-range-picker"
  const group = row(`${prefix}-group`)
  const original = f.custom.current!
  expect(original).not.toBeNull()
  const event = (captured: boolean) => ({
    target: original,
    currentTarget: f.root.current,
    nativeEvent: {
      ...keyPacket({ key: "ArrowDown", altKey: true }),
      target: jest.requireActual<typeof RN>("react-native").findNodeHandle(original)!,
      nativeDefaultHandled: captured,
    },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    isPropagationStopped: () => false,
    persist: jest.fn(),
  })
  const captured = event(true)
  await act(() => group.props.nativeOrdinaryGroupKeyHandler(captured))
  expect(screen.queryByTestId(`${prefix}-calendar`, hidden)).toBeNull()
  expect(captured.preventDefault).not.toHaveBeenCalled()
  expect(captured.stopPropagation).not.toHaveBeenCalled()
  expect(f.custom.current).toBe(original)
  const unclaimed = event(false)
  await act(() => group.props.nativeOrdinaryGroupKeyHandler(unclaimed))
  expect(screen.getByTestId(`${prefix}-calendar`, hidden)).toBeTruthy()
  expect(unclaimed.stopPropagation).toHaveBeenCalled()
  expect(f.custom.current).toBe(original)
})
