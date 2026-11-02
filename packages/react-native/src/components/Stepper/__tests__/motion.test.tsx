import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PlatformColor,
  processColor,
  StyleSheet,
  type ColorValue,
} from "react-native"

import { NativeThemeProvider, Stepper, type TNativeStepperRef } from "../../.."
import { resolveNativeTheme } from "../../../theme/defaults"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))
const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const root = () => screen.getByTestId("stepper")
const group = () => screen.getByTestId("stepper-group")
const input = () => screen.getByTestId("stepper-input")
const plus = () => screen.getByRole("button", { name: names.incrementLabel })
const style = (node: ReturnType<typeof root>) => StyleSheet.flatten(node.props.style)
const glyph = () => plus().queryAll((node) => node.props.style?.width === 15 && node.props.style?.height === 2)[0]
const advance = (milliseconds: number) => act(() => jest.advanceTimersByTime(milliseconds))
const painted = () => ({
  rootBorder: style(root()).borderColor,
  groupBorder: style(group()).borderColor,
  inputColor: style(input()).color,
  inputBorder: style(input()).borderColor,
  buttonBorder: style(plus()).borderColor,
  glyph: glyph().props.style.backgroundColor,
})
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 17)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("uses250ms ease-in-out on the actual foreground/border owners while background and logical value change immediately", async () => {
  const ref = createRef<TNativeStepperRef>(),
    changed = jest.fn(),
    timing = jest.spyOn(Animated, "timing")
  const tree = (white = false) => {
    const color = white ? "#ffffff" : "#000000"
    return (
      <NativeThemeProvider
        overrides={{ colors: { controlForeground: color }, actions: { primary: { border: color } } }}
      >
        <Stepper
          {...names}
          ref={ref}
          value={0}
          onChange={changed}
          type="cohesive"
          colorMode="outline"
          order="primary"
          customStyles={{ borderWidth: 1, borderColor: color }}
          customGroupStyles={{ backgroundColor: white ? "#445566" : "#112233" }}
          customButtonStyles={{ borderColor: color }}
        />
      </NativeThemeProvider>
    )
  }
  const { rerender } = await render(tree())
  const original = ref.current
  timing.mockClear()
  await rerender(tree(true))
  for (const color of Object.values(painted())) expect(processColor(color)).toBe(processColor("#000000"))
  expect(style(group()).backgroundColor).toBe("#445566")
  expect(style(root()).color).toBeUndefined()
  expect(style(group()).color).toBeUndefined()
  const configs = timing.mock.calls.map((call) => call[1])
  expect(configs.length).toBeGreaterThan(0)
  for (const config of configs) {
    expect(config).toMatchObject({ duration: 250, delay: 0, useNativeDriver: false, isInteraction: false })
    for (const fraction of [0.1, 0.25, 0.5, 0.75, 0.9])
      expect(config.easing!(fraction)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(fraction), 6)
  }
  await advance(125)
  for (const color of Object.values(painted())) {
    expect(processColor(color)).not.toBe(processColor("#000000"))
    expect(processColor(color)).not.toBe(processColor("#ffffff"))
  }
  expect(processColor(painted().inputColor)).toBe(processColor(painted().glyph))
  await advance(150)
  for (const color of Object.values(painted())) expect(color).toBe("#ffffff")
  expect(ref.current).toBe(original)
  expect(input()).toHaveDisplayValue("0")
  expect(changed).not.toHaveBeenCalled()
})

