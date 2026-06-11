import { cleanup, screen, waitForElementToBeRemoved } from "@testing-library/react"
import { render } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import Button from "../../../Button/Button"
import Text from "../../../Text/Text"
import { DURATION_BEFORE_UNMOUNT, type TExternalToast, type TToasterProps } from "../../helpers"
import { ToasterObserver } from "../../stateManagement"
import Toaster, { toast } from "../../Toaster"
import styles from "../ToastStyles.module.css"

const cancelAction = vi.fn()
const confirmAction = vi.fn()
const onDismiss = vi.fn()
const onAutoClose = vi.fn()

const ToasterExample = (args: {
  toasterProps?: Partial<TToasterProps>
  toastTitle?: string
  toastProps?: Partial<TExternalToast>
}): ReactNode => {
  const { toasterProps, toastProps, toastTitle = "Toast Title" } = args

  return (
    <div>
      <Toaster {...toasterProps} />
      <Button
        order="primary"
        aria-label="Toast Trigger"
        onPress={() => {
          toast({
            type: "info",
            titleText: toastTitle,
            cancelAction,
            confirmAction,
            ...toastProps,
          })
        }}
      >
        <Text elementType="h1" fontWeight="bold">
          Trigger Toast
        </Text>
      </Button>
    </div>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  ToasterObserver.subscribers = []
  ToasterObserver.toasts = []
})

const renderToastExample = (
  args: {
    toasterProps?: Partial<TToasterProps>
    toastTitle?: string
    toastProps?: Partial<TExternalToast>
  } = {},
) => ({
  user: userEvent.setup(),
  ...render(<ToasterExample {...args} />),
})

const getTriggerButton = () => screen.getByRole("button", { name: /toast trigger/iu })

const triggerToast = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(getTriggerButton())
}

const getToast = () => screen.getByTestId("toast")

const getToastTopRibbon = () => getToast().firstElementChild as HTMLElement

const getToastContent = () => getToast().children[1] as HTMLElement

