import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type RefObject } from "react"
import { AccessibilityInfo, Linking, StyleSheet, View } from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "../../.."
import { useNativeFloatingHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { resolveNativeTheme } from "../../../theme/defaults"
import type { TNativeClickPopoverProps } from "../../ClickPopover/types"
import { Breadcrumbs } from "../Breadcrumbs"
import type { TNativeBreadcrumbItem } from "../model"
import type { TNativeBreadcrumbsProps } from "../types"

const hidden = { includeHiddenElements: true }
const items: readonly TNativeBreadcrumbItem[] = ["A", "B", "C", "D", "E", "F"].map((content) => ({
  id: content,
  content,
  href: `#${content}`,
  disabled: false,
}))
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0
beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  frames.clear()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id !== null && id !== undefined) frames.delete(id)
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const event = () => {
  let prevented = false
  return {
    nativeEvent: { timestamp: 0 },
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  }
}
const press = async (name: string) => fireEvent(screen.getByRole("button", { name, ...hidden }), "press", event())
const pressOption = async (id: string) => {
  // The portal mock retains its React background ancestry; invoke the actual responder handlers on the ready native row.
  const node = screen.getByTestId(`breadcrumb-option-${id}`, hidden)
  let prevented = false
  const touch = {
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
    target: 17,
    currentTarget: 17,
    nativeEvent: { target: 17, timestamp: 0, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
  }
  await act(() => node.props.onResponderGrant(touch))
  await act(() => node.props.onResponderRelease(touch))
}
const fixture = (initial: Partial<TNativeBreadcrumbsProps> = {}) => {
  const host = createRef<View>(),
    anchor = createRef<View>(),
    popup = createRef<View>(),
    root = createRef<View>()
  // The forwarded ref observes the actual private surface for native measurement; it does not replace geometry.
  let observed: ReturnType<typeof useNativeFloatingHost>
  const Probe = () => {
    observed = useNativeFloatingHost()
    return null
  }
  const authored: Partial<TNativeClickPopoverProps> & { ref: RefObject<View | null> } = {
    ref: popup,
    triggerRef: anchor,
  }
  const node = (props: Partial<TNativeBreadcrumbsProps> = initial, mode: "light" | "dark" = "light") => (
    <NativeThemeProvider mode={mode}>
      <NativeFloatingLayerHost testID="host" ref={host}>
        <Probe />
        <View ref={anchor} />
        <Breadcrumbs
          ref={root}
          items={items}
          {...props}
          customClickPopoverProps={{ ...authored, ...props.customClickPopoverProps }}
        />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
  const tick = async () =>
    act(() => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(0))
    })
  const layout = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } })
  const measure = (view: View, value: [number, number, number, number]) =>
    Object.defineProperty(view, "measureInWindow", {
      configurable: true,
      value: jest.fn((callback: Parameters<View["measureInWindow"]>[0]) => callback(...value)),
    })
  const ready = async () => {
    measure(host.current!, [0, 0, 300, 400])
    measure(anchor.current!, [80, 80, 40, 30])
    measure(popup.current!, [0, 0, 220, 180])
    await fireEvent(screen.getByTestId("host"), "layout", layout(300, 400))
    await fireEvent(screen.getByTestId("click-popover", hidden), "layout", layout(220, 180))
    await fireEvent(screen.getByTestId("breadcrumb-overflow-list", hidden), "layout", layout(220, 180))
    await tick()
    const order = observed!.layers.presentationOrder()
    expect(order).toHaveLength(1)
    expect(observed!.layers.state(order[0])).toMatchObject({ phase: "open", active: true })
  }
  return { node, ready, tick, root, popup }
}

