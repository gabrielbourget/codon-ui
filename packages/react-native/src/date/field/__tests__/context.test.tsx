import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { act, renderHook } from "@testing-library/react-native"
import type { ReactNode, Ref } from "react"
import type { View } from "react-native"

import { NATIVE_DEFAULT_SLOT, type TNativeContextValue } from "../../../collection/context"
import { NativeFormBehaviorContext } from "../../../form/context"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import type { TimeValue } from "../../state/types"
import { NativeTimeFieldContext } from "../context"
import type { TNativeTimeFieldContextProps, TNativeTimeFieldProps } from "../types"
import { useNativeTimeField } from "../useTimeField"

const setup = async (
  initial: TNativeTimeFieldProps = {},
  context: TNativeContextValue<TNativeTimeFieldContextProps, View> = null,
  behavior: "native" | "aria" = "native",
  ref?: Ref<View>,
) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NativeLocaleProvider locale="en-GB">
      <NativeFormBehaviorContext.Provider value={behavior}>
        <NativeTimeFieldContext.Provider value={context}>{children}</NativeTimeFieldContext.Provider>
      </NativeFormBehaviorContext.Provider>
    </NativeLocaleProvider>
  )
  return renderHook((props: TNativeTimeFieldProps) => useNativeTimeField(props, ref), {
    wrapper,
    initialProps: initial,
  })
}
const values = [
  new Time(13, 45, 7),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
]
it.each(values)("retains context ownership and repeated veto callbacks for %s", async (value) => {
  const calls: Array<[string, TimeValue | null]> = []
  const view = await setup(
    { onChange: (next) => calls.push(["caller", next]) },
    { value, onChange: (next) => calls.push(["context", next]) },
  )
  const state = view.result.current.state
  await act(() => state.increment("hour"))
  await act(() => view.result.current.state.increment("hour"))
  expect(calls.map(([owner]) => owner)).toEqual(["context", "caller", "context", "caller"])
  expect(calls[0][1]).toBe(calls[1][1])
  expect(calls[0][1]?.constructor).toBe(value.constructor)
  expect(calls[2][1]?.toString()).toBe(calls[0][1]?.toString())
  expect(view.result.current.state.timeValue.toString()).toBe("13:45:07")
})
it("keeps explicit null over context value/default and uses slot null to ignore context", async () => {
  const view = await setup({ value: null }, { value: new Time(13, 45), defaultValue: new Time(10, 20) })
  expect(view.result.current.state.value).toBeNull()
  const ignored = await setup({ slot: null, defaultValue: new Time(18, 20) }, { value: new Time(13, 45) })
  expect(ignored.result.current.props.value).toBeUndefined()
  expect(ignored.result.current.state.timeValue.toString()).toBe("18:20:00")
})
it("selects default and named slots with exact source opt-out behavior", async () => {
  const slots = {
    slots: {
      [NATIVE_DEFAULT_SLOT]: { value: new Time(10, 20) },
      alternate: { value: new Time(18, 40), isReadOnly: true },
    },
  }
  const view = await setup({}, slots)
  expect(view.result.current.state.timeValue.toString()).toBe("10:20:00")
  await view.rerender({ slot: "alternate" })
  expect(view.result.current.state.timeValue.toString()).toBe("18:40:00")
  expect(view.result.current.state.isReadOnly).toBe(true)
  await view.rerender({ slot: null, value: new Time(9, 15) })
  expect(view.result.current.state.timeValue.toString()).toBe("09:15:00")
  expect(view.result.current.state.isReadOnly).toBe(false)
})
it.each(["missing", undefined])("rejects an unavailable required source slot: %s", async (slot) => {
  await expect(setup({ slot }, { slots: { alternate: { isRequired: true } } })).rejects.toThrow(/slot/)
})
it("resolves explicit, field-context, form-context and native validation defaults in source order", async () => {
  const form = await setup({}, null, "aria")
  expect(form.result.current.validationBehavior).toBe("aria")
  await form.rerender({ validationBehavior: "native" })
  expect(form.result.current.validationBehavior).toBe("native")
  const field = await setup({}, { validationBehavior: "native" }, "aria")
  expect(field.result.current.validationBehavior).toBe("native")
  expect((await setup()).result.current.validationBehavior).toBe("native")
})
it("forwards the original host to both owner refs and preserves their cleanup contracts", async () => {
  const contextCleanup = jest.fn(),
    ownerCleanup = jest.fn(),
    contextRef = jest.fn(() => contextCleanup),
    ownerRef = jest.fn(() => ownerCleanup)
  const view = await setup({}, { ref: contextRef }, "native", ownerRef)
  const original = {} as View
  const cleanup = view.result.current.ref(original)
  expect(ownerRef).toHaveBeenCalledWith(original)
  expect(contextRef).toHaveBeenCalledWith(original)
  expect(Object.keys(original)).toEqual([])
  if (typeof cleanup === "function") cleanup()
  expect(contextCleanup).toHaveBeenCalledTimes(1)
  expect(ownerCleanup).toHaveBeenCalledTimes(1)
})
it("keeps complete original native event callbacks outside the DOM-typed state engine", async () => {
  const focus = jest.fn(),
    blur = jest.fn(),
    down = jest.fn(),
    up = jest.fn()
  const view = await setup({
    onFocus: focus,
    onBlur: blur,
    onKeyDown: down,
    onKeyUp: up,
    isRequired: true,
    isReadOnly: true,
  })
  expect(view.result.current.props).toMatchObject({ onFocus: focus, onBlur: blur, onKeyDown: down, onKeyUp: up })
  expect(view.result.current.renderState).toMatchObject({
    state: view.result.current.state,
    isRequired: true,
    isReadOnly: true,
    isDisabled: false,
  })
  expect(focus).not.toHaveBeenCalled()
})

it("keeps wrapper-supplied 24-hour and leading-zero defaults over field-context display defaults", async () => {
  const view = await setup(
    { value: null, hourCycle: 24, shouldForceLeadingZeros: true },
    { hourCycle: 12, shouldForceLeadingZeros: false },
  )
  expect(view.result.current.state.segments.some((part) => part.type === "dayPeriod")).toBe(false)
  await act(() => view.result.current.state.setSegment("hour", 3))
  expect(view.result.current.state.segments.find((part) => part.type === "hour")?.text).toBe("03")
})
