import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, Fragment, useState } from "react"
import { AccessibilityInfo, Animated, Linking, Platform, PlatformColor, processColor, StyleSheet } from "react-native"

import {
  Link,
  NativeThemeProvider,
  Text,
  type LinkProps,
  type TNativeLinkRef,
  type TNativeLinkStyleState,
} from "../../.."
import { resolveNativeTheme } from "../../../theme/defaults"
import { NativeContentContext } from "../../NativeContentContext"

const event = (timestamp = 1) => {
  const value = {
    nativeEvent: { timestamp },
    defaultPrevented: false,
    preventDefault: () => {
      value.defaultPrevented = true
    },
    isDefaultPrevented: () => value.defaultPrevented,
  }
  return value
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("CAP.link.001 renders one native link with owned Text, canonical layout and no button", async () => {
  await render(<Link href="https://example.test">Destination</Link>)
  const root = screen.getByRole("link", { name: "Destination" })
  expect(root).toHaveStyle({ gap: 5, borderRadius: 5, flexDirection: "row", alignItems: "center" })
  expect(screen.queryByRole("button")).toBeNull()
  expect(screen.getByTestId("text")).toHaveStyle({ color: "#171717", textDecorationLine: "none" })
  expect(screen.getByTestId("text").props.selectable).toBe(false)
  expect(Linking.openURL).not.toHaveBeenCalled()
})

it("CAP.link.002 explicit foreground overrides every order state and native opaque colors remain valid", async () => {
  const opaque = PlatformColor("systemBlueColor")
  const { rerender } = await render(
    <Link href="x" order="primary" color="red" isVisited>
      Label
    </Link>,
  )
  await fireEvent(screen.getByTestId("link"), "hoverIn", {})
  await fireEvent(screen.getByTestId("link"), "pressIn", event())
  expect(screen.getByTestId("text")).toHaveStyle({ color: "red" })
  await rerender(
    <Link href="x" color={opaque}>
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ color: opaque })
})

it.each(["light", "dark"] as const)("CAP.link.003–.004 maps every numbered palette in %s mode", async (mode) => {
  const theme = resolveNativeTheme(mode)
  const { rerender } = await render(<Link href="x">Label</Link>)
  for (const order of ["primary", "secondary", "tertiary", "quaternary", "quintenary"] as const) {
    const node = (visited = false) => (
      <NativeThemeProvider mode={mode}>
        <Link href="x" order={order} isVisited={visited}>
          Label
        </Link>
      </NativeThemeProvider>
    )
    await rerender(node())
    expect(screen.getByTestId("text")).toHaveStyle({ color: theme.actions[order].background })
    await rerender(node(true))
    const base = processColor(theme.actions[order].background) as number
    const background = processColor(theme.colors.background) as number
    const mixed = (shift: number) => Math.round(((base >>> shift) & 255) * 0.85 + ((background >>> shift) & 255) * 0.15)
    expect(processColor(StyleSheet.flatten(screen.getByTestId("text").props.style).color)).toBe(
      processColor(`rgb(${mixed(16)}, ${mixed(8)}, ${mixed(0)})`),
    )
    await fireEvent(screen.getByTestId("link"), "hoverIn", {})
    expect(screen.getByTestId("text")).toHaveStyle({ color: theme.actions[order].hoverBackground })
    await fireEvent(screen.getByTestId("link"), "pressIn", event())
    expect(screen.getByTestId("text")).toHaveStyle({ color: theme.actions[order].pressedBackground })
    await fireEvent(screen.getByTestId("link"), "pressOut", event())
    await fireEvent(screen.getByTestId("link"), "hoverOut", {})
  }
})

