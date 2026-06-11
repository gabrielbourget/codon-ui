import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import Button from "../../Button/Button"
import Text from "../../Text/Text"
import { DURATION_BEFORE_UNMOUNT, type TExternalToast, type TToasterProps } from "../helpers"
import { ToasterObserver } from "../stateManagement"
import Toaster, { toast } from "../Toaster"
import styles from "../ToasterStyles.module.css"

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
            titleText: toastTitle,
            type: "info",
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

const renderToasterExample = (
  args: {
    toasterProps?: Partial<TToasterProps>
    toastTitle?: string
    toastProps?: Partial<TExternalToast>
  } = {},
) => ({
  user: userEvent.setup(),
  ...render(<ToasterExample {...args} />),
})

const renderStandaloneToaster = (props: Partial<TToasterProps> = {}) => render(<Toaster {...props} />)

const getTriggerButton = () => screen.getByRole("button", { name: /toast trigger/iu })

const triggerToast = async (user: ReturnType<typeof userEvent.setup>, count = 1) => {
  for (let index = 0; index < count; index += 1) {
    await user.click(getTriggerButton())
  }
}

const getToasterSection = () => screen.getByTestId("toaster")

const getToasterList = () => within(getToasterSection()).getByRole("list")

const getVisibleToasts = () =>
  screen.getAllByTestId("toast").filter((toast) => toast.getAttribute("data-visible") === "true")

