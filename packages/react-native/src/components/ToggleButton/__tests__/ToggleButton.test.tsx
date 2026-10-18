import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState, type ComponentProps } from "react"
import { PlatformColor, StyleSheet, View } from "react-native"

import {
  AVAILABLE_THEMING_ORDER_CODES,
  NativeThemeProvider,
  ToggleButton,
  useNativeTheme,
  type NativeTheme,
  type ToggleButtonProps,
  type TNativeToggleButtonChildrenState,
  type TNativeToggleButtonRef,
  type TNativeToggleButtonStyleState,
} from "../../.."
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const pressEvent = { nativeEvent: { timestamp: 100, identifier: 1, pageX: 10, pageY: 20 } }
const hoverEvent = { nativeEvent: { timestamp: 200, clientX: 10, clientY: 20 } }
const Example = (props: ComponentProps<typeof ToggleButton>) => (
  <ToggleButton accessibilityLabel="Toggle Text" {...props}>
    Toggle Text
  </ToggleButton>
)

it("CAP.toggle-button.001 renders one unselected named native target with the default unraised geometry", async () => {
  await render(<Example />)
  const button = screen.getByRole("button", { name: "Toggle Text" })
  expect(button.props.accessibilityState).toMatchObject({ checked: false, disabled: false })
  expect(button).toHaveStyle({
    backgroundColor: "#ffffff",
    borderColor: "#9e9e9e",
    borderWidth: 1,
    borderRadius: 5,
    minWidth: 44,
    minHeight: 44,
  })
  expect(StyleSheet.flatten(button.props.style).shadowOpacity).toBeUndefined()
  expect(screen.getAllByRole("button")).toHaveLength(1)
  expect(screen.getByText("Toggle Text").props.selectable).toBe(false)
})

it("CAP.toggle-button.002 preserves authored numeric, percentage, auto and zero dimensions", async () => {
  const { rerender } = await render(<Example width={150} height={50} />)
  expect(screen.getByRole("button")).toHaveStyle({ width: 150, height: 50 })
  await rerender(<Example width="100%" height="auto" />)
  expect(screen.getByRole("button")).toHaveStyle({ width: "100%", height: "auto" })
  await rerender(<Example style={{ width: 0, height: 0 }} />)
  expect(screen.getByRole("button")).toHaveStyle({ width: 0, height: 0 })
  expect(StyleSheet.flatten(screen.getByRole("button").props.style).minWidth).toBeUndefined()
  expect(StyleSheet.flatten(screen.getByRole("button").props.style).minHeight).toBeUndefined()
})

it("CAP.toggle-button.003 retains an explicit color through selection, hover and press", async () => {
  await render(<Example color="red" defaultSelected />)
  const button = screen.getByRole("button")
  expect(button).toHaveStyle({ backgroundColor: "red" })
  expect(screen.getByText("Toggle Text")).toHaveStyle({ color: "#171717" })
  await fireEvent(button, "hoverIn", hoverEvent)
  await fireEvent(button, "pressIn", pressEvent)
  expect(button).toHaveStyle({ backgroundColor: "red" })
})

it.each([
  ["rounded", 5],
  ["round", 10000],
  ["orthogonal", 0],
] as const)("CAP.toggle-button.004 preserves %s geometry", async (geometry, borderRadius) => {
  await render(<Example geometry={geometry} />)
  expect(screen.getByRole("button")).toHaveStyle({ borderRadius })
})

