import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useState, type RefObject } from "react"
import { AccessibilityInfo, TextInput, View } from "react-native"

import { AlertDialog, Modal, NativeOverlayProvider, NativeThemeProvider, type ModalRenderState } from "../.."

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
const Draft = ({ editor }: { editor: RefObject<TextInput | null> }) => {
  const [value, setValue] = useState("Original draft")
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  return (
    <TextInput
      ref={editor}
      testID="held-draft"
      value={value}
      selection={selection}
      onChangeText={setValue}
      onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
    />
  )
}
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
  "%s preserves the original overlay, panel, scope and held editor through compatible renderer changes",
  async (kind) => {
    const panel = createRef<View>()
    const editor = createRef<TextInput>()
    const requested = jest.fn()
    const layout = jest.fn()
    let overlay!: RefObject<View | null>
    let values!: ModalRenderState
    const content = <Draft editor={editor} />
    const node = (custom: boolean, open = true, dark = false) => {
      const props = {
        ref: panel,
        accessibilityLabel: "Task",
        isOpen: open,
        onOpenChange: requested,
        customStyles: { padding: 3 },
        style: { padding: 0 },
        customOverlayStyles: { opacity: 0.4 },
        customDialogStyles: { padding: 2 },
        render: custom
          ? (((props, state) => {
              overlay = props.ref as RefObject<View | null>
              values = state
              return <View {...props} onLayout={layout} style={[props.style, { padding: 0 }]} />
            }) satisfies NonNullable<React.ComponentProps<typeof Modal>["render"]>)
          : undefined,
      }
      return (
        <NativeThemeProvider mode={dark ? "dark" : "light"}>
          <NativeOverlayProvider>
            {kind === "modal" ? (
              <Modal {...props}>{content}</Modal>
            ) : (
              <AlertDialog {...props} titleText="Confirm" bodyText="Details">
                {content}
              </AlertDialog>
            )}
          </NativeOverlayProvider>
        </NativeThemeProvider>
      )
    }
    const view = await render(node(true))
    await fireEvent(row(`${kind}-window`), "show")
    const originalOverlay = overlay.current
    const originalPanel = panel.current
    const originalEditor = editor.current
    const originalScope = row(`${kind}-floating-host`)
    const ownerId = originalScope.props.ownerId
    const dismiss = row(`${kind}-window`).props.onDismiss
    expect(originalOverlay).not.toBeNull()
    expect(originalPanel).not.toBeNull()
    expect(originalOverlay === originalPanel).toBe(false)
    expect(typeof originalOverlay?.measureInWindow).toBe("function")
    expect(originalScope.props.ownerId).toBeTruthy()
    expect(Object.keys(values).sort()).toEqual(["isEntering", "isExiting", "state"])
    expect(values.isEntering).toBe(false)
    expect(values.isExiting).toBe(false)
    expect(values.state.isOpen).toBe(true)
    expect(Object.keys(values.state).sort()).toEqual(["close", "isOpen", "open", "setOpen", "toggle"])
    expect(row(`${kind}-floating-host-background`).props).toMatchObject({
      pointerEvents: "box-none",
      accessibilityElementsHidden: false,
      importantForAccessibility: "auto",
    })
    expect(row(kind)).toHaveStyle({ padding: 0 })
    expect(row(`${kind}-backdrop`)).toHaveStyle({ opacity: 0.4 })
    expect(row(`${kind}-dialog`)).toHaveStyle({ padding: 2 })
    const originalEvent = { nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } } }
    await fireEvent(row(`${kind}-floating-host-background`), "layout", originalEvent)
    expect(layout.mock.calls).toEqual([[originalEvent]])
    expect(layout.mock.calls[0][0] === originalEvent).toBe(true)
    await fireEvent.changeText(row("held-draft"), "")
    await fireEvent(row("held-draft"), "selectionChange", { nativeEvent: { selection: { start: 0, end: 0 } } })
    await view.rerender(node(false, true, true))
    expect(overlay.current === originalOverlay).toBe(true)
    expect(panel.current === originalPanel).toBe(true)
    expect(editor.current === originalEditor).toBe(true)
    expect(row(`${kind}-floating-host`) === originalScope).toBe(true)
    expect(row(`${kind}-floating-host`).props.ownerId).toBe(ownerId)
    expect(row("held-draft").props).toMatchObject({ value: "", selection: { start: 0, end: 0 } })
    await fireEvent.changeText(row("held-draft"), "Held edited draft")
    await fireEvent(row("held-draft"), "selectionChange", { nativeEvent: { selection: { start: 2, end: 5 } } })
    await view.rerender(node(true))
    expect(overlay.current === originalOverlay).toBe(true)
    expect(panel.current === originalPanel).toBe(true)
    expect(editor.current === originalEditor).toBe(true)
    expect(row("held-draft").props).toMatchObject({ value: "Held edited draft", selection: { start: 2, end: 5 } })
    const retained = values.state
    await act(() => retained.close())
    await act(() => retained.toggle())
    await act(() => retained.setOpen(false))
    await act(() => retained.open())
    expect(requested.mock.calls).toEqual([[false], [false], [false]])
    expect(values.state.isOpen).toBe(true)
    expect(editor.current === originalEditor).toBe(true)
    await view.rerender(node(true, false))
    expect(screen.queryByTestId(`${kind}-window`, hidden)).toBeNull()
    await act(() => dismiss())
    await act(() => jest.runAllTimers())
    expect(panel.current).toBeNull()
    expect(overlay.current).toBeNull()
    expect(editor.current).toBeNull()
    await view.unmount()
    await act(() => retained.open())
    expect(requested.mock.calls).toEqual([[false], [false], [false]])
  },
)

