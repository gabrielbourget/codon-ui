import { readFileSync } from "node:fs"

import { cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { Button, DialogTrigger } from "react-aria-components"
import { describe, expect, it } from "vitest"

import type { TModalProps } from "../helpers"
import Modal from "../Modal"
import styles from "../ModalStyles.module.css"

const modalStylesSource = readFileSync("src/components/Modal/ModalStyles.module.css", "utf8")

const ModalExample = ({ children, ...props }: Partial<TModalProps>) => (
  <DialogTrigger>
    <Button aria-label="Modal Trigger Button">Trigger Btn</Button>
    <Modal {...props}>{children}</Modal>
  </DialogTrigger>
)

const ControlledModalExample = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button aria-label="Open controlled modal" onPress={() => setIsOpen(true)}>
        Open
      </Button>
      <Modal isOpen={isOpen} onOpenChange={setIsOpen} aria-label="Controlled modal">
        <span>Controlled modal body</span>
      </Modal>
    </>
  )
}

const openDialog = async (role: "dialog" | "alertdialog" = "dialog") => {
  const user = userEvent.setup()
  const triggerButton = screen.getByRole("button", { name: /Modal Trigger Button/iu, hidden: true })

  await user.click(triggerButton)

  const overlay = await screen.findByTestId("modal-overlay")
  const modal = await screen.findByTestId("modal")
  const dialog = await screen.findByRole(role)

  return { user, overlay, modal, dialog }
}

