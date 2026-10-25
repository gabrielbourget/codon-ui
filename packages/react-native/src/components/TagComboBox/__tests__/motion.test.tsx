import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, processColor, StyleSheet, type TextInput, type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { TagComboBox } from "../TagComboBox"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const style = () => StyleSheet.flatten(screen.getByTestId("tag-combobox").props.style)
it("retains the actual root/editor while independently transitioning authored border edges for250ms", async () => {
  const root = createRef<View>(),
    input = createRef<TextInput>(),
    query = jest.fn()
  const timing = jest.spyOn(Animated, "timing")
  const node = (border: string, top: string) => (
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost>
          <TagComboBox
            ref={root}
            inputRef={input}
            selectedItems={[]}
            items={[]}
            getItemKey={() => ""}
            getItemTextValue={() => ""}
            onSelectedItemsChange={() => {}}
            inputValue="held"
            onInputChange={query}
            customStyles={{ direction: "ltr", borderColor: border, borderTopColor: top }}
          />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
  const view = await render(node("red", "green"))
  const originalRoot = root.current,
    originalEditor = input.current
  expect(originalRoot).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  await view.rerender(node("blue", "yellow"))
  await act(() => jest.advanceTimersByTime(125))
  expect(processColor(style().borderColor)).not.toBe(processColor("red"))
  expect(processColor(style().borderColor)).not.toBe(processColor("blue"))
  expect(processColor(style().borderTopColor)).not.toBe(processColor("green"))
  expect(processColor(style().borderTopColor)).not.toBe(processColor("yellow"))
  await act(() => jest.advanceTimersByTime(150))
  expect(processColor(style().borderColor)).toBe(processColor("blue"))
  expect(processColor(style().borderTopColor)).toBe(processColor("yellow"))
  expect(timing.mock.calls.some(([, options]) => options.duration === 250 && options.useNativeDriver === false)).toBe(
    true,
  )
  expect(root.current).toBe(originalRoot)
  expect(input.current).toBe(originalEditor)
  expect(screen.getByTestId("combo-box-input").props.value).toBe("held")
  expect(query).not.toHaveBeenCalled()
})
