import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Checkbox from "../../Checkbox/Checkbox"
import Text from "../../Text/Text"
import CheckboxGroup from "../CheckboxGroup"
import styles from "../CheckboxGroupStyles.module.css"
import type { TCheckboxGroupProps } from "../helpers"
import { ORIENTATION__HORIZONTAL, ORIENTATION__VERTICAL } from "../helpers"

const testItems = ["Option 1", "Option 2", "Option 3"]
const testItemsList = testItems.map((name, index) => ({ id: `${index + 1}`, name }))

const CheckboxGroupExample = (props: Partial<TCheckboxGroupProps> = {}) => {
  const { orientation = ORIENTATION__HORIZONTAL, customStyles, ...checkboxGroupProps } = props

  return (
    <CheckboxGroup
      customStyles={customStyles}
      orientation={orientation}
      aria-label="checkbox-group"
      {...checkboxGroupProps}
    >
      {testItemsList.map(({ id, name }, index) => {
        return (
          <Checkbox aria-label={`Test checkbox ${index + 1}`} order="secondary" key={id} value={name} showIcon={false}>
            <Text>{name}</Text>
          </Checkbox>
        )
      })}
    </CheckboxGroup>
  )
}

describe("<CheckboxGroup />", () => {
  it("renders.", () => {
    render(<CheckboxGroupExample />)

    expect(screen.getByTestId("checkbox-group")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to orientation props.", () => {
      const { rerender } = render(<CheckboxGroupExample orientation={ORIENTATION__HORIZONTAL} />)
      const checkboxGroup = screen.getByTestId("checkbox-group")

      expect(checkboxGroup).toHaveClass(styles["checkboxGroup--horizontal"])

      rerender(<CheckboxGroupExample orientation={ORIENTATION__VERTICAL} />)
      expect(checkboxGroup).toHaveClass(styles["checkboxGroup--vertical"])
    })

    it("responds to canonical disabled and readonly props.", () => {
      const { rerender } = render(<CheckboxGroupExample isDisabled />)
      const checkboxGroup = screen.getByTestId("checkbox-group")

      expect(checkboxGroup).toHaveAttribute("data-disabled", "true")

      rerender(<CheckboxGroupExample isReadOnly />)
      expect(checkboxGroup).toHaveAttribute("data-readonly", "true")
    })

    it("responds to custom styles prop.", () => {
      render(<CheckboxGroupExample customStyles={{ height: 200, width: 500 }} />)
      const checkboxGroup = screen.getByTestId("checkbox-group")

      expect(checkboxGroup).toHaveStyle({ height: "200px", width: "500px" })
    })

    it("merges native and custom root styling props.", () => {
      render(
        <CheckboxGroupExample
          className="native-checkbox-group"
          customClassName="custom-checkbox-group"
          customStyles={{ height: 200 }}
          style={{ width: 500 }}
        />,
      )

      const checkboxGroup = screen.getByTestId("checkbox-group")
      expect(checkboxGroup).toHaveClass(styles.checkboxGroup)
      expect(checkboxGroup).toHaveClass("custom-checkbox-group")
      expect(checkboxGroup).toHaveClass("native-checkbox-group")
      expect(checkboxGroup).toHaveStyle({ height: "200px", width: "500px" })
    })

    it("can opt out of disabled and readonly states with canonical props.", () => {
      render(<CheckboxGroupExample isDisabled={false} isReadOnly={false} />)
      const checkboxGroup = screen.getByTestId("checkbox-group")

      expect(checkboxGroup).not.toHaveAttribute("data-disabled")
      expect(checkboxGroup).not.toHaveAttribute("data-readonly")
    })

    it("consumes wrapper-only props before spreading root props.", () => {
      render(
        <CheckboxGroupExample
          customStyles={{ height: 200 }}
          customClassName="custom-checkbox-group"
          isDisabled
          isReadOnly
        />,
      )

      const checkboxGroup = screen.getByTestId("checkbox-group")
      expect(checkboxGroup).not.toHaveAttribute("customStyles")
      expect(checkboxGroup).not.toHaveAttribute("customClassName")
      expect(checkboxGroup).not.toHaveAttribute("disabled")
      expect(checkboxGroup).not.toHaveAttribute("readOnly")
    })
  })
})
