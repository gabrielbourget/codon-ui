import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, Fragment, useState } from "react"
import { AccessibilityInfo, Animated, Platform, PlatformColor, processColor, StyleSheet } from "react-native"

import {
  Button,
  NativeThemeProvider,
  Tag,
  Text,
  type TNativeTagProps,
  type TNativeTagRef,
  type TNativeTagStyleState,
} from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("CAP.tag.001 renders a static named native text container with default palette, padding and no press target", async () => {
  await render(<Tag accessibilityLabel="Static tag">Content</Tag>)
  const root = screen.getByRole("text", { name: "Static tag" })
  expect(root.props.accessibilityLiveRegion).toBe("none")
  expect(root).toHaveStyle({ backgroundColor: "#2563eb", borderWidth: 0, borderRadius: 5, padding: 5, elevation: 0 })
  expect(screen.queryByRole("button")).toBeNull()
  expect(root.props.onPress).toBeUndefined()
  expect(screen.getByTestId("text")).toHaveStyle({ color: "#171717" })
})

it("CAP.tag.002 renders controlled pressable state without confusing it with a physical press", async () => {
  const states: TNativeTagStyleState[] = []
  await render(
    <Tag
      pressable
      isPressed={false}
      onPress={() => undefined}
      accessibilityLabel="Choose tag"
      style={(state) => {
        states.push(state)
        return {}
      }}
    >
      Choice
    </Tag>,
  )
  const root = screen.getByRole("button", { name: "Choose tag" })
  expect(root.props.accessibilityState).toMatchObject({ checked: false, disabled: false })
  expect(root).toHaveStyle({ backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#c6c6c6" })
  await fireEvent(root, "pressIn", { nativeEvent: { timestamp: 1 } })
  expect(states.at(-1)).toMatchObject({ isPressed: false, isPressing: true })
  expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "#ffffff" })
})

it.each([0, 50, "50%", "auto"] as const)("CAP.tag.003 preserves authored dimensions %s in both modes", async (size) => {
  const { rerender } = await render(<Tag width={size} height={size} />)
  expect(screen.getByTestId("tag")).toHaveStyle({ width: size, height: size })
  await rerender(<Tag pressable isPressed={false} onPress={() => undefined} width={size} height={size} />)
  expect(screen.getByTestId("tag")).toHaveStyle({ width: size, height: size })
  const style = StyleSheet.flatten(screen.getByTestId("tag").props.style)
  expect(style.minWidth).toBeUndefined()
  expect(style.minHeight).toBeUndefined()
})

it.each([
  ["rounded", 5],
  ["round", 10000],
  ["orthogonal", 0],
] as const)("CAP.tag.004 retains geometry %s", async (geometry, radius) => {
  await render(<Tag geometry={geometry} />)
  expect(screen.getByTestId("tag")).toHaveStyle({ borderRadius: radius })
})

it("CAP.tag.005 raises static pointer hover without creating a press responder and forwards original pointer payloads", async () => {
  const onPointerEnter = jest.fn()
  const onPointerLeave = jest.fn()
  await render(
    <Tag raisedOnHover onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      Static
    </Tag>,
  )
  const event = { nativeEvent: { pointerId: 17, pointerType: "mouse" } }
  await act(() => screen.getByTestId("tag").props.onPointerEnter(event))
  expect(onPointerEnter).toHaveBeenCalledWith(event)
  expect(screen.getByTestId("tag")).toHaveStyle({ elevation: 2, shadowOpacity: 0.24 })
  expect(screen.queryByRole("button")).toBeNull()
  await act(() => screen.getByTestId("tag").props.onPointerLeave(event))
  expect(onPointerLeave).toHaveBeenCalledWith(event)
  expect(screen.getByTestId("tag")).toHaveStyle({ elevation: 0, shadowOpacity: 0 })
})