it("CAP.link.003 retains controlled false visited state after successful and intercepted navigation", async () => {
  const states: TNativeLinkStyleState[] = []
  const { rerender } = await render(
    <Link
      href="x"
      order="primary"
      isVisited={false}
      style={(state) => {
        states.push(state)
        return {}
      }}
    >
      Label
    </Link>,
  )
  await fireEvent.press(screen.getByTestId("link"), event())
  expect(states.at(-1)?.isVisited).toBe(false)
  expect(screen.getByTestId("text")).toHaveStyle({ color: "#2563eb" })
  await rerender(
    <Link href="y" isVisited visitedColor="purple">
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ color: "purple" })
  await rerender(
    <Link href="y" isVisited={false} visitedColor="purple">
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ color: "#171717" })
})

it("CAP.link.002–.004 follows parent foreground and live provider overrides without a palette mutation", async () => {
  const { rerender } = await render(
    <NativeContentContext.Provider value={{ foregroundColor: "orange", isButton: false }}>
      <Link href="x">Label</Link>
    </NativeContentContext.Provider>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ color: "orange" })
  await rerender(
    <NativeThemeProvider
      overrides={{
        actions: { primary: { background: "green", hoverBackground: "purple", pressedBackground: "red" } },
        colors: { background: "black" },
        radius: { rounded: 9 },
        spacing: { unit: 7 },
      }}
    >
      <Link href="x" order="primary">
        Label
      </Link>
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("link")).toHaveStyle({ borderRadius: 9, gap: 7 })
  expect(screen.getByTestId("text")).toHaveStyle({ color: "green" })
  await fireEvent(screen.getByTestId("link"), "hoverIn", {})
  expect(screen.getByTestId("text")).toHaveStyle({ color: "purple" })
})

it("CAP.link.005 maps visible decoration and unvisited-only hover underline", async () => {
  const { rerender } = await render(<Link href="x">Label</Link>)
  await fireEvent(screen.getByTestId("link"), "hoverIn", {})
  expect(screen.getByTestId("text")).toHaveStyle({ textDecorationLine: "underline" })
  await rerender(
    <Link href="x" isVisited>
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ textDecorationLine: "none" })
  await rerender(
    <Link href="x" textDecoration="line-through">
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ textDecorationLine: "line-through" })
})

it("CAP.link.006 retains native focus controls and exact native focus payloads", async () => {
  const onFocus = jest.fn()
  const onBlur = jest.fn()
  const { rerender } = await render(
    <Link href="x" onFocus={onFocus} onBlur={onBlur}>
      Label
    </Link>,
  )
  const payload = { nativeEvent: { target: 17 } }
  await fireEvent(screen.getByTestId("link"), "focus", payload)
  expect(onFocus).toHaveBeenCalledWith(payload)
  expect(screen.getByTestId("link")).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 2, outlineColor: "#2563eb" })
  await rerender(
    <Link href="x" offsetFocusRing={false}>
      Label
    </Link>,
  )
  expect(screen.getByTestId("link")).toHaveStyle({ outlineOffset: 0 })
  await rerender(
    <Link href="x" enableFocusStyle={false} onBlur={onBlur}>
      Label
    </Link>,
  )
  expect(StyleSheet.flatten(screen.getByTestId("link").props.style).outlineWidth).toBeUndefined()
  await fireEvent(screen.getByTestId("link"), "blur", payload)
  expect(onBlur).toHaveBeenCalledWith(payload)
})

