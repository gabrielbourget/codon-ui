import { render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Button, DialogTrigger } from "react-aria-components"
import { describe, expect, it, vi } from "vitest"

import AlertDialog from "../AlertDialog"
import styles from "../AlertDialogStyles.module.css"
import type { TAlertDialogProps } from "../helpers"

const AlertDialogExample = (props: Partial<TAlertDialogProps>) => (
  <DialogTrigger>
    <Button aria-label="Alert Dialog Button">Alert Trigger</Button>
    <AlertDialog
      titleText="Dialog Title"
      bodyText="Concise body text that provides more context."
      aria-label="alert dialog"
      {...props}
    />
  </DialogTrigger>
)

const openDialog = async () => {
  const user = userEvent.setup()
  const triggerButton = screen.getByRole("button", { name: "Alert Dialog Button" })

  await user.click(triggerButton)

  const modal = await screen.findByTestId("alert-dialog")
  const dialog = await screen.findByRole("alertdialog")

  return { user, modal, dialog }
}

describe("<AlertDialog />", () => {
  it("renders.", async () => {
    render(<AlertDialogExample />)
    const { dialog } = await openDialog()
    expect(dialog).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", async () => {
      render(<AlertDialogExample height={300} width={450} />)

      const { modal } = await openDialog()
      expect(modal).toHaveStyle({ height: "300px", width: "450px" })
    })

    describe("responds to type props", () => {
      it("info type.", async () => {
        render(<AlertDialogExample type="info" />)

        const { modal } = await openDialog()
        expect(modal.querySelector(`.${styles["alertDialog__topRibbon--info"]}`)).toBeInTheDocument()
        expect(modal.querySelector(`.${styles["alertDialog__dialog__iconCircle--info"]}`)).toBeInTheDocument()
        expect(within(modal).getByTestId("alert-dialog-default-info-icon")).toBeInTheDocument()
      })

      it("warning type.", async () => {
        render(<AlertDialogExample type="warning" />)

        const { modal } = await openDialog()
        expect(modal.querySelector(`.${styles["alertDialog__topRibbon--warning"]}`)).toBeInTheDocument()
        expect(modal.querySelector(`.${styles["alertDialog__dialog__iconCircle--warning"]}`)).toBeInTheDocument()
        expect(within(modal).getByTestId("alert-dialog-default-warning-icon")).toBeInTheDocument()
      })

      it("error type.", async () => {
        render(<AlertDialogExample type="error" />)

        const { modal } = await openDialog()
        expect(modal.querySelector(`.${styles["alertDialog__topRibbon--errorOrDanger"]}`)).toBeInTheDocument()
        expect(modal.querySelector(`.${styles["alertDialog__dialog__iconCircle--errorOrDanger"]}`)).toBeInTheDocument()
        expect(within(modal).getByTestId("alert-dialog-default-error-icon")).toBeInTheDocument()
      })

      it("danger type.", async () => {
        render(<AlertDialogExample type="danger" />)

        const { modal } = await openDialog()
        expect(modal.querySelector(`.${styles["alertDialog__topRibbon--errorOrDanger"]}`)).toBeInTheDocument()
        expect(modal.querySelector(`.${styles["alertDialog__dialog__iconCircle--errorOrDanger"]}`)).toBeInTheDocument()
        expect(within(modal).getByTestId("alert-dialog-default-danger-icon")).toBeInTheDocument()
      })

      it("delete type.", async () => {
        render(<AlertDialogExample type="delete" />)

        const { modal } = await openDialog()
        expect(modal.querySelector(`.${styles["alertDialog__topRibbon--errorOrDanger"]}`)).toBeInTheDocument()
        expect(modal.querySelector(`.${styles["alertDialog__dialog__iconCircle--errorOrDanger"]}`)).toBeInTheDocument()
        expect(within(modal).getByTestId("alert-dialog-default-delete-icon")).toBeInTheDocument()
      })

      it("success type.", async () => {
        render(<AlertDialogExample type="success" />)

        const { modal } = await openDialog()
        expect(modal.querySelector(`.${styles["alertDialog__topRibbon--success"]}`)).toBeInTheDocument()
        expect(modal.querySelector(`.${styles["alertDialog__dialog__iconCircle--success"]}`)).toBeInTheDocument()
        expect(within(modal).getByTestId("alert-dialog-default-success-icon")).toBeInTheDocument()
      })
    })

    it("renders a custom status icon when AlertIcon is provided.", async () => {
      render(
        <AlertDialogExample
          type="danger"
          AlertIcon={<span data-testid="custom-alert-dialog-icon">Custom alert icon</span>}
        />,
      )

      const { modal } = await openDialog()
      expect(within(modal).getByTestId("custom-alert-dialog-icon")).toBeInTheDocument()
      expect(within(modal).queryByTestId("alert-dialog-default-danger-icon")).not.toBeInTheDocument()
    })

    it("responds to corner geometry props.", async () => {
      const { unmount } = render(<AlertDialogExample geometry="rounded" />)

      const { modal } = await openDialog()
      expect(modal).toHaveClass(styles["alertDialog--rounded"])

      unmount()

      render(<AlertDialogExample geometry="orthogonal" />)
      const { modal: modal2 } = await openDialog()
      expect(modal2).not.toHaveClass(styles["alertDialog--rounded"])
    })

    it("responds to box-shadow props.", async () => {
      const { unmount } = render(<AlertDialogExample />)

      const { modal } = await openDialog()
      expect(modal).toHaveClass(styles["alertDialog--raised"])

      unmount()

      render(<AlertDialogExample raised={false} />)
      const { modal: modal2 } = await openDialog()
      expect(modal2).not.toHaveClass(styles["alertDialog--raised"])
    })

    it("responds to overlay blur prop.", async () => {
      const { unmount, baseElement } = render(<AlertDialogExample />)

      await openDialog()
      const overlay = baseElement.querySelector(`.${styles["alertDialog__overlay"]}`)
      expect(overlay).toBeInTheDocument()
      expect(overlay).toHaveClass(styles["alertDialog__overlay--blur"])

      unmount()

      const { baseElement: baseElement2 } = render(<AlertDialogExample overlayBlur={false} />)

      await openDialog()
      const overlay2 = baseElement2.querySelector(`.${styles["alertDialog__overlay"]}`)
      expect(overlay2).toBeInTheDocument()
      expect(overlay2).not.toHaveClass(styles["alertDialog__overlay--blur"])
    })

    it("responds to title and description text props.", async () => {
      render(<AlertDialogExample />)

      const { dialog } = await openDialog()
      expect(dialog).toHaveAccessibleName("alert dialog")
      expect(within(dialog).getByTestId("dialog-header")).toHaveTextContent(/dialog title/iu)
      expect(within(dialog).getByTestId("dialog-body")).toHaveTextContent(
        /concise body text that provides more context\./iu,
      )
    })

    it("responds to cancel and confirm action props.", async () => {
      const cancelActionMock = vi.fn()
      const confirmActionMock = vi.fn()

      const { unmount } = render(
        <AlertDialogExample
          cancelAction={cancelActionMock}
          cancelActionBtnText="Cancel Action"
          confirmAction={confirmActionMock}
          confirmActionBtnText="Confirm Action"
        />,
      )

      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole("button", { name: "Cancel Action" }))
      expect(cancelActionMock).toHaveBeenCalled()

      const { user: user2, dialog: dialog2 } = await openDialog()
      await user2.click(within(dialog2).getByRole("button", { name: "Confirm Action" }))
      expect(confirmActionMock).toHaveBeenCalled()

      unmount()

      render(<AlertDialogExample showCancelAction={false} />)

      const { dialog: dialog3 } = await openDialog()
      expect(within(dialog3).queryByRole("button", { name: "Cancel Action" })).not.toBeInTheDocument()
    })

    it("routes status action colors through CSS variables.", async () => {
      render(<AlertDialogExample type="warning" />)

      const { dialog } = await openDialog()
      const cancelButtonText = within(dialog).getByText("Cancel")
      const confirmButton = within(dialog).getByRole("button", { name: "Confirm Action" })

      expect(cancelButtonText).toHaveStyle({ color: "var(--cui-status-warning)" })
      expect(confirmButton).toHaveStyle({ backgroundColor: "var(--cui-status-warning)" })
    })

    it("uses provided grouped labels for internal action chrome.", async () => {
      render(
        <AlertDialogExample
          labels={{
            cancelActionButton: "Annuler",
            cancelActionButtonAriaLabel: "Annuler la suppression",
            confirmActionButton: "Confirmer",
            confirmActionButtonAriaLabel: "Confirmer la suppression",
          }}
        />,
      )

      const { dialog } = await openDialog()

      expect(within(dialog).getByRole("button", { name: "Annuler la suppression" })).toHaveTextContent("Annuler")
      expect(within(dialog).getByRole("button", { name: "Confirmer la suppression" })).toHaveTextContent("Confirmer")
    })

    it("responds to custom style props.", async () => {
      const { baseElement } = render(
        <AlertDialogExample
          className="native-alert-dialog-class"
          customClassName="custom-alert-dialog-class"
          customOverlayClassName="custom-alert-dialog-overlay-class"
          customDialogClassName="custom-alert-dialog-dialog-class"
          customOverlayStyles={{ backgroundColor: "blue" }}
          customStyles={{ color: "turquoise" }}
          customDialogStyles={{ backgroundColor: "gold" }}
          style={{ backgroundColor: "blue" }}
        />,
      )

      const { modal, dialog } = await openDialog()
      const overlay = baseElement.querySelector(`.${styles["alertDialog__overlay"]}`)!

      expect(overlay).toBeInTheDocument()
      expect(overlay).toHaveClass("custom-alert-dialog-overlay-class")
      expect(overlay).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(modal).toHaveClass("native-alert-dialog-class")
      expect(modal).toHaveClass("custom-alert-dialog-class")
      expect(modal).toHaveStyle({ color: "rgb(64, 224, 208)" })
      expect(modal).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(dialog).toHaveClass("custom-alert-dialog-dialog-class")
      expect(dialog).toHaveStyle({ backgroundColor: "rgb(255, 215, 0)" })
    })

    it("does not leak wrapper props to the modal root.", async () => {
      render(
        <AlertDialogExample
          height={300}
          width={450}
          type="danger"
          geometry="rounded"
          raised
          overlayBlur
          isKeyboardDismissDisabled
          AlertIcon={<span>Alert</span>}
          customStyles={{ backgroundColor: "turquoise" }}
          customOverlayStyles={{ backgroundColor: "blue" }}
          customDialogStyles={{ backgroundColor: "gold" }}
          customClassName="custom-alert-dialog-class"
          customOverlayClassName="custom-alert-dialog-overlay-class"
          customDialogClassName="custom-alert-dialog-dialog-class"
        />,
      )

      const { modal } = await openDialog()

      expect(modal).not.toHaveAttribute("height")
      expect(modal).not.toHaveAttribute("width")
      expect(modal).not.toHaveAttribute("type")
      expect(modal).not.toHaveAttribute("geometry")
      expect(modal).not.toHaveAttribute("raised")
      expect(modal).not.toHaveAttribute("overlayblur")
      expect(modal).not.toHaveAttribute("iskeyboarddismissdisabled")
      expect(modal).not.toHaveAttribute("alerticon")
      expect(modal).not.toHaveAttribute("customstyles")
      expect(modal).not.toHaveAttribute("customoverlaystyles")
      expect(modal).not.toHaveAttribute("customdialogstyles")
      expect(modal).not.toHaveAttribute("customclassname")
      expect(modal).not.toHaveAttribute("customoverlayclassname")
      expect(modal).not.toHaveAttribute("customdialogclassname")
    })
  })
})
