import { render, screen } from "@testing-library/react-native"

import { PlaceholderText } from "../../../../.."

it("preserves canonical placeholder maximum width through native style and semantic overrides", async () => {
  const authored = {
    align: "center" as const,
    elementType: "span" as const,
    accessibilityRole: "text" as const,
    accessibilityLabel: "Saved view placeholder",
    customStyles: { maxWidth: 320 },
  }
  const view = await render(<PlaceholderText {...authored}>No saved views.</PlaceholderText>)
  const text = screen.getByTestId("placeholder-text")
  expect(text).toHaveStyle({ maxWidth: 320, textAlign: "center", fontStyle: "italic" })
  expect(text.props.accessibilityRole).toBe("text")
  expect(text.props.accessibilityLabel).toBe("Saved view placeholder")
  expect(text.props.elementType).toBeUndefined()
  expect(text.props.align).toBeUndefined()
  expect(text.props.customStyles).toBeUndefined()

  await view.rerender(
    <PlaceholderText {...authored} style={{ maxWidth: 160 }}>
      No saved views.
    </PlaceholderText>,
  )
  expect(screen.getByTestId("placeholder-text")).toHaveStyle({ maxWidth: 160, textAlign: "center" })
  await view.rerender(<PlaceholderText {...authored}>No saved views.</PlaceholderText>)
  expect(screen.getByTestId("placeholder-text")).toHaveStyle({ maxWidth: 320, textAlign: "center" })
})
