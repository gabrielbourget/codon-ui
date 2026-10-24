import "../../../collection/__tests__/nativeReceipts"

import { cleanup, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, findNodeHandle, type TextInput } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"

import { CompactTypeaheadFixture } from "./fixtures/CompactTypeaheadFixture"
import { advance, pressCompact, installCompactNativeLayout, row } from "./fixtures/nativeLayout"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext(null),
}))
let fixture: ReturnType<typeof installCompactNativeLayout>
const press = (label: string) => pressCompact(screen.getByRole("button", { name: label }))
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  fixture = installCompactNativeLayout()
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
it("SCENE.compact.001 retains parent-curated typed keys and selection/query vetoes", async () => {
  await render(<CompactTypeaheadFixture hostRef={fixture.hostRef} />)
  await press("Toggle selection veto")
  await press("CompactTypeaheadSearch Search Button")
  await fireEvent.changeText(row("type-ahead-search-input"), "Alpha")
  await fixture.ready()
  expect(row("compact-result-number-0")).toBeOnTheScreen()
  expect(row("compact-result-string-0")).toBeOnTheScreen()
  expect(row("compact-result-string-")).toBeOnTheScreen()
  await pressCompact(row("type-ahead-search-option-number:0"))
  expect(row("compact-fixture-events")).toHaveTextContent(/select:number:0/)
  expect(row("compact-fixture-state")).toHaveTextContent(/Query "Alpha"\. Value object:null/)
  await press("Toggle query veto")
  await fireEvent.changeText(row("type-ahead-search-input"), "discarded")
  expect(row("type-ahead-search-input").props.value).toBe("Alpha")
})
it("SCENE.compact.002 combines minimum-query/loading guidance and localized custom slots", async () => {
  await render(<CompactTypeaheadFixture hostRef={fixture.hostRef} />)
  await press("Toggle custom slots")
  await press("Toggle loading")
  await press("Toggle theme")
  await press("Toggle RTL")
  await press("Run search")
  expect(row("type-ahead-search-group")).toHaveStyle({ flexDirection: "row-reverse", borderWidth: 2 })
  expect(row("type-ahead-search-input")).toHaveStyle({ color: "#a66b00" })
  expect(row("type-ahead-search-minimum-query-state")).toBeOnTheScreen()
  expect(row("type-ahead-search-loading-state")).toBeOnTheScreen()
  expect(row("type-ahead-search-options")).toHaveStyle({ padding: 7, backgroundColor: "#171717" })
})
it("SCENE.compact.003 selection clears the controlled query and closes the maintained popup", async () => {
  await render(<CompactTypeaheadFixture hostRef={fixture.hostRef} />)
  await press("CompactTypeaheadSearch Search Button")
  await fireEvent.changeText(row("type-ahead-search-input"), "Alpha")
  await fixture.ready()
  await pressCompact(row("type-ahead-search-option-string:"))
  await advance()
  expect(row("compact-fixture-state")).toHaveTextContent(/Query ""\. Value string:""\. Open false/)
  expect(screen.queryByTestId("type-ahead-search-popover", { includeHiddenElements: true })).toBeNull()
})
it("SCENE.compact.004 preserves custom descendant focus and closes after observed group departure", async () => {
  await render(<CompactTypeaheadFixture hostRef={fixture.hostRef} />)
  await press("Toggle custom slots")
  await press("Run search")
  await fixture.ready()
  const descendant = fixture.target("compact-search-descendant")
  await act(() =>
    row("compact-search-descendant").props.onNativeFocusChange({
      nativeEvent: {
        ownerId: row("compact-search-descendant").props.ownerId,
        target: findNodeHandle(descendant),
        isFocused: true,
      },
    }),
  )
  await fixture.within("type-ahead-search", "compact-search-descendant")
  await fixture.within("type-ahead-search-group", "compact-search-descendant")
  await act(() => row("type-ahead-search-group").props.onBlur({ nativeEvent: { target: 17 } }))
  await advance()
  expect(row("compact-fixture-events")).toHaveTextContent(/search-child:focus/)
  expect(row("compact-fixture-state")).toHaveTextContent(/Query ""\. Value object:null\. Open true/)
  await fixture.within("type-ahead-search", null, 2)
  await fixture.within("type-ahead-search-group", null, 2)
  await act(() => row("type-ahead-search-group").props.onBlur({ nativeEvent: { target: 17 } }))
  await advance()
  expect(row("compact-fixture-state")).toHaveTextContent(/Query ""\. Value object:null\. Open false/)
  expect(fixture.target("compact-search-descendant")).toBe(descendant)
})

it.each(["disabled", "read only"] as const)(
  "SCENE.compact.005 retains the editor and query through inherited %s",
  async (guard) => {
    const editor = createRef<TextInput>()
    await render(<CompactTypeaheadFixture hostRef={fixture.hostRef} inputRef={editor} />)
    await press("CompactTypeaheadSearch Search Button")
    await fireEvent.changeText(row("type-ahead-search-input"), "Alpha")
    await fixture.ready()
    const original = editor.current!
    await press(`Toggle inherited ${guard}`)
    expect(row("type-ahead-search-input").props.editable).toBe(false)
    await fireEvent.changeText(row("type-ahead-search-input"), "blocked")
    expect(row("type-ahead-search-input").props.value).toBe("Alpha")
    expect(row("compact-fixture-events")).not.toHaveTextContent(/blocked/)
    await press(`Toggle inherited ${guard}`)
    expect(row("type-ahead-search-input").props.editable).toBe(true)
    expect(editor.current).toBe(original)
    await fireEvent.changeText(row("type-ahead-search-input"), "Beta")
    expect(row("type-ahead-search-input").props.value).toBe("Beta")
  },
)
