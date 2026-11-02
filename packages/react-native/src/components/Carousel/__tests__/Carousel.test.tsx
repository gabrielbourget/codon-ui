import { act, fireEvent, render as renderNative, screen } from "@testing-library/react-native"
import { AccessibilityInfo, AppState, ScrollView, StyleSheet, Text, View } from "react-native"
import type * as RN from "react-native"

import type { TNativeKeyPolicy } from "../../../input/keyScope"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeThemeProvider } from "../../../theme"
import { Text as LibraryText } from "../../Text/Text"
import { Carousel } from "../Carousel"
import { CarouselCloseButton, CarouselNextButton, CarouselPrevButton } from "../CarouselControls"
import { CarouselCounter } from "../CarouselCounter"
import { CarouselDots } from "../CarouselDots"
import type { TNativeCarouselContext, TNativeCarouselProps } from "../carouselTypes"

let mockKeyboardObservation:
  | Parameters<typeof import("../../../input/NativeKeyboardScope").useNativeKeyboardObservation>[0]
  | undefined
const mockPolicies = new Map<string, TNativeKeyPolicy>()
jest.mock("../../../input/NativeKeyboardScope", () => ({
  useNativeKeyScope: () => null,
  useNativeWindowPointers: () => null,
  useNativeKeyPolicy: (policy: TNativeKeyPolicy) => {
    mockPolicies.set(policy.lifetimeKey, policy)
  },
  useNativeKeyboardObservation: (options: typeof mockKeyboardObservation) => {
    mockKeyboardObservation = options
  },
}))
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react"),
    Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps>((props, ref) => {
      return <Native.View {...props} ref={ref} />
    }),
    Commands: {
      requestKeyboardFocus: jest.fn(),
      requestContainerFocus: jest.fn(),
      requestKeyboardBlur: jest.fn(),
      inspectAccessibility: jest.fn(),
    },
  }
})
type TItem = { ID: string; title: string }
const items = [
  { ID: "a", title: "First" },
  { ID: "b", title: "Second" },
  { ID: "c", title: "Third" },
]
let context: TNativeCarouselContext
const base = (): TNativeCarouselProps<TItem> => ({
  items,
  renderCarouselItem: ({ item }) => <Text>{item.title}</Text>,
  chromeSlot: ({ context: current, slot }) => {
    context = current
    expect(slot).toBe("custom")
    return (
      <View>
        <CarouselPrevButton />
        <CarouselNextButton />
        <CarouselCounter />
        <CarouselDots />
        <CarouselCloseButton />
      </View>
    )
  },
})
const tree = (props: TNativeCarouselProps<TItem>) => (
  <NativeThemeProvider>
    <Carousel {...props} />
  </NativeThemeProvider>
)
const scrollEvent = (x: number, y: number, velocity = 0) => ({
  nativeEvent: {
    contentOffset: { x, y },
    velocity: { x: velocity, y: velocity },
    contentSize: { width: 900, height: 600 },
    layoutMeasurement: { width: 300, height: 200 },
  },
})
const slideHosts = () =>
  screen.queryAllByLabelText(/^Item \d+ of \d+$/).filter((node) => typeof node.props.nativeID === "string")