it("CAP.tag.005 retains interactive hover/raised overrides and native focus outline controls", async () => {
  const { rerender } = await render(
    <Tag
      pressable
      isPressed
      onPress={() => undefined}
      raisedOnHover
      focusOutline={{ outlineWidth: 3, outlineColor: "purple" }}
      outlineOffset={0}
    />,
  )
  await fireEvent(screen.getByTestId("tag"), "hoverIn", {})
  await fireEvent(screen.getByTestId("tag"), "focus", {})
  expect(screen.getByTestId("tag")).toHaveStyle({
    shadowOpacity: 0.24,
    elevation: 2,
    outlineWidth: 3,
    outlineColor: "purple",
    outlineOffset: 0,
  })
  await rerender(
    <Tag pressable isPressed onPress={() => undefined} raised={false} raisedOnHover={false} focusOutline="none" />,
  )
  expect(screen.getByTestId("tag")).toHaveStyle({ elevation: 0, outlineWidth: 0 })
})

it("CAP.tag.006–.007 guards disabled true, preserves false and cancels a stale press across takeover", async () => {
  const onPress = jest.fn()
  const { rerender } = await render(<Tag pressable isPressed={false} isDisabled id={0} onPress={onPress} />)
  expect(screen.getByRole("button")).toBeDisabled()
  expect(screen.getByTestId("tag")).toHaveStyle({ opacity: 0.4 })
  await fireEvent.press(screen.getByTestId("tag"), {})
  expect(onPress).not.toHaveBeenCalled()
  await rerender(<Tag pressable isPressed={false} isDisabled={false} id={0} onPress={onPress} />)
  const event = { nativeEvent: { timestamp: 10 } }
  await fireEvent(screen.getByTestId("tag"), "pressIn", event)
  await rerender(<Tag pressable isPressed={false} isDisabled id={0} onPress={onPress} />)
  await rerender(<Tag pressable isPressed={false} isDisabled={false} id={0} onPress={onPress} />)
  await fireEvent.press(screen.getByTestId("tag"), event)
  expect(onPress).not.toHaveBeenCalled()
  await fireEvent(screen.getByTestId("tag"), "pressIn", { nativeEvent: { timestamp: 11 } })
  await fireEvent.press(screen.getByTestId("tag"), { nativeEvent: { timestamp: 11 } })
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(onPress).toHaveBeenCalledWith(0)
  expect(screen.getByRole("button")).not.toBeDisabled()
  expect(screen.getByTestId("tag")).toHaveStyle({ opacity: 1, backgroundColor: "#ffffff" })
})

it.each([false, true] as const)(
  "CAP.tag.008 retains native style/text precedence and post-custom defaults in mode %s",
  async (pressable) => {
    const states: TNativeTagStyleState[] = []
    const styles = StyleSheet.create({ root: { color: "orange", width: 70, fontSize: 18 } })
    const common = {
      customStyles: [styles.root, { backgroundColor: "red" }],
      style: (state: TNativeTagStyleState) => {
        states.push(state)
        return { backgroundColor: "blue", color: "purple", fontSize: 20, width: 80 }
      },
      children: (
        <>
          Keyed{" "}
          <Fragment>
            {0}
            <Text testID="authored" color="green">
              authored
            </Text>
          </Fragment>
        </>
      ),
    }
    await render(
      pressable ? <Tag {...common} pressable isPressed={false} onPress={() => undefined} /> : <Tag {...common} />,
    )
    expect(states.at(-1)).toMatchObject({
      foregroundColor: "orange",
      defaultStyle: { width: 70, color: "orange", fontSize: 18, backgroundColor: "red" },
    })
    const root = screen.getByTestId("tag")
    expect(root).toHaveStyle({ width: 80, backgroundColor: "blue" })
    expect(StyleSheet.flatten(root.props.style).fontSize).toBeUndefined()
    expect(StyleSheet.flatten(root.props.style).color).toBeUndefined()
    expect(screen.getByText("Keyed 0")).toHaveStyle({ color: "purple", fontSize: 20 })
    expect(screen.getByTestId("authored")).toHaveStyle({ color: "green" })
  },
)

