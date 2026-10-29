import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import type * as RN from "react-native"
import { AccessibilityInfo, Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

const mockViews = new Map<string, RN.View>()
jest.mock("../../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const bind = React.useCallback(
        (view: RN.View | null) => {
          if (view) mockViews.set(props.ownerId, view)
          else mockViews.delete(props.ownerId)
          if (typeof ref === "function") ref(view)
          else if (ref) ref.current = view
        },
        [ref, props.ownerId],
      )
      return <Native.View {...props} ref={bind} />
    }),
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

const hidden = { includeHiddenElements: true }
let activation = 0
beforeEach(() => {
  jest.useFakeTimers()
  mockViews.clear()
  const native = jest.requireActual<typeof RN>("react-native")
  const original = jest.isMockFunction(native.findNodeHandle)
    ? jest.mocked(native.findNodeHandle).getMockImplementation()!
    : native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let next = 70000
  jest.spyOn(native, "findNodeHandle").mockImplementation((view) => {
    if (!view || typeof view !== "object") return original(view)
    if (!tags.has(view)) tags.set(view, ++next)
    return tags.get(view)!
  })
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const press = async (name: string) => {
  const node = screen.getByRole("button", { name, ...hidden })
  if (typeof node.props.onNativeActivation !== "function") return userEvent.setup().press(node)
  let scope = node.parent
  while (scope && !scope.props.onNativeScopeStatus) scope = scope.parent
  if (!scope) throw new Error("Expected the action's same-window native scope")
  const host = scope.props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: host.ownerId,
        epoch: 1,
        policyRevision: host.policyRevision,
        ready: true,
        windowActive: true,
      },
    }),
  )
  const view = mockViews.get(node.props.ownerId)
  if (!view) throw new Error("Expected the action's original native ref")
  await act(() =>
    node.props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        source: "ios-accessibility-activate",
        ownerId: node.props.ownerId,
        target: jest.requireActual<typeof RN>("react-native").findNodeHandle(view),
        observedAt: 0,
        activationId: ++activation,
        scopeOwnerId: host.ownerId,
        windowId: host.ownerId,
        epoch: 1,
      },
    }),
  )
}
const renderShowcase = async () =>
  render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
const enter = async () => {
  await renderShowcase()
  await press("Panel scene")
  await press("Open panel")
  const window = screen.getByTestId("panel-window", hidden)
  await fireEvent(window, "show")
  return window.props.onDismiss as () => void
}

it("retains Panel's owner veto and original editor through live theme, side, fixture and window changes", async () => {
  await enter()
  const editor = screen.getByLabelText("Held query", hidden)
  await fireEvent.changeText(editor, "declined draft")
  await press("Request close")
  await press("Request close")
  expect(screen.getByTestId("panel-window", hidden).props.visible).toBe(true)
  expect(screen.getByText("Close requests: 2", hidden)).toBeOnTheScreen()
  await press("Toggle physical side")
  await press("Toggle scene theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
    expect(screen.getByLabelText("Held query", hidden)).toBe(editor)
    expect(editor).toHaveDisplayValue("")
    expect(screen.getByTestId("panel", hidden)).toHaveStyle({ right: 0, backgroundColor: "#171717" })
    expect(screen.getByText("Close requests: 2", hidden)).toBeOnTheScreen()
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("echoes Panel closure and restores the complete scene owner through normal showcase reset", async () => {
  const dismissed = await enter()
  await press("Toggle physical side")
  await press("Toggle panel appearance")
  await press("Toggle scene theme")
  await press("Toggle veto")
  await press("Request close")
  await act(() => dismissed())
  await act(() => jest.runAllTimers())
  expect(screen.queryByTestId("panel")).toBeNull()
  await press("Reset scene")
  await press("Panel scene")
  expect(screen.getByText("Owner open: false")).toBeOnTheScreen()
  expect(screen.getByText("Close requests: 0")).toBeOnTheScreen()
  await press("Open panel")
  await fireEvent(screen.getByTestId("panel-window", hidden), "show")
  expect(screen.getByText("Owner veto: true", hidden)).toBeOnTheScreen()
  expect(screen.getByLabelText("Held query", hidden)).toHaveDisplayValue("")
  expect(screen.getByTestId("panel", hidden)).toHaveStyle({ left: 0, backgroundColor: "#ffffff", padding: 0 })
})

it("opens the standalone query scene through the same chooser without nesting overlay providers", async () => {
  await renderShowcase()
  await press("Sort and Filter scene")
  expect(screen.getByRole("button", { name: "Open query panel" })).toBeOnTheScreen()
  expect(JSON.parse(screen.getByTestId("query-panel-owner").props.children as string)).toMatchObject({
    confirmed: { sortInstructions: [], filterGroups: [] },
    requests: [],
    closeRequests: 0,
    echo: false,
  })
})
