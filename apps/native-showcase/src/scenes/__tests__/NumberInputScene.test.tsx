import { render, screen } from "@testing-library/react-native"

import { NumberInputScene } from "../NumberInputScene"

jest.mock("@codon-ui/react-native", () => ({
  ...jest.requireActual("@codon-ui/react-native"),
  NumberInput: () => {
    throw new TypeError("Native utility operation unavailable")
  },
}))

it("retains a readable capability diagnostic when a native number operation fails", async () => {
  const logged = jest.spyOn(console, "error").mockImplementation(() => undefined)
  try {
    await render(<NumberInputScene />)
    expect(screen.getByTestId("number-capability-failure")).toHaveTextContent(/Native utility operation unavailable/)
    expect(screen.getByTestId("number-runtime-methods")).toHaveTextContent(/Instance formatToParts=function/)
  } finally {
    logged.mockRestore()
  }
})
