import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { act, cleanup, render, renderHook, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { I18nProvider } from "react-aria-components"
import { afterEach, expect, it, vi } from "vitest"

import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"
import {
  useNativeDateSegmentEntry,
  type TNativeDateSegmentKeyEvent,
} from "../../../../packages/react-native/src/date/entry/useNativeDateSegmentEntry"
import { getNativeDateSegmentSemantics } from "../../../../packages/react-native/src/date/entry/semantics"
import { useTimeFieldState } from "../../../../packages/react-native/src/date/state/useTimeFieldState"
import type { TimeValue } from "../../../../packages/react-native/src/date/state/types"

const values = [
  new Time(13, 45, 7),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
]
afterEach(cleanup)
const keyEvent = (key: string): TNativeDateSegmentKeyEvent => ({
  nativeEvent: {
    kind: "keyboard",
    ownerId: "oracle",
    target: 1,
    key,
    nativeCode: 0,
    characters: "",
    phase: "down",
    repeat: false,
    cancelled: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    capsLock: false,
    nativeModifierData: "",
    nativeDefaultHandled: true,
    timestamp: 1,
  },
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
})

for (const locale of ["en-GB", "ar-EG"]) {
  for (const value of values) {
    it.each([["1", "2"], ["2", "9"], ["0", "1"], ["0", "0"], ["x"], ["٢"]])(
      `retains actual source prefix/restart/zero behavior for ${value.constructor.name} in ${locale}: %j`,
      async (...digits) => {
        const sourceRequests: TimeValue[] = [],
          nativeRequests: TimeValue[] = []
        render(
          <>
            <button>Outside entry oracle</button>
            <I18nProvider locale={locale}>
              <TimePicker
                aria-label="Clock"
                value={value}
                onChange={(next) => {
                  if (next) sourceRequests.push(next)
                }}
                granularity="second"
              />
            </I18nProvider>
          </>,
        )
        const next = vi.fn(),
          previous = vi.fn()
        const native = renderHook(() => {
          const state = useTimeFieldState({
            locale,
            value,
            onChange: (next) => {
              if (next) nativeRequests.push(next)
            },
            granularity: "second",
            hourCycle: 24,
            shouldForceLeadingZeros: true,
          })
          const segment = state.segments.find((part) => part.type === "hour")!
          return {
            state,
            segment,
            entry: useNativeDateSegmentEntry(segment, state, locale, { focusNext: next, focusPrevious: previous }),
          }
        })
        const user = userEvent.setup()
        const original = screen.getAllByRole("spinbutton")[0]
        await user.click(original)
        act(() => native.result.current.entry.focus())
        for (const digit of digits) {
          await user.keyboard(digit)
          act(() => native.result.current.entry.input(digit))
          expect(nativeRequests.map((request) => request.toString())).toEqual(
            sourceRequests.map((request) => request.toString()),
          )
          for (const request of nativeRequests) expect(request).toBeInstanceOf(value.constructor)
          expect(native.result.current.segment.text).toBe(original.textContent)
        }
        expect(native.result.current.state.timeValue.hour).toBe(value.hour)
        expect(value.hour).toBe(13)
        expect(next.mock.calls.length > 0).toBe(document.activeElement !== original)
        await user.click(screen.getByRole("button", { name: "Outside entry oracle" }))
      },
    )
  }
}

it.each(values)(
  "matches actual source increment/page/bound/delete requests without owner echo for %s",
  async (value) => {
    const source: string[] = [],
      native: string[] = [],
      order: string[] = []
    render(
      <>
        <button>Outside key oracle</button>
        <I18nProvider locale="en-GB">
          <TimePicker
            aria-label="Clock"
            value={value}
            granularity="second"
            onChange={(next) => {
              source.push(next?.toString() ?? "null")
              order.push("change")
            }}
            onKeyDown={() => order.push("key")}
          />
        </I18nProvider>
      </>,
    )
    const nativeHook = renderHook(() => {
      const state = useTimeFieldState({
        locale: "en-GB",
        value,
        granularity: "second",
        hourCycle: 24,
        shouldForceLeadingZeros: true,
        onChange: (next) => native.push(next?.toString() ?? "null"),
      })
      return useNativeDateSegmentEntry(state.segments.find((segment) => segment.type === "hour")!, state, "en-GB", {
        focusNext: vi.fn(),
        focusPrevious: vi.fn(),
      })
    })
    const user = userEvent.setup()
    await user.click(screen.getAllByRole("spinbutton")[0])
    for (const key of ["ArrowUp", "ArrowUp", "PageUp", "PageDown", "Home", "End", "Backspace", "Delete"]) {
      await user.keyboard(`{${key}}`)
      const event = keyEvent(key)
      act(() => nativeHook.result.current.keyDown(event))
      expect(event.preventDefault).toHaveBeenCalledTimes(1)
      expect(native).toEqual(source)
    }
    expect(order.slice(0, 2)).toEqual(["change", "key"])
    await user.click(screen.getByRole("button", { name: "Outside key oracle" }))
  },
)

it.each(["en-GB", "ar-EG"])("matches actual empty-source segment labels and value text in %s", (locale) => {
  render(
    <I18nProvider locale={locale}>
      <TimePicker aria-label="Clock" value={null} />
    </I18nProvider>,
  )
  const native = renderHook(() => {
    const state = useTimeFieldState({ locale, value: null, hourCycle: 24, shouldForceLeadingZeros: true })
    const segment = state.segments.find((part) => part.type === "hour")!
    return getNativeDateSegmentSemantics(segment, state, "", locale, "android", "Clock")
  })
  const segment = screen.getAllByRole("spinbutton")[0]
  expect(native.result.current.hidden).toBe(false)
  if (native.result.current.hidden) throw new Error("Editable hour unexpectedly hidden")
  expect(segment.getAttribute("aria-label")).toBe(native.result.current.label)
  expect(segment.getAttribute("aria-valuetext")).toBe(native.result.current.textValue)
})
