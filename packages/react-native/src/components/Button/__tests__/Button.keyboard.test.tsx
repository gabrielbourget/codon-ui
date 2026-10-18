import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import { Button, focusNativeTarget, type TNativeButtonProps, type TNativeKeyboardData } from "../../.."
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"

const button = () => screen.getByRole("button")
const key = (extra: Partial<TNativeKeyboardData> = {}) => {
  let prevented = false
  return {
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
    nativeEvent: {
      kind: "keyboard" as const,
      ownerId: button().props.ownerId,
      target: 1,
      key: "Enter",
      nativeCode: 40,
      characters: "",
      phase: "down" as const,
      repeat: false,
      cancelled: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: true,
      timestamp: 0,
      ...extra,
    },
  }
}
const send = async (event: ReturnType<typeof key>) => act(() => button().props.onNativeKey(event))

it.each(["Enter", " "])(
  "balances %j start/end/change and activates exactly once on the original native key-up",
  async (name) => {
    const calls: unknown[][] = []
    await render(
      <Button
        onPressStart={(e) => calls.push(["start", e])}
        onPressEnd={(e) => calls.push(["end", e])}
        onPressIn={(e) => calls.push(["in", e])}
        onPressOut={(e) => calls.push(["out", e])}
        onPressChange={(value) => calls.push(["change", value])}
        onPress={(e) => calls.push(["press", e])}
      >
        {(state) => String(state.isPressed)}
      </Button>,
    )
    const down = key({ key: name })
    await send(down)
    expect(screen.getByText("true")).toBeOnTheScreen()
    expect(calls).toEqual([
      ["start", down],
      ["change", true],
      ["in", down],
    ])
    await send(key({ key: name, repeat: true }))
    expect(calls).toHaveLength(3)
    const up = key({ key: name, phase: "up" })
    await send(up)
    expect(calls).toEqual([
      ["start", down],
      ["change", true],
      ["in", down],
      ["end", up],
      ["change", false],
      ["out", up],
      ["press", up],
    ])
    await send(up)
    expect(calls).toHaveLength(7)
    expect(screen.getByText("false")).toBeOnTheScreen()
  },
)

it.each(Array.from({ length: 16 }, (_, mask) => mask))(
  "preserves modifier combination %i and original events for Enter/Space without manufacturing touch coordinates",
  async (mask) => {
    const onPress = jest.fn()
    await render(<Button onPress={onPress}>Action</Button>)
    const modifiers = { shiftKey: !!(mask & 8), altKey: !!(mask & 4), ctrlKey: !!(mask & 2), metaKey: !!(mask & 1) }
    const token = `${+modifiers.shiftKey}${+modifiers.altKey}${+modifiers.ctrlKey}${+modifiers.metaKey}`
    for (const name of ["Enter", " "]) {
      expect(button().props.capturedKeys).toContain(`${token}:${name}`)
      const down = key({ ...modifiers, key: name, nativeModifierData: String(mask) })
      const up = key({ ...down.nativeEvent, phase: "up" })
      await send(down)
      await send(up)
      expect(onPress.mock.calls.at(-1)?.[0]).toBe(up)
      expect(up.nativeEvent).toMatchObject({ ...modifiers, timestamp: 0, nativeModifierData: String(mask) })
      expect(up.nativeEvent).not.toHaveProperty("pageX")
    }
    expect(onPress).toHaveBeenCalledTimes(2)
  },
)

it("keeps a genuine root ref, portable focus commands and zero geometry through guard changes", async () => {
  const ref = createRef<View>()
  const command = jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
  const props: TNativeButtonProps = { width: 0, height: 0, style: { minWidth: 0, minHeight: 0 } }
  await render(
    <Button {...props} ref={ref}>
      Action
    </Button>,
  )
  const native = ref.current
  expect(focusNativeTarget(native)).toBe(true)
  expect(command).toHaveBeenCalledWith(native, button().props.ownerId)
  expect(button()).toHaveStyle({ width: 0, height: 0, minWidth: 0, minHeight: 0 })
  await screen.rerender(
    <Button {...props} ref={ref} isDisabled>
      Action
    </Button>,
  )
  expect(ref.current).toBe(native)
  expect(focusNativeTarget(native)).toBe(false)
  command.mockRestore()
})

