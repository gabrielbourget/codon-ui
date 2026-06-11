import { render, screen } from "@testing-library/react"
import type { CSSProperties } from "react"
import { describe, expect, it } from "vitest"

import type { TRadioProps } from "../../Radio/helpers"
import Radio from "../../Radio/Radio"
import Text from "../../Text/Text"
import type { TRadioGroupProps } from "../helpers"
import { ORIENTATION__HORIZONTAL, ORIENTATION__VERTICAL } from "../helpers"
import RadioGroup from "../RadioGroup"
import styles from "../RadioGroupStyles.module.css"

const testItems = ["Option 1", "Option 2", "Option 3"]
const testItemsList = testItems.map((name, index) => ({ id: `${index + 1}`, name }))

const RadioGroupExample = (
  props: {
    orientation?: "horizontal" | "vertical"
    customStyles?: CSSProperties
    radioProps?: Partial<TRadioProps>
  } & Partial<TRadioGroupProps> = {},
) => {
  const { customStyles, radioProps, orientation = ORIENTATION__HORIZONTAL, ...radioGroupProps } = props

  return (
    <RadioGroup customStyles={customStyles} orientation={orientation} aria-label="radio-group" {...radioGroupProps}>
      {testItemsList.map(({ id, name }, index) => {
        return (
          <Radio aria-label={`Test radio ${index + 1}`} order="secondary" key={id} value={name} {...radioProps}>
            <Text>{name}</Text>
          </Radio>
        )
      })}
    </RadioGroup>
  )
}

describe("<RadioGroup />", () => {
  it("renders.", () => {
    render(<RadioGroupExample />)

    expect(screen.getByTestId("radio-group")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to orientation props.", () => {
      const { rerender } = render(<RadioGroupExample orientation={ORIENTATION__HORIZONTAL} />)
      const radioGroup = screen.getByTestId("radio-group")

      expect(radioGroup).toHaveClass(styles["radioGroup--horizontal"])

      rerender(<RadioGroupExample orientation={ORIENTATION__VERTICAL} />)
      expect(radioGroup).toHaveClass(styles["radioGroup--vertical"])
    })

    it("responds to canonical disabled and readonly props.", () => {
      const { rerender } = render(<RadioGroupExample isDisabled />)
      const radioGroup = screen.getByTestId("radio-group")

      expect(radioGroup).toHaveAttribute("data-disabled", "true")

      rerender(<RadioGroupExample isReadOnly />)
      expect(radioGroup).toHaveAttribute("data-readonly", "true")
    })

    it("responds to custom styles prop.", () => {
      render(<RadioGroupExample customStyles={{ height: 200, width: 500, backgroundColor: "red" }} />)

      const radioGroup = screen.getByTestId("radio-group")
      expect(radioGroup).toHaveStyle({
        height: "200px",
        width: "500px",
        backgroundColor: "rgb(255, 0, 0)",
      })
    })

    it("merges native and custom root styling props.", () => {
      render(
        <RadioGroupExample
          className="native-radio-group"
          customClassName="custom-radio-group"
          customStyles={{ height: 200 }}
          style={{ width: 500 }}
        />,
      )

      const radioGroup = screen.getByTestId("radio-group")
      expect(radioGroup).toHaveClass(styles.radioGroup)
      expect(radioGroup).toHaveClass("custom-radio-group")
      expect(radioGroup).toHaveClass("native-radio-group")
      expect(radioGroup).toHaveStyle({ height: "200px", width: "500px" })
    })

    it("can opt out of disabled and readonly states with canonical props.", () => {
      render(<RadioGroupExample isDisabled={false} isReadOnly={false} />)
      const radioGroup = screen.getByTestId("radio-group")

      expect(radioGroup).not.toHaveAttribute("data-disabled")
      expect(radioGroup).not.toHaveAttribute("data-readonly")
    })

    it("consumes wrapper-only props before spreading root props.", () => {
      render(
        <RadioGroupExample customStyles={{ height: 200 }} customClassName="custom-radio-group" isDisabled isReadOnly />,
      )

      const radioGroup = screen.getByTestId("radio-group")
      expect(radioGroup).not.toHaveAttribute("customStyles")
      expect(radioGroup).not.toHaveAttribute("customClassName")
      expect(radioGroup).not.toHaveAttribute("disabled")
      expect(radioGroup).not.toHaveAttribute("readOnly")
    })
  })
})
