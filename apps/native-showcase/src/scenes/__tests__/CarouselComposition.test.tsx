import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, forwardRef, useCallback, useEffect, useState } from "react"
import type * as RN from "react-native"
import { AccessibilityInfo, Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import {
  Carousel,
  CarouselCounter,
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  type TNativeCarouselContext,
} from "@codon-ui/react-native"

import { NativeShowcase } from "../NativeShowcase"

const mockActors = new Map<string, RN.View>()
const mockNodes = new Map<string, RN.View>()
const mockRects = new WeakMap<
  object,
  { offsetLeft: number; offsetTop: number; offsetWidth: number; offsetHeight: number }
>()
jest.mock("../../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps>((props, ref) => <Native.View {...props} ref={ref} />),
    Commands: {
      requestKeyboardFocus: jest.fn(),
      requestContainerFocus: jest.fn(),
      requestKeyboardBlur: jest.fn(),
      inspectAccessibility: jest.fn(),
    },
  }
})
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual<typeof import("react-native-safe-area-context")>("react-native-safe-area-context")
  const Native = jest.requireActual<typeof RN>("react-native")
  return { ...actual, SafeAreaProvider: Native.View, SafeAreaView: Native.View }
})
let activation = 0
beforeEach(() => {
  jest.useFakeTimers()
  mockActors.clear()
  mockNodes.clear()
  const Native = jest.requireActual<typeof RN>("react-native")
  const RawView = Native.View
  const MetricView = forwardRef<RN.View, RN.ViewProps & { ownerId?: string }>((props, ref) => {
    const identity = props.nativeID ?? props.testID
    const bind = useCallback(
      (view: RN.View | null) => {
        if (view) {
          if (identity) mockNodes.set(identity, view)
          if (props.ownerId) mockActors.set(props.ownerId, view)
          for (const field of ["offsetLeft", "offsetTop", "offsetWidth", "offsetHeight"] as const)
            Object.defineProperty(view, field, { configurable: true, get: () => mockRects.get(view)?.[field] ?? 0 })
        } else {
          if (identity) mockNodes.delete(identity)
          if (props.ownerId) mockActors.delete(props.ownerId)
        }
        if (typeof ref === "function") ref(view)
        else if (ref) ref.current = view
      },
      [ref, identity, props.ownerId],
    )
    return <RawView {...props} ref={bind} />
  })
  jest.spyOn(Native, "View", "get").mockReturnValue(MetricView as unknown as typeof Native.View)
  const original = Native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let next = 80000
  jest.spyOn(Native, "findNodeHandle").mockImplementation((view) => {
    const existing = original(view)
    if (existing || !view || typeof view !== "object") return existing
    if (!tags.has(view)) tags.set(view, ++next)
    return tags.get(view)!
  })
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const hidden = { includeHiddenElements: true }
const acknowledge = async () => {
  for (let turn = 0; turn < 8; turn++) {
    const host = screen.getByTestId("showcase-floating-host", hidden).props
    const revision = host.policyRevision
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "carousel-model-window",
          epoch: 1,
          policyRevision: revision,
          ready: true,
          windowActive: true,
        },
      }),
    )
    if (screen.getByTestId("showcase-floating-host", hidden).props.policyRevision === revision) return
  }
  throw new Error("Native window policy did not settle")
}
const press = async (name: string) => {
  const node = screen.getByRole("button", { name, ...hidden })
  if (!node.props.onNativeActivation) return userEvent.setup().press(node)
  let scope = node.parent
  while (scope && !scope.props.onNativeScopeStatus) scope = scope.parent
  if (!scope) throw new Error("Expected the real action's native window scope")
  await acknowledge()
  const host = screen.getByTestId("showcase-floating-host", hidden).props
  const original = mockActors.get(node.props.ownerId)
  if (!original) throw new Error("Original native action ref missing")
  await act(() =>
    node.props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        source: "ios-accessibility-activate",
        ownerId: node.props.ownerId,
        target: jest.requireActual<typeof RN>("react-native").findNodeHandle(original),
        observedAt: 0,
        activationId: ++activation,
        scopeOwnerId: host.ownerId,
        windowId: "carousel-model-window",
        epoch: 1,
      },
    }),
  )
}
const geometry = async (expectedCount = 9) => {
  const slides = screen.container.queryAll(
    (node) =>
      typeof node.props.nativeID === "string" &&
      (node.props.nativeID.startsWith("carousel-scene-") || node.props.nativeID.startsWith("carousel-owned-")) &&
      typeof node.props.onLayout === "function",
  )
  const viewport = mockNodes.get("carousel-viewport"),
    container = mockNodes.get("carousel-container")
  if (!viewport || !container || slides.length !== expectedCount)
    throw new Error("Expected original viewport/container and current slide refs")
  mockRects.set(viewport, { offsetLeft: 0, offsetTop: 0, offsetWidth: 400, offsetHeight: 220 })
  mockRects.set(container, { offsetLeft: 0, offsetTop: 0, offsetWidth: 400, offsetHeight: 220 })
  slides.forEach((slide, index) => {
    const original = mockNodes.get(slide.props.nativeID)
    if (!original) throw new Error("Original slide ref missing")
    mockRects.set(original, { offsetLeft: index * 400, offsetTop: 0, offsetWidth: 400, offsetHeight: 220 })
  })
  await acknowledge()
  await fireEvent(screen.getByTestId("carousel-viewport", hidden), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 220 } },
  })
  await act(() => jest.advanceTimersByTime(50))
  await acknowledge()
}