const layout = async (props: TNativeCarouselProps<TItem>) => {
  const vertical = props.axis === "y"
  await fireEvent(screen.getByTestId("carousel-scroll-y"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } },
  })
  await fireEvent(screen.getByTestId("carousel-container"), "layout", {
    nativeEvent: {
      layout: {
        x: 0,
        y: 0,
        width: vertical ? 300 : Math.max(300, props.items.length * 300),
        height: vertical ? Math.max(200, props.items.length * 200) : 200,
      },
    },
  })
  for (let index = 0; index < props.items.length; index++) {
    const nativeID = props.getItemID?.(index) ?? `carousel-item-index-${index + 1}`
    const host = screen
      .getAllByLabelText(`Item ${index + 1} of ${props.items.length}`)
      .find((node) => node.props.nativeID === nativeID)!
    await fireEvent(host, "layout", {
      nativeEvent: {
        layout: { x: vertical ? 0 : index * 300, y: vertical ? index * 200 : 0, width: 300, height: 200 },
      },
    })
  }
  await fireEvent(
    screen.getByTestId(`carousel-scroll-${vertical ? "y" : "x"}`),
    "contentSizeChange",
    vertical ? 300 : Math.max(300, props.items.length * 300),
    vertical ? Math.max(200, props.items.length * 200) : 200,
  )
}
const render = async (element: ReturnType<typeof tree>) => {
  const result = await renderNative(element)
  await layout(element.props.children.props)
  return {
    ...result,
    rerender: async (next: ReturnType<typeof tree>) => {
      await result.rerender(next)
      await layout(next.props.children.props)
    },
  }
}
let scrollCommands: jest.SpyInstance
beforeEach(() => {
  jest.useFakeTimers()
  mockPolicies.clear()
  scrollCommands = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(function (
    this: ScrollView,
    options,
  ) {
    if (typeof options !== "object" || !options || options.animated !== false) return
    this.props.onScroll?.(scrollEvent(options.x ?? 0, options.y ?? 0) as RN.NativeSyntheticEvent<RN.NativeScrollEvent>)
  })
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
const key = async (value: string) => {
  const policy = [...mockPolicies.values()].find(({ excludeEditable }) => excludeEditable)!
  let prevented = false
  const event = {
    nativeEvent: { key: value },
    preventDefault: jest.fn(() => {
      prevented = true
    }),
    isDefaultPrevented: () => prevented,
    stopPropagation: jest.fn(),
  }
  await act(() => policy.onKey(event as unknown as Parameters<TNativeKeyPolicy["onKey"]>[0]))
  return event
}

it("composes the whole family, initial selection, labels, real viewport and original native items", async () => {
  const onIndexChange = jest.fn(),
    onViewportRefChange = jest.fn()
  await render(
    tree({ ...base(), initialIndex: 1, onIndexChange, onViewportRefChange, getItemID: (index) => `custom-${index}` }),
  )
  expect(screen.getByTestId("carousel").props.accessibilityLabel).toBe("Content Carousel")
  expect(context.selectedIndex).toBe(1)
  expect(onIndexChange).toHaveBeenLastCalledWith(1)
  expect(onViewportRefChange.mock.calls.at(-1)![0].props.testID).toBe("carousel-viewport")
  expect(slideHosts()).toHaveLength(3)
  expect(screen.getAllByLabelText("Item 2 of 3").some((host) => host.props.nativeID === "custom-1")).toBe(true)
  expect(screen.getByLabelText("Go to item 2 of 3").props.accessibilityState.checked).toBe(true)
  expect(screen.getByLabelText("Go to item 2 of 3").props.accessibilityActions).toEqual([
    { name: "show-item:custom-1", label: "Go to item 2 of 3" },
  ])
  expect(screen.getByTestId("counter-value").props.children).toBe(2)
  expect(screen.getByTestId("counter-max").props.children).toBe("/3")
})

it("retains selection on unrelated renders, resynchronizes requested indices and replaces callbacks", async () => {
  const first = jest.fn(),
    next = jest.fn(),
    props = { ...base(), loopEnabled: false as const, onIndexChange: first }
  const { rerender } = await render(tree(props))
  const scrollTo = context.scrollTo
  await act(() => scrollTo(2, { animated: false }))
  await rerender(tree({ ...props, customStyles: { opacity: 0.5 } }))
  expect(context.scrollTo).toBe(scrollTo)
  expect(context.selectedIndex).toBe(2)
  await rerender(tree({ ...props, onIndexChange: next }))
  expect(next.mock.calls).toEqual([[2]])
  await rerender(tree({ ...props, onIndexChange: next, initialIndex: -10 }))
  expect(context.selectedIndex).toBe(0)
  await rerender(tree({ ...props, onIndexChange: next, initialIndex: 99 }))
  expect(context.selectedIndex).toBe(2)
})

it("preserves ref callback replacement and retires navigation on unmount", async () => {
  const first = jest.fn(),
    next = jest.fn()
  const props = base(),
    { rerender, unmount } = await render(tree({ ...props, onViewportRefChange: first }))
  const scrollTo = context.scrollTo,
    host = first.mock.calls.at(-1)![0]
  await rerender(tree({ ...props, onViewportRefChange: next }))
  expect(first.mock.calls.at(-1)).toEqual([null])
  expect(next.mock.calls.at(-1)).toEqual([host])
  expect(context.scrollTo).toBe(scrollTo)
  await unmount()
  expect(next.mock.calls.at(-1)).toEqual([null])
  scrollCommands.mockClear()
  scrollTo(2)
  expect(scrollCommands).not.toHaveBeenCalled()
})

it("keeps all independent native style owners and late Counter/Text props", async () => {
  const registered = StyleSheet.create({ root: { opacity: 0.3, width: 250 } })
  await render(
    tree({
      ...base(),
      customStyles: registered.root,
      style: { opacity: 0, height: 100 },
      customViewportStyles: { opacity: 0.4 },
      customContainerStyles: { gap: 0 },
      customItemStyles: { flexBasis: "50%" },
      customChromeStyles: { top: 7 },
      chromeSlot: ({ context: current }) => {
        context = current
        return (
          <CarouselCounter
            customStyles={{ opacity: 0.5 }}
            style={{ padding: 0 }}
            counterText=""
            customCounterProps={{
              value: "004",
              maxValue: "010",
              accessibilityLabel: "Owned",
              showProgressIndicator: true,
            }}
            customTextProps={{ children: "ignored" }}
          />
        )
      },
    }),
  )
  expect(screen.getByTestId("carousel")).toHaveStyle({ opacity: 0, width: 250, height: 100 })
  expect(screen.getByTestId("carousel-viewport")).toHaveStyle({ opacity: 0.4 })
  expect(screen.getByTestId("carousel-container")).toHaveStyle({ gap: 0 })
  expect(screen.getByTestId("carousel-chrome")).toHaveStyle({ top: 7 })
  expect(screen.getByTestId("carousel-counter")).toHaveStyle({ padding: 0, opacity: 0.5 })
  expect(screen.getByTestId("carousel-counter-surface")).toHaveStyle({ opacity: 0.75, backgroundColor: "#ffffff" })
  expect(screen.getByTestId("counter-value").props.children).toBe("004")
  expect(screen.getByTestId("counter-max").props.children).toBe("/010")
  expect(screen.queryByText("Items")).toBeNull()
  expect(screen.queryByText("ignored")).toBeNull()
})

it("uses original key policy events, axis directions, Home/End and fixed source modifiers", async () => {
  const props = { ...base(), loopEnabled: false as const },
    { rerender } = await render(tree(props))
  expect((await key("ArrowRight")).preventDefault).toHaveBeenCalledTimes(1)
  expect(context.selectedIndex).toBe(1)
  await key("End")
  expect(context.selectedIndex).toBe(2)
  await key("Home")
  expect(context.selectedIndex).toBe(0)
  await rerender(tree({ ...props, axis: "y", enableHomeEndKeys: false }))
  const policy = [...mockPolicies.values()].find(({ excludeEditable }) => excludeEditable)!
  expect(policy.tokens).toEqual(["0000:ArrowUp", "1000:ArrowUp", "0000:ArrowDown", "1000:ArrowDown"])
  expect(policy.excludeComposing).toBe(false)
  scrollCommands.mockClear()
  await key("ArrowDown")
  expect(scrollCommands).toHaveBeenCalledWith({ x: 0, y: 200, animated: false })
})

it("reports null for low-count dots and keeps explicit empty labels and direct chrome", async () => {
  await render(
    tree({
      ...base(),
      items: [items[0]],
      chromeOverlayStrategy: "none",
      labels: { root: { ariaLabel: "" }, counter: { counterText: "", ariaLabel: "" } },
    }),
  )
  expect(screen.queryByTestId("carousel-dots")).toBeNull()
  expect(screen.queryByTestId("carousel-chrome")).toBeNull()
  expect(screen.getByTestId("carousel").props.accessibilityLabel).toBe("")
  expect(screen.getByTestId("counter").props.accessibilityLabel).toBe("")
  expect(screen.queryByText("Items")).toBeNull()
})

it("keeps the canonical unused autoplay prop inert and supports passive dots", async () => {
  await render(
    tree({
      ...base(),
      autoPlayEnabled: true,
      chromeSlot: ({ context: current }) => {
        context = current
        return <CarouselDots interactive={false} showOverflowSentinels />
      },
    }),
  )
  await act(() => jest.advanceTimersByTime(10000))
  expect(context.selectedIndex).toBe(0)
  expect(screen.getByTestId("carousel-dots", { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(
    true,
  )
  expect(screen.queryAllByRole("radio")).toHaveLength(0)
})

it("activates exact-index radio requests through the actual Pressable callback", async () => {
  await render(tree(base()))
  const target = screen.getByLabelText("Go to item 3 of 3")
  await fireEvent(target, "onKeyDown", {
    nativeEvent: { key: "Enter" },
    preventDefault: jest.fn(),
    isDefaultPrevented: () => true,
  })
  expect(context.selectedIndex).toBe(2)
})

it("navigates the original controlled item from its named native accessibility action", async () => {
  await render(tree({ ...base(), getItemID: (index) => (index === 0 ? "" : `owned-${index}`) }))
  expect(screen.getByLabelText("Go to item 1 of 3").props.accessibilityActions).toBeUndefined()
  const target = screen.getByLabelText("Go to item 3 of 3")
  await fireEvent(target, "accessibilityAction", { nativeEvent: { actionName: "show-item:owned-2" } })
  expect(context.selectedIndex).toBe(2)
})

it("retains original keyed item hosts through reordering and axis changes and resynchronizes on count changes", async () => {
  const nodes = new Map<string, View | null>()
  const props = {
    ...base(),
    renderCarouselItem: ({ item }: { item: TItem }) => (
      <View
        ref={(node) => {
          nodes.set(item.ID, node)
        }}
      >
        <Text>{item.title}</Text>
      </View>
    ),
  }
  const { rerender } = await render(tree(props))
  const original = new Map(nodes)
  const scrollTo = context.scrollTo
  await act(() => scrollTo(2, { animated: false }))
  await rerender(tree({ ...props, items: [...items].reverse() }))
  expect(context.scrollTo).toBe(scrollTo)
  for (const [identity, node] of original) expect(nodes.get(identity) === node).toBe(true)
  expect(context.selectedIndex).toBe(2)
  await rerender(tree({ ...props, items: [...items].reverse(), axis: "y" }))
  for (const [identity, node] of original) expect(nodes.get(identity) === node).toBe(true)
  expect(context.selectedIndex).toBe(2)
  await rerender(tree({ ...props, items: [...items, { ID: "d", title: "Fourth" }] }))
  expect(slideHosts()).toHaveLength(4)
  expect(context.selectedIndex).toBe(0)
  await rerender(tree({ ...props, items: [] }))
  expect(slideHosts()).toEqual([])
  expect(context.itemCount).toBe(0)
})

it("retires an outstanding scroll request when the item count changes", async () => {
  const props = base()
  const { rerender } = await render(tree(props))
  await act(() => context.scrollTo(2, { animated: false }))
  await rerender(tree({ ...props, items: items.slice(0, 2) }))
  expect(slideHosts()).toHaveLength(2)
  expect(context.selectedIndex).toBe(0)
})

it("moves manual roving focus without selecting until original Enter activation", async () => {
  await render(
    tree({
      ...base(),
      chromeSlot: ({ context: current }) => {
        context = current
        return <CarouselDots activationMode="manual" />
      },
    }),
  )
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  const policy = [...mockPolicies.values()].find(({ excludeEditable }) => !excludeEditable)!
  const event = { nativeEvent: { key: "ArrowRight" }, preventDefault: jest.fn(), stopPropagation: jest.fn() }
  await act(() => policy.onKey(event as unknown as Parameters<TNativeKeyPolicy["onKey"]>[0]))
  expect(event.preventDefault).toHaveBeenCalledTimes(1)
  expect(event.stopPropagation).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(context.selectedIndex).toBe(0)
  const target = screen.getByLabelText("Go to item 2 of 3")
  expect(target.props.nativeTabStop).toBe(true)
  expect(screen.getByLabelText("Go to item 1 of 3").props.nativeTabStop).toBe(false)
  await fireEvent(target, "onKeyDown", {
    nativeEvent: { key: "Enter" },
    preventDefault: jest.fn(),
    isDefaultPrevented: () => true,
  })
  expect(context.selectedIndex).toBe(1)
})

it("renders raw zero/mixed item phrases with independent inherited native text styles", async () => {
  await render(
    tree({
      ...base(),
      customStyles: { color: "red", fontSize: 29 },
      customContainerStyles: { color: "blue", fontSize: 25 },
      customItemStyles: { fontSize: 17, color: undefined },
      renderCarouselItem: () => (
        <>
          {0}
          {false}
          {" phrase"}
          <LibraryText testID="authored">Authored</LibraryText>
        </>
      ),
    }),
  )
  expect(screen.getAllByText("0 phrase")[0]).toHaveStyle({ color: "blue", fontSize: 17 })
  expect(screen.getAllByTestId("authored")[0]).toHaveStyle({ color: "blue" })
  expect(screen.getByTestId("carousel").props.style.color).toBeUndefined()
  expect(screen.getByTestId("carousel-container").props.style.fontSize).toBeUndefined()
})

it("keeps chrome typography and Counter wrapper foreground in their own native owners", async () => {
  await render(
    tree({
      ...base(),
      customStyles: { color: "red" },
      customChromeStyles: { color: "purple", fontSize: 31 },
      renderCarouselItem: () => null,
      chromeSlot: () => (
        <>
          {0}
          <CarouselCounter customStyles={{ color: "orange", fontSize: 19 }} />
        </>
      ),
    }),
  )
  expect(screen.getByText("0")).toHaveStyle({ color: "purple", fontSize: 31 })
  expect(screen.getByTestId("counter-value")).toHaveStyle({ color: "orange" })
  expect(screen.getByTestId("carousel-counter").props.style.color).toBeUndefined()
  expect(screen.getByTestId("carousel-chrome").props.style.fontSize).toBeUndefined()
})

it("binds root and viewport keyboard policies to their original host identities", async () => {
  const native = jest.requireActual<typeof RN>("react-native")
  const observed: View[] = []
  jest.spyOn(native, "findNodeHandle").mockImplementation((node) => {
    if (!node || typeof node !== "object" || !("props" in node)) return null
    observed.push(node as View)
    return (node as View).props.testID === "carousel" ? 27 : 33
  })
  const props = base()
  const view = await render(tree(props))
  const policy = () => [...mockPolicies.values()].find(({ excludeEditable }) => excludeEditable)!
  expect(policy().targetTag).toBe(33)
  expect(observed.some((node) => node.props.testID === "carousel-viewport")).toBe(true)
  await view.rerender(tree({ ...props, keyboardNavigationTarget: "root" }))
  expect(policy().targetTag).toBe(27)
  expect(observed.some((node) => node.props.testID === "carousel")).toBe(true)
})

it("reports animated commands only at their observed settled position and ignores superseded completions", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const reports = jest.fn()
  await render(tree({ ...base(), onIndexChange: reports }))
  const scrolling = screen.getByTestId("carousel-scroll-x")
  reports.mockClear()
  await act(() => context.scrollTo(1))
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 300, y: 0, animated: true })
  await fireEvent(scrolling, "scroll", scrollEvent(300, 0))
  expect(context.selectedIndex).toBe(0)
  expect(reports).not.toHaveBeenCalled()
  await act(() => context.scrollTo(2))
  await fireEvent(scrolling, "momentumScrollEnd", scrollEvent(300, 0))
  expect(context.selectedIndex).toBe(0)
  await fireEvent(scrolling, "scroll", scrollEvent(600, 0))
  expect(context.selectedIndex).toBe(0)
  await fireEvent(scrolling, "momentumScrollEnd", scrollEvent(600, 0))
  expect(context.selectedIndex).toBe(2)
  expect(reports.mock.calls).toEqual([[2]])
})

it("lets an original drag interrupt a command and reports its settled swipe selection", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  await render(tree(base()))
  const scrolling = screen.getByTestId("carousel-scroll-x")
  await act(() => context.scrollTo(2))
  await fireEvent(scrolling, "scrollBeginDrag", scrollEvent(100, 0))
  await fireEvent(scrolling, "scroll", scrollEvent(280, 0, 1))
  await fireEvent(scrolling, "scrollEndDrag", scrollEvent(280, 0, 1))
  expect(context.selectedIndex).toBe(0)
  await fireEvent(scrolling, "momentumScrollEnd", scrollEvent(300, 0))
  expect(context.selectedIndex).toBe(1)
  await fireEvent(scrolling, "scrollBeginDrag", scrollEvent(300, 0))
  await fireEvent(scrolling, "scrollEndDrag", scrollEvent(600, 0))
  expect(context.selectedIndex).toBe(2)
})

it("accumulates quick navigation requests and stops at finite edges without wrapping", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  await render(tree(base()))
  await act(() => {
    context.scrollNext()
    context.scrollNext()
    context.scrollNext()
  })
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 600, y: 0, animated: true })
  expect(context.selectedIndex).toBe(0)
  await fireEvent(screen.getByTestId("carousel-scroll-x"), "momentumScrollEnd", scrollEvent(600, 0))
  expect(context.selectedIndex).toBe(2)
  expect(context.canScrollNext).toBe(false)
  await act(() => context.scrollNext())
  expect(context.selectedIndex).toBe(2)
  await act(() => context.scrollTo(-20, { animated: false }))
  expect(context.selectedIndex).toBe(0)
  expect(context.canScrollPrev).toBe(false)
})