describe("<Modal />", () => {
  it("renders.", async () => {
    render(<ModalExample />)
    const { dialog } = await openDialog()
    expect(dialog).toBeInTheDocument()
  })

  it("supports controlled standalone open state.", async () => {
    const user = userEvent.setup()

    render(<ControlledModalExample />)

    await user.click(screen.getByRole("button", { name: "Open controlled modal" }))

    expect(await screen.findByRole("dialog", { name: "Controlled modal" })).toHaveTextContent("Controlled modal body")

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog", { name: "Controlled modal" })).not.toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("renders custom children when provided.", async () => {
      render(
        <ModalExample aria-label="Custom modal">
          <span>Custom modal body</span>
        </ModalExample>,
      )

      const { dialog } = await openDialog()
      expect(dialog).toHaveTextContent("Custom modal body")
      expect(dialog).not.toHaveTextContent("Placeholder text")
    })

    it("can render as an alertdialog starter when requested.", async () => {
      render(<ModalExample dialogRole="alertdialog" aria-label="Alert modal" />)

      const { dialog } = await openDialog("alertdialog")
      expect(dialog).toBeInTheDocument()
    })

    it("responds to height and width props.", async () => {
      render(<ModalExample height={50} width={150} />)

      const { modal } = await openDialog()
      expect(modal).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color prop.", async () => {
      render(<ModalExample color="gold" />)

      const { modal } = await openDialog()
      expect(modal).toHaveStyle({ backgroundColor: "rgb(255, 215, 0)" })
    })

    it("responds to theming order props.", async () => {
      const cases = [
        { order: "primary", expectedClass: styles["modal--primary"] },
        { order: "secondary", expectedClass: styles["modal--secondary"] },
        { order: "tertiary", expectedClass: styles["modal--tertiary"] },
        { order: "quaternary", expectedClass: styles["modal--quaternary"] },
        { order: "quintenary", expectedClass: styles["modal--quintenary"] },
      ] as const

      for (const { order, expectedClass } of cases) {
        render(<ModalExample order={order} />)

        const { modal } = await openDialog()
        expect(modal).toHaveClass(expectedClass)

        cleanup()
      }
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(modalStylesSource).toContain("var(--cui-color-primary-500)")
      expect(modalStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to corner geometry props.", async () => {
      render(<ModalExample geometry="rounded" aria-label="modal" />)
      const { modal } = await openDialog()
      expect(modal).toHaveClass(styles["modal--rounded"])

      cleanup()

      render(<ModalExample geometry="orthogonal" aria-label="modal" />)
      const { modal: modal2 } = await openDialog()
      expect(modal2).not.toHaveClass(styles["modal--rounded"])
    })

    it("responds to box-shadow props.", async () => {
      render(<ModalExample />)
      const { modal } = await openDialog()
      expect(modal).toHaveClass(styles["modal--raised"])

      cleanup()

      render(<ModalExample raised={false} />)
      const { modal: modal2 } = await openDialog()
      expect(modal2).not.toHaveClass(styles["modal--raised"])
    })

    it("responds to overlay blur prop.", async () => {
      render(<ModalExample />)
      const { overlay } = await openDialog()
      expect(overlay).toHaveClass(styles["modal__overlay--blur"])

      cleanup()

      render(<ModalExample overlayBlur={false} />)
      const { overlay: overlay2 } = await openDialog()
      expect(overlay2).not.toHaveClass(styles["modal__overlay--blur"])
    })

    it("responds to custom style props.", async () => {
      render(
        <ModalExample
          className="native-modal-class"
          customClassName="custom-modal-class"
          customOverlayClassName="custom-modal-overlay-class"
          customDialogClassName="custom-modal-dialog-class"
          customOverlayStyles={{ backgroundColor: "blue" }}
          customStyles={{ color: "turquoise" }}
          customDialogStyles={{ backgroundColor: "gold" }}
          style={{ backgroundColor: "blue" }}
        />,
      )

      const { overlay, modal, dialog } = await openDialog()

      expect(overlay).toHaveClass("custom-modal-overlay-class")
      expect(overlay).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(modal).toHaveClass("native-modal-class")
      expect(modal).toHaveClass("custom-modal-class")
      expect(modal).toHaveStyle({ color: "rgb(64, 224, 208)" })
      expect(modal).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(dialog).toHaveClass("custom-modal-dialog-class")
      expect(dialog).toHaveStyle({ backgroundColor: "rgb(255, 215, 0)" })
    })

    it("maps aria labeling props onto the dialog element.", async () => {
      render(<ModalExample aria-label="Named modal" />)

      const { dialog } = await openDialog()
      expect(dialog).toHaveAccessibleName("Named modal")
    })

    it("does not leak wrapper props to the modal root.", async () => {
      render(
        <ModalExample
          height={50}
          width={150}
          color="gold"
          order="primary"
          geometry="rounded"
          raised
          overlayBlur
          isKeyboardDismissDisabled
          titleText="Custom title"
          closeButtonText="Dismiss"
          customOverlayStyles={{ backgroundColor: "blue" }}
          customStyles={{ backgroundColor: "turquoise" }}
          customDialogStyles={{ backgroundColor: "gold" }}
          customClassName="custom-modal-class"
          customOverlayClassName="custom-modal-overlay-class"
          customDialogClassName="custom-modal-dialog-class"
        />,
      )

      const { modal } = await openDialog()

      expect(modal).not.toHaveAttribute("height")
      expect(modal).not.toHaveAttribute("width")
      expect(modal).not.toHaveAttribute("color")
      expect(modal).not.toHaveAttribute("order")
      expect(modal).not.toHaveAttribute("geometry")
      expect(modal).not.toHaveAttribute("raised")
      expect(modal).not.toHaveAttribute("overlayblur")
      expect(modal).not.toHaveAttribute("iskeyboarddismissdisabled")
      expect(modal).not.toHaveAttribute("titletext")
      expect(modal).not.toHaveAttribute("closebuttontext")
      expect(modal).not.toHaveAttribute("customoverlaystyles")
      expect(modal).not.toHaveAttribute("customstyles")
      expect(modal).not.toHaveAttribute("customdialogstyles")
      expect(modal).not.toHaveAttribute("customclassname")
      expect(modal).not.toHaveAttribute("customoverlayclassname")
      expect(modal).not.toHaveAttribute("customdialogclassname")
    })
  })
})
