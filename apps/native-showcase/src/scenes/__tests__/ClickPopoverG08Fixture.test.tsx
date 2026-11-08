import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import type { ComponentProps } from "react"
import { AccessibilityInfo, StyleSheet, type View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { Button, ClickPopover } from "@codon-ui/react-native"

import * as Focus from "../../../../../packages/react-native/src/input/focus"
import { POPOVER_STYLE_CASES } from "../ClickPopoverG08Fixture"
import { NativeShowcase } from "../NativeShowcase"

const ReactNative = jest.requireActual<typeof import("react-native")>("react-native")
const hidden = { includeHiddenElements: true }
beforeEach(() => {
  jest.useFakeTimers()
  jest
    .spyOn(ReactNative, "findNodeHandle")
    .mockImplementation((value) => (value == null ? null : typeof value === "number" ? value : 81))
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const state = () => JSON.parse(screen.getByTestId("popover-native-state", hidden).props.accessibilityLabel)
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "ClickPopover scene" }))
  await user.press(screen.getByRole("button", { name: "Prepare standalone ClickPopover checks" }))
  return (name: string) => user.press(screen.getByRole("button", { name, ...hidden }))
}

// Invoke the authored fixture callback only; native action admission remains an installed assertion.
const fixtureAction = async (name: string) => {
  let fiber = screen.getByRole("button", { name, ...hidden }).unstable_fiber
  while (fiber && fiber.elementType !== Button) fiber = fiber.return
  expect(fiber).not.toBeNull()
  await act(() => fiber!.memoizedProps.onPress({ target: 79, currentTarget: 81, nativeEvent: { timestamp: 1 } }))
}
const outsideCallback = () => {
  let fiber = screen.getByTestId("popover-native-surface", hidden).unstable_fiber
  while (fiber && fiber.elementType !== ClickPopover) fiber = fiber.return
  expect(fiber).not.toBeNull()
  return fiber!.memoizedProps.shouldCloseOnInteractOutside as NonNullable<
    ComponentProps<typeof ClickPopover>["shouldCloseOnInteractOutside"]
  >
}

it("snapshots the original Popover outside target synchronously and preserves omitted touch kind and current veto", async () => {
  const press = await enter()
  await press("Set closed owner echo")
  await press("Original popover action")
  expect(state()).toMatchObject({ open: false, requests: [{ value: true }] })
  await press("Set closed owner echo")
  await press("Original popover action")
  expect(state().open).toBe(true)
  const anchor = screen.getByTestId("popover-native-anchor", hidden)
  const surface = screen.getByTestId("popover-native-surface", hidden)
  expect(anchor).toHaveTextContent("Original popover action")
  expect(anchor.props.nativeID).toMatch(/^codon-dialog-trigger-/)
  expect(surface.props.accessibilityLabel).toBe("Native popover")
  expect(surface.props.nativeLabelledBy).toEqual([anchor.props.nativeID])
  expect(surface.props.nativeDescribedBy).toEqual(["popover-native-description"])
  const original = { target: {} as Parameters<ReturnType<typeof outsideCallback>>[0]["target"] }
  await act(() => {
    expect(outsideCallback()(original as Parameters<ReturnType<typeof outsideCallback>>[0])).toBe(true)
    original.target = 0 as unknown as typeof original.target
  })
  expect(state().outside.at(-1)).toMatchObject({ kind: "touch", target: 81 })
  await fixtureAction("Toggle outside veto")
  await act(() => {
    expect(
      outsideCallback()({ ...original, target: 79, kind: "focus" } as unknown as Parameters<
        ReturnType<typeof outsideCallback>
      >[0]),
    ).toBe(false)
  })
  expect(state().outside.at(-1)).toMatchObject({ kind: "focus", target: 79 })
  expect(state().requests).toHaveLength(2)
})

