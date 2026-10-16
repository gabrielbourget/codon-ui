import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"

import { App, SCENARIOS, scenarioName, TEXT_PHRASE } from "./App"

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

it("offers exactly the eight approved independent comparisons", () => {
  expect(SCENARIOS.map(scenarioName)).toEqual([
    "standalone-default-raw-first",
    "standalone-default-codon-first",
    "standalone-off-raw-first",
    "standalone-off-codon-first",
    "nested-default-raw-first",
    "nested-default-codon-first",
    "nested-off-raw-first",
    "nested-off-codon-first",
  ])
})

it.each(SCENARIOS.filter((scenario) => !scenario.nested))(
  "records callbacks, native counts, selection and committed controlled values: %j",
  async (scenario) => {
    await render(<App />)
    const user = userEvent.setup()
    await user.press(screen.getByRole("button", { name: scenarioName(scenario) }))
    for (const field of ["raw", "codon"]) {
      const input = screen.getByTestId(`${field}-note`)
      expect(input.props.autoCorrect).toBe(scenario.correctionsOff ? false : undefined)
      expect(input.props.spellCheck).toBe(scenario.correctionsOff ? false : undefined)
      await fireEvent(input, "focus", { nativeEvent: {} })
      await fireEvent(input, "change", { nativeEvent: { text: TEXT_PHRASE, eventCount: 17 } })
      await fireEvent.changeText(input, TEXT_PHRASE)
      await fireEvent(input, "selectionChange", { nativeEvent: { selection: { start: 17, end: 17 } } })
      expect(screen.getByTestId(`${field}-note`).props.value).toBe(TEXT_PHRASE)
      expect(screen.getByTestId(`${field}-owner`)).toHaveTextContent(`${field} owner: ${TEXT_PHRASE}`)
    }
    await user.press(screen.getByRole("button", { name: "Capture diagnostic trace" }))
    const trace = JSON.parse(screen.getByTestId("diagnostic-events").props.accessibilityLabel)
    for (const field of ["raw", "codon"]) {
      expect(trace).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "callback", field, value: TEXT_PHRASE }),
          expect.objectContaining({ kind: "native-change", field, value: TEXT_PHRASE, detail: { eventCount: 17 } }),
          expect.objectContaining({ kind: "owner-commit", field, value: TEXT_PHRASE }),
          expect.objectContaining({ kind: "selection", field, detail: { start: 17, end: 17 } }),
        ]),
      )
    }
  },
)
