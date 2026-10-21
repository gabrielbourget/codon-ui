import "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"

import { NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import { MenuScene } from "../MenuScene"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))

const scene = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost>
        <MenuScene />
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const hidden = { includeHiddenElements: true }
const press = async (name: string) => {
  const target = screen.getByRole("button", { name, ...hidden })
  if (name !== "Open owner menu") return fireEvent.press(target)
  const original = {
    target: 17,
    currentTarget: 17,
    persist: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: { target: 17, timestamp: 0, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
  }
  await act(() => target.props.onResponderGrant(original))
  await act(() => target.props.onResponderRelease(original))
}

it("keeps actual trigger open requests subject to the current owner veto and echo", async () => {
  await render(scene())
  await press("Toggle menu modality")
  await press("Toggle menu owner veto")
  await press("Open owner menu")
  expect(screen.getByTestId("menu-owner-state")).toHaveTextContent(/Open: false.*Parent: veto.*Requests: 1/)
  await press("Toggle menu owner veto")
  await press("Open owner menu")
  expect(screen.getByTestId("menu-owner-state")).toHaveTextContent(/Open: true.*Parent: echo.*Requests: 2/)
})

it("preserves original menu refs and the owner editor through metadata, direction and theme updates", async () => {
  const view = await render(scene())
  await press("Toggle menu modality")
  await press("Toggle menu owner open")
  const editor = screen.getByTestId("menu-owner-editor")
  await fireEvent.changeText(editor, "held owner draft")
  await press("Inspect menu refs")
  expect(screen.getByTestId("menu-owner-refs")).toHaveTextContent(/same/)
  await press("Toggle menu direction")
  await press("Toggle menu styles")
  await press("Next menu selection mode")
  await press("Rotate menu items")
  await view.rerender(scene("dark"))
  await press("Inspect menu refs")
  expect(screen.getByTestId("menu-owner-refs")).not.toHaveTextContent(/replaced/)
  expect(editor).toHaveDisplayValue("held owner draft")
  expect(screen.getByTestId("menu-owner-editor-state")).toHaveTextContent("Text events: 1.")
})

it("renders owner-authored empty state and restores the separate numeric, string and empty keys", async () => {
  await render(scene())
  await press("Toggle menu modality")
  await press("Toggle menu owner open")
  expect(screen.getByTestId("menu-owner-number:0", hidden)).toBeOnTheScreen()
  expect(screen.getByTestId('menu-owner-string:"0"', hidden)).toBeOnTheScreen()
  expect(screen.getByTestId('menu-owner-string:""', hidden)).toBeOnTheScreen()
  await press("Clear menu items")
  expect(screen.getByTestId("menu-owner-empty", hidden)).toHaveTextContent("No owner menu items")
  expect(screen.queryByTestId("menu-owner-number:0", hidden)).toBeNull()
  await press("Restore menu items")
  expect(screen.queryByTestId("menu-owner-empty", hidden)).toBeNull()
  expect(screen.getByTestId("menu-owner-number:0", hidden)).toBeOnTheScreen()
  expect(screen.getByTestId('menu-owner-string:"0"', hidden)).toBeOnTheScreen()
})

it("uses the actual native VirtualizedList while preserving the owner editor", async () => {
  await render(scene())
  await press("Toggle menu modality")
  await press("Toggle menu owner open")
  const editor = screen.getByTestId("menu-owner-editor")
  await fireEvent.changeText(editor, "virtual owner draft")
  await press("Toggle 72-item menu virtualization")
  expect(screen.getByTestId("menu-owner-virtual-list", hidden)).toBeOnTheScreen()
  expect(editor).toHaveDisplayValue("virtual owner draft")
  await press("Clear menu items")
  expect(screen.getByTestId("menu-owner-empty", hidden)).toBeOnTheScreen()
})

it("retains the modal default and hides the surrounding editor from accessibility while open", async () => {
  await render(scene())
  await press("Toggle menu owner open")
  expect(screen.queryByTestId("menu-owner-editor")).toBeNull()
  expect(screen.getByTestId("menu-owner-editor", hidden)).toBeOnTheScreen()
  expect(screen.getByTestId("menu-owner-surface", hidden)).toBeOnTheScreen()
})