it("honors separate theme color/border durations,delay and easing without introducing background clocks", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const tree = (white = false) => (
    <NativeThemeProvider
      overrides={{
        transitions: {
          color: { duration: 100, delay: 30, easing: "ease-in" },
          borderColor: { duration: 200, delay: 50, easing: "linear" },
        },
      }}
    >
      <Stepper
        {...names}
        value={0}
        customInputStyles={{ color: white ? "#ffffff" : "#000000" }}
        customGroupStyles={{ borderColor: white ? "#ffffff" : "#000000" }}
      />
    </NativeThemeProvider>
  )
  const { rerender } = await render(tree())
  timing.mockClear()
  await rerender(tree(true))
  const configs = timing.mock.calls.map((call) => call[1])
  expect(configs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ duration: 100, delay: 30 }),
      expect.objectContaining({ duration: 200, delay: 50 }),
    ]),
  )
  expect(configs.every((config) => config.duration === 100 || config.duration === 200)).toBe(true)
  expect(configs.find((config) => config.duration === 200)!.easing!(0.25)).toBe(0.25)
  expect(configs.find((config) => config.duration === 100)!.easing!(0.25)).toBeCloseTo(
    Easing.bezier(0.42, 0, 1, 1)(0.25),
    6,
  )
  await advance(150)
  expect(painted().inputColor).toBe("#ffffff")
  expect(processColor(painted().groupBorder)).not.toBe(processColor("#ffffff"))
  await advance(125)
  expect(painted().groupBorder).toBe("#ffffff")
})

it("routes root/group foreground fallbacks to Input and glyph while preserving final owner overrides", async () => {
  const tree = (groupColor: ColorValue, custom = false) => (
    <Stepper
      {...names}
      value={0}
      customStyles={{ color: "red" }}
      customGroupStyles={{ color: groupColor }}
      customInputStyles={custom ? { color: "lime" } : undefined}
      customButtonStyles={custom ? { color: "yellow" } : undefined}
    />
  )
  const { rerender } = await render(tree("#000000"))
  expect(painted().inputColor).toBe("#000000")
  expect(painted().glyph).toBe("#000000")
  await rerender(tree("#ffffff"))
  await advance(125)
  expect(processColor(painted().inputColor)).not.toBe(processColor("#ffffff"))
  await advance(150)
  expect(painted().inputColor).toBe("#ffffff")
  expect(painted().glyph).toBe("#ffffff")
  await rerender(tree("purple", true))
  await advance(275)
  expect(painted().inputColor).toBe("lime")
  expect(painted().glyph).toBe("yellow")
  expect(style(root()).color).toBeUndefined()
  expect(style(group()).color).toBeUndefined()
  await rerender(
    <Stepper
      {...names}
      value={0}
      type="cohesive"
      customStyles={{ color: "red" }}
      customGroupStyles={{ color: "purple" }}
    />,
  )
  await advance(275)
  expect(painted().inputColor).toBe(resolveNativeTheme("light").colors.controlBackground)
  expect(painted().glyph).toBe(resolveNativeTheme("light").colors.controlBackground)
})

it("retains error precedence and literal custom border ownership after the canonical clock", async () => {
  const { rerender } = await render(<Stepper {...names} value={0} type="cohesive" colorMode="outline" />)
  const before = painted().groupBorder
  await rerender(
    <Stepper {...names} value={0} type="cohesive" colorMode="outline" errorState warningState successState />,
  )
  expect(processColor(painted().groupBorder)).toBe(processColor(before))
  await advance(125)
  expect(processColor(painted().groupBorder)).not.toBe(processColor(before))
  await advance(150)
  expect(painted().groupBorder).toBe(resolveNativeTheme("light").colors.validationErrorBorder)
  await rerender(
    <Stepper
      {...names}
      value={0}
      type="cohesive"
      colorMode="outline"
      errorState
      customGroupStyles={{ borderColor: "blue" }}
    />,
  )
  await advance(275)
  expect(painted().groupBorder).toBe("blue")
})

it("passes opaque and undefined endpoints through literally and does not revive paint across an ownership gap", async () => {
  const tree = (color: ColorValue | undefined) => (
    <Stepper
      {...names}
      value={0}
      customStyles={{ borderWidth: 1, borderColor: color }}
      customGroupStyles={{ borderColor: color }}
      customInputStyles={{ color, borderColor: color }}
      customButtonStyles={{ color, borderColor: color }}
    />
  )
  const timing = jest.spyOn(Animated, "timing"),
    opaque = PlatformColor("labelColor")
  const { rerender } = await render(tree("#000000"))
  timing.mockClear()
  await rerender(tree(opaque))
  for (const color of Object.values(painted())) expect(color).toBe(opaque)
  expect(timing).not.toHaveBeenCalled()
  await rerender(tree(undefined))
  const { glyph: _nativeButtonFallback, ...unset } = painted()
  for (const color of Object.values(unset)) expect(color).toBeUndefined()
  timing.mockClear()
  await rerender(tree("#ff0000"))
  for (const color of Object.values(painted())) expect(color).toBe("#ff0000")
  expect(timing).not.toHaveBeenCalled()
})