it.each([true, false, "true", "false", "mixed"] as const)(
  "CAP.tag.009 keeps aria-pressed override %s separate from controlled visual state",
  async (alias) => {
    await render(<Tag pressable isPressed onPress={() => undefined} aria-pressed={alias} />)
    const expected = alias === "mixed" ? "mixed" : alias === true || alias === "true"
    expect(screen.getByRole("button").props.accessibilityState.checked).toBe(expected)
    expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "#2563eb" })
  },
)

it("CAP.tag.010 maps native live-region/name/role precedence and can be decorative", async () => {
  const { rerender } = await render(
    <Tag
      role="group"
      accessibilityLabel="Native name"
      aria-label="Alias name"
      accessibilityLiveRegion="assertive"
      aria-live="polite"
    />,
  )
  expect(screen.getByRole("group", { name: "Native name" }).props.accessibilityLiveRegion).toBe("assertive")
  await rerender(<Tag role="checkbox" aria-checked={false} aria-disabled aria-selected={false} />)
  expect(screen.getByRole("checkbox").props).toMatchObject({
    "aria-checked": false,
    "aria-disabled": true,
    "aria-selected": false,
  })
  await rerender(<Tag aria-label="Alias name" aria-live="polite" />)
  expect(screen.getByRole("text", { name: "Alias name" }).props.accessibilityLiveRegion).toBe("polite")
  await rerender(<Tag accessible={false} />)
  expect(screen.getByTestId("tag").props.accessible).toBe(false)
})

it("CAP.tag.011 preserves independent active/inactive and static native colors/borders", async () => {
  const { rerender } = await render(
    <Tag color="red" border={{ borderWidth: 2, borderColor: "blue", borderStyle: "dashed" }} />,
  )
  expect(screen.getByTestId("tag")).toHaveStyle({
    backgroundColor: "red",
    borderWidth: 2,
    borderColor: "blue",
    borderStyle: "dashed",
  })
  await rerender(
    <Tag
      pressable
      isPressed={false}
      onPress={() => undefined}
      activeColor="green"
      inactiveColor="pink"
      activeBorder="none"
      inactiveBorder={{ borderWidth: 0, borderColor: "orange" }}
    />,
  )
  expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "pink", borderWidth: 0, borderColor: "orange" })
  await rerender(
    <Tag pressable isPressed onPress={() => undefined} activeColor="green" inactiveColor="pink" activeBorder="none" />,
  )
  expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "green", borderWidth: 0 })
})

it("CAP.tag.012 keeps the live muted-border role independent of control borders and foreground", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <Tag pressable isPressed={false} onPress={() => undefined}>
        Value
      </Tag>
    </NativeThemeProvider>,
  )
  await rerender(
    <NativeThemeProvider
      mode="dark"
      overrides={{
        colors: { controlBackground: "navy", foreground: "orange", controlBorder: "red", borderMuted: "purple" },
        radius: { rounded: 9 },
      }}
    >
      <Tag pressable isPressed={false} onPress={() => undefined}>
        Value
      </Tag>
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "navy", borderColor: "purple", borderRadius: 9 })
  expect(screen.getByText("Value")).toHaveStyle({ color: "orange" })
  await rerender(
    <NativeThemeProvider>
      <Button order="primary">
        <Tag>Owned</Tag>
      </Button>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Owned")).toHaveStyle({ color: "#ffffff" })
})

it.each([0, "0", "", undefined] as const)(
  "CAP.tag.015 preserves exact callback identity %s through repeated owner veto",
  async (id) => {
    const onPress = jest.fn()
    await render(
      <Tag pressable isPressed={false} onPress={onPress} id={id}>
        Choice
      </Tag>,
    )
    await fireEvent.press(screen.getByTestId("tag"), {})
    await fireEvent.press(screen.getByTestId("tag"), {})
    expect(onPress.mock.calls).toEqual([[id], [id]])
    expect(screen.getByTestId("tag").props.accessibilityState.checked).toBe(false)
    expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "#ffffff" })
    expect(screen.getByTestId("tag").props.nativeID).toBe(id === undefined ? undefined : String(id))
  },
)

