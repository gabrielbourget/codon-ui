import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo, type View } from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "@codon-ui/react-native"

import { BreadcrumbsScene } from "../BreadcrumbsScene"

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
    <NativeFloatingLayerHost testID="breadcrumbs-host">
      <BreadcrumbsScene />
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const press = async (name: string) => userEvent.setup().press(screen.getByRole("button", { name, ...hidden }))
const ready = async () => {
  for (const [node, rect] of [
    [screen.getByTestId("breadcrumbs-host"), [0, 0, 400, 700]],
    [screen.getByRole("button", { name: "Show hidden trail levels", ...hidden }), [100, 100, 44, 44]],
    [screen.getByTestId("click-popover", hidden), [0, 0, 220, 180]],
  ] as const) {
    let fiber = node.unstable_fiber
    let native: View | null = null
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
  const arrow = screen.queryByTestId("click-popover-overlay-arrow", hidden)
  if (arrow) await fireEvent(arrow, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 10, height: 10 } } })
  await fireEvent(screen.getByTestId("breadcrumbs-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } },
  })
  for (const ready of [false, true]) {
    const host = screen.getByTestId("breadcrumbs-host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "trail-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
}
const activate = async (id: string) => {
  const target = screen.getByTestId(`breadcrumb-option-${id}`, hidden),
    host = screen.getByTestId("breadcrumbs-host").props
  await act(() =>
    target.props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        source: "android-click",
        observedAt: 0,
        ownerId: target.props.ownerId,
        activationId: 1,
        target: 17,
        scopeOwnerId: host.ownerId,
        windowId: "trail-window",
        epoch: 1,
      },
    }),
  )
}

it("composes public navigation with original caller data and a declined controlled close", async () => {
  await render(node())
  await press("Toggle trail popup echo")
  await press("Show controlled trail popup")
  await ready()
  await activate("4")
  expect(screen.getByTestId("breadcrumbs-scene-state", hidden)).toHaveTextContent(
    /Navigations: 1.*Close requests: 1.*declines.*Last: Navigation.*Original: true/,
  )
  expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
})

it("preserves drafts across styles/theme and closes a normal popup before resetting", async () => {
  const result = await render(node())
  await fireEvent.changeText(screen.getByTestId("breadcrumbs-scene-draft"), "Retained draft")
  await press("Toggle trail styles")
  await press("Next trail order")
  await result.rerender(node("dark"))
  expect(screen.getByTestId("breadcrumbs-scene-draft")).toHaveDisplayValue("Retained draft")
  await press("Show hidden trail levels")
  await ready()
  await activate("4")
  expect(screen.queryByTestId("click-popover", hidden)).toBeNull()
  expect(screen.getByTestId("breadcrumbs-scene-state")).toHaveTextContent(
    /Navigations: 1.*Original: true.*Retained draft/,
  )
  await press("Reset trail")
  expect(screen.getByTestId("breadcrumbs-scene-state")).toHaveTextContent(/Navigations: 0.*Draft: empty/)
})

it("keeps disabled and consolidation controls owner-driven", async () => {
  await render(node())
  await press("Toggle trail consolidation")
  await press("Toggle trail limit")
  await press("Toggle trail disabled")
  expect(screen.getByRole("button", { name: "Show hidden trail levels" })).toBeDisabled()
  expect(screen.getByTestId("breadcrumbs").props.nativeNavigation).toBe(false)
  expect(screen.getByTestId("breadcrumb-current")).toHaveTextContent("Current")
})

it("keeps each trail customization independent while preserving drafts, hosts and reset", async () => {
  const result = await render(node())
  await fireEvent.changeText(screen.getByTestId("breadcrumbs-scene-draft"), "Retained customization draft")
  const draftHost = screen.getByTestId("breadcrumbs-scene-draft").unstable_fiber?.stateNode
  const linkHost = screen.getByTestId("breadcrumb-link-0").unstable_fiber?.stateNode
  expect(draftHost).toBeTruthy()
  expect(linkHost).toBeTruthy()
  await press("Toggle trail breadcrumb styles")
  expect(screen.getByTestId("breadcrumb-0")).toHaveStyle({ padding: 6, borderColor: "#087f8c" })
  expect(screen.getByTestId("breadcrumb-current").props.accessibilityState).toEqual({ selected: true })
  await press("Toggle trail popover styles")
  await press("Toggle trail overflow button styles")
  expect(screen.getByRole("button", { name: "Show hidden trail levels" })).toHaveStyle({
    backgroundColor: "#ddeeff",
    borderColor: "#174ea6",
  })
  await press("Toggle trail link props")
  expect(screen.getByText("Home")).toHaveStyle({ color: "#be123c", textDecorationLine: "underline" })
  await result.rerender(node("dark"))
  expect(screen.getByTestId("breadcrumbs-scene-draft")).toHaveDisplayValue("Retained customization draft")
  expect(screen.getByTestId("breadcrumbs-scene-draft").unstable_fiber?.stateNode).toBe(draftHost)
  expect(screen.getByTestId("breadcrumb-link-0").unstable_fiber?.stateNode).toBe(linkHost)
  expect(screen.getByTestId("breadcrumbs-scene-state")).toHaveTextContent(/Navigations: 0.*Close requests: 0/)
  await press("Toggle trail breadcrumb styles")
  expect(screen.getByTestId("breadcrumb-0")).not.toHaveStyle({ borderColor: "#087f8c" })
  expect(screen.getByText("Home")).toHaveStyle({ color: "#be123c" })
  await press("Reset trail")
  expect(screen.getByTestId("breadcrumbs-customization-state")).toHaveTextContent("Trail customizations: none.")
  expect(screen.getByTestId("breadcrumbs-scene-draft")).toHaveDisplayValue("")
  expect(screen.getByText("Home")).not.toHaveStyle({ color: "#be123c" })
  expect(screen.getByRole("button", { name: "Show hidden trail levels" })).not.toHaveStyle({ borderColor: "#174ea6" })
})

it("retains the trail popover customization through theme changes and an original declined navigation close", async () => {
  const result = await render(node())
  await press("Toggle trail popover styles")
  await press("Toggle trail popup echo")
  await press("Show controlled trail popup")
  await ready()
  expect(screen.getByTestId("click-popover", hidden)).toHaveStyle({
    backgroundColor: "#fff2cc",
    borderColor: "#7c3aed",
  })
  await result.rerender(node("dark"))
  await ready()
  expect(screen.getByTestId("click-popover", hidden)).toHaveStyle({
    backgroundColor: "#fff2cc",
    borderColor: "#7c3aed",
  })
  expect(screen.getByTestId("breadcrumbs-scene-state", hidden)).toHaveTextContent(/Navigations: 0.*Close requests: 0/)
  await activate("4")
  expect(screen.getByTestId("breadcrumbs-scene-state", hidden)).toHaveTextContent(
    /Navigations: 1.*Close requests: 1.*declines.*Last: Navigation.*Original: true/,
  )
  expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
})
