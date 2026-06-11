import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import classNames from "classnames"
import { DialogTrigger, Header } from "react-aria-components"
import { describe, expect, it } from "vitest"

import Button from "../../Button/Button"
import FormField from "../../FormField/FormField"
import Input from "../../Input/Input"
import textStyles from "../../Text/TextStyles.module.css"
import ClickPopover from "../ClickPopover"
import styles from "../ClickPopoverStyles.module.css"
import type { TClickPopoverProps } from "../helpers"

const clickPopoverStylesSource = readFileSync("src/components/ClickPopover/ClickPopoverStyles.module.css", "utf8")

const ClickPopoverExample = (props: Partial<TClickPopoverProps>) => (
  <DialogTrigger>
    <Button
      raisedOnHover
      aria-label="Click Popover Menu"
      geometry="round"
      transparent
      raised={false}
      customStyles={{ aspectRatio: "1/1" }}
    >
      <span aria-hidden="true">Filter</span>
    </Button>
    <ClickPopover placement="bottom right" {...props} showOverlayArrow>
      <Header className={classNames(textStyles.b10, textStyles["fw-bold"])}>Filter Popover</Header>
      <FormField label="Filter Argument" labelID="filter-argument-id">
        <Input height={30} placeholder="Filter Argument" />
      </FormField>
    </ClickPopover>
  </DialogTrigger>
)

const openPopover = async () => {
  const user = userEvent.setup()
  const triggerButton = screen.getByRole("button", { name: "Click Popover Menu" })

  await user.click(triggerButton)

  const modal = await screen.findByTestId("click-popover")
  const dialog = await screen.findByRole("dialog")
  const overlayArrow = await screen.findByTestId("click-popover-overlay-arrow")

  return { user, overlayArrow, modal, dialog }
}