it("CAP.link.007 suppresses disabled activation, long press and cancelled held gestures", async () => {
  const onPress = jest.fn()
  const onLongPress = jest.fn()
  const { rerender } = await render(
    <Link href="x" isDisabled onPress={onPress} onLongPress={onLongPress}>
      Label
    </Link>,
  )
  expect(screen.getByRole("link")).toBeDisabled()
  expect(screen.getByTestId("link")).toHaveStyle({ opacity: 0.4 })
  await fireEvent.press(screen.getByTestId("link"), event())
  await fireEvent(screen.getByTestId("link"), "longPress", event())
  await rerender(
    <Link href="x" isDisabled={false} onPress={onPress} onLongPress={onLongPress}>
      Label
    </Link>,
  )
  const held = event(2)
  await fireEvent(screen.getByTestId("link"), "pressIn", held)
  await rerender(<Link href="x" isDisabled onPress={onPress} />)
  await rerender(<Link href="x" isDisabled={false} onPress={onPress} onLongPress={onLongPress} />)
  await fireEvent.press(screen.getByTestId("link"), held)
  expect(onPress).not.toHaveBeenCalled()
  expect(onLongPress).not.toHaveBeenCalled()
  expect(Linking.openURL).not.toHaveBeenCalled()
  await fireEvent(screen.getByTestId("link"), "pressIn", event(3))
  await fireEvent(screen.getByTestId("link"), "longPress", event(3))
  await fireEvent.press(screen.getByTestId("link"), event(3))
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(onLongPress).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).toHaveBeenCalledTimes(1)
})

it("CAP.link.008–.009 splits root typography and preserves registered/array/custom/final callback precedence", async () => {
  const states: TNativeLinkStyleState[] = []
  const custom = StyleSheet.create({ link: { color: "orange", width: 0, fontSize: 18 } })
  await render(
    <Link
      href="x"
      color="red"
      customStyles={[custom.link, { backgroundColor: "green" }]}
      style={(state) => {
        states.push(state)
        return [{ color: "purple", fontSize: 20, backgroundColor: "blue", height: 0 }]
      }}
    >
      <Fragment>
        Owned {0}
        <Text testID="authored" color="lime">
          Authored
        </Text>
      </Fragment>
    </Link>,
  )
  expect(states.at(-1)).toMatchObject({
    foregroundColor: "orange",
    defaultStyle: { color: "orange", width: 0, fontSize: 18, backgroundColor: "green" },
  })
  const root = screen.getByTestId("link")
  expect(root).toHaveStyle({ width: 0, height: 0, backgroundColor: "blue" })
  expect(StyleSheet.flatten(root.props.style).minWidth).toBeUndefined()
  expect(StyleSheet.flatten(root.props.style).fontSize).toBeUndefined()
  expect(screen.getByText("Owned 0")).toHaveStyle({ color: "purple", fontSize: 20 })
  expect(screen.getByTestId("authored")).toHaveStyle({ color: "lime" })
})

it("CAP.link.010 retains aliases, empty native precedence and native descriptive hints", async () => {
  const { rerender } = await render(
    <Link href="x" ariaLabel="Alias" ariaLabelledBy="alias-id" accessibilityHint="Description" data-testid="alias">
      Label
    </Link>,
  )
  expect(screen.getByRole("link", { name: "Alias" }).props.accessibilityLabelledBy).toBe("alias-id")
  expect(screen.getByTestId("alias").props.accessibilityHint).toBe("Description")
  await rerender(
    <Link
      href=""
      accessibilityLabel=""
      aria-label="Native alias"
      ariaLabel="Alias"
      accessibilityLabelledBy=""
      aria-labelledby="native-id"
      ariaLabelledBy="alias-id"
      testID=""
      data-testid="alias"
    />,
  )
  const root = screen.getByTestId("")
  expect(root.props.accessibilityLabel).toBe("")
  expect(root.props.accessibilityLabelledBy).toBe("")
  expect(Linking.openURL).not.toHaveBeenCalled()
})

