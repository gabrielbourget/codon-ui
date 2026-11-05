import { act, render, screen, userEvent } from "@testing-library/react-native"
import { Linking } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

let emitURL: (event: { url: string }) => void

beforeEach(() => {
  jest.useFakeTimers()
  jest
    .spyOn(Linking, "getInitialURL")
    .mockResolvedValue("codon-showcase://scenario/library?theme=dark&fixture=compact&controls=hidden&reset=1")
  jest.spyOn(Linking, "addEventListener").mockImplementation((_type, listener) => {
    emitURL = listener
    return { remove: jest.fn() } as unknown as ReturnType<typeof Linking.addEventListener>
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const enter = () =>
  render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )

it("opens a real public-component scenario directly and restores harness controls without resetting its state", async () => {
  await enter()
  expect(screen.getByTestId("showcase-scenario")).toHaveTextContent("Scene: library. Theme: dark. Fixture: compact.")
  expect(screen.queryByRole("button", { name: "Foundation scene" })).toBeNull()
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Library action" }))
  await user.press(screen.getByRole("button", { name: "Show harness controls" }))
  expect(screen.getByRole("button", { name: "Foundation scene" })).toBeOnTheScreen()
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
})

it("retains the actual component across same-scene theme/fixture links and resets only when explicitly requested", async () => {
  await enter()
  const user = userEvent.setup()
  const original = screen.getByTestId("library-button")
  await user.press(screen.getByRole("button", { name: "Library action" }))
  await act(() => emitURL({ url: "codon-showcase://scenario/library?theme=light&fixture=expanded" }))
  expect(screen.getByTestId("library-button")).toBe(original)
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  expect(screen.getByTestId("showcase-scenario")).toHaveTextContent("Scene: library. Theme: light. Fixture: expanded.")
  await user.press(screen.getByRole("button", { name: "Toggle library disabled" }))
  await act(() => emitURL({ url: "codon-showcase://scenario/library?reset=1&controls=hidden" }))
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 0.*State: enabled/)
  expect(screen.getByTestId("showcase-scenario")).toHaveTextContent("Scene: library. Theme: light. Fixture: live.")
})

it("retains the selected public component and owner value when a scenario request is invalid", async () => {
  await enter()
  await userEvent.setup().press(screen.getByRole("button", { name: "Library action" }))
  await act(() => emitURL({ url: "codon-showcase://scenario/avatar?theme=light&fixture=typo&reset=1" }))
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  expect(screen.getByTestId("showcase-scenario")).toHaveTextContent("Scene: library. Theme: dark. Fixture: compact.")
  expect(screen.getByTestId("showcase-link-error")).toHaveTextContent(
    "Invalid showcase scenario link. Current scene retained.",
  )
})