it("CAP.tag.016 forwards actual native ref/identity/layout/events and consumes every wrapper", async () => {
  const ref = createRef<TNativeTagRef>()
  const onLayout = jest.fn()
  const onPressIn = jest.fn()
  await render(
    <Tag
      ref={ref}
      nativeID="native-tag"
      testID="native-id"
      data-testid="alias"
      id={0}
      pressable
      isPressed={false}
      onPress={() => undefined}
      onLayout={onLayout}
      onPressIn={onPressIn}
      activeColor="green"
      inactiveColor="blue"
      activeBorder="none"
      inactiveBorder="none"
      width={0}
      height={0}
      geometry="round"
      raised
      raisedOnHover
      hoverCursor="pointer"
      backgroundColorTransition={0}
      focusOutline="none"
      outlineOffset={0}
      customStyles={{ color: "red" }}
    />,
  )
  const root = screen.getByTestId("native-id")
  expect(typeof ref.current?.measure).toBe("function")
  expect(root.props.nativeID).toBe("native-tag")
  expect(screen.queryByTestId("alias")).toBeNull()
  const layout = { nativeEvent: { layout: { x: 1, y: 2, width: 0, height: 0 } } }
  await fireEvent(root, "layout", layout)
  expect(onLayout).toHaveBeenCalledWith(layout)
  const target = (Platform.OS === "ios" ? 44 : 48) / 2
  expect(screen.getByTestId("native-id").props.hitSlop).toEqual({
    top: target,
    bottom: target,
    left: target,
    right: target,
  })
  await fireEvent(root, "pressIn", { nativeEvent: { timestamp: 17 } })
  expect(onPressIn).toHaveBeenCalledWith(
    expect.objectContaining({ nativeEvent: expect.objectContaining({ timestamp: 17 }) }),
  )
  for (const prop of [
    "pressable",
    "isPressed",
    "isDisabled",
    "id",
    "width",
    "height",
    "geometry",
    "raised",
    "raisedOnHover",
    "hoverCursor",
    "backgroundColorTransition",
    "focusOutline",
    "outlineOffset",
    "activeColor",
    "inactiveColor",
    "activeBorder",
    "inactiveBorder",
    "customStyles",
    "data-testid",
    "aria-pressed",
  ])
    expect(root.props[prop]).toBeUndefined()
})

it("NATIVE.tag.001 preserves keyed authored state and explicit native hitSlop", async () => {
  const initialize = jest.fn()
  const Child = () => {
    useState(() => initialize())
    return <Text>Authored</Text>
  }
  const { rerender } = await render(
    <Tag pressable isPressed={false} onPress={() => undefined} hitSlop={0}>
      <Child key="retained" />
    </Tag>,
  )
  await rerender(
    <Tag pressable isPressed onPress={() => undefined} hitSlop={0}>
      <Child key="retained" />
    </Tag>,
  )
  expect(initialize).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId("tag").props.hitSlop).toBe(0)
})

it("NATIVE.tag.002 supports dynamic native colors and rejects no channel information by inventing RGB", async () => {
  const color = PlatformColor("systemBlueColor")
  await render(
    <Tag color={color} border={{ borderWidth: 2, borderColor: color }} customStyles={{ color }}>
      Dynamic
    </Tag>,
  )
  expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: color, borderColor: color })
  expect(screen.getByText("Dynamic")).toHaveStyle({ color })
})

it("CAP.tag.013–.014 applies native timing/easing and default color/shadow timing with cleanup", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const stop = jest.fn()
  const timing = jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: jest.fn(), stop, reset: jest.fn() }))
  const { rerender, unmount } = await render(
    <Tag
      color="red"
      raised={false}
      hoverCursor="auto"
      backgroundColorTransition={{ duration: "1s", delay: "20ms", easing: "linear" }}
    >
      Timing
    </Tag>,
  )
  await rerender(
    <Tag
      color="blue"
      raised
      hoverCursor="pointer"
      customStyles={{ color: "purple", borderColor: "green" }}
      backgroundColorTransition={{ duration: "1s", delay: "20ms", easing: "linear" }}
    >
      Timing
    </Tag>,
  )
  const configs = timing.mock.calls.map((call) => call[1])
  expect(
    configs.some((config) => config.duration === 1000 && config.delay === 20 && config.easing?.(0.5) === 0.5),
  ).toBe(true)
  expect(configs.some((config) => config.duration === 250)).toBe(true)
  expect(configs.some((config) => config.duration === 450)).toBe(true)
  expect(configs.every((config) => config.useNativeDriver === false && config.isInteraction === false)).toBe(true)
  expect(screen.getByTestId("tag")).toHaveStyle({ cursor: "pointer" })
  await unmount()
  expect(stop).toHaveBeenCalled()
})

