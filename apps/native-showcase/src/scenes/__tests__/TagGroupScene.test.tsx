import type { NativeSyntheticEvent } from "react-native"

import { NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import {
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import {
  Commands,
  type NativeAccessibilityData,
} from "../../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent"
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

it("requests SDK reads from actual group/list/item refs and records only original returned packets", async () => {
  const inspect = jest.spyOn(Commands, "inspectAccessibility").mockImplementation(() => {})
  const log = jest.spyOn(console, "warn").mockImplementation(() => {})
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const find = jest.mocked(native.findNodeHandle)
  const previous = find.getMockImplementation()!
  try {
    await render(scene())
    await fireEvent.changeText(screen.getByTestId("tag-group-owner-editor"), "held draft")
    await press("Inspect grouped-tag native accessibility")
    expect(inspect).toHaveBeenCalledTimes(7)
    expect(screen.getByTestId("tag-group-owner-sdk")).toHaveTextContent("SDK reads: 0. Requested: 7.")
    const list = screen.getByTestId("tag-list", hidden)
    const target = inspect.mock.calls.find((call) => call[1] === list.props.ownerId)![0]
    find.mockImplementation((view) => (view === target ? 71 : previous(view)))
    const data: NativeAccessibilityData = {
      ownerId: list.props.ownerId,
      target: 71,
      windowId: "source-model-window",
      platform: "android",
      selected: false,
      containerType: -1,
      containerTitle: "",
      roleDescription: "",
      label: "Owner-controlled tags",
      hint: "",
      value: "",
      description: "",
      details: "",
      descriptionAvailable: false,
      detailsAvailable: false,
      collection: '{"rows":5,"columns":1}',
      observedAt: 1,
    }
    await fireEvent(list, "nativeAccessibilitySnapshot", {
      nativeEvent: data,
    } as NativeSyntheticEvent<NativeAccessibilityData>)
    expect(screen.getByTestId("tag-group-owner-sdk")).toHaveTextContent("SDK reads: 1. Requested: 7.")
    const chunks = log.mock.calls
      .filter(([line]) => String(line).startsWith("CUI_TAG_GROUP_SDK_CHUNK "))
      .map(
        ([line]) =>
          JSON.parse(String(line).slice("CUI_TAG_GROUP_SDK_CHUNK ".length)) as { part: number; content: string },
      )
    const result = JSON.parse(
      chunks
        .sort((a, b) => a.part - b.part)
        .map((chunk) => chunk.content)
        .join(""),
    )
    expect(result).toEqual({ receiver: "list", record: data })
    expect(screen.getByTestId("tag-group-owner-editor")).toHaveDisplayValue("held draft")
  } finally {
    find.mockImplementation(previous)
    inspect.mockRestore()
    log.mockRestore()
  }
})

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