it("CAP.link.011 consumes all wrapper props and retains actual root refs/layout events and measured hitSlop", async () => {
  const ref = createRef<TNativeLinkRef>()
  const onLayout = jest.fn()
  const props: LinkProps = {
    href: "x",
    color: "red",
    visitedColor: "purple",
    order: "primary",
    isVisited: false,
    isDisabled: false,
    textDecoration: "underline",
    enableFocusStyle: false,
    offsetFocusRing: false,
    customStyles: { margin: 5 },
    style: { padding: 0 },
    ariaLabel: "Alias",
    ariaLabelledBy: "label",
    onNavigationError: jest.fn(),
  }
  const { rerender } = await render(
    <Link {...props} ref={ref} nativeID="native" onLayout={onLayout}>
      Label
    </Link>,
  )
  expect(ref.current).toBeTruthy()
  const original = ref.current
  const payload = { nativeEvent: { layout: { x: 2, y: 3, width: 20, height: 10 } } }
  await fireEvent(screen.getByTestId("link"), "layout", payload)
  expect(onLayout).toHaveBeenCalledWith(payload)
  expect(screen.getByTestId("link").props.hitSlop).toEqual({ left: 12, right: 12, top: 17, bottom: 17 })
  const root = screen.getByTestId("link")
  for (const key of Object.keys(props)) if (key !== "style") expect(root.props[key]).toBeUndefined()
  expect(root.props.nativeID).toBe("native")
  await rerender(<Link href="y" ref={ref} hitSlop={0} />)
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("link").props.hitSlop).toBe(0)
})

it("NATIVE.link.navigation preserves the original native event and calls the owner before one exact URL handoff", async () => {
  const sequence: string[] = []
  jest.mocked(Linking.openURL).mockImplementation(async (href) => {
    sequence.push(href)
  })
  const payload = event()
  const onPress = jest.fn((_event: unknown) => sequence.push("owner"))
  await render(
    <Link href="custom:exact?value=0&empty=" onPress={onPress}>
      Label
    </Link>,
  )
  await fireEvent(screen.getByTestId("link"), "press", payload)
  expect(onPress.mock.calls[0][0]).toBe(payload)
  expect(sequence).toEqual(["owner", "custom:exact?value=0&empty="])
})

it.each(["", "#section", "/relative", "https://example.test"])(
  "NATIVE.link.navigation honors repeated owner veto for %s without visited mutation",
  async (href) => {
    const onPress = jest.fn((payload: { preventDefault: () => void }) => payload.preventDefault())
    await render(
      <Link href={href} isVisited={false} onPress={onPress}>
        Label
      </Link>,
    )
    await fireEvent.press(screen.getByTestId("link"), event(1))
    await fireEvent.press(screen.getByTestId("link"), event(2))
    expect(onPress).toHaveBeenCalledTimes(2)
    expect(Linking.openURL).not.toHaveBeenCalled()
  },
)

it.each(["sync", "async"])(
  "NATIVE.link.navigation reports %s failures once with the originating target",
  async (mode) => {
    const failure = new Error("Unavailable destination")
    if (mode === "sync")
      jest.mocked(Linking.openURL).mockImplementation(() => {
        throw failure
      })
    else jest.mocked(Linking.openURL).mockRejectedValue(failure)
    const onNavigationError = jest.fn()
    await render(
      <Link href="" onNavigationError={onNavigationError}>
        Label
      </Link>,
    )
    await fireEvent.press(screen.getByTestId("link"), event())
    expect(onNavigationError).toHaveBeenCalledTimes(1)
    expect(onNavigationError).toHaveBeenCalledWith(failure, "")
  },
)

it("NATIVE.link.navigation retains pending error provenance across target changes and retires it at unmount", async () => {
  let reject: (reason: unknown) => void = () => undefined
  jest.mocked(Linking.openURL).mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  )
  const firstError = jest.fn()
  const nextError = jest.fn()
  const { rerender, unmount } = await render(
    <Link href="first" onNavigationError={firstError}>
      Label
    </Link>,
  )
  await fireEvent.press(screen.getByTestId("link"), event())
  await rerender(
    <Link href="next" onNavigationError={nextError}>
      Label
    </Link>,
  )
  await act(async () => reject("original failure"))
  expect(firstError).toHaveBeenCalledWith("original failure", "first")
  expect(nextError).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId("link"), event(2))
  await unmount()
  await act(async () => reject("retired failure"))
  expect(nextError).not.toHaveBeenCalled()
})

