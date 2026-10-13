import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"

import { AVAILABLE_THEMING_ORDER_CODES, Button, NativeThemeProvider, Text } from "../../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const pressEvent = { nativeEvent: { timestamp: 100, identifier: 1, pageX: 10, pageY: 20 } }
const hoverEvent = { nativeEvent: { timestamp: 200, clientX: 10, clientY: 20 } }

describe("Button public native contract", () => {
  it("wraps plain content, preserves defaults and exposes a single button target", async () => {
    await render(<Button>Action</Button>)
    const button = screen.getByRole("button", { name: "Action" })
    expect(button).toHaveStyle({ minHeight: 44, minWidth: 44, borderRadius: 5, padding: 5, backgroundColor: "#ffffff" })
    expect(screen.getByText("Action")).toHaveStyle({ color: "#171717", fontSize: 14 })
    expect(screen.getByText("Action").props.selectable).toBe(false)
    expect(button.props.accessibilityState).toMatchObject({ disabled: false, busy: false })
    for (const prop of ["colorMode", "geometry", "raised", "customStyles", "isPending"])
      expect(button.props[prop]).toBeUndefined()
  })

  it("emits balanced native press callbacks and one activation", async () => {
    const onPress = jest.fn(),
      onPressStart = jest.fn(),
      onPressEnd = jest.fn(),
      onPressChange = jest.fn()
    const onPressIn = jest.fn(),
      onPressOut = jest.fn()
    const user = userEvent.setup()
    await render(
      <Button {...{ onPress, onPressStart, onPressEnd, onPressChange, onPressIn, onPressOut }}>Press</Button>,
    )
    await user.press(screen.getByRole("button", { name: "Press" }))
    for (const callback of [onPress, onPressStart, onPressEnd, onPressIn, onPressOut])
      expect(callback).toHaveBeenCalledTimes(1)
    expect(onPressChange.mock.calls).toEqual([[true], [false]])
    expect(onPress.mock.calls[0][0]).toEqual(expect.objectContaining({ nativeEvent: expect.any(Object) }))
  })

  it("activates after a held press when no long-press action is configured", async () => {
    const onPress = jest.fn()
    await render(<Button onPress={onPress}>Held action</Button>)
    await userEvent.setup().longPress(screen.getByRole("button"), { duration: 700 })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("uses an authored long-press action without also activating the ordinary action", async () => {
    const onPress = jest.fn(),
      onLongPress = jest.fn()
    await render(<Button {...{ onPress, onLongPress }}>Long action</Button>)
    await userEvent.setup().longPress(screen.getByRole("button"), { duration: 700 })
    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
  })

  it.each(["disabled", "pending"] as const)("suppresses activation/hover/press while %s", async (mode) => {
    const onPress = jest.fn(),
      onPressStart = jest.fn(),
      onHoverStart = jest.fn()
    const user = userEvent.setup()
    await render(
      <Button
        isDisabled={mode === "disabled"}
        isPending={mode === "pending"}
        {...{ onPress, onPressStart, onHoverStart }}
      >
        Blocked
      </Button>,
    )
    const button = screen.getByRole("button", { name: "Blocked" })
    await user.press(button)
    await fireEvent(button, "hoverIn", hoverEvent)
    expect(onPress).not.toHaveBeenCalled()
    expect(onPressStart).not.toHaveBeenCalled()
    expect(onHoverStart).not.toHaveBeenCalled()
    expect(button.props.accessibilityState).toMatchObject({ disabled: mode === "disabled", busy: mode === "pending" })
    expect(button.props.focusable).toBe(mode === "pending")
  })

  it("cancels an active gesture when pending starts, balances end and allows a subsequent gesture", async () => {
    const onPress = jest.fn(),
      onPressEnd = jest.fn(),
      onPressChange = jest.fn()
    const { rerender } = await render(<Button {...{ onPress, onPressEnd, onPressChange }}>Transition</Button>)
    let button = screen.getByRole("button", { name: "Transition" })
    await fireEvent(button, "pressIn", pressEvent)
    await rerender(
      <Button isPending {...{ onPress, onPressEnd, onPressChange }}>
        Transition
      </Button>,
    )
    expect(onPressEnd).toHaveBeenCalledTimes(1)
    expect(onPressChange.mock.calls).toEqual([[true], [false]])
    await rerender(<Button {...{ onPress, onPressEnd, onPressChange }}>Transition</Button>)
    button = screen.getByRole("button", { name: "Transition" })
    await fireEvent(button, "pressOut", pressEvent)
    await fireEvent(button, "press", pressEvent)
    expect(onPress).not.toHaveBeenCalled()
    expect(onPressEnd).toHaveBeenCalledTimes(1)
    await userEvent.setup().press(button)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("retains a pooled release payload so a later distinct activation can follow cancellation", async () => {
    let persistent = false
    const end: { nativeEvent: typeof pressEvent.nativeEvent | null; persist: () => void } = {
      nativeEvent: { ...pressEvent.nativeEvent, timestamp: 101 },
      persist: () => {
        persistent = true
      },
    }
    const onPress = jest.fn()
    const { rerender } = await render(<Button onPress={onPress}>Cancelled then activated</Button>)
    await fireEvent(screen.getByRole("button"), "pressIn", pressEvent)
    await rerender(
      <Button isPending onPress={onPress}>
        Cancelled then activated
      </Button>,
    )
    await rerender(<Button onPress={onPress}>Cancelled then activated</Button>)
    await fireEvent(screen.getByRole("button"), "pressOut", end)
    if (!persistent) end.nativeEvent = null
    await fireEvent(screen.getByRole("button"), "press", { nativeEvent: { ...pressEvent.nativeEvent, timestamp: 200 } })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("does not activate a cancelled contact", async () => {
    const onPress = jest.fn(),
      onPressChange = jest.fn()
    await render(<Button {...{ onPress, onPressChange }}>Cancel</Button>)
    const button = screen.getByRole("button", { name: "Cancel" })
    await fireEvent(button, "pressIn", pressEvent)
    await fireEvent(button, "pressOut", pressEvent)
    expect(onPress).not.toHaveBeenCalled()
    expect(onPressChange.mock.calls).toEqual([[true], [false]])
  })

  it("balances a short press whose native activation precedes delayed press-out", async () => {
    const onPress = jest.fn(),
      onPressEnd = jest.fn(),
      onPressChange = jest.fn()
    await render(<Button {...{ onPress, onPressEnd, onPressChange }}>Short</Button>)
    const button = screen.getByRole("button", { name: "Short" })
    await fireEvent(button, "pressIn", pressEvent)
    await fireEvent(button, "press", pressEvent)
    await fireEvent(button, "pressOut", pressEvent)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onPressEnd).toHaveBeenCalledTimes(1)
    expect(onPressChange.mock.calls).toEqual([[true], [false]])
  })

  it("delivers native focus/hover state transitions and pending remains focus eligible", async () => {
    const onFocusChange = jest.fn(),
      onHoverChange = jest.fn()
    const { rerender } = await render(
      <Button {...{ onFocusChange, onHoverChange }} raised={false} raisedOnHover>
        States
      </Button>,
    )
    let button = screen.getByRole("button", { name: "States" })
    await fireEvent(button, "focus", pressEvent)
    await fireEvent(button, "focus", pressEvent)
    expect(onFocusChange.mock.calls).toEqual([[true]])
    expect(button).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 1.5 })
    await fireEvent(button, "hoverIn", hoverEvent)
    await fireEvent(button, "hoverOut", hoverEvent)
    expect(onHoverChange.mock.calls).toEqual([[true], [false]])
    await rerender(
      <Button isPending {...{ onFocusChange, onHoverChange }}>
        States
      </Button>,
    )
    button = screen.getByRole("button", { name: "States" })
    expect(button.props.focusable).toBe(true)
    await fireEvent(button, "blur", pressEvent)
    expect(onFocusChange.mock.calls).toEqual([[true], [false]])
  })

  it("retains a pooled hover payload when pending ends an active hover", async () => {
    let persistent = false
    const event: { nativeEvent: typeof hoverEvent.nativeEvent | null; persist: () => void } = {
      nativeEvent: hoverEvent.nativeEvent,
      persist: () => {
        persistent = true
      },
    }
    const onHoverEnd = jest.fn(),
      onHoverChange = jest.fn()
    const { rerender } = await render(<Button {...{ onHoverEnd, onHoverChange }}>Hover transition</Button>)
    await fireEvent(screen.getByRole("button"), "hoverIn", event)
    if (!persistent) event.nativeEvent = null
    await rerender(
      <Button isPending {...{ onHoverEnd, onHoverChange }}>
        Hover transition
      </Button>,
    )
    expect(onHoverEnd).toHaveBeenCalledTimes(1)
    expect(onHoverEnd.mock.calls[0][0].nativeEvent).toEqual(hoverEvent.nativeEvent)
    expect(onHoverChange.mock.calls).toEqual([[true], [false]])
  })

  it("gives final styles precedence and passes final foreground to nested Text/render children", async () => {
    const styleCallback = jest.fn(() => ({ backgroundColor: "#123456", color: "#abcdef" }))
    await render(
      <Button
        order="primary"
        color="#ff0000"
        hoverColor="#00ff00"
        customStyles={{ color: "#111111" }}
        style={styleCallback}
      >
        {(state) => (
          <>
            <Text>{state.foregroundColor.toString()}</Text>
            <Text color="blue">Explicit child</Text>
          </>
        )}
      </Button>,
    )
    const button = screen.getByRole("button")
    await fireEvent(button, "hoverIn", hoverEvent)
    expect(button).toHaveStyle({ backgroundColor: "#123456" })
    expect(screen.getByText("#abcdef")).toHaveStyle({ color: "#abcdef" })
    expect(screen.getByText("Explicit child")).toHaveStyle({ color: "blue" })
    expect(styleCallback).toHaveBeenLastCalledWith(
      expect.objectContaining({ isHovered: true, foregroundColor: "#111111" }),
    )
  })

  it("applies explicit hoverColor to themed/custom fills while custom pressed colors keep their base", async () => {
    await render(
      <Button order="primary" color="red" hoverColor="green">
        Color
      </Button>,
    )
    const button = screen.getByRole("button", { name: "Color" })
    await fireEvent(button, "hoverIn", hoverEvent)
    expect(button).toHaveStyle({ backgroundColor: "green" })
    await fireEvent(button, "pressIn", pressEvent)
    expect(button).toHaveStyle({ backgroundColor: "red" })
  })

  it("keeps final authored transparency overrides and computes transparent hover before final style", async () => {
    const { rerender } = await render(
      <Button transparent color="red">
        Transparent
      </Button>,
    )
    let button = screen.getByRole("button", { name: "Transparent" })
    expect(button).toHaveStyle({ backgroundColor: "red" })
    await fireEvent(button, "hoverIn", hoverEvent)
    expect(button).toHaveStyle({ backgroundColor: "transparent" })
    await rerender(
      <Button transparent style={{ backgroundColor: "blue" }}>
        Transparent
      </Button>,
    )
    button = screen.getByRole("button", { name: "Transparent" })
    expect(button).toHaveStyle({ backgroundColor: "blue" })
  })

  it("uses corrected dark outline hover/pressed roles for every order", async () => {
    await render(
      <NativeThemeProvider mode="dark">
        {AVAILABLE_THEMING_ORDER_CODES.map((order) => (
          <Button key={order} order={order} colorMode="outline">
            {order}
          </Button>
        ))}
      </NativeThemeProvider>,
    )
    const expected = ["#192237", "#1d1d1d", "#233322", "#382f1a", "#3a2422"]
    for (const [index, order] of AVAILABLE_THEMING_ORDER_CODES.entries()) {
      const button = screen.getByRole("button", { name: order })
      await fireEvent(button, "hoverIn", hoverEvent)
      expect(button).toHaveStyle({ backgroundColor: expected[index], borderWidth: 2 })
    }
  })

  it("preserves explicit dimensions and measures extra hit slop without claiming unclipped targets", async () => {
    const onLayout = jest.fn()
    await render(
      <Button width={20} height={20} geometry="round" onLayout={onLayout}>
        Small
      </Button>,
    )
    const button = screen.getByRole("button", { name: "Small" })
    expect(button).toHaveStyle({ width: 20, height: 20, borderRadius: 10000 })
    const event = { nativeEvent: { layout: { x: 0, y: 0, width: 20, height: 20 } } }
    await fireEvent(button, "layout", event)
    expect(button.props.hitSlop).toEqual({ left: 12, right: 12, top: 12, bottom: 12 })
    expect(onLayout).toHaveBeenCalledWith(event)
  })

  it("retains alias/native precedence and rejects invalid callback/owned colors", async () => {
    await render(
      <Button testID="native" data-testid="alias" accessibilityLabel="Native" aria-label="Alias">
        Label
      </Button>,
    )
    expect(screen.getByTestId("native").props.accessibilityLabel).toBe("Native")
    expect(screen.queryByTestId("alias")).toBeNull()
    await expect(render(<Button style={() => ({ color: "var(--fg)" })}>Invalid</Button>)).rejects.toThrow(
      /Button.*style.color/,
    )
    await expect(render(<Button hoverColor="currentColor">Invalid hover</Button>)).rejects.toThrow(/Button.*hoverColor/)
  })
})