it("retires background navigation, stale axis callbacks and post-unmount events", async () => {
  let change: ((state: RN.AppStateStatus) => void) | undefined
  const remove = jest.fn()
  jest.spyOn(AppState, "addEventListener").mockImplementation((_name, callback) => {
    change = callback
    return { remove }
  })
  const reports = jest.fn()
  const props = { ...base(), onIndexChange: reports }
  const view = await render(tree(props))
  const stale = screen.getByTestId("carousel-scroll-x").props.onMomentumScrollEnd
  await act(() => change?.("background"))
  scrollCommands.mockClear()
  await act(() => context.scrollTo(2))
  await act(() => stale(scrollEvent(600, 0)))
  expect(context.selectedIndex).toBe(0)
  expect(scrollCommands).not.toHaveBeenCalled()
  await act(() => change?.("active"))
  await act(() => stale(scrollEvent(600, 0)))
  expect(context.selectedIndex).toBe(0)
  await view.rerender(tree({ ...props, axis: "y" }))
  await act(() => stale(scrollEvent(600, 0)))
  expect(context.selectedIndex).toBe(0)
  await view.rerender(tree(props))
  await act(() => stale(scrollEvent(600, 0)))
  expect(context.selectedIndex).toBe(0)
  const retained = screen.getByTestId("carousel-scroll-x").props.onMomentumScrollEnd
  await view.unmount()
  reports.mockClear()
  await act(() => retained(scrollEvent(0, 400)))
  expect(reports).not.toHaveBeenCalled()
  expect(remove).toHaveBeenCalled()
})

