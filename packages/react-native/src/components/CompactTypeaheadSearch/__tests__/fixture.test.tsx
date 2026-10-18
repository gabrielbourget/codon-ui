import { cleanup, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { CompactTypeaheadFixture } from "./fixtures/CompactTypeaheadFixture"
import { advance, installCompactNativeLayout, row } from "./fixtures/nativeLayout"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext(null),
}))
let fixture: ReturnType<typeof installCompactNativeLayout>
const press = (label: string) => userEvent.setup().press(screen.getByRole("button", { name: label }))
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
  await userEvent.setup().press(row("type-ahead-search-option-number:0"))
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
  await userEvent.setup().press(row("type-ahead-search-option-string:"))
  await advance()
  expect(row("compact-fixture-state")).toHaveTextContent(/Query ""\. Value string:""\. Open false/)
  expect(screen.queryByTestId("type-ahead-search-popover", { includeHiddenElements: true })).toBeNull()
})
