import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { Linking, type View } from "react-native"

import { Link, focusNativeTarget, type TNativeKeyboardData } from "../../.."
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"

const root = () => screen.getByRole("link")
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
      ownerId: root().props.ownerId,
      target: 17,
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
const nativeActivation = (activationId = 1) => ({
  preventDefault: jest.fn(),
  nativeEvent: {
    kind: "activation",
    ownerId: root().props.ownerId,
    target: 17,
    source: "ios-accessibility-activate",
    observedAt: 0,
    activationId,
    scopeOwnerId: "",
    windowId: "window",
    epoch: 0,
  },
})
const sendKey = async (event: ReturnType<typeof key>) => act(() => root().props.onNativeKey(event))
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
})
afterEach(() => jest.restoreAllMocks())

it.each(Array.from({ length: 16 }, (_, mask) => mask))(
  "preserves Enter/Space native modifier mask %i, raw records and one exact URL handoff on release",
  async (mask) => {
    const press = jest.fn(),
      pressIn = jest.fn(),
      pressOut = jest.fn()
    await render(
      <Link
        href="custom:destination?empty=&value=0"
        isVisited={false}
        onPress={press}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        Destination
      </Link>,
    )
    const modifiers = { shiftKey: !!(mask & 8), altKey: !!(mask & 4), ctrlKey: !!(mask & 2), metaKey: !!(mask & 1) }
    const token = `${+modifiers.shiftKey}${+modifiers.altKey}${+modifiers.ctrlKey}${+modifiers.metaKey}`
    for (const name of ["Enter", " "]) {
      expect(root().props.capturedKeys).toContain(`${token}:${name}`)
      const down = key({ ...modifiers, key: name, nativeModifierData: String(mask) })
      const up = key({ ...down.nativeEvent, phase: "up" })
      await sendKey(down)
      await sendKey(key({ ...down.nativeEvent, repeat: true }))
      expect(press).toHaveBeenCalledTimes(name === "Enter" ? 0 : 1)
      await sendKey(up)
      expect(press.mock.calls.at(-1)?.[0]).toBe(up)
      expect(pressIn.mock.calls.at(-1)?.[0]).toBe(down)
      expect(pressOut.mock.calls.at(-1)?.[0]).toBe(up)
      expect(up.nativeEvent).not.toHaveProperty("pageX")
      await sendKey(up)
    }
    expect(press).toHaveBeenCalledTimes(2)
    expect(jest.mocked(Linking.openURL).mock.calls).toEqual([
      ["custom:destination?empty=&value=0"],
      ["custom:destination?empty=&value=0"],
    ])
  },
)

it("preserves the original activation record and owner ordering without manufacturing raw press-in/out", async () => {
  const calls: unknown[] = [],
    rawIn = jest.fn(),
    rawOut = jest.fn()
  jest.mocked(Linking.openURL).mockImplementation(async (href) => {
    calls.push(href)
  })
  await render(
    <Link href="" isVisited={false} onPress={(event) => calls.push(event)} onPressIn={rawIn} onPressOut={rawOut}>
      Destination
    </Link>,
  )
  const event = nativeActivation()
  await act(() => root().props.onNativeActivation(event))
  expect(calls).toEqual([event, ""])
  expect(event.nativeEvent).not.toHaveProperty("pageX")
  expect(event.nativeEvent).not.toHaveProperty("timestamp")
  expect(rawIn).not.toHaveBeenCalled()
  expect(rawOut).not.toHaveBeenCalled()
  await act(() => root().props.onNativeActivation(event))
  expect(calls).toHaveLength(2)
})

it.each(["disabled", "focusable", "tabIndex"] as const)(
  "retires held keyboard input after %s changes and preserves real refs and portable focus admission",
  async (guard) => {
    const ref = createRef<View>(),
      press = jest.fn()
    const focus = jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
    const node = (blocked = false) => (
      <Link
        href=""
        ref={ref}
        onPress={press}
        isDisabled={guard === "disabled" && blocked}
        focusable={guard !== "focusable" || !blocked}
        tabIndex={guard === "tabIndex" && blocked ? -1 : 0}
      >
        Destination
      </Link>
    )
    await render(node())
    const actual = ref.current
    expect(focusNativeTarget(actual)).toBe(true)
    expect(focus).toHaveBeenCalledWith(actual, root().props.ownerId)
    await sendKey(key())
    await screen.rerender(node(true))
    expect(focusNativeTarget(ref.current)).toBe(false)
    expect(ref.current).toBe(actual)
    await screen.rerender(node())
    await sendKey(key({ phase: "up" }))
    expect(press).not.toHaveBeenCalled()
    await sendKey(key())
    await sendKey(key({ phase: "up" }))
    expect(press).toHaveBeenCalledTimes(1)
  },
)

it("retains repeated owner vetoes and current destinations across native activation without rewriting visited=false", async () => {
  const states: boolean[] = []
  const node = (href: string) => (
    <Link
      href={href}
      isVisited={false}
      onPress={(event) => event.preventDefault()}
      style={(state) => {
        states.push(state.isVisited)
        return {}
      }}
    >
      Destination
    </Link>
  )
  await render(node(""))
  const event = key(),
    up = key({ phase: "up" })
  await sendKey(event)
  await sendKey(up)
  await screen.rerender(node("next"))
  const activation = { ...nativeActivation(), isDefaultPrevented: () => true }
  await act(() => root().props.onNativeActivation(activation))
  expect(activation.preventDefault).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).not.toHaveBeenCalled()
  expect(states.every((value) => value === false)).toBe(true)
})

it("rechecks current window admission after the owner callback and retires retained native callbacks on unmount", async () => {
  let active = true
  const press = jest.fn(() => {
    active = false
  })
  await render(
    <NativeFloatingWindowContext.Provider value={() => active}>
      <Link href="destination" onPress={press}>
        Destination
      </Link>
    </NativeFloatingWindowContext.Provider>,
  )
  const event = nativeActivation(),
    retained = root().props.onNativeActivation
  await act(() => retained(event))
  expect(press).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).not.toHaveBeenCalled()
  const next = nativeActivation(2)
  active = true
  await screen.unmount()
  await act(() => retained(next))
  expect(press).toHaveBeenCalledTimes(1)
})

it("forwards actual native focus acknowledgment without inventing focus for a command or admitting foreign owners", async () => {
  const ref = createRef<View>(),
    focus = jest.fn()
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
  await render(
    <Link href="" ref={ref} onFocus={focus}>
      Destination
    </Link>,
  )
  expect(focusNativeTarget(ref.current)).toBe(true)
  expect(focus).not.toHaveBeenCalled()
  const event = {
    nativeEvent: {
      ownerId: root().props.ownerId,
      target: 17,
      isFocused: true,
      isFocusVisible: false,
      origin: "programmatic",
      timestamp: 0,
    },
  }
  await act(() => root().props.onNativeFocusChange({ nativeEvent: { ...event.nativeEvent, ownerId: "retired" } }))
  expect(focus).not.toHaveBeenCalled()
  await act(() => root().props.onNativeFocusChange(event))
  expect(focus.mock.calls[0][0]).toBe(event)
  expect(root()).toHaveStyle({ outlineWidth: 1.5 })
})
