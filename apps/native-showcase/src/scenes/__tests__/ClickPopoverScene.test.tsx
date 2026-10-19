import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo, type View } from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "@codon-ui/react-native"

import { ClickPopoverScene } from "../ClickPopoverScene"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const hidden = { includeHiddenElements: true }
const node = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeFloatingLayerHost testID="popover-host">
      <ClickPopoverScene />
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const press = async (name: string) => userEvent.setup().press(screen.getByRole("button", { name, ...hidden }))
let activation = 0
// Teleport's Jest portal is inline beneath the isolated background; route a native packet to the real target instead.
const activateContent = async (name: string) => {
  const target = screen.getByRole("button", { name, ...hidden })
  const host = screen.getByTestId("popover-host").props
  await act(() =>
    target.props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        source: "android-click",
        observedAt: 0,
        ownerId: target.props.ownerId,
        target: 17,
        activationId: ++activation,
        scopeOwnerId: host.ownerId,
        windowId: "scene-window",
        epoch: 1,
      },
    }),
  )
}
const ready = async () => {
  for (const [id, rect] of [
    ["popover-host", [0, 0, 400, 700]],
    ["popover-scene-trigger", [100, 100, 80, 44]],
    ["popover-scene-surface", [0, 0, 250, 300]],
  ] as const) {
    let fiber = screen.getByTestId(id, hidden).unstable_fiber
    let native: View | null = null
    while (fiber) {
      const instance = fiber.stateNode as View | null
      if (typeof instance?.measureInWindow === "function") {
        native = instance
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
  await fireEvent(screen.getByTestId("popover-scene-surface-overlay-arrow", hidden), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 10, height: 10 } },
  })
  await fireEvent(screen.getByTestId("popover-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } },
  })
  await acknowledge()
  await acknowledge()
}
const acknowledge = async () => {
  for (const ready of [false, true]) {
    const host = screen.getByTestId("popover-host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "scene-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
}

it("keeps declined close requests owner-controlled and preserves context and raw drafts", async () => {
  const result = await render(node())
  await press("Toggle popover echo")
  // Owner-controlled open is declined; enabling echo permits the next request.
  await press("Open click popover")
  expect(screen.queryByTestId("popover-scene-surface", hidden)).toBeNull()
  await press("Toggle popover echo")
  await press("Toggle nonmodal popover")
  await press("Toggle child dialog")
  await press("Toggle popover styles")
  await press("Toggle popover geometry")
  await press("Next popover order")
  await press("Open click popover")
  await ready()
  await fireEvent.changeText(screen.getByTestId("popover-scene-editor", hidden), "Retained draft")
  // Modal entry registers child key policies after the layer is positioned.
  await acknowledge()
  await result.rerender(node("dark"))
  expect(screen.getByTestId("popover-scene-editor", hidden)).toHaveDisplayValue("Retained draft")
  expect(screen.getByTestId("popover-caller-context", hidden)).toHaveTextContent("Live popover caller context")
  expect(screen.getByTestId("popover-scene-surface", hidden)).toHaveStyle({
    borderRadius: 0,
    borderWidth: 3,
    padding: 0,
  })
  await press("Toggle popover echo")
  await press("Request popover close")
  expect(screen.getByTestId("popover-scene-state")).toHaveTextContent(
    /Open: true.*Requests: 3.*declines.*Retained draft/,
  )
})

it("retains drafts through owner removal and resets through the public scene controls", async () => {
  await render(node())
  await press("Open click popover")
  await ready()
  await fireEvent.changeText(screen.getByTestId("popover-scene-editor", hidden), "Retained draft")
  await activateContent("Resize popover content")
  expect(screen.getByTestId("popover-scene-scroll", hidden)).toHaveStyle({ height: 100 })
  await activateContent("Unmount open popover")
  expect(screen.queryByTestId("popover-scene-surface", hidden)).toBeNull()
  await press("Toggle popover owner")
  expect(screen.getByTestId("popover-scene-editor", hidden)).toHaveDisplayValue("Retained draft")
  await ready()
  await activateContent("Request popover close")
  await press("Reset popover")
  expect(screen.getByTestId("popover-scene-state")).toHaveTextContent(/Open: false.*Requests: 0.*Draft: empty/)
})