it("NATIVE.link.navigation diagnoses an unhandled URL failure without an unhandled promise", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
  jest.mocked(Linking.openURL).mockRejectedValue("failure")
  await render(<Link href="bad">Label</Link>)
  await fireEvent.press(screen.getByTestId("link"), event())
  expect(warn).toHaveBeenCalledWith('Link: unable to open "bad"', "failure")
})

it("NATIVE.link.children preserves authored keyed lifetime across content regrouping", async () => {
  const Child = () => {
    const [count, setCount] = useState(0)
    return (
      <Text testID="counter" onPress={() => setCount((value) => value + 1)}>
        {count}
      </Text>
    )
  }
  const { rerender } = await render(
    <Link href="x">
      Before
      <Child key="child" />
    </Link>,
  )
  await fireEvent.press(screen.getByTestId("counter"))
  await rerender(
    <Link href="x">
      Changed
      <Child key="child" />
      After
    </Link>,
  )
  expect(screen.getByTestId("counter")).toHaveTextContent("1")
})

it("NATIVE.link.motion interpolates actual eased foreground, retargets from the current color and cancels on live Reduce Motion", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const subscriptionSpy = jest.spyOn(AccessibilityInfo, "addEventListener")
  const removalSpy = jest.spyOn(Animated.Value.prototype, "removeListener")
  const { rerender, unmount } = await render(
    <Link href="x" color="black">
      Label
    </Link>,
  )
  await rerender(
    <Link href="x" color="white">
      Label
    </Link>,
  )
  await act(async () => jest.advanceTimersByTime(64))
  const middle = processColor(StyleSheet.flatten(screen.getByTestId("text").props.style).color) as number
  expect(middle & 255).toBeGreaterThan(128)
  expect(middle & 255).toBeLessThan(255)
  await rerender(
    <Link href="x" color="red">
      Label
    </Link>,
  )
  expect(processColor(StyleSheet.flatten(screen.getByTestId("text").props.style).color)).toBe(middle)
  await act(async () => jest.advanceTimersByTime(150))
  expect(screen.getByTestId("text")).toHaveStyle({ color: "red" })
  await rerender(
    <Link href="x" color="blue">
      Label
    </Link>,
  )
  const changed = subscriptionSpy.mock.calls.at(-1)![1] as unknown as (value: boolean) => void
  const subscription = subscriptionSpy.mock.results.at(-1)!.value
  await act(() => changed(true))
  expect(screen.getByTestId("text")).toHaveStyle({ color: "blue" })
  await unmount()
  expect(subscription.remove).toHaveBeenCalledTimes(1)
  expect(removalSpy).toHaveBeenCalledTimes(3)
})

it("NATIVE.link.motion keeps pending/unavailable preferences static and newer live events beat old queries", async () => {
  let resolve: (value: boolean) => void = () => undefined
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const subscriptionSpy = jest.spyOn(AccessibilityInfo, "addEventListener")
  const timing = jest.spyOn(Animated, "timing")
  const { rerender } = await render(
    <Link href="x" color="red">
      Label
    </Link>,
  )
  await rerender(
    <Link href="x" color="blue">
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ color: "blue" })
  const changed = subscriptionSpy.mock.calls.at(-1)![1] as unknown as (value: boolean) => void
  await act(() => changed(true))
  await act(async () => resolve(false))
  await rerender(
    <Link href="x" color="green">
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ color: "green" })
  expect(timing).not.toHaveBeenCalled()
})

it("NATIVE.link.motion snaps opaque native colors and an unavailable preference without scheduling work", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRejectedValue(new Error("Unavailable"))
  const timing = jest.spyOn(Animated, "timing")
  const { rerender } = await render(<Link href="x">Label</Link>)
  const opaque = PlatformColor("systemBlueColor")
  await rerender(
    <Link href="x" color={opaque}>
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ color: opaque })
  expect(timing).not.toHaveBeenCalled()
})