it("NATIVE.tag.003 reaches the authored RGB target after a real core Animated color transition", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const { rerender } = await render(
    <Tag color="red" customStyles={{ color: "red" }}>
      Color
    </Tag>,
  )
  await rerender(
    <Tag color="blue" customStyles={{ color: "blue" }} backgroundColorTransition={50}>
      Color
    </Tag>,
  )
  await act(() => jest.advanceTimersByTime(400))
  const color = StyleSheet.flatten(screen.getByTestId("tag").props.style).backgroundColor
  expect(processColor(color)).toBe(processColor("blue"))
  expect(processColor(StyleSheet.flatten(screen.getByText("Color").props.style).color)).toBe(processColor("blue"))
})

it("NATIVE.tag.003 interrupts RGB transitions at the current frame without jumping to the previous target", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const { rerender } = await render(<Tag color="red" backgroundColorTransition={1000} />)
  await rerender(<Tag color="blue" backgroundColorTransition={1000} />)
  await act(() => jest.advanceTimersByTime(500))
  const before = StyleSheet.flatten(screen.getByTestId("tag").props.style).backgroundColor
  expect(processColor(before)).not.toBe(processColor("red"))
  expect(processColor(before)).not.toBe(processColor("blue"))
  await rerender(<Tag color="green" backgroundColorTransition={1000} />)
  const after = StyleSheet.flatten(screen.getByTestId("tag").props.style).backgroundColor
  expect(processColor(after)).toBe(processColor(before))
  await act(() => jest.advanceTimersByTime(1200))
  expect(processColor(StyleSheet.flatten(screen.getByTestId("tag").props.style).backgroundColor)).toBe(
    processColor("green"),
  )
})

it("NATIVE.tag.003 rejects retired shadow stop callbacks after replacement and unmount", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const pending: ((value: number) => void)[] = []
  jest.spyOn(Animated.Value.prototype, "stopAnimation").mockImplementation((callback) => {
    if (callback) pending.push(callback)
  })
  const timing = jest
    .spyOn(Animated, "timing")
    .mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }))
  const { rerender, unmount } = await render(<Tag raised={false}>Current</Tag>)
  const old = [...pending]
  await rerender(
    <Tag
      raised
      customStyles={{ shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 3, height: 5 }, elevation: 4 }}
    >
      Current
    </Tag>,
  )
  await act(() => old.forEach((callback) => callback(0)))
  expect(timing).not.toHaveBeenCalled()
  await unmount()
  await act(() => pending.forEach((callback) => callback(0)))
  expect(timing).not.toHaveBeenCalled()
})

it("NATIVE.tag.003 respects live Reduce Motion over a late initial query and removes its subscription", async () => {
  let settle: (value: boolean) => void = () => undefined
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(
    new Promise((resolve) => {
      settle = resolve
    }),
  )
  const subscriptionSpy = jest.spyOn(AccessibilityInfo, "addEventListener")
  const timing = jest.spyOn(Animated, "timing")
  const { rerender, unmount } = await render(<Tag color="red" />)
  expect(subscriptionSpy.mock.calls.at(-1)![0]).toBe("reduceMotionChanged")
  const changed = subscriptionSpy.mock.calls.at(-1)![1] as unknown as (value: boolean) => void
  const subscription = subscriptionSpy.mock.results.at(-1)!.value
  await act(() => changed(true))
  await act(() => settle(false))
  await rerender(<Tag color="blue" raised />)
  expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "blue", elevation: 2 })
  expect(timing).not.toHaveBeenCalled()
  await unmount()
  expect(subscription.remove).toHaveBeenCalledTimes(1)
})

