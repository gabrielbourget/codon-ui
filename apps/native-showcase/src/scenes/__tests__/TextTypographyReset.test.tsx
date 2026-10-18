import { render, screen, userEvent } from "@testing-library/react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("restores the selected text variant/weight through clearing, theme changes and reset without changing owner count", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Text/Button scene")
  await press("Library action")
  await press("Toggle library styles")
  expect(screen.getByTestId("library-text-preview")).toHaveStyle({
    fontSize: 18,
    fontWeight: "700",
    fontStyle: "italic",
    lineHeight: 26,
  })
  await press("Next text variant")
  await press("Next font weight")
  await press("Clear text typography")
  expect(screen.getByTestId("library-text-preview")).toHaveStyle({
    fontSize: 12,
    fontWeight: "500",
    fontStyle: "normal",
  })
  await press("Dark theme")
  expect(screen.getByTestId("library-text-preview")).toHaveStyle({ fontSize: 12, fontWeight: "500" })
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  await press("Clear text typography")
  expect(screen.getByTestId("library-text-preview")).toHaveStyle({ fontSize: 18, fontWeight: "700" })
  await press("Reset scene")
  await press("Text/Button scene")
  expect(screen.getByTestId("library-text-preview")).toHaveStyle({ fontSize: 14, fontWeight: "400" })
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 0/)
})
