import "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"

import { createRef } from "react"
import * as RN from "react-native"

import { NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
  userEvent,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import {
  NativeComboBoxGroupContext,
  NativeComboBoxPopoverContext,
} from "../../../../../packages/react-native/src/components/ComboBox/collectionContext"
import { TagComboBoxScene } from "../TagComboBoxScene"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const hidden = { includeHiddenElements: true }
const host = createRef<RN.View>(),
  anchor = createRef<RN.View>(),
  popup = createRef<RN.View>()
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameSequence = 0
const scene = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost testID="fixture-host" ref={host}>
        <NativeComboBoxGroupContext.Provider value={{ ref: anchor }}>
          <NativeComboBoxPopoverContext.Provider value={{ ref: popup }}>
            <TagComboBoxScene />
          </NativeComboBoxPopoverContext.Provider>
        </NativeComboBoxGroupContext.Provider>
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const press = (name: string) => fireEvent.press(screen.getByRole("button", { name, ...hidden }))
const choose = (name: string) => act(() => userEvent.setup().press(screen.getByRole("option", { name })))
const show = async () => {
  const measure = (target: RN.View, box: number[]) =>
    Object.defineProperty(target, "measureInWindow", {
      configurable: true,
      value: (callback: (...values: number[]) => void) => callback(...box),
    })
  measure(host.current!, [0, 0, 360, 640])
  measure(anchor.current!, [10, 40, 260, 48])
  measure(popup.current!, [0, 0, 260, 180])
  await fireEvent(screen.getByTestId("fixture-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
  })
  await fireEvent(screen.getByTestId("combo-box-popover", hidden), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 260, height: 180 } },
  })
  for (const ready of [false, true]) {
    const scope = screen.getByTestId("fixture-host").props
    await act(() =>
      scope.onNativeScopeStatus({
        nativeEvent: {
          ownerId: scope.ownerId,
          windowId: "source-model-window",
          epoch: 1,
          policyRevision: scope.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  for (let turn = 0; turn < 3; turn++)
    await act(() => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(0))
    })
}

beforeEach(() => {
  jest.useFakeTimers()
  frames.clear()
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameSequence
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id != null) frames.delete(id)
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("keeps popup requests subject to owner veto and opens only after an owner echo", async () => {
  await render(scene())
  await press("Toggle tag-combo popup veto")
  await press("Show suggestions")
  expect(screen.getByTestId("tag-combo-owner-state")).toHaveTextContent(/Open: false.*Popup: veto/)
  expect(screen.getByTestId("tag-combo-owner-requests")).toHaveTextContent("Requests: open:true.")
  await press("Toggle tag-combo popup veto")
  await press("Show suggestions")
  await show()
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Open: true/)
  expect(screen.getByTestId("combo-box-input")).toBeOnTheScreen()
})

it("retains held selection and query across repeated add requests, then shows the owner echo", async () => {
  await render(scene())
  await press("Run two-veto tag-combo selection")
  await show()
  await choose("Empty key")
  await choose("Empty key")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Selected: empty.*Query: "Empty"/)
  expect(screen.getByTestId("tag-combo-owner-requests", hidden)).toHaveTextContent(
    'Requests: add:string:"" → input:"" → nested-input:"" → open:false → add:string:"" → input:"" → nested-input:"" → open:false.',
  )
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("Empty")
  await choose("Empty key")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(
    /Selected: string:"".*Query: "".*Open: false/,
  )
  expect(screen.queryByRole("option", { name: "Empty key" })).toBeNull()
})

it("preserves the original draft and receiver refs through theme, styles and item updates", async () => {
  const view = await render(scene())
  await press("Toggle tag-combo owner open")
  await show()
  const editor = screen.getByTestId("tag-combo-owner-editor", hidden)
  await fireEvent.changeText(editor, "original owner draft")
  await press("Inspect tag-combo refs")
  expect(screen.getByTestId("tag-combo-owner-editor-state", hidden)).not.toHaveTextContent(/replaced/)
  await press("Toggle tag-combo styles")
  await press("Toggle tag-combo text size")
  await press("Reverse tag-combo items")
  await view.rerender(scene("dark"))
  await press("Inspect tag-combo refs")
  expect(editor).toHaveDisplayValue("original owner draft")
  expect(screen.getByTestId("tag-combo-owner-editor-state", hidden)).toHaveTextContent(/Text events: 1\./)
  expect(screen.getByTestId("tag-combo-owner-editor-state", hidden)).not.toHaveTextContent(/replaced/)
})

it("keeps the source string-key exclusion rule while preserving typed owner keys", async () => {
  await render(scene())
  await press("Set tag-combo number zero")
  await press("Toggle tag-combo owner open")
  await show()
  expect(screen.queryByRole("option", { name: "Number zero" })).toBeNull()
  expect(screen.queryByRole("option", { name: "String zero" })).toBeNull()
  expect(screen.getByRole("option", { name: "Empty key" })).toBeOnTheScreen()
  await press("Set tag-combo string zero")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Selected: string:"0"/)
  await press("Clear tag-combo items")
  expect(screen.getByTestId("combo-box-empty")).toBeOnTheScreen()
  await press("Restore tag-combo items")
  expect(screen.getByRole("option", { name: "Empty key" })).toBeOnTheScreen()
})
