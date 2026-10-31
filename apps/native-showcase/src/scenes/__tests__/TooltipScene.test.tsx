import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "@codon-ui/react-native"

import { TooltipScene } from "../TooltipScene"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const node = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeFloatingLayerHost>
      <TooltipScene />
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const press = async (name: string) => userEvent.setup().press(screen.getByRole("button", { name }))

it("composes public descriptions with declined close requests and preserves the original action", async () => {
  await render(node())
  await press("Show tooltip explicitly")
  await press("Toggle description echo")
  await press("Described action")
  expect(screen.getByTestId("tooltip-scene-state")).toHaveTextContent(
    /Tooltip: true.*Requests: 1.*Actions: 1.*declines/,
  )
  await press("Toggle description echo")
  await press("Described action")
  expect(screen.getByTestId("tooltip-scene-state")).toHaveTextContent(/Tooltip: false.*Requests: 2.*Actions: 2/)
})

it("retains caller-owned editor drafts through theme/style changes, owner removal and explicit reset", async () => {
  const result = await render(node())
  await fireEvent.changeText(screen.getByTestId("tooltip-scene-editor"), "Retained draft")
  await press("Show editor description explicitly")
  await press("Toggle description styles")
  await press("Toggle description geometry")
  await press("Toggle description arrow")
  await press("Next description order")
  await result.rerender(node("dark"))
  expect(screen.getByTestId("tooltip-scene-editor")).toHaveDisplayValue("Retained draft")
  expect(screen.getByTestId("hover-scene-surface", { includeHiddenElements: true })).toHaveStyle({
    borderRadius: 0,
    borderWidth: 3,
    padding: 0,
  })
  expect(screen.getByTestId("tooltip-context", { includeHiddenElements: true })).toHaveTextContent(
    "Live caller description context",
  )
  await press("Toggle description owner")
  expect(screen.queryByTestId("hover-scene-surface", { includeHiddenElements: true })).toBeNull()
  await press("Toggle description owner")
  expect(screen.getByTestId("tooltip-scene-editor")).toHaveDisplayValue("Retained draft")
  await press("Reset descriptions")
  expect(screen.getByTestId("tooltip-scene-state")).toHaveTextContent(
    /Tooltip: false.*Hover: false.*Requests: 0.*Actions: 0.*echoes.*Draft: empty/,
  )
})

it("uses the public trigger's hover timing without turning touch entry into an automatic tooltip", async () => {
  await render(node())
  await fireEvent(screen.getByTestId("tooltip-scene-trigger"), "pointerEnter", {
    nativeEvent: { pointerType: "touch" },
  })
  await act(() => jest.advanceTimersByTime(1500))
  expect(screen.getByTestId("tooltip-scene-state")).toHaveTextContent(/Tooltip: false.*Requests: 0/)
  await fireEvent(screen.getByTestId("tooltip-scene-trigger"), "pointerEnter", {
    nativeEvent: { pointerType: "mouse" },
  })
  await act(() => jest.advanceTimersByTime(1500))
  expect(screen.getByTestId("tooltip-scene-state")).toHaveTextContent(/Tooltip: true.*Requests: 1/)
})