it("NATIVE.link.guard owns native semantics even for an untyped conflicting spread", async () => {
  const forged = {
    role: "button",
    accessibilityRole: "button",
    disabled: true,
    accessible: false,
    "aria-disabled": true,
    accessibilityState: { disabled: true },
  } as unknown as LinkProps
  await render(
    <Link {...forged} href="x" isDisabled={false}>
      Label
    </Link>,
  )
  expect(screen.getByRole("link")).not.toBeDisabled()
  expect(screen.queryByRole("button")).toBeNull()
  expect(screen.getByTestId("link").props.accessible).toBe(true)
})

it.each(["ios", "android"] as const)(
  "NATIVE.link.target uses the platform target on %s without overriding explicit geometry",
  async (platform) => {
    jest.replaceProperty(Platform, "OS", platform)
    const { rerender } = await render(<Link href="x">Label</Link>)
    expect(screen.getByTestId("link")).toHaveStyle({
      minWidth: platform === "ios" ? 44 : 48,
      minHeight: platform === "ios" ? 44 : 48,
    })
    await rerender(
      <Link href="x" style={{ width: 0, height: 0 }}>
        Label
      </Link>,
    )
    expect(screen.getByTestId("link")).toHaveStyle({ width: 0, height: 0 })
    expect(StyleSheet.flatten(screen.getByTestId("link").props.style).minHeight).toBeUndefined()
  },
)

it("NATIVE.link.motion cancels replaced/unmounted animations and ignores retired completion callbacks", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const completions: ((result: { finished: boolean }) => void)[] = []
  const stop = jest.fn()
  jest.spyOn(Animated, "timing").mockImplementation(() => ({
    start: (completion) => {
      if (completion) completions.push(completion)
    },
    stop,
    reset: jest.fn(),
  }))
  const { rerender, unmount } = await render(
    <Link href="x" color="black">
      Label
    </Link>,
  )
  await rerender(
    <Link href="x" color="white">
      Label
    </Link>,
  )
  await rerender(
    <Link href="x" color="red">
      Label
    </Link>,
  )
  expect(stop).toHaveBeenCalledTimes(1)
  await act(() => completions[0]({ finished: true }))
  expect(screen.getByTestId("text")).toHaveStyle({ color: "black" })
  await unmount()
  expect(stop).toHaveBeenCalledTimes(2)
  await act(() => completions[1]({ finished: true }))
})

it("NATIVE.link.motion snaps opaque native colors even when motion is enabled", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timing = jest.spyOn(Animated, "timing")
  const { rerender } = await render(
    <Link href="x" color="red">
      Label
    </Link>,
  )
  const opaque = PlatformColor("systemBlueColor")
  await rerender(
    <Link href="x" color={opaque}>
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ color: opaque })
  await rerender(
    <Link href="x" color="blue">
      Label
    </Link>,
  )
  expect(screen.getByTestId("text")).toHaveStyle({ color: "blue" })
  expect(timing).not.toHaveBeenCalled()
})

it("NATIVE.link.focus preserves explicit false focusability while the disabled guard remains authoritative", async () => {
  const { rerender } = await render(
    <Link href="x" focusable={false}>
      Label
    </Link>,
  )
  expect(screen.getByTestId("link").props.focusable).toBe(false)
  await rerender(
    <Link href="x" focusable isDisabled>
      Label
    </Link>,
  )
  expect(screen.getByTestId("link").props.focusable).toBe(false)
})

it("NATIVE.link.palette mixes transparent visited roles with premultiplied alpha", async () => {
  await render(
    <NativeThemeProvider
      overrides={{ actions: { primary: { background: "transparent" } }, colors: { background: "white" } }}
    >
      <Link href="x" order="primary" isVisited>
        Label
      </Link>
    </NativeThemeProvider>,
  )
  expect(processColor(StyleSheet.flatten(screen.getByTestId("text").props.style).color)).toBe(
    processColor("rgba(255, 255, 255, 0.15)"),
  )
})