it("CAP.breadcrumbs renders the canonical default trail with the current item passive and actual root ref", async () => {
  const f = fixture()
  await render(f.node())
  expect(f.root.current).not.toBeNull()
  expect(screen.getByTestId("breadcrumbs")).toHaveStyle({ flexDirection: "row", flexWrap: "wrap", gap: 5 })
  expect(screen.getAllByRole("link")).toHaveLength(3)
  expect(screen.getByTestId("breadcrumb-current")).toHaveTextContent("F")
  expect(screen.getByTestId("breadcrumb-current")).toHaveStyle({ fontWeight: "700", opacity: 1 })
  expect(screen.queryByRole("link", { name: "F" })).toBeNull()
  expect(Linking.openURL).not.toHaveBeenCalled()
})
it("CAP.breadcrumbs maps explicit color onto root/item content without mutating the palette", async () => {
  const f = fixture({ color: "red" })
  await render(f.node())
  for (const label of ["A", "B", "C", "F"]) expect(screen.getByText(label)).toHaveStyle({ color: "red" })
})
it.each(["light", "dark"] as const)(
  "CAP.breadcrumbs maps every order through native theme roles in %s",
  async (mode) => {
    const f = fixture()
    await render(f.node({}, mode))
    for (const order of ["primary", "secondary", "tertiary", "quaternary", "quintenary"] as const) {
      await screen.rerender(f.node({ order }, mode))
      const before = StyleSheet.flatten(screen.getByText("A").props.style).color
      expect(before).toBe(resolveNativeTheme(mode).actions[order].background)
      expect(screen.getByText("F")).toHaveStyle({ color: before })
      await screen.rerender(f.node({ order, color: "red" }, mode))
      expect(screen.getByText("A")).toHaveStyle({ color: before })
    }
  },
)
it("CAP.breadcrumbs uses exact visible limits and both consolidation positions", async () => {
  const f = fixture({ maxVisibleItems: 3, consolidationPlacement: "left" })
  await render(f.node())
  expect(screen.getAllByRole("link").map((link) => link.props.testID)).toEqual([
    "breadcrumb-link-A",
    "breadcrumb-link-E",
  ])
  await screen.rerender(f.node({ maxVisibleItems: 3, consolidationPlacement: "right" }))
  expect(screen.getAllByRole("link").map((link) => link.props.testID)).toEqual([
    "breadcrumb-link-A",
    "breadcrumb-link-B",
  ])
})
it("CAP.breadcrumbs keeps global/member disabled guards authoritative over custom link props", async () => {
  const f = fixture({ isDisabled: true })
  await render(f.node())
  for (const link of screen.getAllByRole("link")) expect(link).toBeDisabled()
  expect(screen.getByRole("button")).toBeDisabled()
  await screen.rerender(
    f.node({
      items: items.map((item) => ({ ...item, disabled: item.id === "A" })),
      customBreadcrumbLinkProps: { isDisabled: false },
    }),
  )
  expect(screen.getByTestId("breadcrumb-link-A")).toBeDisabled()
})
it("CAP.breadcrumbs merges root/custom/final and computed link props without losing exact zero or href", async () => {
  const f = fixture({
    customStyles: { backgroundColor: "green", width: 0 },
    style: { backgroundColor: "blue", height: 0 },
    customBreadcrumbStyles: { color: "green" },
    customBreadcrumbLinkProps: {
      href: "forged",
      order: "secondary",
      isDisabled: true,
      customStyles: { backgroundColor: "yellow" },
      style: { color: "purple", marginTop: 4 },
    },
    order: "primary",
  })
  await render(f.node())
  expect(screen.getByTestId("breadcrumbs")).toHaveStyle({ backgroundColor: "blue", width: 0, height: 0 })
  const link = screen.getByTestId("breadcrumb-link-A")
  expect(link).not.toBeDisabled()
  expect(link).toHaveStyle({ backgroundColor: "yellow", marginTop: 4 })
  expect(screen.getByText("A")).toHaveStyle({ color: "purple" })
  await fireEvent(link, "press", event())
  expect(Linking.openURL).toHaveBeenCalledWith("#A")
})
it("CAP.breadcrumbs preserves localized/empty labels and consumes wrapper props", async () => {
  const f = fixture({ ariaLabel: "Trail", labels: { overflowButtonAriaLabel: "Show levels" }, maxVisibleItems: 3 })
  await render(f.node())
  expect(screen.getByTestId("breadcrumbs").props.accessibilityLabel).toBe("Trail")
  expect(screen.getByRole("button", { name: "Show levels" })).toBeOnTheScreen()
  for (const name of [
    "items",
    "color",
    "order",
    "geometry",
    "maxVisibleItems",
    "consolidationPlacement",
    "isDisabled",
    "onNavigate",
  ])
    expect(screen.getByTestId("breadcrumbs").props[name]).toBeUndefined()
  await screen.rerender(f.node({ "aria-label": "", ariaLabel: "ignored", labels: { overflowButtonAriaLabel: "" } }))
  expect(screen.getByTestId("breadcrumbs").props.accessibilityLabel).toBe("")
  expect(screen.getByRole("button").props.accessibilityLabel).toBe("")
})
it("CAP.breadcrumbs routes ordered relationship IDs into its nonfocusable native root without changing caller metadata", async () => {
  const f = fixture({
    ariaLabelledBy: " heading\tsection ",
    ariaDescribedBy: "summary explanation",
    ariaDetails: "full-details",
    accessibilityLabel: "Fallback",
    accessibilityHint: "Hint",
    accessibilityValue: { now: 0, text: "" },
    labels: { descriptionLabel: "Description localisée", detailsLabel: "" },
  })
  await render(f.node())
  expect(screen.getByTestId("breadcrumbs").props).toMatchObject({
    nativeLabelledBy: ["heading", "section"],
    nativeDescribedBy: ["summary", "explanation"],
    nativeDetailsBy: ["full-details"],
    nativeDescriptionLabel: "Description localisée",
    nativeDetailsLabel: "",
    accessibilityLabel: "Fallback",
    accessibilityHint: "Hint",
    accessibilityValue: { now: 0, text: "" },
    keyboardFocusable: false,
    accessible: false,
  })
  expect(f.root.current).not.toBeNull()
  await screen.rerender(
    f.node({ "aria-labelledby": "", ariaLabelledBy: "ignored", "aria-describedby": "", "aria-details": "" }),
  )
  expect(screen.getByTestId("breadcrumbs").props).toMatchObject({
    nativeLabelledBy: [],
    nativeDescribedBy: [],
    nativeDetailsBy: [],
  })
  await screen.rerender(f.node({ accessibilityLabelledBy: ["native-a", "native-b"], ariaLabelledBy: "ignored" }))
  expect(screen.getByTestId("breadcrumbs").props.nativeLabelledBy).toEqual(["native-a", "native-b"])
  expect(screen.getByTestId("breadcrumbs").props.nativeDescribedBy).toBeUndefined()
  expect(screen.getByTestId("breadcrumbs").props.nativeDetailsBy).toBeUndefined()
})
it("CAP.breadcrumbs applies independent overflow/list/popover/dialog overrides and closes before one owner navigation request", async () => {
  const onNavigate = jest.fn()
  const f = fixture({
    maxVisibleItems: 3,
    onNavigate,
    linkTarget: "_self",
    customOptionsListStyles: { backgroundColor: "blue" },
    customPopoverStyles: { backgroundColor: "purple" },
    customOverflowItemsPopoverButtonStyles: { backgroundColor: "magenta" },
    customClickPopoverProps: { customDialogStyles: { padding: 0 } },
  })
  await render(f.node())
  expect(screen.getByRole("button")).toHaveStyle({ backgroundColor: "magenta" })
  await press("Visually Consolidated Breadcrumbs")
  await f.ready()
  expect(screen.getByTestId("click-popover", hidden)).toHaveStyle({ backgroundColor: "purple", maxWidth: 250 })
  expect(screen.getByTestId("click-popover-dialog", hidden)).toHaveStyle({ padding: 0, outlineOffset: 2 })
  expect(screen.getByTestId("breadcrumb-overflow-scroll", hidden).props.contentContainerStyle).toMatchObject({
    backgroundColor: "blue",
  })
  await pressOption("C")
  await f.tick()
  expect(onNavigate.mock.calls).toEqual([[{ href: "#C", item: items[2], target: "_self" }]])
  expect(Linking.openURL).not.toHaveBeenCalled()
  expect(screen.queryByTestId("click-popover", hidden)).toBeNull()
})
it("CAP.breadcrumbs preserves controlled child-open veto and the original owner navigation payload", async () => {
  const onOpenChange = jest.fn(),
    onNavigate = jest.fn()
  const f = fixture({ customClickPopoverProps: { isOpen: true, onOpenChange }, onNavigate })
  await render(f.node())
  await f.ready()
  await pressOption("D")
  expect(onOpenChange.mock.calls).toEqual([[false]])
  expect(onNavigate.mock.calls[0]?.[0]).toEqual({ href: "#D", item: items[3], target: "_blank" })
  expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
  await screen.rerender(f.node({ onNavigate: undefined, customClickPopoverProps: { isOpen: false } }))
  await f.tick()
})