describe("<Toast /> Tests", () => {
  it("Toast can render.", async () => {
    const { user } = renderToastExample()

    await triggerToast(user)

    const toast = await screen.findByTestId("toast")
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveClass(styles.toast)
  })

  describe("Props API Surface Area", () => {
    it("Toast responds correctly to height and width props.", async () => {
      const { user } = renderToastExample({
        toastProps: { height: 300, width: 500, duration: "persistent" },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      expect(toast).toHaveStyle({ height: "300px", width: "500px" })
    })

    it("Toast responds correctly to type prop.", async () => {
      const toastTypeToExpectedDefaultMap = {
        info: {
          colorClassName: styles["toast__topRibbon--info"],
          defaultIconTestID: "toast-default-info-icon",
        },
        warning: {
          colorClassName: styles["toast__topRibbon--warning"],
          defaultIconTestID: "toast-default-warning-icon",
        },
        error: {
          colorClassName: styles["toast__topRibbon--errorOrDanger"],
          defaultIconTestID: "toast-default-error-icon",
        },
        danger: {
          colorClassName: styles["toast__topRibbon--errorOrDanger"],
          defaultIconTestID: "toast-default-danger-icon",
        },
        delete: {
          colorClassName: styles["toast__topRibbon--errorOrDanger"],
          defaultIconTestID: "toast-default-delete-icon",
        },
        success: {
          colorClassName: styles["toast__topRibbon--success"],
          defaultIconTestID: "toast-default-success-icon",
        },
      } as const

      const runCase = async (type: keyof typeof toastTypeToExpectedDefaultMap) => {
        const { user, unmount } = renderToastExample({
          toastProps: { type, duration: "persistent" },
        })

        await triggerToast(user)

        const toastTopRibbon = getToastTopRibbon()
        expect(toastTopRibbon).toHaveClass(toastTypeToExpectedDefaultMap[type].colorClassName)
        expect(screen.getByTestId(toastTypeToExpectedDefaultMap[type].defaultIconTestID)).toBeInTheDocument()

        unmount()
      }

      await runCase("info")
      await runCase("warning")
      await runCase("error")
      await runCase("danger")
      await runCase("delete")
      await runCase("success")
    })

    it("Toast renders a custom status icon when ToastIcon is provided.", async () => {
      const { user } = renderToastExample({
        toastProps: {
          type: "danger",
          duration: "persistent",
          ToastIcon: <span data-testid="custom-toast-icon">Custom toast icon</span>,
        },
      })

      await triggerToast(user)

      expect(await screen.findByTestId("custom-toast-icon")).toBeInTheDocument()
      expect(screen.queryByTestId("toast-default-danger-icon")).not.toBeInTheDocument()
    })

    it("Toast responds correctly to corner geometry prop.", async () => {
      const { user, unmount } = renderToastExample({
        toastProps: { geometry: "rounded", duration: "persistent" },
      })

      await triggerToast(user)

      let toast = await screen.findByTestId("toast")
      expect(toast).toHaveClass(styles["toast--rounded"])

      unmount()

      const { user: user2 } = renderToastExample({
        toastProps: { geometry: "orthogonal", duration: "persistent" },
      })

      await triggerToast(user2)

      toast = await screen.findByTestId("toast")
      expect(toast).not.toHaveClass(styles["toast--rounded"])
    })

    it("Toast responds correctly to box-shadow props.", async () => {
      const { user, unmount } = renderToastExample({
        toastProps: { raised: true, duration: "persistent" },
      })

      await triggerToast(user)

      let toast = await screen.findByTestId("toast")
      expect(toast).toHaveClass(styles["toast--raised"])

      unmount()

      const { user: user2 } = renderToastExample({
        toastProps: { raised: false, duration: "persistent" },
      })

      await triggerToast(user2)

      toast = await screen.findByTestId("toast")
      expect(toast).not.toHaveClass(styles["toast--raised"])
    })

    it("Toast responds correctly to dismissability prop.", async () => {
      const { user, unmount } = renderToastExample({
        toastProps: { dismissable: true, duration: "persistent" },
      })

      await triggerToast(user)

      let toast = await screen.findByTestId("toast")
      let toastCloseButton = screen.getByRole("button", { name: /close toast/iu })

      expect(toast).toBeInTheDocument()
      expect(toastCloseButton).toBeInTheDocument()
      expect(toastCloseButton).toContainElement(screen.getByTestId("toast-default-close-icon"))

      await user.click(toastCloseButton)
      await waitForElementToBeRemoved(toast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })

      unmount()

      const { user: user2 } = renderToastExample({
        toastProps: { dismissable: false, duration: "persistent" },
      })

      await triggerToast(user2)

      toast = await screen.findByTestId("toast")
      toastCloseButton = screen.queryByRole("button", { name: /close toast/iu }) as HTMLButtonElement

      expect(toast).toBeInTheDocument()
      expect(toastCloseButton).toBeNull()
    })

    it("Toast renders a custom close icon when CloseIcon is provided.", async () => {
      const { user } = renderToastExample({
        toastProps: {
          duration: "persistent",
          CloseIcon: <span data-testid="custom-toast-close-icon">Close</span>,
        },
      })

      await triggerToast(user)

      const toastCloseButton = await screen.findByRole("button", { name: /close toast/iu })
      expect(toastCloseButton).toContainElement(screen.getByTestId("custom-toast-close-icon"))
      expect(screen.queryByTestId("toast-default-close-icon")).not.toBeInTheDocument()
    })

    it("Toast responds correctly to duration prop.", async () => {
      const { user } = renderToastExample({
        toastProps: { duration: 10 },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      expect(toast).toBeInTheDocument()

      await waitForElementToBeRemoved(toast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })
    })

    it("Toast responds correctly to important prop.", async () => {
      const { user, unmount } = renderToastExample({
        toastProps: { important: true, duration: "persistent" },
      })

      await triggerToast(user)

      let toast = await screen.findByTestId("toast")
      expect(toast).toHaveAttribute("aria-live", "assertive")
      expect(toast).toHaveAttribute("role", "alertdialog")

      unmount()

      const { user: user2 } = renderToastExample({
        toastProps: { important: false, duration: "persistent" },
      })

      await triggerToast(user2)

      toast = await screen.findByTestId("toast")
      expect(toast).toHaveAttribute("aria-live", "polite")
      expect(toast).toHaveAttribute("role", "dialog")
    })

    it("Toast responds correctly to custom text content props.", async () => {
      const { user } = renderToastExample({
        toastProps: {
          titleText: "Toast Title Text",
          bodyText: "Toast Body Text",
          cancelActionBtnText: "Cancel Action Button Text",
          confirmActionBtnText: "Confirm Action Button Text",
          duration: "persistent",
        },
      })

      await triggerToast(user)

      expect(await screen.findByText(/toast title text/iu)).toBeInTheDocument()
      expect(screen.getByText(/toast body text/iu)).toBeInTheDocument()
      expect(screen.getByText(/cancel action button text/iu)).toBeInTheDocument()
      expect(screen.getByText(/confirm action button text/iu)).toBeInTheDocument()
    })

    it("Toast uses grouped labels supplied by the toaster and individual toast.", async () => {
      const { user } = renderToastExample({
        toasterProps: {
          toastLabels: {
            cancelActionButton: "Annuler",
            cancelActionButtonAriaLabel: "Annuler l'action localisée",
            closeButtonAriaLabel: "Fermer la notification localisée",
            confirmActionButton: "Confirmer",
            confirmActionButtonAriaLabel: "Confirmer l'action localisée",
          },
        },
        toastProps: {
          duration: "persistent",
          labels: {
            confirmActionButton: "Valider",
          },
        },
      })

      await triggerToast(user)

      expect(await screen.findByRole("button", { name: "Fermer la notification localisée" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Annuler l'action localisée" })).toHaveTextContent("Annuler")
      expect(screen.getByRole("button", { name: "Confirmer l'action localisée" })).toHaveTextContent("Valider")
    })

    it("Toast responds correctly to showButtons prop.", async () => {
      const { user, unmount } = renderToastExample({
        toastProps: { showButtons: true, duration: "persistent" },
      })

      await triggerToast(user)

      expect(await screen.findByRole("button", { name: /cancel action/iu })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /confirm action/iu })).toBeInTheDocument()

      unmount()

      const { user: user2 } = renderToastExample({
        toastProps: { showButtons: false, duration: "persistent" },
      })

      await triggerToast(user2)
      await screen.findByTestId("toast")

      expect(screen.queryByRole("button", { name: /cancel action/iu })).toBeNull()
      expect(screen.queryByRole("button", { name: /confirm action/iu })).toBeNull()
    })

    it("Toast responds correctly to showCancelAction prop.", async () => {
      const { user, unmount } = renderToastExample({
        toastProps: { showCancelAction: true, duration: "persistent" },
      })

      await triggerToast(user)

      expect(await screen.findByRole("button", { name: /cancel action/iu })).toBeInTheDocument()

      unmount()

      const { user: user2 } = renderToastExample({
        toastProps: { showCancelAction: false, duration: "persistent" },
      })

      await triggerToast(user2)
      await screen.findByTestId("toast")

      expect(screen.queryByRole("button", { name: /cancel action/iu })).toBeNull()
      expect(screen.getByRole("button", { name: /confirm action/iu })).toBeInTheDocument()
    })

    it("Toast responds correctly to onDismiss prop.", async () => {
      const { user } = renderToastExample({
        toastProps: { onDismiss, duration: "persistent" },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      const toastCloseButton = screen.getByRole("button", { name: /close toast/iu })

      await user.click(toastCloseButton)

      expect(onDismiss).toHaveBeenCalledTimes(1)
      await waitForElementToBeRemoved(toast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })
    })

    it("Toast responds correctly to onAutoClose prop.", async () => {
      const { user } = renderToastExample({
        toastProps: { onAutoClose, duration: 10 },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")

      await waitForElementToBeRemoved(toast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })
      expect(onAutoClose).toHaveBeenCalledTimes(1)
    })

    it("Toast responds correctly to custom styles prop.", async () => {
      const { user } = renderToastExample({
        toastProps: { customStyles: { backgroundColor: "teal" }, duration: "persistent" },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      expect(toast).toHaveStyle({ backgroundColor: "rgb(0, 128, 128)" })
    })

    it("Toast merges root and slot styling hooks.", async () => {
      const { user } = renderToastExample({
        toastProps: {
          className: "native-toast",
          customBodyTextClassName: "custom-body-text",
          customBodyTextProps: { "data-testid": "toast-body-text" },
          customBodyTextStyles: { color: "blue" },
          customBottomRowClassName: "custom-bottom-row",
          customBottomRowStyles: { backgroundColor: "white" },
          customButtonRowClassName: "custom-button-row",
          customButtonRowStyles: { gap: 10 },
          customCancelButtonClassName: "custom-cancel-button",
          customCancelButtonStyles: { marginRight: 5 },
          customClassName: "custom-toast",
          customCloseButtonClassName: "custom-close-button",
          customCloseButtonProps: {
            className: "native-close-button",
            customClassName: "custom-close-button-prop",
            customStyles: { marginTop: 3 },
          },
          customCloseButtonStyles: { marginLeft: 5 },
          customConfirmButtonClassName: "custom-confirm-button",
          customConfirmButtonStyles: { marginLeft: 6 },
          customContentClassName: "custom-content",
          customContentStyles: { padding: 10 },
          customStyles: { backgroundColor: "teal" },
          customTimestampClassName: "custom-timestamp",
          customTimestampTextProps: { "data-testid": "toast-timestamp" },
          customTimestampStyles: { color: "green" },
          customTitleClassName: "custom-title",
          customTitleStyles: { color: "yellow" },
          customTopRibbonClassName: "custom-top-ribbon",
          customTopRibbonLeftContentClassName: "custom-top-ribbon-left",
          customTopRibbonLeftContentStyles: { gap: 6 },
          customTopRibbonStyles: { backgroundColor: "purple" },
          duration: "persistent",
          height: "12rem",
          style: { marginTop: 7 },
          width: "20rem",
        },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      const topRibbon = getToastTopRibbon()
      const topRibbonLeftContent = topRibbon.firstElementChild as HTMLElement
      const title = screen.getByRole("heading", { name: /toast title/iu })
      const content = getToastContent()
      const bodyText = screen.getByTestId("toast-body-text")
      const bottomRow = content.lastElementChild as HTMLElement
      const timestamp = screen.getByTestId("toast-timestamp")
      const buttonRow = bottomRow.lastElementChild as HTMLElement
      const closeButton = screen.getByRole("button", { name: /close toast/iu })
      const cancelButton = screen.getByRole("button", { name: /cancel action/iu })
      const confirmButton = screen.getByRole("button", { name: /confirm action/iu })

      expect(toast).toHaveClass(styles.toast)
      expect(toast).toHaveClass("custom-toast")
      expect(toast).toHaveClass("native-toast")
      expect(toast).toHaveStyle({
        backgroundColor: "rgb(0, 128, 128)",
        height: "12rem",
        marginTop: "7px",
        width: "20rem",
      })
      expect(topRibbon).toHaveClass("custom-top-ribbon")
      expect(topRibbon).toHaveStyle({ backgroundColor: "rgb(128, 0, 128)" })
      expect(topRibbonLeftContent).toHaveClass("custom-top-ribbon-left")
      expect(topRibbonLeftContent).toHaveStyle({ gap: "6px" })
      expect(title).toHaveClass("custom-title")
      expect(title).toHaveStyle({ color: "rgb(255, 255, 0)" })
      expect(content).toHaveClass("custom-content")
      expect(content).toHaveStyle({ padding: "10px" })
      expect(bodyText).toHaveClass("custom-body-text")
      expect(bodyText).toHaveStyle({ color: "rgb(0, 0, 255)" })
      expect(bottomRow).toHaveClass("custom-bottom-row")
      expect(bottomRow).toHaveStyle({ backgroundColor: "rgb(255, 255, 255)" })
      expect(timestamp).toHaveClass("custom-timestamp")
      expect(timestamp).toHaveStyle({ color: "rgb(0, 128, 0)" })
      expect(buttonRow).toHaveClass("custom-button-row")
      expect(buttonRow).toHaveStyle({ gap: "10px" })
      expect(closeButton).toHaveClass("custom-close-button")
      expect(closeButton).toHaveClass("custom-close-button-prop")
      expect(closeButton).toHaveClass("native-close-button")
      expect(closeButton).toHaveStyle({ marginTop: "3px", marginLeft: "5px" })
      expect(cancelButton).toHaveClass("custom-cancel-button")
      expect(cancelButton).toHaveStyle({ marginRight: "5px" })
      expect(confirmButton).toHaveClass("custom-confirm-button")
      expect(confirmButton).toHaveStyle({ marginLeft: "6px" })
      expect(toast).not.toHaveAttribute("customclassname")
      expect(toast).not.toHaveAttribute("customtopribbonclassname")
      expect(toast).not.toHaveAttribute("custombodytextprops")
      expect(toast).not.toHaveAttribute("customconfirmbuttonstyles")
    })
  })

  describe("User Action Tests", () => {
    it("Toast responds correctly to pressing dismiss button.", async () => {
      const { user } = renderToastExample({
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      const toastCloseButton = screen.getByRole("button", { name: /close toast/iu })

      await user.click(toastCloseButton)

      await waitForElementToBeRemoved(toast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })
    })

    it("Toast responds correctly to pressing cancel button.", async () => {
      const { user } = renderToastExample({
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      const cancelActionButton = screen.getByRole("button", { name: /cancel action/iu })

      await user.click(cancelActionButton)

      expect(cancelAction).toHaveBeenCalledTimes(1)
      await waitForElementToBeRemoved(toast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })
    })

    it("Toast responds correctly to pressing confirm button.", async () => {
      const { user } = renderToastExample({
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      const confirmActionButton = screen.getByRole("button", { name: /confirm action/iu })

      await user.click(confirmActionButton)

      expect(confirmAction).toHaveBeenCalledTimes(1)
      await waitForElementToBeRemoved(toast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })
    })
  })
})
