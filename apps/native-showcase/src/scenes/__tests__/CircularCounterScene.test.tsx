import { act, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo, Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const hidden = { includeHiddenElements: true }
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Circular/Counter scene")
  return press
}

it("retains caller-owned zero and rounded threshold status through theme/window changes", async () => {
  const press = await enter()
  expect(screen.getByRole("progressbar", { name: "Circular task progress" })).toHaveAccessibilityValue({ now: 25 })
  await press("Set rounded warning threshold")
  expect(screen.getByTestId("counter-demo-value")).toHaveStyle({ color: "#a66b00" })
  await press("Set rounded danger threshold")
  expect(screen.getByTestId("counter-demo-value")).toHaveStyle({ color: "#b73434" })
  await press("Zero circular value")
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
    expect(screen.getByTestId("counter-demo-value").props.children).toBe(0)
    expect(screen.getByRole("progressbar", { name: "Circular task progress" })).toHaveAccessibilityValue({
      now: 0,
      text: "0%",
    })
    expect(screen.getByTestId("circular-counter-state")).toHaveTextContent(/Value: 0\. Counter: 0/)
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("exposes actual geometry/caps/order, six plus three style owners and unknown semantics", async () => {
  const press = await enter()
  await press("Toggle circular ratio")
  await press("Reverse circular direction")
  await press("Next circular cap")
  await press("Next circular order")
  expect(screen.getByTestId("circular-counter-state")).toHaveTextContent(
    /Ratio: half\. Direction: counter-clockwise\. Cap: round\. Order: primary/,
  )
  expect(screen.getByTestId("circular-demo-path", hidden).props.strokeDashoffset).toBeCloseTo(-0.875 * 2 * Math.PI * 46)
  await press("Toggle circular and counter styles")
  expect(screen.getByTestId("circular-demo")).toHaveStyle({ opacity: 0.85 })
  expect(screen.getByTestId("circular-demo-path", hidden).props).toMatchObject({
    strokeWidth: 8,
    stroke: { payload: 0xff2f7d18 },
  })
  expect(screen.getByTestId("circular-demo-track", hidden).props.strokeWidth).toBe(4)
  expect(screen.getByTestId("counter-demo")).toHaveStyle({ padding: 8, borderWidth: 1 })
  expect(screen.getByTestId("counter-demo-progress")).toHaveStyle({ width: 20, height: 20 })
  await press("Toggle circular unknown semantics")
  expect(
    screen.getByRole("progressbar", { name: "Circular task progress" }).props.accessibilityValue.now,
  ).toBeUndefined()
  expect(screen.getByRole("progressbar", { name: "Task count Progress" })).toHaveAccessibilityValue({ now: 25 })
})

it("distinguishes numeric/string max zero and retains raw nonnumeric text then resets", async () => {
  const press = await enter()
  await press("Next counter max")
  expect(screen.queryByTestId("counter-demo-max")).toBeNull()
  expect(screen.queryByTestId("counter-demo-progress")).toBeNull()
  await press("Next counter max")
  expect(screen.getByTestId("counter-demo-max")).toHaveTextContent("/0")
  expect(screen.getByTestId("counter-demo-progress")).toBeOnTheScreen()
  await press("Toggle raw counter text")
  expect(screen.getByTestId("counter-demo-value")).toHaveTextContent("not numeric")
  expect(screen.getByTestId("counter-demo-progress-track", hidden)).toBeOnTheScreen()
  expect(screen.queryByTestId("counter-demo-progress-path", hidden)).toBeNull()
  await press("Toggle counter max suffix")
  await press("Toggle counter ring")
  expect(screen.queryByTestId("counter-demo-max")).toBeNull()
  expect(screen.queryByTestId("counter-demo-progress")).toBeNull()
  await press("Reset scene")
  await press("Circular/Counter scene")
  expect(screen.getByTestId("circular-counter-state")).toHaveTextContent(
    /Value: 25\. Counter: 25\. Max: 100 \(number\).*Ratio: full.*forward.*butt.*semantic/,
  )
})

it("cycles all semantic label shapes without mounting them or changing the owner value and visible text", async () => {
  const press = await enter()
  const cases = [
    ["automatic", "25%"],
    ["null", "25%"],
    ["false", "25%"],
    ["empty", "25%"],
    ["numeric zero", "25%"],
    ["bigint zero", "25%"],
    ["numeric label", "4"],
    ["bigint label", "4"],
    ["string zero", "0"],
    ["true", "true"],
    ["text", "One quarter"],
    ["array", "1, of ,4"],
    ["fragment", "[object Object]"],
    ["element", "[object Object]"],
    ["promise", "[object Promise]"],
  ] as const
  for (const [index, [name, text]] of cases.entries()) {
    if (index) await press("Next circular value label")
    expect(screen.getByTestId("circular-value-label-state")).toHaveTextContent(`Value label: ${name}.`)
    expect(screen.getByRole("progressbar", { name: "Circular task progress" })).toHaveAccessibilityValue({
      now: 25,
      text,
    })
    expect(screen.getByTestId("counter-demo-value").props.children).toBe(25)
    expect(screen.getByTestId("circular-demo-text", hidden).children).toEqual(
      expect.arrayContaining([expect.objectContaining({ props: expect.objectContaining({ content: "25%" }) })]),
    )
    expect(screen.queryByText("Value label nodes remain unmounted")).toBeNull()
  }
})

it("retains label mode and owner zero through live theme/window changes and indeterminate transitions until reset", async () => {
  const press = await enter()
  for (let index = 0; index < 13; index += 1) await press("Next circular value label")
  await press("Zero circular value")
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
    expect(screen.getByTestId("circular-value-label-state")).toHaveTextContent("Value label: element.")
    expect(screen.getByRole("progressbar", { name: "Circular task progress" })).toHaveAccessibilityValue({
      now: 0,
      text: "[object Object]",
    })
    expect(screen.getByTestId("counter-demo-value").props.children).toBe(0)
    await press("Toggle circular unknown semantics")
    expect(
      screen.getByRole("progressbar", { name: "Circular task progress" }).props.accessibilityValue.text,
    ).toBeUndefined()
    await press("Toggle circular unknown semantics")
    expect(screen.getByRole("progressbar", { name: "Circular task progress" })).toHaveAccessibilityValue({
      now: 0,
      text: "[object Object]",
    })
    await press("Reset scene")
    await press("Circular/Counter scene")
    expect(screen.getByTestId("circular-value-label-state")).toHaveTextContent("Value label: automatic.")
    expect(screen.getByRole("progressbar", { name: "Circular task progress" })).toHaveAccessibilityValue({
      now: 25,
      text: "25%",
    })
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})
