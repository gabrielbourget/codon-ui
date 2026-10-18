import { render, screen, userEvent } from "@testing-library/react-native"

import { App } from "./App"

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
jest.setTimeout(15000)
const press = async (name: string) => userEvent.setup().press(screen.getByRole("button", { name }))
const state = () => screen.getByTestId("owner-state", { includeHiddenElements: true })

it("exercises repeated controlled vetoes without a provider, then accepts string zero and explicit null", async () => {
  await render(<App />)
  await press("Case ownership")
  await press("Choose")
  await press("Choose")
  expect(screen.queryByRole("radio")).toBeNull()
  expect(state()).toHaveTextContent("requests 2/0/0", { exact: false })
  await press("Choose")
  for (let attempt = 0; attempt < 2; attempt++) {
    await userEvent.setup().press(screen.getByRole("radio", { name: "String zero" }))
    expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
  }
  await userEvent.setup().press(screen.getByRole("radio", { name: "String zero" }))
  expect(state()).toHaveTextContent("Value string:0; open false; requests 3/3/3", { exact: false })
  await press("Clear controlled value")
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Choose a value")
  expect(state()).toHaveTextContent("Value null", { exact: false })
})

it("honors a programmatic owner transition even while its close request is rejected", async () => {
  await render(<App />)
  await press("Case programmatic")
  await press("Open programmatically")
  expect(state()).toHaveTextContent("open true; requests 0/0/0", { exact: false })
  await userEvent.setup().press(screen.getByRole("radio", { name: "String zero" }))
  expect(state()).toHaveTextContent("Value string:0; open false; requests 0/1/1", { exact: false })
})

it("exposes actual trigger metadata after relabel, removal and reorder without synthetic selection", async () => {
  await render(<App />)
  await press("Case collections")
  await press("Relabel selected")
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Renamed zero")
  await press("Remove selected")
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Choose a value")
  await press("Restore and reorder")
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Renamed zero")
  expect(state()).toHaveTextContent("requests 0/0/0", { exact: false })
})

it("keeps uncontrolled defaults initial-only", async () => {
  await render(<App />)
  await press("Case uncontrolled")
  expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
  await userEvent.setup().press(screen.getByRole("radio", { name: "String zero" }))
  await press("Change defaults")
  expect(screen.queryByRole("radio")).toBeNull()
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("String zero")
})