it("renderer state methods use the current owner without adding an ordinary-event veto", async () => {
  let values!: ModalRenderState
  const first = jest.fn()
  const current = jest.fn()
  const node = (onOpenChange: (open: boolean) => void) => (
    <NativeOverlayProvider>
      <Modal
        accessibilityLabel="Task"
        isOpen
        onOpenChange={onOpenChange}
        render={(props, state) => {
          values = state
          return <View {...props} />
        }}
      />
    </NativeOverlayProvider>
  )
  const view = await render(node(first))
  const retained = values.state
  await view.rerender(node(current))
  await act(() => retained.close())
  expect(first).not.toHaveBeenCalled()
  expect(current.mock.calls).toEqual([[false]])
  await view.unmount()
})

it("uncontrolled renderer requests retain the existing state-update-before-callback throw ordering", async () => {
  let values!: ModalRenderState
  const onOpenChange = jest.fn(() => {
    throw new Error("Owner failure")
  })
  await render(
    <NativeOverlayProvider>
      <Modal
        accessibilityLabel="Task"
        defaultOpen
        onOpenChange={onOpenChange}
        render={(props, state) => {
          values = state
          return <View {...props} />
        }}
      />
    </NativeOverlayProvider>,
  )
  await fireEvent(row("modal-window"), "show")
  await act(() => {
    expect(() => values.state.close()).toThrow("Owner failure")
  })
  expect(screen.queryByTestId("modal-window", hidden)).toBeNull()
  expect(onOpenChange.mock.calls).toEqual([[false]])
})

it("retained renderer methods reopen an uncontrolled owner through its existing window lifecycle", async () => {
  let values!: ModalRenderState
  const requested = jest.fn()
  await render(
    <NativeOverlayProvider>
      <Modal
        accessibilityLabel="Task"
        defaultOpen
        onOpenChange={requested}
        render={(props, state) => {
          values = state
          return <View {...props} />
        }}
      />
    </NativeOverlayProvider>,
  )
  await fireEvent(row("modal-window"), "show")
  const dismissed = row("modal-window").props.onDismiss
  const retained = values.state
  await act(() => retained.close())
  expect(screen.queryByTestId("modal-window", hidden)).toBeNull()
  await act(() => dismissed())
  await act(() => jest.runAllTimers())
  await act(() => retained.open())
  expect(values.state.isOpen).toBe(true)
  await fireEvent(row("modal-window"), "show")
  await act(() => retained.toggle())
  expect(screen.queryByTestId("modal-window", hidden)).toBeNull()
  await act(() => retained.setOpen(false))
  expect(requested.mock.calls).toEqual([[false], [true], [false]])
})