it.each(["light", "dark"] as const)(
  "CAP.toggle-button.005–.007 maps every order to existing %s action roles",
  async (mode) => {
    let theme: NativeTheme | undefined
    const Probe = (props: ToggleButtonProps) => {
      theme = useNativeTheme()
      return <Example {...props} />
    }
    const { rerender } = await render(
      <NativeThemeProvider mode={mode}>
        <Probe />
      </NativeThemeProvider>,
    )
    for (const order of AVAILABLE_THEMING_ORDER_CODES) {
      await rerender(
        <NativeThemeProvider mode={mode}>
          <Probe order={order} isSelected />
        </NativeThemeProvider>,
      )
      expect(screen.getByRole("button")).toHaveStyle({
        backgroundColor: theme!.actions[order].background,
        borderColor: theme!.actions[order].border,
      })
      expect(screen.getByText("Toggle Text")).toHaveStyle({ color: theme!.actions[order].foreground })
      await fireEvent(screen.getByRole("button"), "hoverIn", hoverEvent)
      expect(screen.getByRole("button")).toHaveStyle({ backgroundColor: theme!.actions[order].hoverBackground })
      await fireEvent(screen.getByRole("button"), "pressIn", pressEvent)
      expect(screen.getByRole("button")).toHaveStyle({ backgroundColor: theme!.actions[order].pressedBackground })
      await fireEvent(screen.getByRole("button"), "pressOut", pressEvent)
      await fireEvent(screen.getByRole("button"), "hoverOut", hoverEvent)
      await rerender(
        <NativeThemeProvider mode={mode}>
          <Probe order={order} isSelected={false} />
        </NativeThemeProvider>,
      )
      await fireEvent(screen.getByRole("button"), "hoverIn", hoverEvent)
      expect(screen.getByRole("button")).toHaveStyle({ backgroundColor: theme!.actions[order].outlineHoverBackground })
      await fireEvent(screen.getByRole("button"), "pressIn", pressEvent)
      expect(screen.getByRole("button")).toHaveStyle({
        backgroundColor: theme!.actions[order].outlinePressedBackground,
      })
      await fireEvent(screen.getByRole("button"), "pressOut", pressEvent)
      await fireEvent(screen.getByRole("button"), "hoverOut", hoverEvent)
    }
  },
)

it("CAP.toggle-button.008/.015/.016 uses semantic no-order selected and interaction colors", async () => {
  await render(<Example defaultSelected />)
  const button = screen.getByRole("button")
  expect(button).toHaveStyle({ backgroundColor: "#2563eb", borderColor: "#2563eb" })
  expect(screen.getByText("Toggle Text")).toHaveStyle({ color: "#ffffff" })
  await fireEvent(button, "hoverIn", hoverEvent)
  expect(button).toHaveStyle({ backgroundColor: "#245bd6" })
  await fireEvent(button, "pressIn", pressEvent)
  expect(button).toHaveStyle({ backgroundColor: "#2254c1" })
})

it("CAP.toggle-button.009/.010 preserves focus opt-outs, offset and raised false", async () => {
  const { rerender } = await render(<Example raised />)
  const root = screen.getByRole("button")
  await fireEvent(root, "focus", {
    nativeEvent: {
      ownerId: root.props.ownerId,
      target: 17,
      isFocused: true,
      isFocusVisible: true,
      origin: "keyboard",
      timestamp: 0,
    },
  })
  expect(screen.getByRole("button")).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 1.5, shadowOpacity: 0.24 })
  await rerender(<Example raised={false} offsetFocusRing={false} />)
  expect(screen.getByRole("button")).toHaveStyle({ outlineOffset: 0 })
  await rerender(<Example enableFocusStyle={false} />)
  const style = StyleSheet.flatten(screen.getByRole("button").props.style)
  expect(style.outlineWidth).toBeUndefined()
  expect(style.shadowOpacity).toBeUndefined()
})

it("CAP.toggle-button.011 blocks disabled activation and cancels an active native gesture with balanced callbacks", async () => {
  const change = jest.fn(),
    end = jest.fn(),
    pressChange = jest.fn(),
    activate = jest.fn()
  const { rerender } = await render(
    <Example onChange={change} onPressEnd={end} onPressChange={pressChange} onPress={activate} />,
  )
  await fireEvent(screen.getByRole("button"), "pressIn", pressEvent)
  await rerender(
    <Example isDisabled onChange={change} onPressEnd={end} onPressChange={pressChange} onPress={activate} />,
  )
  expect(end).toHaveBeenCalledTimes(1)
  expect(pressChange.mock.calls).toEqual([[true], [false]])
  expect(screen.getByRole("button").props.accessibilityState).toMatchObject({ checked: false, disabled: true })
  expect(screen.getByRole("button")).toHaveStyle({ opacity: 0.4 })
  await rerender(<Example onChange={change} onPressEnd={end} onPressChange={pressChange} onPress={activate} />)
  await fireEvent(screen.getByRole("button"), "press", pressEvent)
  expect(change).not.toHaveBeenCalled()
  expect(activate).not.toHaveBeenCalled()
})

