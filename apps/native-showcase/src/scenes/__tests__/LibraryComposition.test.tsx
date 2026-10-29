import "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"

import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const enter = async (name: string) => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  await press(name)
}
const changeEnvironment = async () => {
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
  return window
}

it("retains the original Card and edited content through live showcase changes, then resets its owner", async () => {
  await enter("Card scene")
  const card = screen.getByTestId("card-scene-original")
  const editor = screen.getByLabelText("Original Card editor")
  await fireEvent.changeText(editor, "retained Card draft")
  await press("Change parent from child")
  const window = await changeEnvironment()
  try {
    expect(screen.getByTestId("card-scene-original")).toBe(card)
    expect(screen.getByLabelText("Original Card editor")).toBe(editor)
    expect(editor).toHaveDisplayValue("retained Card draft")
    expect(card).toHaveStyle({ width: "100%" })
    await press("Reset scene")
    expect(screen.queryByTestId("card-scene-original")).toBeNull()
    await press("Card scene")
    expect(screen.getByLabelText("Original Card editor")).toHaveDisplayValue("Original Card editor")
    expect(screen.getByTestId("card-scene-original")).toHaveStyle({ width: 260 })
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("retains TagGroup owner veto and draft through live showcase changes, then resets membership", async () => {
  await enter("TagGroup scene")
  const editor = screen.getByTestId("tag-group-owner-editor")
  await fireEvent.changeText(editor, "retained tag draft")
  await press("Toggle tag-group owner veto")
  await fireEvent.press(screen.getAllByTestId("tag-remove-button")[0])
  const window = await changeEnvironment()
  try {
    expect(screen.getByTestId("tag-group-owner-editor")).toBe(editor)
    expect(editor).toHaveDisplayValue("retained tag draft")
    expect(screen.getByTestId("tag-group-owner-state")).toHaveTextContent(/Parent: veto.*Requests: 1/)
    expect(screen.getByTestId("grouped-number:0")).toBeOnTheScreen()
    await press("Reset scene")
    expect(screen.queryByTestId("tag-group-owner-state")).toBeNull()
    await press("TagGroup scene")
    expect(screen.getByTestId("tag-group-owner-editor")).toHaveDisplayValue("")
    expect(screen.getByTestId("tag-group-owner-state")).toHaveTextContent(/Parent: echo.*Requests: 0/)
    expect(screen.getByTestId("grouped-number:0")).toBeOnTheScreen()
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("retains TagComboBox selection, query and independent draft through live showcase changes, then resets", async () => {
  await enter("TagComboBox scene")
  await press("Set tag-combo owner query")
  await press("Set tag-combo number zero")
  const input = screen.getByTestId("combo-box-input")
  const editor = screen.getByTestId("tag-combo-owner-editor")
  await fireEvent.changeText(editor, "retained independent draft")
  const window = await changeEnvironment()
  try {
    expect(screen.getByTestId("combo-box-input")).toBe(input)
    expect(screen.getByTestId("tag-combo-owner-editor")).toBe(editor)
    expect(input).toHaveDisplayValue("held query")
    expect(editor).toHaveDisplayValue("retained independent draft")
    expect(screen.getByTestId("tag-combo-owner-state")).toHaveTextContent(/Selected: number:0/)
    expect(screen.getByTestId("tag-combo-owner-requests")).toHaveTextContent("Requests: none.")
    await press("Reset scene")
    expect(screen.queryByTestId("tag-combo-owner-state")).toBeNull()
    await press("TagComboBox scene")
    expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("")
    expect(screen.getByTestId("tag-combo-owner-editor")).toHaveDisplayValue("")
    expect(screen.getByTestId("tag-combo-owner-state")).toHaveTextContent(/Selected: empty.*Query: ""/)
    expect(screen.getByTestId("tag-combo-owner-requests")).toHaveTextContent("Requests: none.")
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})
