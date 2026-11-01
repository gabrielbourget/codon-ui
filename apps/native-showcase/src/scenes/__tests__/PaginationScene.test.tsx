import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native"
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

it("keeps primary pager customizations independent without requesting a page or replacing the draft host", async () => {
  const result = await render(node())
  await fireEvent.changeText(screen.getByLabelText("Page number"), "7")
  const editorHost = screen.getByLabelText("Page number").unstable_fiber?.stateNode
  expect(editorHost).toBeTruthy()
  await press("Toggle pager separator styles")
  expect(screen.getByTestId("pagination-separator-0")).toHaveStyle({ width: 3, backgroundColor: "#087f8c" })
  for (const [name, id, borderColor] of [
    ["first", "first", "#be123c"],
    ["previous", "previous", "#d97706"],
    ["next", "next", "#166534"],
    ["last", "last", "#7c3aed"],
  ] as const) {
    await press(`Toggle pager ${name} button styles`)
    expect(screen.getByTestId(`pagination-${id}`)).toHaveStyle({ borderWidth: 2, borderColor })
  }
  await press("Toggle pager page button styles")
  expect(screen.getByTestId("pagination-page-3")).toHaveStyle({ backgroundColor: "#d1fae5", borderColor: "#166534" })
  await result.rerender(node("dark"))
  expect(screen.getByLabelText("Page number")).toHaveDisplayValue("7")
  expect(screen.getByLabelText("Page number").unstable_fiber?.stateNode).toBe(editorHost)
  expect(screen.getByTestId("pagination-scene-state")).toHaveTextContent(/Page: 3.*Size: 10.*Requests: none/)
  await press("Toggle pager next button styles")
  expect(screen.getByTestId("pagination-next")).not.toHaveStyle({ borderColor: "#166534" })
  expect(screen.getByTestId("pagination-last")).toHaveStyle({ borderColor: "#7c3aed" })
  await press("Reset pager")
  expect(screen.getByTestId("pagination-customization-state")).toHaveTextContent("Pager customizations: none.")
  expect(screen.getByTestId("pagination-first")).not.toHaveStyle({ borderColor: "#be123c" })
})

it("keeps composed pager customizations on their own slots while retaining draft and size request ordering", async () => {
  const result = await render(node())
  await fireEvent.changeText(screen.getByLabelText("Page number"), "7")
  await press("Toggle pager echo")
  await press("Toggle pager counter styles")
  expect(within(screen.getByTestId("page-counter")).getByTestId("counter")).toHaveStyle({
    padding: 7,
    borderColor: "#7c3aed",
  })
  await press("Toggle pager page field styles")
  expect(within(screen.getByTestId("page-input")).getByTestId("form-field")).toHaveStyle({
    padding: 8,
    borderColor: "#087f8c",
  })
  await press("Toggle pager size field styles")
  expect(within(screen.getByTestId("items-per-page")).getByTestId("form-field")).toHaveStyle({
    padding: 9,
    borderColor: "#d97706",
  })
  await press("Toggle pager size select styles")
  expect(screen.getByTestId("pagination-scene-size")).toHaveStyle({
    backgroundColor: "#fff2cc",
    borderColor: "#166534",
  })
  await result.rerender(node("dark"))
  expect(screen.getByLabelText("Page number")).toHaveDisplayValue("7")
  expect(screen.getByTestId("pagination-scene-state")).toHaveTextContent(/Page: 3.*Size: 10.*Requests: none/)
  await press("Toggle pager counter styles")
  expect(within(screen.getByTestId("page-counter")).getByTestId("counter")).not.toHaveStyle({ borderColor: "#7c3aed" })
  expect(within(screen.getByTestId("page-input")).getByTestId("form-field")).toHaveStyle({ borderColor: "#087f8c" })
  await press("Page size")
  const modal = screen.getByTestId("pagination-scene-size-window", hidden)
  const dismissed = modal.props.onDismiss
  await fireEvent(modal, "show")
  await fireEvent.press(screen.getByRole("radio", { name: "20" }))
  await act(() => dismissed())
  expect(screen.getByTestId("pagination-scene-state")).toHaveTextContent(/Page: 3.*Size: 10.*size:20, page:2/)
  await press("Reset pager")
  expect(screen.getByTestId("pagination-customization-state")).toHaveTextContent("Pager customizations: none.")
})

it("keeps the pager overflow customization on every trigger while retaining reset and a held popup through theme changes", async () => {
  const result = await render(node())
  await press("Toggle pager overflow button styles")
  const triggers = screen.getAllByTestId("pagination-overflow-trigger")
  expect(triggers).toHaveLength(2)
  for (const trigger of triggers) expect(trigger).toHaveStyle({ backgroundColor: "#ddeeff", borderColor: "#174ea6" })
  await press("Reset pager")
  expect(screen.getByTestId("pagination-customization-state")).toHaveTextContent("Pager customizations: none.")
  for (const trigger of screen.getAllByTestId("pagination-overflow-trigger")) {
    expect(trigger).not.toHaveStyle({ borderColor: "#174ea6" })
  }
  await press("Toggle pager overflow button styles")
  await press("Toggle pager echo")
  await press("Show controlled pager popup")
  const triggerHost = screen.getByTestId("pagination-overflow-trigger", hidden).unstable_fiber?.stateNode
  expect(triggerHost).toBeTruthy()
  await result.rerender(node("dark"))
  expect(screen.getByTestId("pagination-overflow-trigger", hidden)).toHaveStyle({
    backgroundColor: "#ddeeff",
    borderColor: "#174ea6",
  })
  expect(screen.getByTestId("pagination-overflow-trigger", hidden).unstable_fiber?.stateNode).toBe(triggerHost)
  expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
  expect(screen.getByTestId("pagination-scene-state", hidden)).toHaveTextContent(
    /Page: 1.*Size: 10.*declines.*Requests: none/,
  )
})