it.each([
  ["linear", 128],
  ["ease", 205],
  ["ease-in", 80],
  ["ease-out", 175],
  ["ease-in-out", 128],
] as const)("NATIVE.tag.003 renders the expected midpoint for native easing %s", async (easing, expectedBlue) => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const { rerender } = await render(<Tag color="red" backgroundColorTransition={{ duration: 1000, easing }} />)
  await rerender(<Tag color="blue" backgroundColorTransition={{ duration: 1000, easing }} />)
  await act(() => jest.advanceTimersByTime(500))
  const color = processColor(StyleSheet.flatten(screen.getByTestId("tag").props.style).backgroundColor)
  expect(typeof color).toBe("number")
  const blue = typeof color === "number" ? color & 255 : NaN
  expect(blue).toBeGreaterThanOrEqual(expectedBlue - 6)
  expect(blue).toBeLessThanOrEqual(expectedBlue + 6)
})

it("NATIVE.tag.003 cancels live motion immediately without changing authoritative selection or fabricating a press", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const subscriptions = jest.spyOn(AccessibilityInfo, "addEventListener")
  const onPress = jest.fn()
  const timing = jest.spyOn(Animated, "timing")
  const { rerender } = await render(
    <Tag pressable isPressed={false} onPress={onPress} activeColor="blue" inactiveColor="red" />,
  )
  await rerender(<Tag pressable isPressed onPress={onPress} activeColor="blue" inactiveColor="red" />)
  await act(() => jest.advanceTimersByTime(80))
  const changed = subscriptions.mock.calls.at(-1)![1] as unknown as (value: boolean) => void
  await act(() => changed(true))
  expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "blue" })
  expect(screen.getByRole("button").props.accessibilityState.checked).toBe(true)
  const count = timing.mock.calls.length
  await rerender(<Tag pressable isPressed={false} onPress={onPress} activeColor="blue" inactiveColor="red" />)
  expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "red" })
  expect(timing).toHaveBeenCalledTimes(count)
  expect(onPress).not.toHaveBeenCalled()
})

it("NATIVE.tag.003 remains static when the platform preference query fails", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRejectedValue(new Error("Unavailable"))
  const timing = jest.spyOn(Animated, "timing")
  const { rerender } = await render(<Tag color="red" />)
  await rerender(<Tag color="blue" raised />)
  expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: "blue", elevation: 2 })
  expect(timing).not.toHaveBeenCalled()
})

it("NATIVE.tag.004 consumes forged native aliases before they can replace managed traits", async () => {
  const props = {
    pressable: true,
    isPressed: false,
    isDisabled: false,
    onPress: () => undefined,
    "aria-pressed": "mixed",
    "aria-checked": true,
    "aria-disabled": true,
    role: "checkbox",
  } as unknown as TNativeTagProps
  await render(<Tag {...props} />)
  const root = screen.getByRole("button")
  expect(root.props.accessibilityState).toMatchObject({ checked: "mixed", disabled: false })
  expect(root.props["aria-checked"]).toBeUndefined()
  expect(root.props["aria-disabled"]).toBeUndefined()
  expect(root).not.toBeDisabled()
})

it.each([
  { width: "2rem" },
  { height: -1 },
  { geometry: "triangle" },
  { hoverCursor: "grab" },
  { border: { borderWidth: -1 } },
  { color: "var(--bad)" },
  { customStyles: { color: "var(--bad)" } },
  { focusOutline: { outlineColor: "var(--bad)" } },
  { backgroundColorTransition: -1 },
  { backgroundColorTransition: "background-color 1s linear" },
  { backgroundColorTransition: { easing: "bounce" } },
] as unknown as TNativeTagProps[])("NATIVE.tag.004 rejects invalid native calibration %j", async (props) => {
  await expect(render(<Tag {...props} />)).rejects.toThrow(/Tag:/)
})
