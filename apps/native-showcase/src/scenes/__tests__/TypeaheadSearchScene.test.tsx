import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Inline search scene")
  return press
}
const input = () => screen.getByTestId("typeahead-search-input")
const alpha = () => screen.getByRole("radio", { name: /^Alpha wave/ })

it("separates native observations, controlled echo/veto and authoritative trimmed submissions", async () => {
  const press = await enter()
  await fireEvent(input(), "change", { nativeEvent: { text: "raw native", eventCount: 1, target: 7 } })
  expect(screen.getByTestId("inline-search-native")).toHaveTextContent(/Last native text: "raw native"/)
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(/Owner: "".*Requests: 0/)
  await fireEvent.changeText(input(), "  alpha  ")
  expect(input().props.value).toBe("  alpha  ")
  await fireEvent(input(), "submitEditing", { nativeEvent: { text: "native submit only", target: 7 } })
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(
    /Owner: "\s+alpha\s+".*Requests: 1.*Submitted: "alpha".*Submits: 1/,
  )
  expect(screen.getByTestId("inline-search-native")).toHaveTextContent(/Last native submit: "native submit only"/)
  await press("Toggle inline search veto")
  await fireEvent.changeText(input(), "declined first")
  await fireEvent.changeText(input(), "declined second")
  expect(input()).toHaveDisplayValue("  alpha  ")
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(
    /Request: "declined second".*Requests: 3.*Veto: true/,
  )
  await press("Search")
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(/Submitted: "alpha".*Submits: 2/)
  await press("Toggle inline search disabled")
  await fireEvent.changeText(input(), "blocked")
  await fireEvent.press(screen.getByTestId("typeahead-search-button"))
  await fireEvent.press(alpha())
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(
    /Requests: 3.*Submits: 2.*Selection: number:0.*Selection callbacks: 1/,
  )
  await press("Clear inline search owner")
  expect(input()).toHaveDisplayValue("")
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(/Requests: 3/)
})

it("retains internal typed selection/query across replacement and host changes, resets the surface separately, then resets the scene", async () => {
  const press = await enter()
  await fireEvent.changeText(input(), "owner")
  await fireEvent.press(alpha())
  await press("Reverse inline search items")
  await press("Toggle inline search first item")
  expect(screen.queryByRole("radio", { name: /^Alpha wave/ })).toBeNull()
  await press("Toggle inline search first item")
  expect(alpha()).toBeChecked()
  await press("Toggle inline search row rendering")
  await press("Toggle inline search French labels")
  await press("Dark theme")
  await press("Vertical blocked region")
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(alpha()).toBeChecked()
  expect(input()).toHaveDisplayValue("owner")
  expect(screen.getByRole("button", { name: "Rechercher" })).toBeOnTheScreen()
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(
    /Selection callbacks: 1.*Custom rows: true.*French: true/,
  )
  await press("Restart inline search surface")
  expect(alpha()).not.toBeChecked()
  expect(input()).toHaveDisplayValue("owner")
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(/Selection callbacks: 1.*Lifetime: 1/)
  await press("Reset scene")
  await press("Inline search scene")
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(
    /Owner: "".*Requests: 0.*Selection: none.*Selection callbacks: 0.*Status: results/,
  )
})

it("exercises statuses, caller curation, all six styles, affordances, zero frames and the 200-row fixture", async () => {
  const press = await enter()
  for (const status of ["idle", "minimum-query", "loading", "error", "empty", "results"]) {
    await press("Next inline search status")
    expect(screen.getByTestId("inline-search-state")).toHaveTextContent(new RegExp(`Status: ${status}`))
  }
  await press("Toggle inline search styles")
  expect(screen.getByTestId("inline-search-example")).toHaveStyle({ padding: 6, borderWidth: 1 })
  expect(screen.getByTestId("typeahead-search-input-row")).toHaveStyle({ gap: 3 })
  expect(input()).toHaveStyle({ fontSize: 18, paddingLeft: 15 })
  expect(screen.getByTestId("typeahead-search-button")).toHaveStyle({ width: 35, height: 35 })
  expect(screen.getByTestId("typeahead-search-results-container")).toHaveStyle({
    height: 240,
    minHeight: 0,
    maxHeight: 240,
  })
  expect(screen.getByTestId("typeahead-search-results-list")).toHaveStyle({ gap: 15, padding: 5 })
  await press("Next inline search geometry")
  await press("Next inline search threshold")
  await press("Next inline search affordance")
  expect(screen.getByText("Go")).toBeOnTheScreen()
  await press("Next inline search affordance")
  expect(screen.getByTestId("typeahead-search-default-search-icon", { includeHiddenElements: true })).toBeOnTheScreen()
  await press("Next inline search affordance")
  expect(screen.getByText("12")).toBeOnTheScreen()
  await fireEvent.changeText(input(), "Alpha")
  await press("Toggle inline search host filter")
  expect(screen.getAllByTestId("typeahead-search-item")).toHaveLength(1)
  await press("Toggle inline search host filter")
  await press("Toggle inline search empty items")
  expect(screen.queryAllByTestId("typeahead-search-item")).toHaveLength(0)
  expect(screen.queryByTestId("typeahead-search-empty-state")).toBeNull()
  await press("Toggle inline search empty items")
  await press("Toggle inline search 200 items")
  expect(screen.getAllByTestId("typeahead-search-item")).toHaveLength(200)
  await fireEvent.press(screen.getByRole("radio", { name: /^Result 199 / }))
  expect(screen.getByTestId("inline-search-state")).toHaveTextContent(/Selection: number:199/)
  await press("Toggle inline search zero dimensions")
  expect(screen.getByTestId("inline-search-example")).toHaveStyle({ width: 0, height: 0, padding: 0, borderWidth: 0 })
  await fireEvent(screen.getByTestId("inline-search-example"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } },
  })
  expect(screen.getByTestId("inline-search-native")).toHaveTextContent(/Last root frame: 0 x 0/)
  expect(input()).toHaveDisplayValue("Alpha")
})