it("retargets from current paint and never completes an interrupted endpoint", async () => {
  const tree = (color: string) => (
    <Stepper {...names} value={0} customInputStyles={{ color }} customButtonStyles={{ color }} />
  )
  const { rerender } = await render(tree("#ff0000"))
  await rerender(tree("#00ff00"))
  await advance(100)
  const interrupted = painted()
  await rerender(tree("#0000ff"))
  for (const [owner, color] of Object.entries(painted()))
    expect(processColor(color)).toBe(processColor(interrupted[owner as keyof typeof interrupted]))
  await advance(275)
  expect(painted().inputColor).toBe("#0000ff")
  expect(painted().glyph).toBe("#0000ff")
  await advance(500)
  expect(painted().inputColor).toBe("#0000ff")
})

it("honors live Reduce Motion and cleans up interrupted clocks/subscriptions on unmount", async () => {
  const listeners = jest.spyOn(AccessibilityInfo, "addEventListener"),
    timing = jest.spyOn(Animated, "timing")
  const tree = (color: string) => <Stepper {...names} value={0} customInputStyles={{ color }} />
  const { rerender, unmount } = await render(tree("#000000"))
  await rerender(tree("#ffffff"))
  await advance(100)
  const stop = jest.spyOn(timing.mock.results.at(-1)!.value, "stop")
  await act(() =>
    (listeners.mock.calls as unknown as [string, (value: boolean) => void][])
      .filter(([name]) => name === "reduceMotionChanged")
      .forEach(([, callback]) => callback(true)),
  )
  expect(painted().inputColor).toBe("#ffffff")
  expect(stop).toHaveBeenCalled()
  await act(() =>
    (listeners.mock.calls as unknown as [string, (value: boolean) => void][])
      .filter(([name]) => name === "reduceMotionChanged")
      .forEach(([, callback]) => callback(false)),
  )
  await rerender(tree("#00ff00"))
  const lastStop = jest.spyOn(timing.mock.results.at(-1)!.value, "stop")
  const subscriptionIndex = (listeners.mock.calls as unknown as [string, unknown][]).findIndex(
    ([name]) => name === "reduceMotionChanged",
  )
  expect(subscriptionIndex).toBeGreaterThanOrEqual(0)
  const remove = jest.spyOn(listeners.mock.results[subscriptionIndex].value, "remove")
  await unmount()
  expect(lastStop).toHaveBeenCalled()
  expect(remove).toHaveBeenCalled()
  await advance(500)
})

it("keeps the original ref and admitted600/60 press lease while theme paint and callbacks update", async () => {
  const ref = createRef<TNativeStepperRef>(),
    oldOwner = jest.fn(),
    newOwner = jest.fn()
  const tree = (white = false) => (
    <Stepper
      {...names}
      ref={ref}
      value={0}
      type="cohesive"
      onChange={white ? newOwner : oldOwner}
      customInputStyles={{ color: white ? "#ffffff" : "#000000" }}
      customButtonStyles={{ color: white ? "#ffffff" : "#000000" }}
    />
  )
  const { rerender } = await render(tree())
  const original = ref.current
  for (const ready of [false, true]) {
    const props = root().props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "motion-window",
          epoch: 1,
          policyRevision: props.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  const event = {
    persist: () => undefined,
    target: 17,
    currentTarget: 17,
    nativeEvent: { target: 17, timestamp: 1, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
  }
  await fireEvent(plus(), "responderGrant", event)
  await advance(300)
  await rerender(tree(true))
  await advance(300)
  await advance(60)
  expect(oldOwner).not.toHaveBeenCalled()
  expect(newOwner.mock.calls).toEqual([[1], [1]])
  await fireEvent(plus(), "responderRelease", event)
  await advance(500)
  expect(newOwner).toHaveBeenCalledTimes(2)
  expect(ref.current).toBe(original)
  expect(input()).toHaveDisplayValue("0")
})
