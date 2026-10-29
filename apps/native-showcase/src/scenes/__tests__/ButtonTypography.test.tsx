import { act, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("applies public button typography through mixed/callback content while preserving owner state and resetting defaults", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Text/Button scene")
  expect(screen.getByTestId("library-button").props.nativeID).toBe("library-button-ready")
  expect(screen.getByText("Library action 0")).toHaveStyle({ fontSize: 14, fontWeight: "400" })
  await press("Toggle library styles")
  expect(screen.getByText("Library action 0")).toHaveStyle({
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#ffffff",
  })
  await press("Library action")
  await press("Toggle render children")
  expect(screen.getByText("Rendered library action 1")).toHaveStyle({ fontSize: 20, fontWeight: "700" })
  await press("Dark theme")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
    expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
    expect(screen.getByText("Rendered library action 1")).toHaveStyle({ fontSize: 20, fontWeight: "700" })
    await press("Toggle library pending")
    await press("Library action")
    expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
    await press("Reset scene")
    await press("Text/Button scene")
    expect(screen.getByText("Library action 0")).toHaveStyle({ fontSize: 14, fontWeight: "400" })
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("composes native keyboard activation with the maintained scene's pending guard and owner counter", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Text/Button scene")
  const send = async (phase: "down" | "up", key = "Enter") => {
    const button = screen.getByTestId("library-button")
    await act(() =>
      button.props.onNativeKey({
        persist: jest.fn(),
        nativeEvent: {
          kind: "keyboard",
          ownerId: button.props.ownerId,
          key,
          nativeCode: key === "Enter" ? 40 : 44,
          phase,
          nativeDefaultHandled: true,
          repeat: false,
          cancelled: false,
        },
      }),
    )
  }
  await send("down")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 0/)
  await send("up")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  await send("down", " ")
  await press("Toggle library pending")
  expect(screen.getByTestId("library-button").props.nativeID).toBe("library-button-pending")
  await press("Toggle library pending")
  expect(screen.getByTestId("library-button").props.nativeID).toBe("library-button-ready")
  await send("up", " ")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  await press("Toggle library keyboard focus")
  expect(screen.getByTestId("library-button").props.keyboardFocusable).toBe(false)
  await send("down")
  await send("up")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  await press("Library action")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 2/)
  await press("Toggle library keyboard focus")
  await press("Toggle render children")
  await press("Dark theme")
  await send("down")
  await send("up")
  expect(screen.getByText("Rendered library action 3")).toBeOnTheScreen()
  const retained = screen.getByTestId("library-button").props.onNativeKey
  const ownerId = screen.getByTestId("library-button").props.ownerId
  await press("Reset scene")
  await act(() => retained({ nativeEvent: { kind: "keyboard", ownerId, key: "Enter", nativeCode: 40, phase: "up" } }))
  await press("Text/Button scene")
  expect(screen.getByText("Library action 0")).toBeOnTheScreen()
})

it("composes native activation and press-up with owner state, guards, callback retirement and scene reset", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Text/Button scene")
  const root = () => screen.getByTestId("library-button")
  let scope = root().parent
  while (scope && !scope.props.onNativeScopeStatus) scope = scope.parent
  if (!scope) throw new Error("Expected the button's native keyboard scope in this source-model fixture")
  const scopeHost = scope
  const activation = (activationId: number, scoped = true) => ({
    nativeEvent: {
      kind: "activation",
      source: "ios-accessibility-activate",
      ownerId: root().props.ownerId,
      target: 17,
      observedAt: 0,
      activationId,
      scopeOwnerId: scoped ? scopeHost.props.ownerId : "",
      windowId: scoped ? "button-scene-window" : "window-1",
      epoch: scoped ? 1 : 0,
    },
  })
  const send = async (event: ReturnType<typeof activation>) => act(() => root().props.onNativeActivation(event))
  // Source-model handshake only; installed acknowledgments remain a separate acceptance tier.
  const acknowledgeCurrentScope = async () =>
    act(() =>
      scopeHost.props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: scopeHost.props.ownerId,
          windowId: "button-scene-window",
          epoch: 1,
          policyRevision: scopeHost.props.policyRevision,
          ready: true,
          windowActive: true,
        },
      }),
    )
  await send(activation(1, false))
  await send(activation(2))
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 0/)
  expect(screen.getByTestId("library-release")).toHaveTextContent("Last release: none")
  await acknowledgeCurrentScope()
  const first = activation(3)
  await send(first)
  await send(first)
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  expect(screen.getByTestId("library-release")).toHaveTextContent("Last release: activation")
  await press("Toggle library pending")
  const blocked = activation(4)
  await send(blocked)
  await press("Toggle library pending")
  await acknowledgeCurrentScope()
  await send(blocked)
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  await press("Toggle render children")
  await press("Dark theme")
  await acknowledgeCurrentScope()
  await send(activation(5))
  expect(screen.getByText("Rendered library action 2")).toBeOnTheScreen()
  const retained = screen.getByTestId("library-button").props.onNativeActivation
  const retired = activation(6)
  await press("Reset scene")
  await act(() => retained(retired))
  await press("Text/Button scene")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 0/)
  expect(screen.getByTestId("library-release")).toHaveTextContent("Last release: none")
})