describe("<Toaster /> Tests", () => {
  it("Toaster can render.", async () => {
    const { user } = renderToasterExample()

    await triggerToast(user)

    const toasterSection = await screen.findByTestId("toaster")
    const toasterList = within(toasterSection).getByRole("list")

    expect(toasterSection).toBeInTheDocument()
    expect(toasterList).toHaveClass(styles.toaster)
  })

  describe("Props API Surface Area", () => {
    it("Toaster responds correctly to duration prop.", async () => {
      const { user } = renderToasterExample({
        toasterProps: { duration: 10 },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      expect(toast).toBeInTheDocument()

      await waitForElementToBeRemoved(toast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })
    })

    it("Toaster responds correctly to placement prop.", async () => {
      const positionToExpectedCoordsMap = {
        "bottom-right": { y: "bottom", x: "right" },
        "bottom-center": { y: "bottom", x: "center" },
        "bottom-left": { y: "bottom", x: "left" },
        "top-left": { y: "top", x: "left" },
        "top-center": { y: "top", x: "center" },
        "top-right": { y: "top", x: "right" },
      } as const

      const runCase = async (position: keyof typeof positionToExpectedCoordsMap) => {
        const { user, unmount } = renderToasterExample({
          toasterProps: { position },
          toastProps: { duration: "persistent" },
        })

        await triggerToast(user)

        const toasterList = getToasterList()
        const { y, x } = positionToExpectedCoordsMap[position]

        expect(toasterList).toHaveAttribute("data-y-position", y)
        expect(toasterList).toHaveAttribute("data-x-position", x)

        unmount()
      }

      await runCase("bottom-right")
      await runCase("bottom-center")
      await runCase("bottom-left")
      await runCase("top-left")
      await runCase("top-center")
      await runCase("top-right")
    })

    it("Toaster responds correctly to dismissal hotkey prop.", async () => {
      const { user } = renderToasterExample({
        toasterProps: { dismissalHotkey: ["Escape"] },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user)

      const toast = await screen.findByTestId("toast")
      await user.click(toast)
      await user.keyboard("{Escape}")

      await waitForElementToBeRemoved(toast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })
    })

    it("Toaster responds correctly to expand toggle hotkey prop.", async () => {
      const { user } = renderToasterExample({
        toasterProps: { expandToggleHotkey: ["altKey", "KeyE"] },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user)

      const toasterList = getToasterList()
      expect(toasterList).toHaveAttribute("data-expanded", "false")

      await act(async () => {
        fireEvent.keyDown(document, { altKey: true, code: "KeyE" })
      })
      await waitFor(() => expect(toasterList).toHaveAttribute("data-expanded", "true"))

      await act(async () => {
        fireEvent.keyDown(document, { altKey: true, code: "KeyE" })
      })
      await waitFor(() => expect(toasterList).toHaveAttribute("data-expanded", "false"))
    })

    it("Toaster responds correctly to expandByDefault prop.", async () => {
      const { user, unmount } = renderToasterExample({
        toasterProps: { expandByDefault: true },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user, 2)

      await waitFor(() => {
        const toasts = screen.getAllByTestId("toast")
        expect(toasts).toHaveLength(2)
        toasts.forEach((toast) => expect(toast).toHaveAttribute("data-expanded", "true"))
      })

      unmount()

      const { user: user2 } = renderToasterExample({
        toasterProps: { expandByDefault: false },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user2, 2)

      await waitFor(() => {
        const toasts = screen.getAllByTestId("toast")
        expect(toasts).toHaveLength(2)
        toasts.forEach((toast) => expect(toast).toHaveAttribute("data-expanded", "false"))
      })
    })

    it("Toaster responds correctly to maxVisibleToasts prop.", async () => {
      const { user } = renderToasterExample({
        toasterProps: { maxVisibleToasts: 3 },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user, 4)

      await waitFor(() => expect(screen.getAllByTestId("toast")).toHaveLength(4))
      expect(getVisibleToasts()).toHaveLength(3)
    })

    it("Toaster responds correctly to toastGap prop.", async () => {
      const { user } = renderToasterExample({
        toasterProps: { toastGap: 50 },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user)

      const toasterList = getToasterList()
      expect(toasterList.style.getPropertyValue("--toastGap")).toBe("50px")
    })

    it("Toaster responds correctly to offset prop.", async () => {
      const { user } = renderToasterExample({
        toasterProps: { offset: 30 },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user)

      const toasterList = getToasterList()
      expect(toasterList.style.getPropertyValue("--offset")).toBe("30px")
    })

    it("Toaster responds correctly to custom style prop.", async () => {
      const { user } = renderToasterExample({
        toasterProps: { customStyles: { backgroundColor: "red" } },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user)

      const toasterList = getToasterList()
      expect(toasterList).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
    })

    it("Toaster maps root aria aliases and merges native root styling.", async () => {
      const { user } = renderToasterExample({
        toasterProps: {
          "data-testid": "custom-toaster",
          ariaDescribedBy: "toaster-description",
          ariaDetails: "toaster-details",
          ariaLabel: "Alias Notifications",
          ariaLabelledBy: "toaster-heading",
          className: "native-toaster-root",
          customClassName: "custom-toaster-root",
          customRootStyles: { marginTop: 5 },
          customStackClassName: "custom-stack",
          customStackStyles: { borderColor: "black" },
          customToastBridgeClassName: "custom-bridge",
          customToastBridgeStyles: { backgroundColor: "pink" },
          style: { marginBottom: 10 },
        },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user)

      const toasterSection = await screen.findByTestId("custom-toaster")

      expect(toasterSection).toHaveClass(styles.toasterRoot)
      expect(toasterSection).toHaveClass("custom-toaster-root")
      expect(toasterSection).toHaveClass("native-toaster-root")
      expect(toasterSection).toHaveAttribute("aria-label", "Alias Notifications - alt+E")
      expect(toasterSection).toHaveAttribute("aria-labelledby", "toaster-heading")
      expect(toasterSection).toHaveAttribute("aria-describedby", "toaster-description")
      expect(toasterSection).toHaveAttribute("aria-details", "toaster-details")
      expect(toasterSection).toHaveStyle({
        marginTop: "5px",
        marginBottom: "10px",
      })
      expect(toasterSection).not.toHaveAttribute("arialabel")
      expect(toasterSection).not.toHaveAttribute("arialabelledby")
      expect(toasterSection).not.toHaveAttribute("ariadescribedby")
      expect(toasterSection).not.toHaveAttribute("customclassname")
      expect(toasterSection).not.toHaveAttribute("customrootstyles")
      expect(toasterSection).not.toHaveAttribute("customstackclassname")
      expect(toasterSection).not.toHaveAttribute("customstackstyles")
      expect(toasterSection).not.toHaveAttribute("customtoastbridgeclassname")
      expect(toasterSection).not.toHaveAttribute("customtoastbridgestyles")
    })

    it("Toaster merges stack and hover bridge styling hooks.", async () => {
      const { user } = renderToasterExample({
        toasterProps: {
          customStackClassName: "custom-stack",
          customStackStyles: { backgroundColor: "red" },
          customToastBridgeClassName: "custom-bridge",
          customToastBridgeStyles: { backgroundColor: "pink" },
        },
        toastProps: { duration: "persistent" },
      })

      await triggerToast(user, 2)

      const toasterSection = await screen.findByTestId("toaster")
      const toasterList = getToasterList()
      const toastBridge = toasterSection.querySelector(".custom-bridge") as HTMLElement

      expect(toasterList).toHaveClass(styles.toaster)
      expect(toasterList).toHaveClass("custom-stack")
      expect(toasterList).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
      expect(toastBridge).toHaveClass(styles.toaster__toastBridgeDiv)
      expect(toastBridge).toHaveStyle({ backgroundColor: "rgb(255, 192, 203)" })
    })
  })

  describe("Observer State Management", () => {
    it("Observer updates the queued toast when a matching id is published.", () => {
      const subscriber = vi.fn()
      const unsubscribe = ToasterObserver.subscribe(subscriber)

      try {
        const id = toast({
          id: "queued-toast",
          titleText: "Queued Toast",
          type: "info",
        })

        toast({
          id: "queued-toast",
          titleText: "Updated Queued Toast",
          type: "success",
        })

        expect(id).toBe("queued-toast")
        expect(ToasterObserver.toasts).toHaveLength(1)
        expect(ToasterObserver.toasts[0]).toMatchObject({
          id: "queued-toast",
          titleText: "Updated Queued Toast",
          type: "success",
        })
        expect(subscriber).toHaveBeenCalledTimes(2)
      } finally {
        unsubscribe()
      }
    })

    it("Observer publishes dismiss events for one toast or all queued toasts.", () => {
      const subscriber = vi.fn()
      const unsubscribe = ToasterObserver.subscribe(subscriber)

      try {
        toast({ id: "first-toast", titleText: "First Toast", type: "info" })
        toast({ id: "second-toast", titleText: "Second Toast", type: "success" })
        subscriber.mockClear()

        expect(ToasterObserver.dismiss("first-toast")).toBe("first-toast")
        expect(subscriber).toHaveBeenCalledWith({ id: "first-toast", dismiss: true })
        expect(ToasterObserver.toasts.map((toast) => toast.id)).toEqual(["second-toast"])

        subscriber.mockClear()

        expect(ToasterObserver.dismiss()).toBeUndefined()
        expect(subscriber).toHaveBeenCalledTimes(1)
        expect(subscriber).toHaveBeenCalledWith({ id: "second-toast", dismiss: true })
        expect(ToasterObserver.toasts).toEqual([])
      } finally {
        unsubscribe()
      }
    })

    it("Toaster updates an existing rendered toast when toast ids match.", async () => {
      renderStandaloneToaster()

      act(() => {
        toast({
          bodyText: "Initial Body",
          duration: "persistent",
          id: "rendered-toast",
          titleText: "Initial Toast",
          type: "info",
        })
      })

      expect(await screen.findByText("Initial Toast")).toBeInTheDocument()

      act(() => {
        toast({
          bodyText: "Updated Body",
          duration: "persistent",
          id: "rendered-toast",
          titleText: "Updated Toast",
          type: "success",
        })
      })

      await waitFor(() => {
        expect(screen.getByText("Updated Toast")).toBeInTheDocument()
        expect(screen.getByText("Updated Body")).toBeInTheDocument()
      })

      expect(screen.queryByText("Initial Toast")).toBeNull()
      expect(screen.getAllByTestId("toast")).toHaveLength(1)
    })

    it("Toaster dismisses a rendered toast from the observer API.", async () => {
      renderStandaloneToaster()

      let toastID: string | number = "dismissed-toast"

      act(() => {
        toastID = toast({
          duration: "persistent",
          id: "dismissed-toast",
          titleText: "Dismissed Toast",
          type: "info",
        })
      })

      const renderedToast = await screen.findByTestId("toast")

      act(() => {
        ToasterObserver.dismiss(toastID)
      })

      await waitForElementToBeRemoved(renderedToast, { timeout: DURATION_BEFORE_UNMOUNT + 1000 })
    })
  })
})
