import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Button from "../Button"

describe("Button root typography contract", () => {
  it("retains final root typography over custom typography for raw text", () => {
    render(
      <Button
        customStyles={{ fontSize: 18, fontWeight: 600, letterSpacing: 1 }}
        style={{ fontSize: 22, fontStyle: "italic", textTransform: "uppercase" }}
      >
        Save 0
      </Button>,
    )
    const root = screen.getByRole("button", { name: "Save 0" })
    expect(root).toHaveStyle({
      fontSize: "22px",
      fontWeight: "600",
      letterSpacing: "1px",
      fontStyle: "italic",
      textTransform: "uppercase",
    })
    expect(root.textContent).toBe("Save 0")
  })
  it("retains render-function text and final callback typography without rewriting authored children", () => {
    render(
      <Button customStyles={{ fontSize: 18 }} style={() => ({ fontSize: 24, fontWeight: 700 })}>
        {() => (
          <>
            Save{" "}
            <span data-testid="authored" style={{ fontSize: 11, fontWeight: 400 }}>
              own
            </span>
          </>
        )}
      </Button>,
    )
    expect(screen.getByRole("button")).toHaveStyle({ fontSize: "24px", fontWeight: "700" })
    expect(screen.getByTestId("authored")).toHaveStyle({ fontSize: "11px", fontWeight: "400" })
  })
  it("preserves zero typography and clears an authored font field through final undefined", () => {
    const { rerender } = render(
      <Button customStyles={{ fontSize: 18 }} style={{ fontSize: 0, letterSpacing: 0 }}>
        Zero
      </Button>,
    )
    expect(parseFloat(screen.getByRole("button").style.fontSize)).toBe(0)
    expect(parseFloat(screen.getByRole("button").style.letterSpacing)).toBe(0)
    rerender(
      <Button customStyles={{ fontSize: 18 }} style={{ fontSize: undefined }}>
        Default
      </Button>,
    )
    expect(screen.getByRole("button").style.fontSize).toBe("")
  })
})