it("uses measured heterogeneous snap offsets and keeps distinct items at a shared finite edge", async () => {
  await render(tree(base()))
  const measured = [
    { x: 0, y: 0, width: 120, height: 200 },
    { x: 140, y: 0, width: 280, height: 200 },
    { x: 440, y: 0, width: 360, height: 200 },
  ]
  for (const [index, host] of slideHosts().entries())
    await fireEvent(host, "layout", { nativeEvent: { layout: measured[index] } })
  await fireEvent(screen.getByTestId("carousel-scroll-x"), "contentSizeChange", 800, 200)
  expect(screen.getByTestId("carousel-scroll-x").props.snapToOffsets).toEqual([0, 130, 470])
  await act(() => context.scrollTo(1, { animated: false }))
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 130, y: 0, animated: false })
  expect(context.selectedIndex).toBe(1)
  await fireEvent(screen.getByTestId("carousel-scroll-x"), "contentSizeChange", 300, 200)
  await act(() => context.scrollTo(2, { animated: false }))
  expect(context.selectedIndex).toBe(2)
  expect(screen.getByLabelText("Go to item 3 of 3").props.accessibilityState.checked).toBe(true)
  expect(screen.getByTestId("counter-value").props.children).toBe(3)
})

it("withholds native snap configuration and gestures until geometry exists, including empty data", async () => {
  const props = base()
  const view = await renderNative(tree(props))
  expect(screen.getByTestId("carousel-scroll-x").props.snapToOffsets).toBeUndefined()
  expect(screen.getByTestId("carousel-scroll-x").props.scrollEnabled).toBe(false)
  await layout(props)
  expect(screen.getByTestId("carousel-scroll-x").props.scrollEnabled).toBe(true)
  await view.rerender(tree({ ...props, axis: "y", items: [] }))
  await layout({ ...props, axis: "y", items: [] })
  expect(screen.getByTestId("carousel-scroll-y").props.snapToOffsets).toBeUndefined()
  expect(screen.getByTestId("carousel-scroll-y").props.scrollEnabled).toBe(false)
})