describe("<ClickPopover /> Tests", () => {
  it("ClickPopover can render.", async () => {
    render(<ClickPopoverExample />)

    const { modal, dialog } = await openPopover()
    expect(modal).toBeInTheDocument()
    expect(dialog).toBeInTheDocument()
  })

  describe("Props API Surface Area", () => {
    it("ClickPopover responds correctly to height and width props.", async () => {
      render(<ClickPopoverExample height={50} width={150} />)

      const { modal } = await openPopover()
      expect(modal).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("ClickPopover responds correctly to color prop.", async () => {
      render(<ClickPopoverExample color="teal" />)

      const { modal, overlayArrow } = await openPopover()
      expect(modal).toHaveStyle({ color: "rgb(0, 128, 128)" })
      expect(overlayArrow).toHaveStyle({ color: "rgb(0, 128, 128)" })
    })

    describe("ClickPopover responds correctly to theming order props.", () => {
      it("Primary Theme.", async () => {
        render(<ClickPopoverExample order="primary" />)
        const { modal, overlayArrow } = await openPopover()
        expect(modal).toHaveClass(styles["clickPopover--primary"])
        expect(overlayArrow).toHaveClass(styles["clickPopover__overlayArrow--primary"])
      })

      it("Secondary Theme.", async () => {
        render(<ClickPopoverExample order="secondary" />)
        const { modal, overlayArrow } = await openPopover()
        expect(modal).toHaveClass(styles["clickPopover--secondary"])
        expect(overlayArrow).toHaveClass(styles["clickPopover__overlayArrow--secondary"])
      })

      it("Tertiary Theme.", async () => {
        render(<ClickPopoverExample order="tertiary" />)
        const { modal, overlayArrow } = await openPopover()
        expect(modal).toHaveClass(styles["clickPopover--tertiary"])
        expect(overlayArrow).toHaveClass(styles["clickPopover__overlayArrow--tertiary"])
      })

      it("Quaternary Theme.", async () => {
        render(<ClickPopoverExample order="quaternary" />)
        const { modal, overlayArrow } = await openPopover()
        expect(modal).toHaveClass(styles["clickPopover--quaternary"])
        expect(overlayArrow).toHaveClass(styles["clickPopover__overlayArrow--quaternary"])
      })

      it("Quintenary Theme.", async () => {
        render(<ClickPopoverExample order="quintenary" />)
        const { modal, overlayArrow } = await openPopover()
        expect(modal).toHaveClass(styles["clickPopover--quintenary"])
        expect(overlayArrow).toHaveClass(styles["clickPopover__overlayArrow--quintenary"])
      })
    })

    it("ClickPopover order styles use numbered palette tokens.", () => {
      expect(clickPopoverStylesSource).toContain("var(--cui-color-primary-500)")
      expect(clickPopoverStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("ClickPopover responds correctly to corner geometry props.", async () => {
      const { unmount } = render(<ClickPopoverExample geometry="rounded" aria-label="click-popover" />)
      const { modal } = await openPopover()
      expect(modal).toHaveClass(styles["clickPopover--rounded"])

      unmount()

      render(<ClickPopoverExample geometry="orthogonal" aria-label="click-popover" />)
      const { modal: modal2 } = await openPopover()
      expect(modal2).not.toHaveClass(styles["clickPopover--rounded"])
    })

    it("ClickPopover responds correctly to box-shadow props.", async () => {
      const { unmount } = render(<ClickPopoverExample />)
      const { modal } = await openPopover()
      expect(modal).toHaveClass(styles["clickPopover--raised"])

      unmount()

      render(<ClickPopoverExample raised={false} />)
      const { modal: modal2 } = await openPopover()
      expect(modal2).not.toHaveClass(styles["clickPopover--raised"])
    })

    it("ClickPopover responds correctly to custom style props.", async () => {
      render(
        <ClickPopoverExample
          className="native-click-popover-class"
          customClassName="custom-click-popover-class"
          customStyles={{ color: "turquoise" }}
          customOverlayArrowStyles={{ backgroundColor: "blue" }}
          customDialogStyles={{ backgroundColor: "orange" }}
          style={{ backgroundColor: "blue" }}
          aria-label="datetime-picker"
        />,
      )

      const { overlayArrow, modal, dialog } = await openPopover()
      expect(modal).toHaveClass("native-click-popover-class")
      expect(modal).toHaveClass("custom-click-popover-class")
      expect(modal).toHaveStyle({ color: "rgb(64, 224, 208)" })
      expect(modal).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(dialog).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(overlayArrow).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("ClickPopover does not leak wrapper props to the popover root.", async () => {
      render(
        <ClickPopoverExample
          height={50}
          width={150}
          color="teal"
          order="primary"
          geometry="rounded"
          raised
          showOverlayArrow
          childIsDialog
          customStyles={{ backgroundColor: "turquoise" }}
          customOverlayArrowStyles={{ backgroundColor: "blue" }}
          customDialogStyles={{ backgroundColor: "orange" }}
          customClassName="custom-click-popover-class"
          customDialogClassName="custom-click-popover-dialog-class"
        />,
      )

      const { modal } = await openPopover()

      expect(modal).not.toHaveAttribute("height")
      expect(modal).not.toHaveAttribute("width")
      expect(modal).not.toHaveAttribute("color")
      expect(modal).not.toHaveAttribute("order")
      expect(modal).not.toHaveAttribute("geometry")
      expect(modal).not.toHaveAttribute("raised")
      expect(modal).not.toHaveAttribute("showoverlayarrow")
      expect(modal).not.toHaveAttribute("childisdialog")
      expect(modal).not.toHaveAttribute("customstyles")
      expect(modal).not.toHaveAttribute("customoverlayarrowstyles")
      expect(modal).not.toHaveAttribute("customdialogstyles")
      expect(modal).not.toHaveAttribute("customclassname")
      expect(modal).not.toHaveAttribute("customdialogclassname")
    })
  })
})
