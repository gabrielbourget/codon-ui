import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native"
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

const mockPolicies = new Map<string, TNativeKeyPolicy>()
jest.mock("../../../input/NativeKeyboardScope", () => ({
  useNativeKeyScope: () => null,
  useNativeWindowPointers: () => null,
  useNativeKeyPolicy: (policy: TNativeKeyPolicy) => {
    mockPolicies.set(policy.lifetimeKey, policy)
  },
  useNativeKeyboardObservation: () => {},
}))
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react"),
    Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps>((props, ref) => {
      const attach = React.useCallback(
        (node: RN.View | null) => {
          if (node)
            Object.defineProperties(node, {
              offsetWidth: { configurable: true, value: 300 },
              offsetHeight: { configurable: true, value: 200 },
              offsetTop: { configurable: true, value: 0 },
              offsetLeft: {
                configurable: true,
                value: Math.max(0, Number(props.nativeID?.match(/^carousel-item-index-(\d+)$/)?.[1] ?? 1) - 1) * 300,
              },
              offsetParent: { configurable: true, value: {} },
              getBoundingClientRect: {
                configurable: true,
                value: () => ({ top: 0, left: 0, width: 300, height: 200, right: 300, bottom: 200 }),
              },
            })
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        },
        [ref, props.nativeID],
      )
      return <Native.View {...props} ref={attach} />
    }),
    Commands: {
      requestKeyboardFocus: jest.fn(),
      requestContainerFocus: jest.fn(),
      requestKeyboardBlur: jest.fn(),
      inspectAccessibility: jest.fn(),
    },
  }
})
jest.mock("../engine/EmblaCarousel", () => {
  const create = jest.requireActual<typeof import("../engine/EmblaCarousel")>("../engine/EmblaCarousel").default
  return {
    __esModule: true,
    default: (...args: Parameters<typeof create>) => {
      const nodes = args[1].environment.nodes()
      for (const [index, binding] of [nodes.container, ...nodes.slides].entries()) {
        Object.defineProperties(binding.node, {
          offsetWidth: { configurable: true, value: 300 },
          offsetHeight: { configurable: true, value: 200 },
          offsetLeft: { configurable: true, value: Math.max(0, index - 1) * 300 },
          offsetTop: { configurable: true, value: 0 },
          offsetParent: { configurable: true, value: {} },
        })
      }
      return create(...args)
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
beforeEach(() => {
  jest.useFakeTimers()
  mockPolicies.clear()
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

it("composes the whole family, initial selection, labels, real viewport and raw native nodes", async () => {
  const onIndexChange = jest.fn(),
    onViewportRefChange = jest.fn()
  await render(
    tree({ ...base(), initialIndex: 1, onIndexChange, onViewportRefChange, getItemID: (index) => `custom-${index}` }),
  )
  expect(screen.getByTestId("carousel").props.accessibilityLabel).toBe("Content Carousel")
  expect(context.selectedIndex).toBe(1)
  expect(onIndexChange).toHaveBeenLastCalledWith(1)
  expect(context.emblaApi!.rootNode()).toBe(onViewportRefChange.mock.calls.at(-1)![0])
  expect(context.emblaApi!.slideNodes()).toHaveLength(3)
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
    props = { ...base(), loopEnabled: false, onIndexChange: first }
  const { rerender } = await render(tree(props))
  const api = context.emblaApi!
  await act(() => api.scrollTo(2, true))
  await rerender(tree({ ...props, customStyles: { opacity: 0.5 } }))
  expect(context.emblaApi).toBe(api)
  expect(context.selectedIndex).toBe(2)
  await rerender(tree({ ...props, onIndexChange: next }))
  expect(next.mock.calls).toEqual([[2]])
  await rerender(tree({ ...props, onIndexChange: next, initialIndex: -10 }))
  expect(context.selectedIndex).toBe(0)
  await rerender(tree({ ...props, onIndexChange: next, initialIndex: 99 }))
  expect(context.selectedIndex).toBe(2)
})

it("preserves ref callback replacement and retires the actual engine on unmount", async () => {
  const first = jest.fn(),
    next = jest.fn()
  const props = base(),
    { rerender, unmount } = await render(tree({ ...props, onViewportRefChange: first }))
  const api = context.emblaApi!,
    host = api.rootNode(),
    destroyed = jest.fn()
  api.on("destroy", destroyed)
  await rerender(tree({ ...props, onViewportRefChange: next }))
  expect(first.mock.calls.at(-1)).toEqual([null])
  expect(next.mock.calls.at(-1)).toEqual([host])
  expect(context.emblaApi).toBe(api)
  await unmount()
  expect(next.mock.calls.at(-1)).toEqual([null])
  expect(destroyed).toHaveBeenCalledTimes(1)
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
  const props = { ...base(), loopEnabled: false },
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
  const scrollNext = jest.spyOn(context.emblaApi!, "scrollNext")
  await key("ArrowDown")
  expect(scrollNext).toHaveBeenCalledTimes(1)
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

it("retains original keyed item hosts through reordering and resynchronizes on count changes", async () => {
  const props = base(),
    { rerender } = await render(tree(props))
  const api = context.emblaApi!,
    original = api.slideNodes()
  await act(() => api.scrollTo(2, true))
  await rerender(tree({ ...props, items: [...items].reverse() }))
  expect(context.emblaApi).toBe(api)
  expect(api.slideNodes()).toEqual([...original].reverse())
  expect(context.selectedIndex).toBe(2)
  await rerender(tree({ ...props, items: [...items, { ID: "d", title: "Fourth" }] }))
  expect(api.slideNodes()).toHaveLength(4)
  expect(context.selectedIndex).toBe(0)
  await rerender(tree({ ...props, items: [] }))
  expect(api.slideNodes()).toEqual([])
  expect(context.itemCount).toBe(0)
})

it("resynchronizes the requested index when the raw owner disables slide observation", async () => {
  const props = base(),
    { rerender } = await render(tree(props))
  const api = context.emblaApi!
  await act(() => {
    api.scrollTo(2, true)
    api.reInit({ watchSlides: false })
  })
  await rerender(tree({ ...props, items: items.slice(0, 2) }))
  expect(api.slideNodes()).toHaveLength(3)
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
  expect(observed.some((node) => node === context.emblaApi?.rootNode())).toBe(true)
  await view.rerender(tree({ ...props, keyboardNavigationTarget: "root" }))
  expect(policy().targetTag).toBe(27)
  expect(observed.some((node) => node.props.testID === "carousel")).toBe(true)
})
