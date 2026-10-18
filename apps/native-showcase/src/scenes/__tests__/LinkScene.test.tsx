import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo, Dimensions, Linking } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Link scene")
  // RNTL 14 userEvent supplies a no-op preventDefault; use a stateful native event for navigation veto.
  const activate = async () => {
    let prevented = false
    await fireEvent(screen.getByRole("link", { name: "Controlled native link" }), "press", {
      nativeEvent: { timestamp: Date.now() },
      preventDefault: () => {
        prevented = true
      },
      isDefaultPrevented: () => prevented,
    })
  }
  return { press, activate, heldPress: () => user.press(screen.getByRole("link", { name: "Controlled native link" })) }
}

it("keeps repeated navigation vetoes and controlled false/empty values through theme/window/fixture changes and reset", async () => {
  const { press, activate } = await enter()
  await activate()
  await activate()
  expect(screen.getByTestId("link-state")).toHaveTextContent(/Visited: false.*Requests: 2/)
  expect(Linking.openURL).not.toHaveBeenCalled()
  await press("Next link destination")
  await activate()
  expect(screen.getByTestId("link-state")).toHaveTextContent(/Requests: 3\. Last: ""/)
  await press("Dark theme")
  await press("Vertical blocked region")
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(screen.getByTestId("link-state")).toHaveTextContent(/Visited: false.*Requests: 3\. Last: ""/)
  await press("Toggle link owner visited")
  await press("Toggle link disabled")
  await activate()
  expect(screen.getByTestId("link-state")).toHaveTextContent(/Visited: true.*Disabled: true.*Requests: 3/)
  await press("Reset scene")
  await press("Link scene")
  expect(screen.getByTestId("link-state")).toHaveTextContent(/Visited: false.*Echo: false.*Requests: 0\. Last: none/)
})

it("demonstrates owner visited echo, URL error reporting and an armed guard without a fabricated request", async () => {
  const { press, activate, heldPress } = await enter()
  await press("Toggle link visited echo")
  await activate()
  expect(screen.getByTestId("link-state")).toHaveTextContent(/Visited: true.*Requests: 1/)
  await press("Toggle native URL handoff")
  jest.mocked(Linking.openURL).mockRejectedValue(new Error("No installed handler"))
  await activate()
  expect(Linking.openURL).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).toHaveBeenCalledWith("codon-lab-unhandled://destination?value=0&empty=")
  expect(screen.getByTestId("link-state")).toHaveTextContent(/Requests: 2.*Errors: 1.*No installed handler/)
  await press("Arm link disable during press")
  await heldPress()
  expect(screen.getByTestId("link-state")).toHaveTextContent(/Disabled: true.*Requests: 2/)
  expect(Linking.openURL).toHaveBeenCalledTimes(1)
})

it("exposes all orders, native text/custom/final controls and native zero layout receipts", async () => {
  const { press } = await enter()
  for (const order of ["secondary", "tertiary", "quaternary", "quintenary", "primary"]) {
    await press("Next link order")
    expect(screen.getByTestId("link-state")).toHaveTextContent(new RegExp(`Order: ${order}`))
  }
  await press("Toggle link styles")
  await press("Toggle link colors")
  await press("Toggle link underline")
  await press("Toggle link focus ring")
  await press("Toggle link width constraint")
  await press("Toggle long link label")
  expect(screen.getByTestId("link-example")).toHaveStyle({ width: 140, borderColor: "#b73434" })
  expect(screen.getByText(/^Lien long/)).toHaveStyle({
    color: "#2f7d18",
    fontSize: 20,
    textDecorationLine: "underline",
  })
  await press("Toggle link styles")
  await press("Toggle link zero dimensions")
  await fireEvent(screen.getByTestId("link-example"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } },
  })
  expect(screen.getByTestId("link-example")).toHaveStyle({ width: 0, height: 0 })
  expect(screen.getByTestId("link-state")).toHaveTextContent(/Requests: 0.*Frame: 0 x 0/)
})