it("CAP.toggle-button.012/.013 resolves custom and final styles with post-custom callback state", async () => {
  const states: TNativeToggleButtonStyleState[] = []
  await render(
    <Example
      height={50}
      width={150}
      customStyles={{ color: "turquoise", marginTop: 5, borderRadius: 0 }}
      style={(state) => {
        states.push(state)
        return { color: "tomato", width: 175, marginBottom: 10 }
      }}
    />,
  )
  expect(screen.getByRole("button")).toHaveStyle({
    height: 50,
    width: 175,
    borderRadius: 0,
    marginTop: 5,
    marginBottom: 10,
  })
  expect(screen.getByText("Toggle Text")).toHaveStyle({ color: "tomato" })
  expect(states.at(-1)).toMatchObject({
    isSelected: false,
    isPressed: false,
    isHovered: false,
    isFocused: false,
    isDisabled: false,
    foregroundColor: "turquoise",
    defaultStyle: { width: 150, marginTop: 5, color: "turquoise" },
  })
  expect(states.at(-1)).not.toHaveProperty("isPending")
})

it("CAP.toggle-button.014 consumes wrapper props and forwards native aliases, payloads and the actual View ref", async () => {
  const ref = createRef<TNativeToggleButtonRef>()
  const layout = jest.fn()
  await render(
    <Example
      ref={ref}
      width={50}
      height={50}
      color="turquoise"
      order="primary"
      geometry="round"
      raised
      enableFocusStyle={false}
      offsetFocusRing={false}
      customStyles={{ marginTop: 5 }}
      accessibilityLabel="Native"
      aria-label="Alias"
      testID="native"
      data-testid="alias"
      nativeID="toggle-native"
      onLayout={layout}
    />,
  )
  const button = screen.getByRole("button", { name: "Native" })
  expect(screen.getByTestId("native")).toBe(button)
  expect(screen.queryByTestId("alias")).toBeNull()
  expect(typeof ref.current?.measure).toBe("function")
  expect(button.props.nativeID).toBe("toggle-native")
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 50, height: 50 } } }
  await fireEvent(button, "layout", event)
  expect(layout).toHaveBeenCalledWith(event)
  for (const prop of [
    "color",
    "geometry",
    "order",
    "width",
    "height",
    "enableFocusStyle",
    "offsetFocusRing",
    "raised",
    "customStyles",
    "isSelected",
    "defaultSelected",
    "onChange",
    "autoFocus",
  ])
    expect(button.props[prop]).toBeUndefined()
})

it("NATIVE.toggle-button.001 preserves controlled false through repeated vetoes and requests selection before native activation", async () => {
  const calls: unknown[] = []
  const { rerender } = await render(
    <Example
      isSelected={false}
      onChange={(next) => calls.push(next)}
      onPress={(event) =>
        calls.push("observedAt" in event.nativeEvent ? event.nativeEvent.observedAt : event.nativeEvent.timestamp)
      }
    />,
  )
  await fireEvent(screen.getByRole("button"), "press", pressEvent)
  await fireEvent(screen.getByRole("button"), "press", pressEvent)
  expect(calls).toEqual([true, 100, true, 100])
  expect(screen.getByRole("button").props.accessibilityState.checked).toBe(false)
  await rerender(<Example isSelected onChange={(next) => calls.push(next)} />)
  expect(screen.getByRole("button").props.accessibilityState.checked).toBe(true)
  await fireEvent.press(screen.getByRole("button"), pressEvent)
  expect(calls.at(-1)).toBe(false)
  expect(screen.getByRole("button").props.accessibilityState.checked).toBe(true)
})

it("NATIVE.toggle-button.001 echoes accepted controlled requests and reads an uncontrolled default once", async () => {
  const Controlled = () => {
    const [selected, setSelected] = useState(false)
    return <Example isSelected={selected} onChange={setSelected} />
  }
  const { rerender } = await render(<Controlled />)
  await userEvent.setup().press(screen.getByRole("button"))
  expect(screen.getByRole("button").props.accessibilityState.checked).toBe(true)
  await rerender(<Example defaultSelected />)
  await fireEvent.press(screen.getByRole("button"), pressEvent)
  expect(screen.getByRole("button").props.accessibilityState.checked).toBe(false)
  await rerender(<Example defaultSelected={false} />)
  expect(screen.getByRole("button").props.accessibilityState.checked).toBe(false)
  await rerender(<Example defaultSelected />)
  expect(screen.getByRole("button").props.accessibilityState.checked).toBe(false)
})

