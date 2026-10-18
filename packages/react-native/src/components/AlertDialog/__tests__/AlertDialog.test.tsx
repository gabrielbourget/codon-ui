import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { AccessibilityInfo, type View } from "react-native"

import {
  AlertDialog,
  AVAILABLE_ALERT_DIALOG_TYPES,
  Modal,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
  type AlertDialogProps,
} from "../../.."

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})

const base = { accessibilityLabel: "Confirmation", titleText: "Review changes", bodyText: "Choose an action." }
const wrap = (node: React.ReactNode) => <NativeOverlayProvider>{node}</NativeOverlayProvider>
const show = async (id = "alert-dialog") =>
  fireEvent(screen.getByTestId(`${id}-window`, { includeHiddenElements: true }), "show")
beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it.each(AVAILABLE_ALERT_DIALOG_TYPES)(
  "renders the %s native mark, ribbon and separately accessible content",
  async (type) => {
    await render(wrap(<AlertDialog {...base} type={type} defaultOpen />))
    await show()
    expect(screen.getByTestId(`alert-dialog-default-${type}-icon`, { includeHiddenElements: true })).toBeOnTheScreen()
    expect(screen.getByRole("heading", { name: "Review changes" })).toBeOnTheScreen()
    expect(screen.getByText("Choose an action.")).toBeOnTheScreen()
    expect(screen.getByTestId("alert-dialog-title").props.accessibilityLiveRegion).toBe("assertive")
    const tone =
      type === "info" ? "#2563eb" : type === "warning" ? "#a66b00" : type === "success" ? "#2f7d18" : "#b73434"
    expect(screen.getByTestId("alert-dialog-ribbon", { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: tone,
    })
    expect(screen.getByTestId("alert-dialog")).toHaveStyle({ borderRadius: 10 })
    expect(screen.getByTestId("alert-dialog-actions")).toHaveStyle({ flexWrap: "wrap", flexShrink: 0 })
  },
)

it.each([undefined, null])("retains the default icon for %s", async (AlertIcon) => {
  await render(wrap(<AlertDialog {...base} AlertIcon={AlertIcon} defaultOpen />))
  expect(screen.getByTestId("alert-dialog-default-info-icon", { includeHiddenElements: true })).toBeOnTheScreen()
})

it("preserves custom decorative icons, children, refs, aliases and style owners", async () => {
  const ref = createRef<View>()
  await render(
    wrap(
      <AlertDialog
        {...base}
        defaultOpen
        ref={ref}
        data-testid="custom-alert"
        AlertIcon={<Text>Custom mark</Text>}
        geometry="orthogonal"
        width="90%"
        customStyles={{ backgroundColor: "gold", color: "navy" }}
        style={{ backgroundColor: "plum" }}
        customOverlayStyles={{ backgroundColor: "teal" }}
        customDialogStyles={{ padding: 8 }}
      >
        Additional {0} content.
      </AlertDialog>,
    ),
  )
  await show("custom-alert")
  expect(ref.current).toBeTruthy()
  expect(screen.queryByTestId("alert-dialog-default-info-icon", { includeHiddenElements: true })).toBeNull()
  expect(screen.getByText("Custom mark", { includeHiddenElements: true })).toBeOnTheScreen()
  expect(
    screen.getByTestId("custom-alert-icon", { includeHiddenElements: true }).props.accessibilityElementsHidden,
  ).toBe(true)
  expect(screen.getByTestId("custom-alert")).toHaveStyle({ width: "90%", backgroundColor: "plum", borderRadius: 0 })
  expect(screen.getByTestId("custom-alert-ribbon", { includeHiddenElements: true })).toHaveStyle({
    borderTopLeftRadius: 0,
  })
  expect(screen.getByTestId("custom-alert-backdrop")).toHaveStyle({ backgroundColor: "teal" })
  expect(screen.getByTestId("custom-alert-dialog")).toHaveStyle({ padding: 8 })
  expect(screen.getByText("Additional 0 content.")).toHaveStyle({ color: "navy" })
})

it("resolves grouped labels and legacy visible text independently from accessible names", async () => {
  await render(
    wrap(
      <AlertDialog
        {...base}
        defaultOpen
        labels={{
          cancelActionButton: "Grouped cancel",
          cancelActionButtonAriaLabel: "Cancel configuration",
          confirmActionButton: "Grouped confirm",
          confirmActionButtonAriaLabel: "Confirm configuration",
        }}
        cancelActionBtnText="Annuler"
        confirmActionBtnText="Confirmer"
      />,
    ),
  )
  await show()
  expect(screen.getByRole("button", { name: "Cancel configuration" })).toHaveTextContent("Annuler")
  expect(screen.getByRole("button", { name: "Confirm configuration" })).toHaveTextContent("Confirmer")
  expect(screen.queryByText("Grouped cancel")).toBeNull()
})

it.each(["cancel", "confirm"] as const)(
  "invokes %s once before requesting closure and lets a controlled owner decline",
  async (action) => {
    const calls: string[] = []
    const cancelAction = jest.fn(() => calls.push("cancel"))
    const confirmAction = jest.fn(() => calls.push("confirm"))
    const onOpenChange = jest.fn((open: boolean) => calls.push(String(open)))
    await render(wrap(<AlertDialog {...base} isOpen {...{ cancelAction, confirmAction, onOpenChange }} />))
    await show()
    const user = userEvent.setup()
    const button = screen.getByRole("button", { name: action === "cancel" ? "Cancel Action" : "Confirm Action" })
    await user.press(button)
    expect(calls).toEqual([action, "false"])
    expect(action === "cancel" ? confirmAction : cancelAction).not.toHaveBeenCalled()
    expect(button).toBeOnTheScreen()
    await user.press(button)
    expect(calls).toEqual([action, "false", action, "false"])
  },
)

it("does not await promises and does not close after a synchronous throw", async () => {
  const onOpenChange = jest.fn()
  const pending = new Promise(() => undefined)
  const { rerender } = await render(
    wrap(<AlertDialog {...base} isOpen confirmAction={() => pending} onOpenChange={onOpenChange} />),
  )
  await show()
  await userEvent.setup().press(screen.getByRole("button", { name: "Confirm Action" }))
  expect(onOpenChange.mock.calls).toEqual([[false]])
  await rerender(
    wrap(
      <AlertDialog
        {...base}
        isOpen
        confirmAction={() => {
          throw new Error("Action failed")
        }}
        onOpenChange={onOpenChange}
      />,
    ),
  )
  await expect(fireEvent.press(screen.getByRole("button", { name: "Confirm Action" }))).rejects.toThrow("Action failed")
  expect(onOpenChange).toHaveBeenCalledTimes(1)
})

it("closes an uncontrolled alert through an explicit action even when both gestures are disabled", async () => {
  const calls: unknown[] = []
  await render(
    wrap(
      <AlertDialog
        {...base}
        defaultOpen
        isDismissable={false}
        isKeyboardDismissDisabled
        confirmAction={() => calls.push("confirm")}
        onOpenChange={(open) => calls.push(open)}
      />,
    ),
  )
  await show()
  expect(screen.getByTestId("alert-dialog-scroll").props.keyboardShouldPersistTaps).toBe("handled")
  await userEvent.setup().press(screen.getByRole("button", { name: "Confirm Action" }))
  expect(calls).toEqual(["confirm", false])
  expect(screen.queryByRole("button", { name: "Confirm Action" })).toBeNull()
})

it("keeps gesture guards independent and invokes no business callback for gestures or external closure", async () => {
  const cancelAction = jest.fn(),
    confirmAction = jest.fn(),
    onOpenChange = jest.fn()
  const { rerender } = await render(
    wrap(<AlertDialog {...base} isOpen isDismissable={false} {...{ cancelAction, confirmAction, onOpenChange }} />),
  )
  await show()
  await fireEvent.press(screen.getByTestId("alert-dialog-backdrop"))
  await fireEvent(screen.getByTestId("alert-dialog-window"), "requestClose")
  expect(onOpenChange.mock.calls).toEqual([[false]])
  await rerender(
    wrap(<AlertDialog {...base} isOpen isKeyboardDismissDisabled {...{ cancelAction, confirmAction, onOpenChange }} />),
  )
  await fireEvent(screen.getByTestId("alert-dialog-window"), "requestClose")
  await fireEvent.press(screen.getByTestId("alert-dialog-backdrop"))
  expect(onOpenChange.mock.calls).toEqual([[false], [false]])
  await rerender(wrap(<AlertDialog {...base} isOpen={false} {...{ cancelAction, confirmAction, onOpenChange }} />))
  expect(cancelAction).not.toHaveBeenCalled()
  expect(confirmAction).not.toHaveBeenCalled()
})

it("hides cancellation and validates only rendered action names", async () => {
  await render(
    wrap(<AlertDialog {...base} defaultOpen showCancelAction={false} labels={{ cancelActionButtonAriaLabel: "" }} />),
  )
  await show()
  expect(screen.queryByRole("button", { name: "Cancel Action" })).toBeNull()
  expect(screen.getByRole("button", { name: "Confirm Action" })).toBeOnTheScreen()
  for (const props of [
    { labels: { confirmActionButtonAriaLabel: " " } },
    { labels: { cancelActionButtonAriaLabel: "" } },
    { accessibilityLabel: "" },
    { titleText: 1 },
    { bodyText: null },
    { customStyles: { color: "var(--bad)" } },
    { overlayBlur: "true" },
  ]) {
    await expect(render(wrap(<AlertDialog {...base} {...(props as unknown as AlertDialogProps)} />))).rejects.toThrow()
  }
})

it("uses distinct tone roles even when validation-border defaults have the same value", async () => {
  const { rerender } = await render(
    wrap(
      <NativeThemeProvider mode="dark" overrides={{ colors: { validationWarningBorder: "pink" } }}>
        <AlertDialog {...base} type="warning" defaultOpen />
      </NativeThemeProvider>,
    ),
  )
  expect(screen.getByTestId("alert-dialog-ribbon", { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: "#f0b429",
  })
  await rerender(
    wrap(
      <NativeThemeProvider
        mode="dark"
        overrides={{ colors: { validationWarningBorder: "pink", statusWarning: "violet" } }}
      >
        <AlertDialog {...base} type="warning" defaultOpen />
      </NativeThemeProvider>,
    ),
  )
  expect(screen.getByTestId("alert-dialog-ribbon", { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: "violet",
  })
})

it("gates covered parent actions while a child owns the native window", async () => {
  const confirmAction = jest.fn()
  const Fixture = () => {
    const [child, setChild] = useState(false)
    return (
      <AlertDialog {...base} defaultOpen confirmAction={confirmAction}>
        <Text onPress={() => setChild(true)}>Open confirmation child</Text>
        <Modal accessibilityLabel="Child" testID="child" isOpen={child} />
      </AlertDialog>
    )
  }
  await render(wrap(<Fixture />))
  await show()
  const action = screen.getByRole("button", { name: "Confirm Action" })
  await fireEvent.press(screen.getByText("Open confirmation child"))
  await show("child")
  await fireEvent.press(action)
  expect(confirmAction).not.toHaveBeenCalled()
  await act(() => jest.runAllTimers())
})