it("CAP.breadcrumbs opens one exact overflow URL when no owner handler is supplied and retires delayed errors at unmount", async () => {
  let reject: (error: unknown) => void = () => {}
  jest.mocked(Linking.openURL).mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  )
  const error = jest.fn(),
    f = fixture({ maxVisibleItems: 3, onNavigationError: error })
  await render(f.node())
  await press("Visually Consolidated Breadcrumbs")
  await f.ready()
  await pressOption("C")
  await f.tick()
  expect(jest.mocked(Linking.openURL).mock.calls).toEqual([["#C"]])
  await screen.unmount()
  await act(async () => reject(new Error("retired")))
  expect(error).not.toHaveBeenCalled()
})
it("preserves caller-owned false popup state and reads a custom default only at the overflow mount", async () => {
  const changed = jest.fn(),
    f = fixture({ customClickPopoverProps: { isOpen: false, onOpenChange: changed } })
  await render(f.node())
  await press("Visually Consolidated Breadcrumbs")
  expect(screen.queryByTestId("click-popover", hidden)).toBeNull()
  expect(changed).not.toHaveBeenCalled()
  await screen.unmount()
  const local = fixture({ customClickPopoverProps: { defaultOpen: true, onOpenChange: changed } })
  await render(local.node())
  await local.ready()
  await screen.rerender(local.node({ customClickPopoverProps: { defaultOpen: false, onOpenChange: changed } }))
  expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
  await pressOption("D")
  await local.tick()
  expect(changed.mock.calls).toEqual([[false]])
  expect(Linking.openURL).toHaveBeenCalledWith("#D")
})
it("retains caller relabel/reorder/removal and authored link styles while making the new last item passive", async () => {
  const f = fixture({ items: items.slice(0, 3), maxVisibleItems: 8 })
  await render(f.node())
  await screen.rerender(f.node({ items: [items[2], { ...items[0], content: "Renamed" }], maxVisibleItems: 8 }))
  expect(screen.getAllByRole("link").map((link) => link.props.testID)).toEqual(["breadcrumb-link-C"])
  expect(screen.getByTestId("breadcrumb-current")).toHaveTextContent("Renamed")
  expect(screen.queryByRole("button")).toBeNull()
  await screen.rerender(f.node({ items: [] }))
  expect(screen.queryAllByRole("link")).toHaveLength(0)
  expect(screen.queryByTestId("breadcrumb-current")).toBeNull()
})
it("preserves the original item and current owner callback after a mounted label/theme update", async () => {
  const first = jest.fn(),
    next = jest.fn(),
    f = fixture({ onNavigate: first })
  await render(f.node())
  await press("Visually Consolidated Breadcrumbs")
  await f.ready()
  await screen.rerender(
    f.node({ onNavigate: next, labels: { overflowListAriaLabel: "Updated hidden levels" } }, "dark"),
  )
  expect(screen.getByTestId("breadcrumb-overflow-list", hidden).props.accessibilityLabel).toBe("Updated hidden levels")
  await pressOption("D")
  await f.tick()
  expect(first).not.toHaveBeenCalled()
  expect(next.mock.calls[0]?.[0].item).toBe(items[3])
})

