import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo, type View } from "react-native"

import { NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import { PaginationScene } from "../PaginationScene"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const hidden = { includeHiddenElements: true }
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const node = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost testID="pager-host">
        <PaginationScene />
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const press = async (name: string) => userEvent.setup().press(screen.getByRole("button", { name, ...hidden }))

it("keeps page requests owner-controlled and retains the independent draft through theme/style/owner changes", async () => {
  const result = await render(node())
  await press("Next Page")
  await press("Toggle pager echo")
  await press("Next Page")
  await press("Next Page")
  expect(screen.getByTestId("pagination-scene-state")).toHaveTextContent(/Page: 4.*declines.*page:4, page:5, page:5/)
  await fireEvent.changeText(screen.getByLabelText("Page number"), "7")
  await press("Toggle pager styles")
  await press("Toggle pager RTL")
  await press("Toggle pager geometry")
  await press("Next pager order")
  await press("Replace owner page")
  await result.rerender(node("dark"))
  expect(screen.getByLabelText("Page number")).toHaveDisplayValue("7")
  await press("Navigate to Selected Page")
  expect(screen.getByTestId("pagination-scene-state")).toHaveTextContent(/Page: 3.*page:7.*Last text event: 7/)
})

it("requests size before the coordinated page and keeps declined size authoritative", async () => {
  await render(node())
  await press("Toggle pager echo")
  await press("Page size")
  const modal = screen.getByTestId("pagination-scene-size-window", hidden),
    dismissed = modal.props.onDismiss
  await fireEvent(modal, "show")
  await fireEvent.press(screen.getByRole("radio", { name: "20" }))
  await act(() => dismissed())
  expect(screen.getByTestId("pagination-scene-state")).toHaveTextContent(/Page: 3.*Size: 10.*size:20, page:2/)
  await press("Toggle pager empty data")
  expect(screen.getByTestId("pagination")).toBeOnTheScreen()
  await press("Toggle pager groups")
  expect(screen.queryByTestId("page-input")).toBeNull()
  await press("Reset pager")
  expect(screen.getByTestId("pagination-scene-state")).toHaveTextContent(/Page: 3.*Size: 10.*Requests: none/)
})

it("keeps a controlled overflow open while the owner declines its page selection", async () => {
  await render(node())
  await press("Toggle pager echo")
  await press("Show controlled pager popup")
  for (const [element, rect] of [
    [screen.getByTestId("pager-host"), [0, 0, 400, 700]],
    [screen.getByRole("button", { name: "Show other pages", ...hidden }), [100, 100, 48, 48]],
    [screen.getByTestId("click-popover", hidden), [0, 0, 220, 200]],
  ] as const) {
    let fiber = element.unstable_fiber,
      native: View | null = null
    while (fiber) {
      const value = fiber.stateNode as View | null
      if (typeof value?.measureInWindow === "function") {
        native = value
        break
      }
      fiber = fiber.return
    }
    expect(native).not.toBeNull()
    Object.defineProperty(native, "measureInWindow", {
      configurable: true,
      value: jest.fn((callback: Parameters<View["measureInWindow"]>[0]) =>
        callback(rect[0], rect[1], rect[2], rect[3]),
      ),
    })
  }
  await fireEvent(screen.getByTestId("pager-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } },
  })
  for (const ready of [false, true]) {
    const host = screen.getByTestId("pager-host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "pager-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  const target = screen.getByTestId("pagination-option-page-2", hidden),
    host = screen.getByTestId("pager-host").props
  await act(() =>
    target.props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        source: "android-click",
        ownerId: target.props.ownerId,
        activationId: 1,
        target: 17,
        observedAt: 0,
        scopeOwnerId: host.ownerId,
        windowId: "pager-window",
        epoch: 1,
      },
    }),
  )
  expect(screen.getByTestId("pagination-scene-state", hidden)).toHaveTextContent(/Page: 1.*page:2/)
  expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
})
