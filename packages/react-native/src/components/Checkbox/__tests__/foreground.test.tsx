import { render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { Checkbox, Text } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("preserves computed-custom-final label foreground independently of the mark and authored Text", async () => {
  const custom = { color: "#123456", marginTop: 3 }
  const state = jest.fn()
  await render(
    <Checkbox
      isSelected
      color="#fedcba"
      customStyles={custom}
      style={(value) => {
        state(value)
        return { ...value.defaultStyle, color: "#abcdef" }
      }}
    >
      <>
        Inherited <Text color="#654321">Authored</Text>
      </>
    </Checkbox>,
  )
  expect(state.mock.calls[0][0].defaultStyle).toMatchObject({ color: "#123456", marginTop: 3 })
  expect(screen.getByText("Inherited")).toHaveStyle({ color: "#abcdef" })
  expect(screen.getByText("Authored")).toHaveStyle({ color: "#654321" })
  expect(screen.getByRole("checkbox")).toHaveStyle({ marginTop: 3 })
  expect(screen.getByRole("checkbox").props.style.color).toBeUndefined()
  expect(screen.getByTestId("checkbox-shape", { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: "#fedcba",
    borderColor: "#fedcba",
  })
})