it("prepares every Popover style owner, explicit zero arrow, constrained text and provider restoration", async () => {
  const press = await enter()
  await press("Popover styles")
  await press("Original popover action")
  for (const name of POPOVER_STYLE_CASES) {
    expect(state().case).toBe(name)
    const style = StyleSheet.flatten(screen.getByTestId("popover-native-surface", hidden).props.style)
    expect(style.width).toBe(name === "narrow" ? 128 : 280)
    expect(style.padding).toBe(name === "custom" ? 7 : name === "final" ? 3 : 10)
    expect(state().showArrow).toBe(["custom", "final", "arrow-zero"].includes(name))
    expect(screen.queryByTestId("popover-native-surface-overlay-arrow", hidden) !== null).toBe(state().showArrow)
    if (name === "custom" || name === "final") {
      expect(screen.getByTestId("popover-native-surface-dialog", hidden)).toHaveStyle({ padding: 4, gap: 2 })
      expect(style.borderWidth).toBe(name === "custom" ? 3 : 1)
    }
    if (name === "arrow-zero")
      expect(screen.getByTestId("popover-native-surface-overlay-arrow", hidden)).toHaveStyle({ width: 0 })
    if (name === "narrow")
      expect(screen.getByTestId("popover-native-body", hidden)).toHaveTextContent(
        "Renseignements détaillés entièrement lisibles dans une fenêtre étroite.",
      )
    if (name === "dark") expect(state().palette).toBe("dark")
    if (name === "light-restored") expect(state().palette).toBe("light")
    if (name !== POPOVER_STYLE_CASES.at(-1)) await fixtureAction("Next popover style")
  }
})

it("preserves Popover original action and raw editor snapshots through owner retirement and a fresh lifetime", async () => {
  const press = await enter()
  await press("Popover lifetime")
  await press("Original popover action")
  await fixtureAction("Original content action")
  expect(state()).toMatchObject({ mode: "lifetime", actions: 1 })
  expect(state().events.at(-1)).toEqual({ phase: "action", target: 79, currentTarget: 81 })
  await fireEvent.changeText(screen.getByTestId("popover-native-editor", hidden), "ownerx")
  const original = state().lifetime
  await fixtureAction("Retire popover owner")
  expect(state()).toMatchObject({ mounted: false, value: "ownerx" })
  expect(screen.queryByTestId("popover-native-anchor", hidden)).toBeNull()
  await press("Fresh popover owner")
  expect(state()).toMatchObject({ mounted: true, open: false, lifetime: original + 1, value: "ownerx" })
})

it("measures the original Popover trigger in its native window and rejects stale owner, case and window callbacks", async () => {
  const press = await enter()
  await press("Popover styles")
  await press("Original popover action")
  expect(screen.getByRole("button", { name: "Measure original anchor", ...hidden }).props.focusable).toBe(false)
  const original = screen.getByTestId("popover-native-anchor", hidden)
  let fiber = original.unstable_fiber
  let native: View | null = null
  while (fiber) {
    const candidate = fiber.stateNode as View | null
    if (typeof candidate?.measureInWindow === "function") {
      native = candidate
      break
    }
    fiber = fiber.return
  }
  expect(native).not.toBeNull()
  const callbacks: Parameters<View["measureInWindow"]>[0][] = []
  Object.defineProperty(native, "measureInWindow", {
    configurable: true,
    value: jest.fn((callback) => callbacks.push(callback)),
  })
  const window = jest.spyOn(Focus, "getNativeFocusTargetWindow").mockReturnValue("current-window")
  await fixtureAction("Measure original anchor")
  expect(state().anchorMeasurement).toBeNull()
  await act(() => callbacks.shift()!(55, 636, 280, 44))
  expect(state().anchorMeasurement).toMatchObject({
    target: 81,
    rootTag: 81,
    case: "baseline",
    windowId: "current-window",
    rootWindowId: "current-window",
    frame: [55, 636, 280, 44],
  })
  const first = state().anchorMeasurement
  await fixtureAction("Measure original anchor")
  window.mockReturnValue("replaced-window")
  await act(() => callbacks.shift()!(0, 0, 1, 1))
  expect(state().anchorMeasurement).toEqual(first)
  await fixtureAction("Measure original anchor")
  await fixtureAction("Next popover style")
  await act(() => callbacks.shift()!(0, 0, 1, 1))
  expect(state().anchorMeasurement).toEqual(first)
  await fixtureAction("Measure original anchor")
  await act(() => callbacks.shift()!(55, 636, 280, 44))
  expect(state().anchorMeasurement.case).toBe("custom")
  expect(state().anchorMeasurement.sequence).toBeGreaterThan(first.sequence)
  const current = state().anchorMeasurement
  await fixtureAction("Measure original anchor")
  await fixtureAction("Popover lifetime")
  await act(() => callbacks.shift()!(0, 0, 1, 1))
  expect(state().anchorMeasurement).toEqual(current)
})
