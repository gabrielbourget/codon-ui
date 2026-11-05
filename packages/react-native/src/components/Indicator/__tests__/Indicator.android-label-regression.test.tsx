import { render, screen } from "@testing-library/react-native"
import { Platform } from "react-native"

import { Indicator } from "../../.."

it("clears a removed Android Indicator label while retaining native and alias precedence", async () => {
  const originalPlatform = Platform.OS
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" })
  try {
    const { rerender } = await render(
      <Indicator accessible accessibilityLabel="Native status" aria-label="Alias status" />,
    )
    expect(screen.getByTestId("indicator").props.accessibilityLabel).toBe("Native status")
    await rerender(<Indicator accessible aria-label="Alias status" />)
    expect(screen.getByTestId("indicator").props.accessibilityLabel).toBe("Alias status")
    await rerender(<Indicator accessibilityLabel="" aria-label="Alias status" />)
    expect(screen.getByTestId("indicator").props.accessibilityLabel).toBe("")
    await rerender(<Indicator />)
    expect(screen.getByTestId("indicator").props.accessibilityLabel).toBe("")
    expect(screen.getByTestId("indicator").props.accessible).toBe(false)
  } finally {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform })
  }
})

it("retains absent and explicit-empty Indicator names on iOS", async () => {
  const originalPlatform = Platform.OS
  Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })
  try {
    const { rerender } = await render(<Indicator />)
    expect(screen.getByTestId("indicator").props.accessibilityLabel).toBeUndefined()
    await rerender(<Indicator accessibilityLabel="" aria-label="Alias status" />)
    expect(screen.getByTestId("indicator").props.accessibilityLabel).toBe("")
  } finally {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform })
  }
})
