import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { findNodeHandle, type View } from "react-native"

import { focusNativeTarget } from "../../../input/focus"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { Select } from "../Select"

const items = [
  { id: 0, name: "Zero" },
  { id: "", name: "Empty" },
]
beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.restoreAllMocks())
it("keeps the same registered trigger ref through owner value and metadata updates", async () => {
  const ref = createRef<View>(),
    focused = jest.fn(),
    blurred = jest.fn(),
    focus = jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
  const view = await render(
    <Select
      ref={ref}
      accessibilityLabel="Choose"
      closeLabel="Close"
      items={items}
      getKey={(item) => item.id}
      getTextValue={(item) => item.name}
      value={0}
    />,
  )
  const original = ref.current!
  expect(focusNativeTarget(original)).toBe(true)
  expect(focus).toHaveBeenCalledWith(original, screen.getByRole("button", { name: "Choose" }).props.ownerId)
  await view.rerender(
    <Select
      ref={ref}
      accessibilityLabel="Choose"
      closeLabel="Close"
      items={items.map((item) => ({ ...item, name: item.name + " refreshed" }))}
      getKey={(item) => item.id}
      getTextValue={(item) => item.name}
      value=""
      onFocus={focused}
      onBlur={blurred}
    />,
  )
  expect(ref.current).toBe(original)
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Empty refreshed")
  const props = screen.getByRole("button", { name: "Choose" }).props
  for (const isFocused of [true, false])
    await act(() =>
      props.onNativeFocusChange({
        nativeEvent: { ownerId: props.ownerId, target: findNodeHandle(original), isFocused, isFocusVisible: true },
      }),
    )
  expect(focused).toHaveBeenCalledTimes(1)
  expect(blurred).toHaveBeenCalledTimes(1)
})
it("uses the existing native Enter release path and rejects a cycle retired by its window", async () => {
  let active = true
  const open = jest.fn(),
    ref = createRef<View>()
  await render(
    <NativeFloatingWindowContext.Provider value={() => active}>
      <Select
        ref={ref}
        accessibilityLabel="Choose"
        closeLabel="Close"
        items={items}
        getKey={(item) => item.id}
        getTextValue={(item) => item.name}
        isOpen={false}
        onOpenChange={open}
      />
    </NativeFloatingWindowContext.Provider>,
  )
  const send = async (phase: "down" | "up") => {
    const props = screen.getByRole("button", { name: "Choose" }).props
    await act(() =>
      props.onNativeKey({
        persist: jest.fn(),
        preventDefault: jest.fn(),
        isDefaultPrevented: () => false,
        nativeEvent: {
          kind: "keyboard",
          ownerId: props.ownerId,
          target: findNodeHandle(ref.current),
          key: "Enter",
          nativeCode: 40,
          characters: "",
          phase,
          repeat: false,
          cancelled: false,
          shiftKey: false,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          capsLock: false,
          nativeModifierData: "",
          nativeDefaultHandled: true,
          timestamp: 100,
        },
      }),
    )
  }
  await send("down")
  expect(open).not.toHaveBeenCalled()
  active = false
  await send("up")
  expect(open).not.toHaveBeenCalled()
  active = true
  await send("down")
  await send("up")
  expect(open.mock.calls).toEqual([[true]])
})
