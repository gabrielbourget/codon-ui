import { act, fireEvent, render as renderNative, screen, userEvent } from "@testing-library/react-native"
import { createRef, useEffect, useState } from "react"
import { AccessibilityInfo, BackHandler, FlatList, Platform } from "react-native"

import { Select, type TNativeSelectProps, type TNativeSelectRef } from "../../.."
import {
  acknowledgeSelectHost,
  prepareSelectPopover,
  pressSelectOption,
  SelectTestHost,
} from "../../../overlays/floating/__tests__/selectPopoverFixture"

const render = (node: React.ReactElement) => renderNative(node, { wrapper: SelectTestHost })

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})

const hidden = { includeHiddenElements: true }
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
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("applies an asynchronous owner collection response without replacing its selected trigger or issuing requests", async () => {
  const ref = createRef<TNativeSelectRef>(),
    onChange = jest.fn(),
    onOpenChange = jest.fn()
  let receive!: (next: typeof items) => void
  const response = new Promise<typeof items>((resolve) => {
    receive = resolve
  })
  const Owner = () => {
    const [current, setCurrent] = useState(items)
    useEffect(() => {
      let mounted = true
      void response.then((next) => {
        if (mounted) setCurrent(next)
      })
      return () => {
        mounted = false
      }
    }, [])
    return <Select {...base} items={current} ref={ref} value={0} isOpen {...{ onChange, onOpenChange }} />
  }
  const view = await render(<Owner />)
  await prepareSelectPopover()
  const original = ref.current
  expect(original).not.toBeNull()
  await act(async () => {
    receive([...items].reverse().map((item) => (item.id === 0 ? { ...item, name: "Resolved zero" } : item)))
    await response
  })
  expect(ref.current).toBe(original)
  expect(screen.getByRole("radio", { name: "Resolved zero", ...hidden }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("Resolved zero")
  expect(onChange).not.toHaveBeenCalled()
  expect(onOpenChange).not.toHaveBeenCalled()
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("opens an anchored named list, selects once and exposes selected text on its trigger", async () => {
  const onChange = jest.fn(),
    onOpenChange = jest.fn()
  await render(<Select {...base} {...{ onChange, onOpenChange }} />)
  const user = userEvent.setup()
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("Choose a value")
  await user.press(screen.getByTestId("select-trigger", hidden))
  const { popup } = await prepareSelectPopover()
  expect(popup).toHaveStyle({ top: 130, left: 80, width: 120, maxHeight: 150 })
  expect(screen.getByTestId("select-list", hidden).props).toMatchObject({
    accessibilityRole: "list",
    accessibilityLabel: "Choose",
  })
  expect(screen.queryByTestId("select-window", hidden)).toBeNull()
  await pressSelectOption(screen.getByRole("radio", { name: "String zero", ...hidden }))
  expect(onChange.mock.calls).toEqual([["0"]])
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("String zero")
  expect(screen.queryByRole("radio")).toBeNull()
}, 15_000)

it("flips and constrains the virtualized options in a narrow window", async () => {
  await render(<Select {...base} defaultOpen closeLabel={undefined} />)
  const { popup } = await prepareSelectPopover("select", {
    viewport: [0, 0, 180, 210],
    anchor: [36, 170, 320, 24],
    content: [0, 0, 250, 190],
  })
  expect(popup).toHaveStyle({ bottom: 45, left: 12, width: 250, maxWidth: 156, maxHeight: 150 })
  expect(screen.queryByTestId("select-close")).toBeNull()
  expect(screen.queryByTestId("select-popover-scroll")).toBeNull()
})

it("reports the required same-window host without rendering a fallback", async () => {
  await expect(renderNative(<Select {...base} defaultOpen />)).rejects.toThrow("NativeFloatingLayerHost")
})

it("dismisses via Close and an outside tap without changing selection", async () => {
  const onChange = jest.fn()
  await render(<Select {...base} defaultValue={0} onChange={onChange} />)
  const user = userEvent.setup()
  await user.press(screen.getByTestId("select-trigger", hidden))
  await prepareSelectPopover()
  await pressSelectOption(screen.getByRole("button", { name: "Close choices", ...hidden }))
  await user.press(screen.getByTestId("select-trigger", hidden))
  const { outside } = await prepareSelectPopover()
  await outside()
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("Numeric zero")
})

it("keeps controlled selection/open output until the parent echoes requests", async () => {
  const onChange = jest.fn(),
    onOpenChange = jest.fn()
  const { rerender } = await render(<Select {...base} value={0} isOpen {...{ onChange, onOpenChange }} />)
  await prepareSelectPopover()
  await pressSelectOption(screen.getByRole("radio", { name: "String zero", ...hidden }))
  expect(onChange.mock.calls).toEqual([["0"]])
  expect(onOpenChange.mock.calls).toEqual([[false]])
  expect(screen.getByRole("radio", { name: "Numeric zero", ...hidden }).props.accessibilityState.checked).toBe(true)
  await rerender(<Select {...base} value="0" isOpen={false} {...{ onChange, onOpenChange }} />)
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("String zero")
})

it("does not initially open an uncontrolled disabled Select", async () => {
  await render(<Select {...base} defaultOpen isDisabled />)
  expect(screen.queryByRole("button", { name: "Close choices" })).toBeNull()
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityState.expanded).toBe(false)
})

it("cancels native focus work when selection unmounts the owner", async () => {
  const Owner = () => {
    const [visible, setVisible] = useState(true)
    return visible ? <Select {...base} defaultOpen onChange={() => setVisible(false)} /> : null
  }
  await render(<Owner />)
  await prepareSelectPopover()
  await pressSelectOption(screen.getByRole("radio", { name: "String zero", ...hidden }))
  const count = jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mock.calls.length
  await act(() => jest.advanceTimersByTime(64))
  expect(screen.queryByTestId("select")).toBeNull()
  expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(count)
})

it("allows read-only inspection and blocks unavailable/disabled activation", async () => {
  const onChange = jest.fn()
  const { rerender } = await render(<Select {...base} disabledKeys={["blocked"]} onChange={onChange} />)
  const user = userEvent.setup()
  await user.press(screen.getByTestId("select-trigger", hidden))
  await prepareSelectPopover()
  await fireEvent.press(screen.getByRole("radio", { name: "Blocked", ...hidden }), { nativeEvent: { timestamp: 1 } })
  expect(onChange).not.toHaveBeenCalled()
  await rerender(<Select {...base} isReadOnly isOpen onChange={onChange} />)
  await prepareSelectPopover()
  await fireEvent.press(screen.getByRole("radio", { name: "Numeric zero", ...hidden }), {
    nativeEvent: { timestamp: 2 },
  })
  expect(onChange).not.toHaveBeenCalled()
  await rerender(<Select {...base} isDisabled onChange={onChange} />)
  await user.press(screen.getByTestId("select-trigger", hidden))
  expect(screen.queryByRole("radio")).toBeNull()
})

it("renders empty collections and retained missing values without automatic changes", async () => {
  const onChange = jest.fn()
  const { rerender } = await render(<Select {...base} items={[]} defaultValue={0} defaultOpen onChange={onChange} />)
  await prepareSelectPopover()
  expect(screen.getByText("No items remaining to select", hidden)).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Close choices", ...hidden })).toBeOnTheScreen()
  await pressSelectOption(screen.getByRole("button", { name: "Close choices", ...hidden }))
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("Choose a value")
  await rerender(<Select {...base} onChange={onChange} />)
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("Numeric zero")
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
  await userEvent.setup().press(screen.getByTestId("select-trigger", hidden))
  await prepareSelectPopover()
  expect(screen.getByRole("radio", { name: "Numeric zero", ...hidden }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByText("Numeric zero chosen", hidden)).toBeOnTheScreen()
})

it("restores focus after iOS dismissal and cancels queued work on unmount", async () => {
  const ref = createRef<TNativeSelectRef>()
  const { unmount } = await render(<Select {...base} ref={ref} />)
  const user = userEvent.setup()
  await user.press(screen.getByTestId("select-trigger", hidden))
  const { host } = await prepareSelectPopover()
  await pressSelectOption(screen.getByRole("button", { name: "Close choices", ...hidden }))
  await acknowledgeSelectHost(host)
  await act(() => jest.advanceTimersByTime(64))
  expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenLastCalledWith(ref.current, "focus")
  await user.press(screen.getByTestId("select-trigger", hidden))
  await prepareSelectPopover()
  const calls = jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mock.calls.length
  await unmount()
  await act(() => jest.advanceTimersByTime(64))
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
    const back = jest.spyOn(BackHandler, "addEventListener")
    await render(<Select {...base} ref={ref} />)
    const user = userEvent.setup()
    await user.press(screen.getByTestId("select-trigger", hidden))
    const { host } = await prepareSelectPopover()
    await act(() => expect(back.mock.calls.at(-1)?.[1]({ type: "hardwareBackPress", timeStamp: 17 })).toBe(true))
    await acknowledgeSelectHost(host)
    await act(() => jest.advanceTimersByTime(64))
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
  await prepareSelectPopover()
  await act(() => jest.advanceTimersByTime(64))
  expect(scroll).toHaveBeenCalledTimes(1)
  expect(offset).not.toHaveBeenCalled()
  await pressSelectOption(screen.getByRole("button", { name: "Close choices", ...hidden }))
  const count = scroll.mock.calls.length
  await act(() => jest.advanceTimersByTime(64))
  expect(scroll).toHaveBeenCalledTimes(count)
})

it("allows small measured batches without spending retries on unchanged row layouts", async () => {
  const offset = jest.spyOn(FlatList.prototype, "scrollToOffset").mockImplementation(() => undefined)
  const scroll = jest.spyOn(FlatList.prototype, "scrollToIndex").mockImplementation(() => {
    screen.getByTestId("select-list", hidden).props.onScrollToIndexFailed({
      index: 9,
      averageItemLength: 48,
      highestMeasuredFrameIndex: scroll.mock.calls.length - 1,
    })
  })
  const many = Array.from({ length: 10 }, (_, id) => ({ id, name: `Choice ${id}` }))
  await render(<Select {...base} items={many} defaultValue={9} defaultOpen />)
  await prepareSelectPopover()
  await act(() => jest.advanceTimersByTime(64))
  for (let repeat = 0; repeat < 3; repeat += 1) {
    await fireEvent(screen.getByRole("radio", { name: "Choice 0", ...hidden }), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 48 } },
    })
    await act(() => jest.advanceTimersByTime(64))
  }
  expect(scroll).toHaveBeenCalledTimes(1)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await fireEvent(screen.getByRole("radio", { name: `Choice ${attempt + 1}`, ...hidden }), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 48 } },
    })
    await act(() => jest.advanceTimersByTime(64))
  }
  expect(scroll).toHaveBeenCalledTimes(6)
  expect(offset).toHaveBeenCalledTimes(6)
})

