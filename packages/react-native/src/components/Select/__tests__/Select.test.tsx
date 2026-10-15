import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { AccessibilityInfo, FlatList, Platform } from "react-native"

import { Select, type TNativeSelectProps, type TNativeSelectRef } from "../../../.."

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})

const items = [
  { id: 0, name: "Numeric zero" },
  { id: "0", name: "String zero" },
  { id: "blocked", name: "Blocked" },
]
const base = {
  items,
  getKey: (item: (typeof items)[number]) => item.id,
  getTextValue: (item: (typeof items)[number]) => item.name,
  accessibilityLabel: "Choose",
  closeLabel: "Close choices",
  placeholder: "Choose a value",
} satisfies TNativeSelectProps<(typeof items)[number]>
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("opens one named modal, selects once and exposes selected text on its trigger", async () => {
  const onChange = jest.fn(),
    onOpenChange = jest.fn()
  await render(<Select {...base} {...{ onChange, onOpenChange }} />)
  const user = userEvent.setup()
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Choose a value")
  await user.press(screen.getByRole("button", { name: "Choose" }))
  expect(screen.getByRole("heading", { name: "Choose" })).toBeOnTheScreen()
  await user.press(screen.getByRole("radio", { name: "String zero" }))
  expect(onChange.mock.calls).toEqual([["0"]])
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("String zero")
  expect(screen.queryByRole("radio")).toBeNull()
})

it("cancels via Close and native Back without changing selection", async () => {
  const onChange = jest.fn()
  await render(<Select {...base} defaultValue={0} onChange={onChange} />)
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Choose" }))
  await user.press(screen.getByRole("button", { name: "Close choices" }))
  await user.press(screen.getByRole("button", { name: "Choose" }))
  await fireEvent(screen.getByTestId("select-window", { includeHiddenElements: true }), "requestClose")
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Numeric zero")
})

it("keeps controlled selection/open output until the parent echoes requests", async () => {
  const onChange = jest.fn(),
    onOpenChange = jest.fn()
  const { rerender } = await render(<Select {...base} value={0} isOpen {...{ onChange, onOpenChange }} />)
  await userEvent.setup().press(screen.getByRole("radio", { name: "String zero" }))
  expect(onChange.mock.calls).toEqual([["0"]])
  expect(onOpenChange.mock.calls).toEqual([[false]])
  expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
  await rerender(<Select {...base} value="0" isOpen={false} {...{ onChange, onOpenChange }} />)
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("String zero")
})

it("does not initially open an uncontrolled disabled Select", async () => {
  await render(<Select {...base} defaultOpen isDisabled />)
  expect(screen.queryByRole("button", { name: "Close choices" })).toBeNull()
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityState.expanded).toBe(false)
})

it("cancels native focus work when selection unmounts the owner", async () => {
  const Owner = () => {
    const [visible, setVisible] = useState(true)
    return visible ? <Select {...base} defaultOpen onChange={() => setVisible(false)} /> : null
  }
  await render(<Owner />)
  await fireEvent(screen.getByTestId("select-window"), "show")
  await userEvent.setup().press(screen.getByRole("radio", { name: "String zero" }))
  const count = jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mock.calls.length
  await act(() => jest.runAllTimers())
  expect(screen.queryByTestId("select")).toBeNull()
  expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(count)
})

it("allows read-only inspection and blocks unavailable/disabled activation", async () => {
  const onChange = jest.fn()
  const { rerender } = await render(<Select {...base} disabledKeys={["blocked"]} onChange={onChange} />)
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Choose" }))
  await fireEvent.press(screen.getByRole("radio", { name: "Blocked" }), { nativeEvent: { timestamp: 1 } })
  expect(onChange).not.toHaveBeenCalled()
  await rerender(<Select {...base} isReadOnly isOpen onChange={onChange} />)
  await fireEvent.press(screen.getByRole("radio", { name: "Numeric zero" }), { nativeEvent: { timestamp: 2 } })
  expect(onChange).not.toHaveBeenCalled()
  await rerender(<Select {...base} isDisabled onChange={onChange} />)
  await user.press(screen.getByRole("button", { name: "Choose" }))
  expect(screen.queryByRole("radio")).toBeNull()
})