it("NATIVE.toggle-button.001 retains render state methods, batch deduplication and programmatic requests while disabled", async () => {
  let latest: TNativeToggleButtonChildrenState | undefined
  const change = jest.fn()
  await render(
    <ToggleButton isSelected={false} defaultSelected={false} isDisabled onChange={change}>
      {(state) => {
        latest = state
        return (
          <>
            Save {3}
            <View testID="icon" />
          </>
        )
      }}
    </ToggleButton>,
  )
  expect(screen.getByText("Save 3")).toHaveStyle({ color: "#171717" })
  expect(latest?.state).toMatchObject({ isSelected: false, defaultSelected: false })
  await act(() => {
    latest!.state.setSelected(true)
    latest!.state.setSelected(true)
  })
  expect(change.mock.calls).toEqual([[true]])
  expect(latest?.isSelected).toBe(false)
  await act(() => latest!.state.setSelected(false))
  expect(change).toHaveBeenCalledTimes(1)
  await act(() => latest!.state.toggle())
  expect(change.mock.calls).toEqual([[true], [true]])
})

it("NATIVE.toggle-button.001 supports native dynamic colors and mounted provider changes without changing selection", async () => {
  const native = PlatformColor("systemBlueColor")
  const registered = StyleSheet.create({ root: { color: native, borderColor: native } })
  const { rerender } = await render(
    <NativeThemeProvider>
      <Example isSelected customStyles={[false, registered.root]} />
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Toggle Text")).toHaveStyle({ color: native })
  await rerender(
    <NativeThemeProvider
      mode="dark"
      overrides={{ colors: { controlSelectedBackground: "purple", controlSelectedForeground: "orange" } }}
    >
      <Example isSelected />
    </NativeThemeProvider>,
  )
  expect(screen.getByRole("button")).toHaveStyle({ backgroundColor: "purple", borderColor: "purple" })
  expect(screen.getByText("Toggle Text")).toHaveStyle({ color: "orange" })
  expect(screen.getByRole("button").props.accessibilityState.checked).toBe(true)
})

it.each([false, true])(
  "NATIVE.toggle-button.002 queues initial native autofocus and cancels safely when later disabled=%s",
  async (disabled) => {
    let frame: Parameters<typeof requestAnimationFrame>[0] | undefined
    jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback
      return 53
    })
    const cancel = jest.spyOn(globalThis, "cancelAnimationFrame")
    const ref = createRef<TNativeToggleButtonRef>()
    const { rerender, unmount } = await render(<Example autoFocus ref={ref} />)
    const focus = jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
    const upstreamFocus = ref.current!.focus
    focus.mockClear()
    if (disabled) await rerender(<Example autoFocus ref={ref} isDisabled />)
    await act(() => frame!(0))
    expect(focus).toHaveBeenCalledTimes(disabled ? 0 : 1)
    if (!disabled) expect(focus).toHaveBeenCalledWith(ref.current, screen.getByRole("button").props.ownerId)
    expect(ref.current!.focus).toBe(upstreamFocus)
    await unmount()
    expect(cancel).toHaveBeenCalledWith(53)
    await act(() => frame!(0))
    expect(focus).toHaveBeenCalledTimes(disabled ? 0 : 1)
  },
)

it("NATIVE.toggle-button.002 does not autofocus an initially disabled target or a later opt-in", async () => {
  const request = jest.spyOn(globalThis, "requestAnimationFrame")
  const { rerender } = await render(<Example autoFocus isDisabled />)
  await rerender(<Example autoFocus />)
  expect(request).not.toHaveBeenCalled()
})

it("NATIVE.toggle-button.002 rejects unsupported native dimensions and CSS colors", async () => {
  await expect(render(<Example width={-1} />)).rejects.toThrow(/width/)
  await expect(render(<Example height={NaN} />)).rejects.toThrow(/height/)
  await expect(render(<Example color="var(--bad)" />)).rejects.toThrow(/unsupported native color/)
})
