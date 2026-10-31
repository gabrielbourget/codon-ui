import "./intrinsicNativeModel"

import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useEffect, useState } from "react"
import { AccessibilityInfo, Text, type View } from "react-native"

import { NativeThemeProvider, ToggleSwitcher } from "../../.."
import { NativeFocusHost } from "../../../input/NativeFocusView"

import { ToggleSwitcherFixture } from "./fixtures/ToggleSwitcherFixture"
import {
  commitIntrinsicNativeTree,
  intrinsicWidths,
  intrinsicOriginal,
  intrinsicEvaluationResult,
  nativeEvaluations,
} from "./intrinsicNativeModel"

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
const deliverLayout = (id: string, width: number, height = 44) =>
  fireEvent(screen.getByTestId(id), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height } } })

const seedLayout = async (widths = [60, 88]) => {
  const options = screen.getAllByTestId("toggle-switcher-option"),
    labels = screen.getAllByTestId("toggle-switcher-label")
  await deliverLayout("toggle-switcher", 156, 50)
  await deliverLayout("toggle-switcher-row", 150)
  for (const [index, node] of options.entries())
    await fireEvent(node, "layout", {
      nativeEvent: { layout: { x: index * 62, y: 0, width: widths[index], height: 44 } },
    })
  for (const [index, node] of labels.entries())
    await fireEvent(node, "layout", {
      nativeEvent: { layout: { x: 5, y: 2, width: Math.max(0, widths[index] - 10), height: 16 } },
    })
}
const choices = [
  { id: "and", label: "First", accessibilityLabel: "First choice" },
  { id: "or", label: "Second", accessibilityLabel: "Second choice" },
]
const holdNext = () => {
  let release!: () => void
  nativeEvaluations.mockImplementationOnce((encoded: string) => {
    const result = intrinsicEvaluationResult(encoded, 999)
    return new Promise<string>((resolve) => {
      release = () => resolve(result)
    })
  })
  return async () => {
    await act(async () => {
      release()
      for (let i = 0; i < 12; i++) await Promise.resolve()
    })
  }
}

it("updates equal-column natural width after an opaque original label changes inside the same constrained native frame", async () => {
  let complete!: (value: string) => void
  const response = new Promise<string>((resolve) => {
    complete = resolve
  })
  const initialized = jest.fn(),
    change = jest.fn(),
    root = createRef<View>(),
    label = createRef<React.ElementRef<typeof Text>>()
  const AuthoredLabel = () => {
    useState(() => initialized())
    const [text, setText] = useState("Short")
    useEffect(() => {
      let live = true
      void response.then((value) => {
        if (live) setText(value)
      })
      return () => {
        live = false
      }
    }, [])
    return (
      <Text ref={label} numberOfLines={1}>
        {text}
      </Text>
    )
  }
  const items = [
    { id: "and", label: <AuthoredLabel />, accessibilityLabel: "First choice" },
    { id: "or", label: "Second", accessibilityLabel: "Second choice" },
  ]
  intrinsicWidths.set("First choice", 60)
  intrinsicWidths.set("Second choice", 88)
  const view = await render(
    <NativeThemeProvider>
      <ToggleSwitcher ref={root} items={items} selectedKey="and" onSelectionChange={change} />
    </NativeThemeProvider>,
  )
  const originalRoot = root.current,
    originalLabel = label.current
  const options = screen.getAllByTestId("toggle-switcher-option"),
    labels = screen.getAllByTestId("toggle-switcher-label")
  await deliverLayout("toggle-switcher", 156, 50)
  await deliverLayout("toggle-switcher-row", 150)
  for (const [index, node] of options.entries())
    await fireEvent(node, "layout", {
      nativeEvent: { layout: { x: index * 62, y: 0, width: [60, 88][index], height: 44 } },
    })
  for (const [index, node] of labels.entries())
    await fireEvent(node, "layout", { nativeEvent: { layout: { x: 5, y: 2, width: [50, 78][index], height: 16 } } })
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 184 })
  expect(screen.getByRole("button", { name: "First choice" }).props.nativeMotionGeometryObserveFrames).toBe(false)
  const first = intrinsicOriginal("First choice")
  await act(async () => {
    intrinsicWidths.set("First choice", 148)
    complete("A longer original authored label")
    await response
  })
  expect(screen.getByText("A longer original authored label")).toBeOnTheScreen()
  // The modeled physical rectangles stay identical; the native mount carries a new original subtree.
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 304 })
  expect(root.current).toBe(originalRoot)
  expect(label.current).toBe(originalLabel)
  expect(intrinsicOriginal("First choice")).toBe(first)
  expect(initialized).toHaveBeenCalledTimes(1)
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "First choice" }).props.accessibilityState.checked).toBe(true)
  await view.unmount()
  expect(root.current).toBeNull()
  expect(label.current).toBeNull()
})

it("rejects a late intrinsic result after a newer original mount commits the current width", async () => {
  const root = createRef<View>(),
    change = jest.fn()
  intrinsicWidths.set("First choice", 60)
  intrinsicWidths.set("Second choice", 88)
  await render(
    <NativeThemeProvider>
      <ToggleSwitcher ref={root} items={choices} selectedKey="and" onSelectionChange={change} />
    </NativeThemeProvider>,
  )
  await seedLayout()
  const original = root.current,
    release = holdNext()
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 184 })
  intrinsicWidths.set("First choice", 148)
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 304 })
  await release()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 304 })
  expect(root.current).toBe(original)
  expect(change).not.toHaveBeenCalled()
})

