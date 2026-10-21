import { NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import {
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import { TagGroupScene } from "../TagGroupScene"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const scene = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost>
        <TagGroupScene />
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const hidden = { includeHiddenElements: true }
const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }))

it("keeps original grouped refs and the visible editor draft through owner mode and provider changes", async () => {
  const view = await render(scene())
  await fireEvent.changeText(screen.getByTestId("tag-group-owner-editor"), "draft held")
  await press("Inspect grouped-tag refs")
  expect(screen.getByTestId("tag-group-owner-layout")).toHaveTextContent(/same/)
  await press("Next tag-group selection mode")
  await press("Next tag-group selection mode")
  await press("Rotate tag-group items")
  await view.rerender(scene("dark"))
  await press("Inspect grouped-tag refs")
  expect(screen.getByTestId("tag-group-owner-layout")).not.toHaveTextContent(/replaced/)
  expect(screen.getByTestId("tag-group-owner-editor")).toHaveDisplayValue("draft held")
  expect(screen.getByTestId("tag-group-owner-state")).toHaveTextContent(/Mode: none/)
})

it("retains typed owner membership under veto and removes only after owner echo", async () => {
  await render(scene())
  await press("Toggle tag-group owner veto")
  await fireEvent.press(screen.getAllByTestId("tag-remove-button", hidden)[0])
  expect(screen.getByTestId("tag-group-owner-state")).toHaveTextContent(/Parent: veto.*Requests: 1/)
  expect(screen.getByTestId("grouped-number:0", hidden)).toBeOnTheScreen()
  await press("Toggle tag-group owner veto")
  await fireEvent.press(screen.getAllByTestId("tag-remove-button", hidden)[0])
  expect(screen.queryByTestId("grouped-number:0", hidden)).toBeNull()
  expect(screen.getByTestId('grouped-string:"0"', hidden)).toBeOnTheScreen()
  expect(screen.getByTestId("tag-group-owner-state")).toHaveTextContent(/Requests: 2/)
})

it("mounts the real native VirtualizedList renderer and restores explicit empty-state ownership", async () => {
  await render(scene())
  await press("Toggle 69-item native virtualization")
  expect(screen.getByTestId("tag-group-virtual-list", hidden)).toBeOnTheScreen()
  await press("Clear tag-group owner items")
  expect(screen.getByTestId("tag-group-owner-empty", hidden)).toHaveTextContent(/Logical count: 0/)
  await press("Restore tag-group owner items")
  expect(screen.queryByTestId("tag-group-owner-empty", hidden)).toBeNull()
})

it("exposes actual field slots and keeps authored remove-button requests owner controlled", async () => {
  await render(scene())
  const editor = screen.getByTestId("tag-group-owner-editor")
  await fireEvent.changeText(editor, "held draft")
  await press("Toggle tag-group field slots")
  const list = screen.getByTestId("tag-list", hidden)
  expect(list.props.nativeLabelledBy).toContain(screen.getByTestId("tag-group-owner-label", hidden).props.nativeID)
  expect(list.props.nativeDescribedBy).toEqual([
    screen.getByTestId("tag-group-owner-description", hidden).props.nativeID,
    screen.getByTestId("tag-group-owner-error", hidden).props.nativeID,
  ])
  await press("Toggle tag-group owner veto")
  await fireEvent.press(screen.getByTestId("tag-group-authored-remove", hidden))
  expect(screen.getByTestId("tag-group-owner-state")).toHaveTextContent(/Parent: veto.*Requests: 1/)
  expect(screen.getByTestId("grouped-number:0", hidden)).toBeOnTheScreen()
  await press("Toggle tag-group owner veto")
  await fireEvent.press(screen.getByTestId("tag-group-authored-remove", hidden))
  expect(screen.queryByTestId("grouped-number:0", hidden)).toBeNull()
  await press("Toggle tag-group field slots")
  expect(screen.getByTestId("tag-list", hidden).props.nativeDescribedBy).toBeUndefined()
  expect(editor).toHaveDisplayValue("held draft")
})

it("retains actual item refs when toggling the compatible custom host", async () => {
  await render(scene())
  await press("Inspect grouped-tag refs")
  await press("Toggle grouped-tag custom host")
  await press("Inspect grouped-tag refs")
  expect(screen.getByTestId("tag-group-owner-layout")).not.toHaveTextContent(/replaced/)
  expect(screen.getByTestId("grouped-number:0", hidden).props.accessibilityHint).toBe("Selected custom host")
  await press("Toggle grouped-tag custom host")
  await press("Inspect grouped-tag refs")
  expect(screen.getByTestId("tag-group-owner-layout")).not.toHaveTextContent(/replaced/)
})