it("does not queue a navigation action when the caller's controlled close callback throws", async () => {
  const failure = new Error("declined with error"),
    onNavigate = jest.fn()
  const f = fixture({
    onNavigate,
    customClickPopoverProps: {
      isOpen: true,
      onOpenChange: () => {
        throw failure
      },
    },
  })
  await render(f.node())
  await f.ready()
  await expect(pressOption("D")).rejects.toThrow(failure)
  await f.tick()
  expect(onNavigate).not.toHaveBeenCalled()
  expect(Linking.openURL).not.toHaveBeenCalled()
})

it("NAV.001/.003 binds enabled navigation and passive localized current-page metadata", async () => {
  const f = fixture({
    labels: { navigationRoleDescription: "Navigation locale", currentPageValue: "Page actuelle" },
    accessibilityValue: { now: 0, text: "" },
  })
  await render(f.node())
  expect(screen.getByTestId("breadcrumbs").props).toMatchObject({
    nativeNavigation: true,
    nativeNavigationLabel: "Navigation locale",
    accessible: false,
    keyboardFocusable: false,
    accessibilityValue: { now: 0, text: "" },
  })
  expect(screen.getByTestId("breadcrumb-current").props).toMatchObject({
    accessibilityState: { selected: true },
    accessibilityValue: { text: "Page actuelle" },
  })
  expect(screen.queryByRole("button", { name: "F" })).toBeNull()
  expect(f.root.current).not.toBeNull()
  await screen.rerender(f.node({ isDisabled: true }))
  expect(screen.getByTestId("breadcrumbs").props.nativeNavigation).toBe(false)
  await screen.rerender(f.node({ labels: { navigationRoleDescription: "", currentPageValue: "" } }))
  expect(screen.getByTestId("breadcrumbs").props.nativeNavigationLabel).toBe("")
  expect(screen.getByTestId("breadcrumb-current").props.accessibilityValue).toEqual({ text: "" })
})

it("NAV.003 moves passive current status only with the caller's actual breadcrumb collection", async () => {
  const f = fixture({ items: items.slice(0, 2) })
  await render(f.node())
  expect(screen.getByTestId("breadcrumb-current")).toHaveTextContent("B")
  expect(screen.getByTestId("breadcrumb-current").props.accessibilityValue).toEqual({ text: "Current page" })
  await screen.rerender(f.node({ items: items.slice(0, 3) }))
  expect(screen.getByTestId("breadcrumb-current")).toHaveTextContent("C")
  expect(screen.getByTestId("breadcrumb-link-B").props.accessibilityValue).toBeUndefined()
  expect(Linking.openURL).not.toHaveBeenCalled()
})
