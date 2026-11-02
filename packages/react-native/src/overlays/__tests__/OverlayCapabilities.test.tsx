import { act, render, screen } from "@testing-library/react-native"
import { createRef, type ComponentProps } from "react"
import { AccessibilityInfo, StyleSheet, View } from "react-native"

import { AlertDialog, Modal, NativeOverlayProvider } from "../.."
import { resolveNativeTheme } from "../../theme/defaults"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../tokens/theme-order"

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it.each(["modal", "alert-dialog"] as const)(
  "%s preserves native dimensions, original refs and independent final style owners",
  async (kind) => {
    const ref = createRef<View>()
    const node = (zero: boolean) => {
      const props = {
        ref,
        accessibilityLabel: "Task",
        isOpen: true,
        width: zero ? 0 : 150,
        height: zero ? 0 : 50,
        customStyles: zero ? undefined : { width: 250, height: 70 },
        style: zero ? undefined : { width: 175, height: 60 },
      }
      return (
        <NativeOverlayProvider>
          {kind === "modal" ? <Modal {...props} /> : <AlertDialog {...props} titleText="Title" bodyText="Body" />}
        </NativeOverlayProvider>
      )
    }
    const view = await render(node(true))
    const original = ref.current
    expect(original).not.toBeNull()
    expect(row(kind)).toHaveStyle({ width: 0, height: 0 })
    await view.rerender(node(false))
    expect(ref.current === original).toBe(true)
    expect(row(kind)).toHaveStyle({ width: 175, height: 60 })
    for (const name of [
      "width",
      "height",
      "customStyles",
      "customOverlayStyles",
      "customDialogStyles",
      "render",
      "isOpen",
    ])
      expect(row(kind).props[name]).toBeUndefined()
    await view.unmount()
    expect(ref.current).toBeNull()
  },
)

it("Modal preserves all five order backgrounds and owned foregrounds through current theme roles", async () => {
  const theme = resolveNativeTheme("light")
  const node = (order: (typeof AVAILABLE_THEMING_ORDER_CODES)[number]) => (
    <NativeOverlayProvider>
      <Modal accessibilityLabel="Task" isOpen order={order} />
    </NativeOverlayProvider>
  )
  const view = await render(node("primary"))
  for (const order of AVAILABLE_THEMING_ORDER_CODES) {
    await view.rerender(node(order))
    expect(row("modal")).toHaveStyle({ backgroundColor: theme.actions[order].background })
    expect(screen.getByText("Placeholder text", hidden)).toHaveStyle({ color: theme.actions[order].foreground })
  }
})

const nativeEvents = [
  "onTouchCancel",
  "onTouchEnd",
  "onTouchEndCapture",
  "onTouchMove",
  "onTouchStart",
  "onPointerDown",
  "onPointerDownCapture",
  "onPointerMove",
  "onPointerMoveCapture",
  "onPointerUp",
  "onPointerUpCapture",
  "onPointerCancel",
  "onPointerCancelCapture",
  "onPointerEnter",
  "onPointerLeave",
] as const
it.each(["modal", "alert-dialog"] as const)(
  "%s exposes supported original native viewport events through the existing renderer",
  async (kind) => {
    const events = Object.fromEntries(nativeEvents.map((name) => [name, jest.fn()]))
    const request = jest.fn()
    const renderRoot: NonNullable<ComponentProps<typeof Modal>["render"]> = (props) => <View {...props} {...events} />
    const props = { accessibilityLabel: "Task", isOpen: true, onOpenChange: request, render: renderRoot }
    await render(
      <NativeOverlayProvider>
        {kind === "modal" ? <Modal {...props} /> : <AlertDialog {...props} titleText="Title" bodyText="Body" />}
      </NativeOverlayProvider>,
    )
    const target = row(`${kind}-floating-host-background`)
    for (const name of nativeEvents) {
      const original = { nativeEvent: { target: 17, timestamp: 10, pointerId: 2 }, target: 17, currentTarget: 17 }
      await act(() => target.props[name](original))
      expect(events[name].mock.calls).toEqual([[original]])
      expect(events[name].mock.calls[0][0] === original).toBe(true)
    }
    expect(request).not.toHaveBeenCalled()
  },
)

it.each(["modal", "alert-dialog"] as const)(
  "%s preserves default raised geometry and explicit native style opt-outs",
  async (kind) => {
    const theme = resolveNativeTheme("light")
    const node = (reset: boolean) => {
      const props = {
        accessibilityLabel: "Task",
        isOpen: true,
        geometry: reset ? ("orthogonal" as const) : undefined,
        raised: reset ? false : undefined,
      }
      return (
        <NativeOverlayProvider>
          {kind === "modal" ? (
            <Modal {...props} color="gold" order="secondary" />
          ) : (
            <AlertDialog {...props} titleText="Title" bodyText="Body" />
          )}
        </NativeOverlayProvider>
      )
    }
    const view = await render(node(false))
    expect(row(kind)).toHaveStyle({
      borderRadius: theme.radius.rounded * (kind === "modal" ? 1 : 2),
      elevation: 2,
      shadowOpacity: 0.24,
    })
    if (kind === "modal") {
      expect(row(kind)).toHaveStyle({ backgroundColor: "gold" })
      expect(screen.getByText("Placeholder text", hidden)).toHaveStyle({ color: theme.colors.foreground })
    }
    await view.rerender(node(true))
    expect(row(kind)).toHaveStyle({ borderRadius: 0 })
    expect(row(kind).props.style.elevation).toBeUndefined()
    expect(row(kind).props.style.shadowOpacity).toBeUndefined()
  },
)

it("Modal preserves canonical fallback spacing, end alignment and small close text without wrapping authored labels", async () => {
  const theme = resolveNativeTheme("light")
  const label = createRef<View>()
  const authored = <View ref={label} testID="authored-close" style={{ width: 24, height: 12 }} />
  const node = (custom: boolean, name = "Task") => (
    <NativeOverlayProvider>
      <Modal
        accessibilityLabel={name}
        isOpen
        closeLabel={custom ? "Close custom" : undefined}
        closeButtonText={custom ? authored : "Close Modal"}
      />
    </NativeOverlayProvider>
  )
  const view = await render(node(false))
  const button = screen.getByRole("button", { name: "Close Modal", ...hidden })
  const text = screen.getByText("Close Modal", hidden)
  expect({
    gap: StyleSheet.flatten(row("modal-dialog").props.style).gap,
    align: StyleSheet.flatten(button.props.style).alignSelf,
    size: StyleSheet.flatten(text.props.style).fontSize,
    color: StyleSheet.flatten(text.props.style).color,
  }).toEqual({
    gap: theme.spacing.unit * 3,
    align: "flex-end",
    size: theme.typography.fontSizes.b11,
    color: theme.colors.controlSelectedForeground,
  })
  await view.rerender(node(true))
  const original = label.current
  expect(original).not.toBeNull()
  expect(row("authored-close")).toHaveStyle({ width: 24, height: 12 })
  await view.rerender(node(true, "Updated"))
  expect(label.current === original).toBe(true)
  expect(screen.getByRole("button", { name: "Close custom", ...hidden })).toBeOnTheScreen()
})
