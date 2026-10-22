import type { TNativeFocusWithinEvent } from "../../../input/focusWithin"
import type { TNativeFocusEvent } from "../../../input/types"
import { isNativeDateFieldFocusEvent } from "../focusEvent"

const event = (within: boolean): TNativeFocusWithinEvent =>
  ({
    nativeEvent: {
      ownerId: "field",
      bindingId: "binding",
      target: 3,
      surfaceId: 11,
      windowId: "window",
      scopeOwnerId: "scope",
      scopeEpoch: 1,
      sequence: 1,
      attached: true,
      active: true,
      within,
      focusedTarget: within ? 4 : 0,
      textInputFocused: within,
      origin: "keyboard",
      observedAt: 12,
      timestamp: 12,
      isFocused: within,
      isFocusVisible: within,
    },
  }) as TNativeFocusWithinEvent
it.each([true, false])("admits the unchanged original SDK event as the public focus event: %s", (within) => {
  const original = event(within),
    callback = jest.fn<void, [TNativeFocusEvent]>()
  if (isNativeDateFieldFocusEvent(original)) callback(original)
  expect(callback).toHaveBeenCalledWith(original)
  expect(callback.mock.calls[0][0].nativeEvent).toBe(original.nativeEvent)
})
it.each([
  { timestamp: 13 },
  { isFocused: false },
  { isFocusVisible: undefined },
  { origin: "synthetic" },
  { active: false },
])("rejects a missing or inconsistent original focus view %j", (override) => {
  const original = event(true)
  expect(
    isNativeDateFieldFocusEvent({
      ...original,
      nativeEvent: { ...original.nativeEvent, ...override },
    } as TNativeFocusWithinEvent),
  ).toBe(false)
})
it("rejects legacy fields and an impossible outside focus-visible flag", () => {
  const original = event(false),
    { isFocused: _focus, isFocusVisible: _visible, timestamp: _time, ...legacy } = original.nativeEvent
  expect(isNativeDateFieldFocusEvent({ ...original, nativeEvent: legacy })).toBe(false)
  expect(
    isNativeDateFieldFocusEvent({ ...original, nativeEvent: { ...original.nativeEvent, isFocusVisible: true } }),
  ).toBe(false)
})
