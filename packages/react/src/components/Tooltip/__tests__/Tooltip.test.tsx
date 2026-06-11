import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Button, TooltipTrigger } from "react-aria-components"
import { describe, expect, it } from "vitest"

import type { TTooltipProps } from "../helpers"
import Tooltip from "../Tooltip"
import styles from "../TooltipStyles.module.css"

const tooltipStylesSource = readFileSync("src/components/Tooltip/TooltipStyles.module.css", "utf8")

const tooltipThemeOrders: NonNullable<TTooltipProps["order"]>[] = [
  "primary",
  "secondary",
  "tertiary",
  "quaternary",
  "quintenary",
]

const TooltipExample = (props: Partial<TTooltipProps> = {}) => (
  <TooltipTrigger delay={0} closeDelay={200000}>
    <Button aria-label="Delete" data-tooltiptrigger>
      Delete
    </Button>
    <Tooltip {...props} aria-label="tooltip">
      <span>Delete Item</span>
    </Tooltip>
  </TooltipTrigger>
)

const renderTooltipExample = (props: Partial<TTooltipProps> = {}) => ({
  user: userEvent.setup(),
  ...render(<TooltipExample {...props} />),
})

const getTriggerButton = () => screen.getByRole("button", { name: /delete/iu })

const openTooltip = async (user: ReturnType<typeof userEvent.setup>) => {
  const triggerButton = getTriggerButton()

  await user.tab()
  await user.hover(triggerButton)

  const tooltip = await screen.findByTestId("tooltip")
  const overlayArrow = tooltip.firstElementChild as HTMLElement

  return { tooltip, overlayArrow }
}

describe("<Tooltip />", () => {
  it("renders.", async () => {
    const { user } = renderTooltipExample()
    const { tooltip } = await openTooltip(user)

    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveClass(styles.tooltip)
  })

  describe("props API surface", () => {
    it("responds to height and width props.", async () => {
      const { user } = renderTooltipExample({ height: 50, width: 150 })
      const { tooltip } = await openTooltip(user)

      expect(tooltip).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color props.", async () => {
      const { user } = renderTooltipExample({ color: "red" })
      const { tooltip } = await openTooltip(user)

      expect(tooltip).toHaveStyle({ color: "rgb(255, 0, 0)" })
    })

    it("responds to theming order props.", async () => {
      for (const orderCode of tooltipThemeOrders) {
        const { user, unmount } = renderTooltipExample({ order: orderCode })
        const { tooltip, overlayArrow } = await openTooltip(user)

        expect(tooltip).toHaveClass(styles[`tooltip--${orderCode}`])
        expect(overlayArrow).toHaveClass(styles[`tooltip__overlayArrow--${orderCode}`])

        unmount()
      }
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(tooltipStylesSource).toContain("var(--cui-color-primary-500)")
      expect(tooltipStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to corner geometry props.", async () => {
      const { user, unmount } = renderTooltipExample({ geometry: "rounded" })
      const { tooltip } = await openTooltip(user)

      expect(tooltip).toHaveClass(styles["tooltip--rounded"])

      unmount()

      const { user: user2 } = renderTooltipExample({ geometry: "orthogonal" })
      const { tooltip: tooltip2 } = await openTooltip(user2)

      expect(tooltip2).not.toHaveClass(styles["tooltip--rounded"])
    })

    it("responds to box-shadow props.", async () => {
      const { user, unmount } = renderTooltipExample()
      const { tooltip } = await openTooltip(user)

      expect(tooltip).toHaveClass(styles["tooltip--raised"])

      unmount()

      const { user: user2 } = renderTooltipExample({ raised: false })
      const { tooltip: tooltip2 } = await openTooltip(user2)

      expect(tooltip2).not.toHaveClass(styles["tooltip--raised"])
    })

    it("responds to custom styles prop.", async () => {
      const { user } = renderTooltipExample({
        className: "native-tooltip-class",
        customClassName: "custom-tooltip-class",
        customStyles: { color: "turquoise" },
        customOverlayArrowStyles: { backgroundColor: "green" },
        style: { backgroundColor: "blue" },
      })
      const { tooltip, overlayArrow } = await openTooltip(user)

      expect(tooltip).toHaveClass("native-tooltip-class")
      expect(tooltip).toHaveClass("custom-tooltip-class")
      expect(tooltip).toHaveStyle({ color: "rgb(64, 224, 208)" })
      expect(tooltip).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(overlayArrow).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
    })

    it("can hide the overlay arrow.", async () => {
      const { user } = renderTooltipExample({ showOverlayArrow: false })
      const { tooltip } = await openTooltip(user)

      expect(tooltip.querySelector("svg")).not.toBeInTheDocument()
    })

    it("does not leak wrapper props to the tooltip root.", async () => {
      const { user } = renderTooltipExample({
        height: 50,
        width: 150,
        color: "teal",
        order: "primary",
        geometry: "rounded",
        raised: true,
        showOverlayArrow: true,
        customStyles: { backgroundColor: "turquoise" },
        customOverlayArrowStyles: { backgroundColor: "green" },
        customClassName: "custom-tooltip-class",
      })
      const { tooltip } = await openTooltip(user)

      expect(tooltip).not.toHaveAttribute("height")
      expect(tooltip).not.toHaveAttribute("width")
      expect(tooltip).not.toHaveAttribute("color")
      expect(tooltip).not.toHaveAttribute("order")
      expect(tooltip).not.toHaveAttribute("geometry")
      expect(tooltip).not.toHaveAttribute("raised")
      expect(tooltip).not.toHaveAttribute("showoverlayarrow")
      expect(tooltip).not.toHaveAttribute("customstyles")
      expect(tooltip).not.toHaveAttribute("customoverlayarrowstyles")
      expect(tooltip).not.toHaveAttribute("customclassname")
    })
  })
})