it("runs the maintained Carousel's actual engine while retaining original draft hosts through live owner changes and normal reset", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  await press("Carousel scene")
  await geometry()
  expect(screen.getByTestId("carousel-scene-state", hidden)).toHaveTextContent(/Snaps: 9/)
  await press("Next Item")
  expect(screen.getByTestId("carousel-scene-state", hidden)).toHaveTextContent(/Selected: 2/)
  await press("Previous Item")
  expect(screen.getByTestId("carousel-scene-state", hidden)).toHaveTextContent(/Selected: 1/)
  await press("Toggle loop")
  await geometry()
  expect(screen.getByRole("button", { name: "Previous Item", ...hidden })).toBeDisabled()
  const beforeDisabled = screen.getByTestId("carousel-scene-state", hidden).props.children
  await press("Previous Item")
  expect(screen.getByTestId("carousel-scene-state", hidden).props.children).toEqual(beforeDisabled)
  await press("Toggle loop")
  await geometry()
  await press("Change requested index")
  await geometry()
  expect(screen.getByTestId("carousel-scene-state", hidden)).toHaveTextContent(/Selected: 5\. Items: 9/)
  const editor = screen.getByLabelText("Item 1 editor", hidden),
    root = screen.getByTestId("carousel", hidden)
  await fireEvent.changeText(editor, "retained slide draft")
  expect(editor).toHaveDisplayValue("retained slide draft")
  await press("Reverse items")
  await geometry()
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
    await geometry()
    expect(screen.getByLabelText("Item 1 editor", hidden)).toBe(editor)
    expect(screen.getByTestId("carousel", hidden)).toBe(root)
    expect(editor).toHaveDisplayValue("retained slide draft")
    await press("Jump to first")
    expect(screen.getByTestId("carousel-scene-state", hidden)).toHaveTextContent(/Selected: 1\. Items: 9/)
  } finally {
    await act(() => Dimensions.set({ window }))
  }
  await press("Reset scene")
  expect(screen.queryByTestId("carousel")).toBeNull()
  await press("Carousel scene")
  await geometry()
  expect(screen.getByTestId("carousel-scene-state", hidden)).toHaveTextContent(/Selected: 1\. Items: 9/)
  expect(screen.getByLabelText("Item 1 editor", hidden)).toHaveDisplayValue("")
  expect(screen.getByTestId("carousel", hidden)).toHaveStyle({ backgroundColor: "#ffffff" })
})

it("retains the actual public Carousel engine, original nodes and edited owner draft through a deferred item reorder", async () => {
  const initial = [
    { ID: "keep", label: "Keep" },
    { ID: "b", label: "Beta" },
    { ID: "c", label: "Gamma" },
  ]
  let complete!: (items: typeof initial) => void
  const pending = new Promise<typeof initial>((resolve) => {
    complete = resolve
  })
  const viewport = createRef<RN.View>(),
    editor = createRef<RN.TextInput>(),
    context = createRef<TNativeCarouselContext>()
  const reports = jest.fn()
  const attach = (view: RN.View | null) => {
    viewport.current = view
  }
  const Owner = () => {
    const [items, setItems] = useState(initial)
    const [draft, setDraft] = useState("owner draft")
    useEffect(() => {
      let live = true
      void pending.then((next) => {
        if (live) setItems(next)
      })
      return () => {
        live = false
      }
    }, [])
    const Native = jest.requireActual<typeof RN>("react-native")
    return (
      <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}>
        <NativeThemeProvider>
          <NativeOverlayProvider>
            <NativeFloatingLayerHost testID="showcase-floating-host">
              <Carousel
                items={items}
                initialIndex={0}
                onIndexChange={reports}
                onViewportRefChange={attach}
                getItemID={(index) => `carousel-owned-${items[index].ID}`}
                style={{ height: 220 }}
                renderCarouselItem={({ item }) => (
                  <Native.TextInput
                    ref={item.ID === "keep" ? editor : undefined}
                    accessibilityLabel={item.label}
                    value={item.ID === "keep" ? draft : item.label}
                    onChangeText={item.ID === "keep" ? setDraft : undefined}
                  />
                )}
                chromeSlot={({ context: current }) => {
                  context.current = current
                  return <CarouselCounter />
                }}
              />
            </NativeFloatingLayerHost>
          </NativeOverlayProvider>
        </NativeThemeProvider>
      </SafeAreaInsetsContext.Provider>
    )
  }
  const view = await render(<Owner />)
  expect(reports).not.toHaveBeenCalled()
  await geometry(3)
  const api = context.current?.emblaApi
  if (!api) throw new Error("Expected the actual public engine after native geometry")
  const originalViewport = viewport.current,
    originalEditor = editor.current,
    originalSlides = api.slideNodes()
  expect(originalViewport).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  expect(api.rootNode()).toBe(originalViewport)
  expect(api.scrollSnapList()).toHaveLength(3)
  expect(originalSlides).toHaveLength(3)
  await fireEvent.changeText(screen.getByLabelText("Keep", hidden), "edited source draft")
  await act(async () => {
    complete([
      { ID: "keep", label: "Keep renamed" },
      { ID: "c", label: "Gamma renamed" },
      { ID: "b", label: "Beta renamed" },
    ])
    await pending
  })
  await geometry(3)
  expect(context.current?.emblaApi).toBe(api)
  expect(viewport.current).toBe(originalViewport)
  expect(editor.current).toBe(originalEditor)
  expect(api.slideNodes()).toEqual([originalSlides[0], originalSlides[2], originalSlides[1]])
  expect(screen.getByLabelText("Keep renamed", hidden)).toHaveDisplayValue("edited source draft")
  expect(api.selectedScrollSnap()).toBe(0)
  expect(reports.mock.calls.length).toBeGreaterThan(0)
  expect(reports.mock.calls.every(([index]) => index === 0)).toBe(true)
  await view.unmount()
  expect(viewport.current).toBeNull()
  expect(editor.current).toBeNull()
})