it("preserves an unacknowledged owner request through new geometry and ignores the old completion handler", async () => {
  const props = base()
  const view = await render(tree(props))
  scrollCommands.mockImplementation(() => {})
  await view.rerender(tree({ ...props, initialIndex: 2 }))
  expect(context.selectedIndex).toBe(0)
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 600, y: 0, animated: false })
  const oldCompletion = screen.getByTestId("carousel-scroll-x").props.onMomentumScrollEnd
  await fireEvent(screen.getByTestId("carousel-scroll-y"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 200 } },
  })
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 500, y: 0, animated: false })
  await act(() => oldCompletion(scrollEvent(600, 0)))
  expect(context.selectedIndex).toBe(0)
  await fireEvent(screen.getByTestId("carousel-scroll-x"), "scroll", scrollEvent(500, 0))
  expect(context.selectedIndex).toBe(2)
})

it("normalizes native scroll coordinates without mirroring original RTL content", async () => {
  const props = { ...base(), customStyles: { direction: "rtl" as const }, align: "start" as const }
  await render(tree(props))
  for (const [index, host] of slideHosts().entries())
    await fireEvent(host, "layout", {
      nativeEvent: { layout: { x: (2 - index) * 300, y: 0, width: 300, height: 200 } },
    })
  expect(screen.getByTestId("carousel-container")).toHaveStyle({ direction: "rtl" })
  expect(screen.getByTestId("carousel-scroll-x")).toHaveStyle({ direction: "ltr" })
  expect(screen.getByTestId("carousel-scroll-x").props.snapToOffsets).toEqual([0, 300, 600])
  await act(() => context.scrollTo(0, { animated: false }))
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 600, y: 0, animated: false })
  await act(() => context.scrollNext({ animated: false }))
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 300, y: 0, animated: false })
  expect(context.selectedIndex).toBe(1)
})