it("retires pending original intrinsic work at unmount without owner requests", async () => {
  const root = createRef<View>(),
    change = jest.fn()
  intrinsicWidths.set("First choice", 60)
  intrinsicWidths.set("Second choice", 88)
  const view = await render(
    <NativeThemeProvider>
      <ToggleSwitcher ref={root} items={choices} selectedKey="and" onSelectionChange={change} />
    </NativeThemeProvider>,
  )
  await seedLayout()
  const release = holdNext()
  await commitIntrinsicNativeTree()
  await view.unmount()
  await release()
  expect(root.current).toBeNull()
  expect(change).not.toHaveBeenCalled()
})

it("waits for the next actual mount after a retired Fabric input and performs no unchanged retry", async () => {
  intrinsicWidths.set("First choice", 148)
  intrinsicWidths.set("Second choice", 88)
  await render(
    <NativeThemeProvider>
      <ToggleSwitcher items={choices} selectedKey="and" />
    </NativeThemeProvider>,
  )
  await seedLayout()
  nativeEvaluations.mockRejectedValueOnce(new Error("Native motion layout: Fabric input retired"))
  await commitIntrinsicNativeTree()
  const attempts = nativeEvaluations.mock.calls.length
  expect(attempts).toBe(2)
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 184 })
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve()
  })
  expect(nativeEvaluations).toHaveBeenCalledTimes(attempts)
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 304 })
})

it.each([0, 100])("preserves an authored %s option width during intrinsic updates", async (width) => {
  intrinsicWidths.set("First choice", 300)
  intrinsicWidths.set("Second choice", 250)
  await render(
    <NativeThemeProvider>
      <ToggleSwitcher items={choices} selectedKey="and" customOptionStyles={{ width }} />
    </NativeThemeProvider>,
  )
  await seedLayout([width, width])
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: width * 2 + 8 })
  for (const option of screen.getAllByTestId("toggle-switcher-option")) expect(option).toHaveStyle({ width })
})

it("retains default target minimum and authored min/max bounds in the isolated original measurement", async () => {
  intrinsicWidths.set("First choice", 1)
  intrinsicWidths.set("Second choice", 2)
  const view = await render(
    <NativeThemeProvider>
      <ToggleSwitcher items={choices} selectedKey="and" />
    </NativeThemeProvider>,
  )
  await seedLayout()
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 96 })
  intrinsicWidths.set("First choice", 300)
  intrinsicWidths.set("Second choice", 250)
  await view.rerender(
    <NativeThemeProvider>
      <ToggleSwitcher items={choices} selectedKey="and" customOptionStyles={{ minWidth: 120, maxWidth: 160 }} />
    </NativeThemeProvider>,
  )
  await seedLayout([120, 120])
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 328 })
})

it("preserves explicit root and percentage option constraints without imperatively applying the proposal", async () => {
  intrinsicWidths.set("First choice", 300)
  intrinsicWidths.set("Second choice", 250)
  await render(
    <NativeThemeProvider>
      <ToggleSwitcher width={240} items={choices} selectedKey="and" customOptionStyles={{ width: "50%" }} />
    </NativeThemeProvider>,
  )
  await seedLayout()
  const original = intrinsicOriginal("First choice")
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 240 })
  for (const option of screen.getAllByTestId("toggle-switcher-option")) expect(option).toHaveStyle({ width: "50%" })
  expect(original).not.toBeNull()
  if (original && typeof original === "object") expect(original.setNativeProps).not.toHaveBeenCalled()
})

it("composes the maintained original-label fixture through real growth, selection, theme and reset controls", async () => {
  const root = createRef<View>(),
    label = createRef<React.ElementRef<typeof Text>>()
  intrinsicWidths.set("First choice", 60)
  intrinsicWidths.set("Second choice", 88)
  const view = await render(<ToggleSwitcherFixture rootRef={root} labelRef={label} />)
  await seedLayout()
  await commitIntrinsicNativeTree()
  const originalRoot = root.current,
    originalLabel = label.current
  await fireEvent.press(screen.getByRole("button", { name: "Grow authored switcher label" }))
  intrinsicWidths.set("First choice", 148)
  await commitIntrinsicNativeTree()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 304 })
  expect(screen.getByTestId("switcher-fixture-state")).toHaveTextContent(/"selected":"and","requests":\[\]/)
  expect(root.current).toBe(originalRoot)
  expect(label.current).toBe(originalLabel)
  await fireEvent.press(screen.getByRole("button", { name: "Second choice" }))
  expect(screen.getByTestId("switcher-fixture-state")).toHaveTextContent(/"selected":"or","requests":\["or"\]/)
  await fireEvent.press(screen.getByRole("button", { name: "Toggle switcher theme" }))
  expect(screen.getByTestId("switcher-fixture-state")).toHaveTextContent(/"dark":true/)
  expect(root.current).toBe(originalRoot)
  expect(label.current).toBe(originalLabel)
  await fireEvent.press(screen.getByRole("button", { name: "Reset switcher fixture" }))
  intrinsicWidths.set("First choice", 60)
  await seedLayout()
  await commitIntrinsicNativeTree()
  expect(screen.getByText("Short")).toBeOnTheScreen()
  expect(screen.getByTestId("switcher-fixture-state")).toHaveTextContent(
    /"selected":"and","requests":\[\],"dark":false/,
  )
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 184 })
  expect(root.current).toBe(originalRoot)
  expect(label.current).toBe(originalLabel)
  await view.unmount()
  expect(root.current).toBeNull()
  expect(label.current).toBeNull()
})

it("preserves the existing native frame-sampling default outside the switcher opt-in", async () => {
  await render(<NativeFocusHost testID="existing-motion-host" nativeMotionGeometryObservation />)
  expect(screen.getByTestId("existing-motion-host").props.nativeMotionGeometryObserveFrames).toBe(true)
})