it.each(["pending", "disabled"] as const)(
  "cancels a held key during %s, preserves a balanced end and rejects its release after re-enabling",
  async (guard) => {
    const press = jest.fn(),
      end = jest.fn(),
      change = jest.fn(),
      out = jest.fn()
    const node = (blocked = false) => (
      <Button
        onPress={press}
        onPressEnd={end}
        onPressChange={change}
        onPressOut={out}
        isPending={blocked && guard === "pending"}
        isDisabled={blocked && guard === "disabled"}
      >
        Action
      </Button>
    )
    await render(node())
    const down = key()
    await send(down)
    await screen.rerender(node(true))
    expect(end.mock.calls[0][0]).toBe(down)
    expect(change.mock.calls).toEqual([[true], [false]])
    expect(out).not.toHaveBeenCalled()
    await screen.rerender(node())
    await send(key({ phase: "up" }))
    expect(press).not.toHaveBeenCalled()
    expect(end).toHaveBeenCalledTimes(1)
    await send(key())
    await send(key({ phase: "up" }))
    expect(press).toHaveBeenCalledTimes(1)
  },
)

it("rejects cancellation, orphan repeats/releases, foreign owners and native unconsumed keys", async () => {
  const press = jest.fn(),
    start = jest.fn()
  await render(
    <Button onPress={press} onPressStart={start}>
      Action
    </Button>,
  )
  await send(key({ repeat: true }))
  await send(key({ phase: "up" }))
  await send(key({ ownerId: "retired" }))
  await send(key({ nativeDefaultHandled: false }))
  expect(start).not.toHaveBeenCalled()
  await send(key())
  await send(key({ phase: "up", cancelled: true }))
  expect(start).toHaveBeenCalledTimes(1)
  expect(press).not.toHaveBeenCalled()
})

it("uses current callbacks for a held key and supports caller keyboard veto without undoing native default handling", async () => {
  const first = jest.fn(),
    next = jest.fn()
  await render(<Button onPress={first}>Action</Button>)
  await send(key())
  await screen.rerender(<Button onPress={next}>Action</Button>)
  await send(key({ phase: "up" }))
  expect(first).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledTimes(1)
  await screen.rerender(
    <Button onPress={next} onKeyDown={(e) => e.preventDefault()}>
      Action
    </Button>,
  )
  const veto = key()
  await send(veto)
  await send(key({ phase: "up" }))
  expect(veto.nativeEvent.nativeDefaultHandled).toBe(true)
  expect(next).toHaveBeenCalledTimes(1)
})

it("retires a held key on blur and all retained native callbacks on unmount", async () => {
  const press = jest.fn(),
    end = jest.fn()
  await render(
    <Button onPress={press} onPressEnd={end}>
      Action
    </Button>,
  )
  await send(key())
  await act(() =>
    button().props.onNativeFocusChange({
      nativeEvent: {
        ownerId: button().props.ownerId,
        isFocused: false,
        target: 1,
        origin: "unknown",
        isFocusVisible: false,
        timestamp: 0,
      },
    }),
  )
  await send(key({ phase: "up" }))
  expect(end).toHaveBeenCalledTimes(1)
  expect(press).not.toHaveBeenCalled()
  const handler = button().props.onNativeKey
  const old = key()
  await screen.unmount()
  await act(() => handler(old))
  expect(press).not.toHaveBeenCalled()
})

it("retains the inherited native accessibility alias precedence and explicit false/zero/empty values", async () => {
  await render(
    <Button
      aria-selected={false}
      accessibilityState={{ selected: true }}
      aria-valuenow={0}
      accessibilityValue={{ now: 9 }}
      aria-valuetext=""
      aria-labelledby="first, second"
      id="native-action"
    >
      Action
    </Button>,
  )
  expect(button().props.accessibilityState.selected).toBe(false)
  expect(button().props.accessibilityValue).toMatchObject({ now: 0, text: "" })
  expect(button().props.accessibilityLabelledBy).toEqual(["first", "second"])
  expect(button().props.nativeID).toBe("native-action")
  await fireEvent.press(button())
})