it("renders empty collections and retained missing values without automatic changes", async () => {
  const onChange = jest.fn()
  const { rerender } = await render(<Select {...base} items={[]} defaultValue={0} defaultOpen onChange={onChange} />)
  expect(screen.getByText("No items remaining to select")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Close choices" })).toBeOnTheScreen()
  await userEvent.setup().press(screen.getByRole("button", { name: "Close choices" }))
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Choose a value")
  await rerender(<Select {...base} onChange={onChange} />)
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Numeric zero")
  expect(onChange).not.toHaveBeenCalled()
})

it("retains callback dimensions, styled owned text, validation priority and custom visual content", async () => {
  const { rerender } = await render(
    <Select
      {...base}
      defaultValue={0}
      errorState
      warningState
      successState
      customStyles={{ width: 24, height: 24 }}
      style={({ defaultStyle }) => defaultStyle}
      customSelectedItemTextStyles={{ color: "tomato" }}
      renderSelectedValue={({ selectedText }) => <>Picked {selectedText}</>}
      ComponentIcon={null}
    />,
  )
  expect(screen.getByTestId("select")).toHaveStyle({ width: 24, height: 24 })
  expect(screen.getByTestId("select").props.style.minHeight).toBeUndefined()
  expect(screen.getByTestId("select-trigger")).toHaveStyle({ borderColor: "#b73434" })
  expect(screen.getByText("Picked Numeric zero")).toHaveStyle({ color: "tomato" })
  await rerender(
    <Select
      {...base}
      defaultValue={0}
      renderItem={(item, state) => (
        <>
          {item.name} {state.isSelected ? "chosen" : "other"}
        </>
      )}
    />,
  )
  await userEvent.setup().press(screen.getByRole("button", { name: "Choose" }))
  expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByText("Numeric zero chosen")).toBeOnTheScreen()
})

it("restores focus after iOS dismissal and cancels queued work on unmount", async () => {
  const ref = createRef<TNativeSelectRef>()
  const { unmount } = await render(<Select {...base} ref={ref} />)
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Choose" }))
  const dismiss = screen.getByTestId("select-window").props.onDismiss
  await user.press(screen.getByRole("button", { name: "Close choices" }))
  await act(() => dismiss())
  await act(() => jest.runAllTimers())
  expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenLastCalledWith(ref.current, "focus")
  await user.press(screen.getByRole("button", { name: "Choose" }))
  await fireEvent(screen.getByTestId("select-window", { includeHiddenElements: true }), "show")
  const calls = jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mock.calls.length
  await unmount()
  await act(() => jest.runAllTimers())
  expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(calls)
})

it("forwards React ref cleanup without leaving stale native focus work", async () => {
  const cleanup = jest.fn()
  const ref = jest.fn((node: TNativeSelectRef | null) => (node ? cleanup : undefined))
  const { unmount } = await render(<Select {...base} ref={ref} />)
  expect(ref).toHaveBeenCalledTimes(1)
  await unmount()
  expect(cleanup).toHaveBeenCalledTimes(1)
})

it("restores the surviving Android trigger on bounded native frames", async () => {
  const platform = jest.replaceProperty(Platform, "OS", "android")
  try {
    const ref = createRef<TNativeSelectRef>()
    await render(<Select {...base} ref={ref} />)
    const user = userEvent.setup()
    await user.press(screen.getByRole("button", { name: "Choose" }))
    await fireEvent(screen.getByTestId("select-window", { includeHiddenElements: true }), "requestClose")
    await act(() => jest.runAllTimers())
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenLastCalledWith(ref.current, "focus")
  } finally {
    platform.restore()
  }
})

it("waits for cell measurements and does not scroll after closing", async () => {
  const scroll = jest.spyOn(FlatList.prototype, "scrollToIndex")
  const offset = jest.spyOn(FlatList.prototype, "scrollToOffset")
  const many = Array.from({ length: 200 }, (_, id) => ({ id, name: `Choice ${id}` }))
  await render(<Select {...base} items={many} defaultValue={199} defaultOpen />)
  await fireEvent(screen.getByTestId("select-window", { includeHiddenElements: true }), "show")
  await act(() => jest.runAllTimers())
  expect(scroll).toHaveBeenCalledTimes(1)
  expect(offset).not.toHaveBeenCalled()
  await userEvent.setup().press(screen.getByRole("button", { name: "Close choices" }))
  const count = scroll.mock.calls.length
  await act(() => jest.runAllTimers())
  expect(scroll).toHaveBeenCalledTimes(count)
})

it("caps retries driven by measured row-layout progress", async () => {
  const offset = jest.spyOn(FlatList.prototype, "scrollToOffset").mockImplementation(() => undefined)
  const scroll = jest.spyOn(FlatList.prototype, "scrollToIndex").mockImplementation(() => {
    screen
      .getByTestId("select-list")
      .props.onScrollToIndexFailed({ index: 199, averageItemLength: 48, highestMeasuredFrameIndex: 10 })
  })
  const many = Array.from({ length: 200 }, (_, id) => ({ id, name: `Choice ${id}` }))
  await render(<Select {...base} items={many} defaultValue={199} defaultOpen />)
  await fireEvent(screen.getByTestId("select-window"), "show")
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await fireEvent(screen.getByRole("radio", { name: "Choice 0" }), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 48 } },
    })
    await act(() => jest.runAllTimers())
  }
  expect(scroll).toHaveBeenCalledTimes(3)
  expect(offset).toHaveBeenCalledTimes(3)
})

it.each([
  { accessibilityLabel: " " },
  { closeLabel: " " },
  { width: NaN },
  { customOptionsListStyles: { backgroundColor: "var(--list)" } },
  { customSelectedItemTextStyles: { color: "var(--text)" } },
])("validates names, dimensions and style colors while closed: %p", async (invalid) => {
  await expect(render(<Select {...base} {...invalid} />)).rejects.toThrow(TypeError)
})
