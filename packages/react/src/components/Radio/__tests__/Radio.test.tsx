import { readFileSync } from "node:fs"

import { fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { ORIENTATION__HORIZONTAL } from "../../RadioGroup/helpers"
import RadioGroup from "../../RadioGroup/RadioGroup"
import Text from "../../Text/Text"
import type { TRadioProps } from "../helpers"
import Radio from "../Radio"
import styles from "../RadioStyles.module.css"

const radioStylesSource = readFileSync("src/components/Radio/RadioStyles.module.css", "utf8")
const testItems = ["Option 1", "Option 2", "Option 3"]
const testItemsList = testItems.map((name, index) => ({ id: `${index + 1}`, name }))

const RadioGroupExample = (props: {
  orientation?: "horizontal" | "vertical"
  customStyles?: React.CSSProperties
  isDisabled?: boolean
  radioProps?: Partial<TRadioProps>
}) => {
  const { customStyles, isDisabled, radioProps } = props
  const orientation = props.orientation ?? ORIENTATION__HORIZONTAL

  return (
    <RadioGroup customStyles={customStyles} orientation={orientation} aria-label="radio-group">
      {testItemsList.slice(0, 1).map(({ id, name }, index) => {
        return (
          <Radio
            aria-label={`Test radio ${index + 1}`}
            order="secondary"
            key={id}
            value={name}
            isDisabled={isDisabled}
            {...radioProps}
          >
            <Text>{name}</Text>
          </Radio>
        )
      })}
    </RadioGroup>
  )
}

describe("<Radio />", () => {
  it("renders.", () => {
    render(<RadioGroupExample />)

    const radio = screen.getByTestId("radio")
    expect(radio).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<RadioGroupExample radioProps={{ height: 30, width: 100 }} />)

      const radio = screen.getByTestId("radio")
      expect(radio).toHaveStyle({ height: "30px", width: "100px" })
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<RadioGroupExample radioProps={{ geometry: "rounded" }} />)
      const radio = screen.getByTestId("radio-shape")
      expect(radio).toHaveClass(styles["shape--rounded"])

      rerender(<RadioGroupExample radioProps={{ geometry: "round" }} />)
      expect(radio).toHaveClass(styles["shape--round"])

      rerender(<RadioGroupExample radioProps={{ geometry: "orthogonal" }} />)
      expect(radio).not.toHaveClass(styles["shape--rounded"])
      expect(radio).not.toHaveClass(styles["shape--round"])
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<RadioGroupExample radioProps={{ order: "primary" }} />)
      let radio = screen.getByTestId("radio-shape")
      expect(radio).toHaveClass(styles["shape--primary"])

      rerender(<RadioGroupExample radioProps={{ order: "secondary" }} />)
      radio = screen.getByTestId("radio-shape")
      expect(radio).toHaveClass(styles["shape--secondary"])

      rerender(<RadioGroupExample radioProps={{ order: "tertiary" }} />)
      radio = screen.getByTestId("radio-shape")
      expect(radio).toHaveClass(styles["shape--tertiary"])

      rerender(<RadioGroupExample radioProps={{ order: "quaternary" }} />)
      radio = screen.getByTestId("radio-shape")
      expect(radio).toHaveClass(styles["shape--quaternary"])

      rerender(<RadioGroupExample radioProps={{ order: "quintenary" }} />)
      radio = screen.getByTestId("radio-shape")
      expect(radio).toHaveClass(styles["shape--quintenary"])
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(radioStylesSource).toContain("var(--cui-color-primary-500)")
      expect(radioStylesSource).toContain("var(--cui-color-primary-600)")
      expect(radioStylesSource).toContain("var(--cui-color-primary-700)")
      expect(radioStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<RadioGroupExample />)
      let radio = screen.getByTestId("radio-shape")
      fireEvent.focus(radio)

      radio = screen.getByTestId("radio-shape")
      expect(radio).toHaveClass(styles["shape--applyFocusStyle"])
      expect(radio).toHaveClass(styles["shape--offsetFocusRing"])

      rerender(<RadioGroupExample radioProps={{ enableFocusStyle: false, offsetFocusRing: false }} />)
      radio = screen.getByTestId("radio-shape")
      fireEvent.focus(radio)

      expect(radio).not.toHaveClass(styles["shape--applyFocusStyle"])
      expect(radio).not.toHaveClass(styles["shape--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<RadioGroupExample isDisabled />)

      const radio = screen.getByTestId("radio")
      expect(radio).toHaveAttribute("data-disabled", "true")
    })

    it("responds to custom styles prop.", () => {
      render(<RadioGroupExample radioProps={{ customStyles: { color: "turquoise", borderRadius: 0 } }} />)

      const radio = screen.getByTestId("radio")
      expect(radio).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <RadioGroupExample
          radioProps={{
            height: 30,
            width: 100,
            customStyles: { marginTop: 5 },
            className: "native-radio-class",
            style: { width: 120, marginBottom: 10 },
          }}
        />,
      )

      const radio = screen.getByTestId("radio")

      expect(radio).toHaveClass(styles.radio)
      expect(radio).toHaveClass("native-radio-class")
      expect(radio).toHaveStyle({
        height: "30px",
        width: "120px",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("keeps custom shape styles scoped to the visual shape.", () => {
      render(
        <RadioGroupExample
          radioProps={{
            customShapeStyles: { backgroundColor: "turquoise" },
          }}
        />,
      )

      const radio = screen.getByTestId("radio")
      const radioShape = screen.getByTestId("radio-shape")

      expect(radio).not.toHaveStyle({ backgroundColor: "rgb(64, 224, 208)" })
      expect(radioShape).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)" })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <RadioGroupExample
          radioProps={{
            height: 30,
            width: 100,
            color: "turquoise",
            geometry: "round",
            order: "primary",
            enableFocusStyle: false,
            offsetFocusRing: false,
            customStyles: { marginTop: 5 },
            customShapeStyles: { backgroundColor: "turquoise" },
          }}
        />,
      )

      const radio = screen.getByTestId("radio")

      expect(radio).not.toHaveAttribute("color")
      expect(radio).not.toHaveAttribute("geometry")
      expect(radio).not.toHaveAttribute("order")
      expect(radio).not.toHaveAttribute("enablefocusstyle")
      expect(radio).not.toHaveAttribute("offsetfocusring")
      expect(radio).not.toHaveAttribute("customstyles")
      expect(radio).not.toHaveAttribute("customshapestyles")
    })
  })

  describe("interactions", () => {
    it("responds when hovering over it.", async () => {
      const user = userEvent.setup()

      render(<RadioGroupExample />)
      const radio = screen.getByTestId("radio")

      await user.hover(radio)

      expect(radio).toHaveAttribute("data-hovered", "true")
    })

    it("responds when pressing it.", () => {
      render(<RadioGroupExample />)
      const radio = screen.getByTestId("radio")

      fireEvent.mouseDown(radio)

      expect(radio).toHaveAttribute("data-pressed", "true")
    })
  })
})