it("uses the stock clip viewport measurement inside authored viewport padding and borders", async () => {
  await render(tree({ ...base(), customViewportStyles: { padding: 20, borderWidth: 5 }, align: "start" }))
  await fireEvent(screen.getByTestId("carousel-scroll-y"), "layout", {
    nativeEvent: { layout: { x: 25, y: 25, width: 250, height: 150 } },
  })
  expect(screen.getByTestId("carousel-scroll-x")).toHaveStyle({ width: 250, height: 150 })
  await act(() => context.scrollTo(2, { animated: false }))
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 600, y: 0, animated: false })
})

it("does not mistake a transient scroll position for settlement when a new command targets it", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const reports = jest.fn()
  await render(tree({ ...base(), onIndexChange: reports }))
  reports.mockClear()
  const scrolling = screen.getByTestId("carousel-scroll-x")
  await act(() => context.scrollTo(2))
  await fireEvent(scrolling, "scroll", scrollEvent(300, 0))
  scrollCommands.mockClear()
  await act(() => context.scrollTo(1))
  expect(context.selectedIndex).toBe(0)
  expect(reports).not.toHaveBeenCalled()
  expect(scrollCommands).not.toHaveBeenCalled()
  await fireEvent(scrolling, "momentumScrollEnd", scrollEvent(600, 0))
  expect(context.selectedIndex).toBe(0)
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 300, y: 0, animated: true })
  await fireEvent(scrolling, "momentumScrollEnd", scrollEvent(300, 0))
  expect(reports.mock.calls).toEqual([[1]])
  expect(context.selectedIndex).toBe(1)
})

