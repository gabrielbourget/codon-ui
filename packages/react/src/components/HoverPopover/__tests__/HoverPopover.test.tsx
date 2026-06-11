import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { useRef, type ContextType } from "react"
import { TooltipTriggerStateContext } from "react-aria-components"
import { describe, expect, it, vi } from "vitest"

import type { THoverPopoverProps } from "../helpers"
import HoverPopover from "../HoverPopover"
import styles from "../HoverPopoverStyles.module.css"

const hoverPopoverStylesSource = readFileSync("src/components/HoverPopover/HoverPopoverStyles.module.css", "utf8")

const contentCircleStyles = {
  height: 75,
  width: 75,
  borderRadius: "50%",
  backgroundColor: "#333",
  marginBottom: 10,
}

const contentBlockShortStyles = {
  height: 20,
  width: "65%",
  backgroundColor: "#333",
  borderRadius: 5,
  placeSelf: "flex-start",
}

const contentBlockLongStyles = {
  height: 20,
  width: "100%",
  backgroundColor: "#333",
  borderRadius: 5,
  placeSelf: "flex-start",
}

type TTooltipTriggerState = NonNullable<ContextType<typeof TooltipTriggerStateContext>>

type TRenderHoverPopoverArgs = {
  isOpen?: boolean
  props?: Partial<THoverPopoverProps>
}

const HoverPopoverExample = ({ isOpen = true, props = {} }: TRenderHoverPopoverArgs) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipState: TTooltipTriggerState = {
    isOpen,
    open: vi.fn(),
    close: vi.fn(),
  }
  const { customStyles, ...restProps } = props

  return (
    <>
      <button ref={triggerRef} type="button" aria-label="hover-popover-trigger">
        Hover Popover Trigger
      </button>
      <TooltipTriggerStateContext.Provider value={tooltipState}>
        <HoverPopover triggerRef={triggerRef} customStyles={{ alignItems: "center", ...customStyles }} {...restProps}>
          <div style={contentCircleStyles}></div>
          <div style={contentBlockShortStyles}></div>
          <div style={contentBlockLongStyles}></div>
          <div style={contentBlockLongStyles}></div>
        </HoverPopover>
      </TooltipTriggerStateContext.Provider>
    </>
  )
}

const renderHoverPopover = ({ isOpen = true, props = {} }: TRenderHoverPopoverArgs = {}) => {
  const renderInfo = render(<HoverPopoverExample isOpen={isOpen} props={props} />)
  const popover = screen.queryByTestId("hover-popover")
  const overlayArrow = screen.queryByTestId("hover-popover-overlay-arrow")

  return { ...renderInfo, popover, overlayArrow }
}

describe("<HoverPopover />", () => {
  it("renders.", () => {
    const { popover } = renderHoverPopover()

    expect(popover).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to the closed tooltip state.", () => {
      const { popover } = renderHoverPopover({ isOpen: false })

      expect(popover).toBeNull()
    })

    it("responds to height and width props.", () => {
      const { popover } = renderHoverPopover({
        props: { height: 50, width: 150 },
      })

      expect(popover).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color prop.", () => {
      const { popover, overlayArrow } = renderHoverPopover({
        props: { color: "teal", showOverlayArrow: true },
      })

      expect(popover).toHaveStyle({ color: "rgb(0, 128, 128)" })
      expect(overlayArrow).toHaveStyle({ color: "rgb(0, 128, 128)" })
    })

    it.each([
      ["primary", "hoverPopover--primary", "hoverPopover__overlayArrow--primary"],
      ["secondary", "hoverPopover--secondary", "hoverPopover__overlayArrow--secondary"],
      ["tertiary", "hoverPopover--tertiary", "hoverPopover__overlayArrow--tertiary"],
      ["quaternary", "hoverPopover--quaternary", "hoverPopover__overlayArrow--quaternary"],
      ["quintenary", "hoverPopover--quintenary", "hoverPopover__overlayArrow--quintenary"],
    ] as const)("responds to theming order props for %s.", (order, popoverClass, arrowClass) => {
      const { popover, overlayArrow } = renderHoverPopover({
        props: { order, showOverlayArrow: true },
      })

      expect(popover).toHaveClass(styles[popoverClass])
      expect(overlayArrow).toHaveClass(styles[arrowClass])
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(hoverPopoverStylesSource).toContain("var(--cui-color-primary-500)")
      expect(hoverPopoverStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to corner geometry props.", () => {
      const roundedPopover = renderHoverPopover({
        props: { geometry: "rounded" },
      })

      expect(roundedPopover.popover).toHaveClass(styles["hoverPopover--rounded"])

      roundedPopover.unmount()

      const orthogonalPopover = renderHoverPopover({
        props: { geometry: "orthogonal" },
      })

      expect(orthogonalPopover.popover).not.toHaveClass(styles["hoverPopover--rounded"])
    })

    it("responds to box-shadow props.", () => {
      const raisedPopover = renderHoverPopover({
        props: { showOverlayArrow: true },
      })

      expect(raisedPopover.popover).toHaveClass(styles["hoverPopover--raised"])
      expect(raisedPopover.overlayArrow).toHaveClass(styles["hoverPopover--raised"])

      raisedPopover.unmount()

      const flatPopover = renderHoverPopover({
        props: { raised: false, showOverlayArrow: true },
      })

      expect(flatPopover.popover).not.toHaveClass(styles["hoverPopover--raised"])
      expect(flatPopover.overlayArrow).not.toHaveClass(styles["hoverPopover--raised"])
    })

    it("responds to custom style props.", () => {
      const { popover, overlayArrow } = renderHoverPopover({
        props: {
          className: "native-hover-popover-class",
          customClassName: "custom-hover-popover-class",
          showOverlayArrow: true,
          customStyles: { color: "turquoise" },
          customOverlayArrowStyles: { opacity: 0.4 },
          style: { backgroundColor: "blue" },
        },
      })

      expect(popover).toHaveClass("native-hover-popover-class")
      expect(popover).toHaveClass("custom-hover-popover-class")
      expect(popover).toHaveStyle({ color: "rgb(64, 224, 208)" })
      expect(popover).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(overlayArrow).toHaveStyle({ opacity: "0.4" })
    })

    it("does not leak wrapper props to the tooltip root.", () => {
      const { popover } = renderHoverPopover({
        props: {
          height: 50,
          width: 150,
          color: "teal",
          order: "primary",
          geometry: "rounded",
          raised: true,
          showOverlayArrow: true,
          customStyles: { backgroundColor: "turquoise" },
          customOverlayArrowStyles: { opacity: 0.4 },
          customClassName: "custom-hover-popover-class",
        },
      })

      expect(popover).not.toHaveAttribute("height")
      expect(popover).not.toHaveAttribute("width")
      expect(popover).not.toHaveAttribute("color")
      expect(popover).not.toHaveAttribute("order")
      expect(popover).not.toHaveAttribute("geometry")
      expect(popover).not.toHaveAttribute("raised")
      expect(popover).not.toHaveAttribute("showoverlayarrow")
      expect(popover).not.toHaveAttribute("customstyles")
      expect(popover).not.toHaveAttribute("customoverlayarrowstyles")
      expect(popover).not.toHaveAttribute("customclassname")
    })
  })
})
