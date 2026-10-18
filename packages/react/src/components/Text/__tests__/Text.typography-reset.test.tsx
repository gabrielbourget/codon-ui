import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import Text from "../Text"
import styles from "../TextStyles.module.css"

it.each(["b10", "h1", "d1"] as const)(
  "retains the computed %s class when final undefined clears custom size",
  (variant) => {
    render(
      <Text variant={variant} customStyles={{ fontSize: 17 }} style={{ fontSize: undefined }}>
        Reset
      </Text>,
    )
    expect(screen.getByText("Reset")).toHaveClass(styles[variant])
    expect(screen.getByText("Reset").style.fontSize).toBe("")
  },
)

it("retains computed weight/style classes after clearing authored overrides", () => {
  render(
    <Text
      fontWeight="bold"
      fontStyle="italic"
      customStyles={{ fontWeight: 400, fontStyle: "normal" }}
      style={{ fontWeight: undefined, fontStyle: undefined }}
    >
      Reset
    </Text>,
  )
  expect(screen.getByText("Reset")).toHaveClass(styles["fw-bold"], styles["fs-italic"])
  expect(screen.getByText("Reset").style.fontWeight).toBe("")
  expect(screen.getByText("Reset").style.fontStyle).toBe("")
})

it("keeps an explicit zero override above the computed size class", () => {
  render(
    <Text variant="h1" customStyles={{ fontSize: 17 }} style={{ fontSize: 0 }}>
      Zero
    </Text>,
  )
  expect(screen.getByText("Zero")).toHaveClass(styles.h1)
  expect(parseFloat(screen.getByText("Zero").style.fontSize)).toBe(0)
})

it("clears a font-family override while keeping the canonical base class", () => {
  render(
    <Text customStyles={{ fontFamily: "Custom" }} style={{ fontFamily: undefined }}>
      Reset
    </Text>,
  )
  expect(screen.getByText("Reset")).toHaveClass(styles.base)
  expect(screen.getByText("Reset").style.fontFamily).toBe("")
})