it("keeps automatic child-focus scrolling disabled on both stock scrollers", async () => {
  await render(tree(base()))
  expect(screen.getByTestId("carousel-scroll-x").props.scrollsChildToFocus).toBe(false)
  expect(screen.getByTestId("carousel-scroll-y").props.scrollsChildToFocus).toBe(false)
})

it("keeps Tab-driven descendant focus reveal on its existing explicit native owner", async () => {
  const native = jest.requireActual<typeof RN>("react-native")
  jest.spyOn(native, "findNodeHandle").mockImplementation((node) => (node ? 33 : null))
  await render(tree(base()))
  const slide = slideHosts()[2]
  expect(slide.props.nativeFocusWithinBinding).not.toBe("")
  const packet = {
    ownerId: slide.props.ownerId,
    bindingId: slide.props.nativeFocusWithinBinding,
    target: 33,
    scopeOwnerId: "",
    windowId: "carousel-focus-window",
    scopeEpoch: 0,
    surfaceId: 1,
    sequence: 1,
    focusedTarget: 34,
    attached: true,
    active: true,
    within: true,
    textInputFocused: false,
    origin: "keyboard",
    observedAt: 0,
  }
  scrollCommands.mockClear()
  await fireEvent(slide, "nativeFocusWithin", { nativeEvent: packet })
  expect(scrollCommands).not.toHaveBeenCalled()
  await act(() =>
    mockKeyboardObservation?.onKeyDown?.({ nativeEvent: { key: "Tab" } } as Parameters<
      NonNullable<NonNullable<typeof mockKeyboardObservation>["onKeyDown"]>
    >[0]),
  )
  await fireEvent(slide, "nativeFocusWithin", { nativeEvent: { ...packet, sequence: 2 } })
  expect(scrollCommands).toHaveBeenLastCalledWith({ x: 600, y: 0, animated: false })
  expect(context.selectedIndex).toBe(2)
})