it("waits for full row visibility before finishing initial accessibility focus", async () => {
  jest.spyOn(FlatList.prototype, "scrollToIndex").mockImplementation(() => {
    screen.getByTestId("select-list", hidden).props.onScrollToIndexFailed({
      index: 0,
      averageItemLength: 0,
      highestMeasuredFrameIndex: -1,
    })
  })
  await render(<Select {...base} defaultValue={0} defaultOpen />)
  await prepareSelectPopover()
  await act(() => jest.advanceTimersByTime(64))
  jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mockClear()
  const list = screen.getByTestId("select-list", hidden)
  expect(list.props.viewabilityConfig).toEqual({ itemVisiblePercentThreshold: 100 })
  const token = {
    item: { key: 0, encodedKey: "number:0", text: "Numeric zero", item: items[0] },
    index: 0,
    key: "number:0",
  }
  await act(() => list.props.onViewableItemsChanged({ viewableItems: [{ ...token, isViewable: false }] }))
  await act(() => jest.advanceTimersByTime(64))
  expect(AccessibilityInfo.sendAccessibilityEvent).not.toHaveBeenCalled()
  await act(() => list.props.onViewableItemsChanged({ viewableItems: [{ ...token, isViewable: true }] }))
  await act(() => jest.advanceTimersByTime(64))
  expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(1)
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

it("retains the initial controlled Select value when the owner hands back control", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {})
  const onChange = jest.fn()
  const view = await render(<Select {...base} value="0" defaultValue={0} onChange={onChange} />)
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("String zero")
  await view.rerender(<Select {...base} defaultValue={0} onChange={onChange} />)
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("String zero")
  expect(onChange).not.toHaveBeenCalled()
})
it("retains a declined Select value request when the owner hands back control", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {})
  const onChange = jest.fn(),
    onOpenChange = jest.fn()
  const view = await render(<Select {...base} value={0} isOpen onChange={onChange} onOpenChange={onOpenChange} />)
  await prepareSelectPopover()
  await pressSelectOption(screen.getByRole("radio", { name: "String zero", ...hidden }))
  expect(onChange.mock.calls).toEqual([["0"]])
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("Numeric zero")
  await view.rerender(<Select {...base} isOpen onChange={onChange} onOpenChange={onOpenChange} />)
  expect(screen.getByTestId("select-trigger", hidden).props.accessibilityValue.text).toBe("String zero")
  expect(onChange).toHaveBeenCalledTimes(1)
})
it("retains a declined Select close request when the owner hands back open control", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {})
  const onOpenChange = jest.fn()
  const view = await render(<Select {...base} value={0} isOpen defaultOpen onOpenChange={onOpenChange} />)
  await prepareSelectPopover()
  await pressSelectOption(screen.getByRole("button", { name: "Close choices", ...hidden }))
  expect(onOpenChange.mock.calls).toEqual([[false]])
  expect(screen.getByRole("button", { name: "Close choices", ...hidden })).toBeOnTheScreen()
  await view.rerender(<Select {...base} value={0} defaultOpen onOpenChange={onOpenChange} />)
  expect(screen.queryByRole("radio")).toBeNull()
  expect(onOpenChange).toHaveBeenCalledTimes(1)
})
