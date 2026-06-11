import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import Panel from "../Panel"
import styles from "../PanelStyles.module.css"

type TRenderPanelArgs = Partial<ComponentProps<typeof Panel>>

const renderPanel = (props: TRenderPanelArgs = {}) => {
  const onOpenChange = vi.fn()

  const renderInfo = render(
    <Panel isOpen onOpenChange={onOpenChange} {...props}>
      <div>Panel Body</div>
    </Panel>,
  )

  const getPanel = () => renderInfo.baseElement.querySelector(`.${styles.panel}`) as HTMLElement | null
  const getOverlay = () => renderInfo.baseElement.querySelector(`.${styles.panel__overlay}`) as HTMLElement | null

  return {
    ...renderInfo,
    onOpenChange,
    getPanel,
    getOverlay,
  }
}

describe("<Panel />", () => {
  it("does not render when the panel is closed.", () => {
    const { getPanel, getOverlay } = renderPanel({ isOpen: false })

    expect(screen.queryByText("Panel Body")).not.toBeInTheDocument()
    expect(getPanel()).not.toBeInTheDocument()
    expect(getOverlay()).not.toBeInTheDocument()
  })

  it("renders the dialog and overlay when the panel is open.", () => {
    const { getPanel, getOverlay } = renderPanel()

    expect(screen.getByText("Panel Body")).toBeInTheDocument()
    expect(getPanel()).toBeInTheDocument()
    expect(getOverlay()).toBeInTheDocument()
    expect(getPanel()).toHaveClass(styles["panel--open"])
  })

  it("applies geometry, raised, and overlay blur classes.", () => {
    const { getPanel, getOverlay } = renderPanel({
      panelGeometry: "rounded",
      raised: true,
      overlayBlur: true,
    })

    expect(getPanel()).toHaveClass(styles["panel--rounded"])
    expect(getPanel()).toHaveClass(styles["panel--raised"])
    expect(getOverlay()).toHaveClass(styles["panel__overlay--blur"])
  })

  it("does not apply rounded or raised classes when those props are disabled.", () => {
    const { getPanel, getOverlay } = renderPanel({
      panelGeometry: "orthogonal",
      raised: false,
      overlayBlur: false,
    })

    expect(getPanel()).not.toHaveClass(styles["panel--rounded"])
    expect(getPanel()).not.toHaveClass(styles["panel--round"])
    expect(getPanel()).not.toHaveClass(styles["panel--raised"])
    expect(getOverlay()).not.toHaveClass(styles["panel__overlay--blur"])
  })

  it("merges root and overlay style props.", () => {
    const { getPanel, getOverlay } = renderPanel({
      className: "native-panel-class",
      customClassName: "custom-panel-class",
      customOverlayClassName: "custom-panel-overlay-class",
      customStyles: { color: "turquoise" },
      style: { backgroundColor: "blue" },
      customOverlayStyles: { backgroundColor: "gold" },
    })

    expect(getPanel()).toHaveClass("native-panel-class")
    expect(getPanel()).toHaveClass("custom-panel-class")
    expect(getPanel()).toHaveStyle({ color: "rgb(64, 224, 208)" })
    expect(getPanel()).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    expect(getOverlay()).toHaveClass("custom-panel-overlay-class")
    expect(getOverlay()).toHaveStyle({ backgroundColor: "rgb(255, 215, 0)" })
  })

  it("applies panel sizing, background, and right-side placement props.", () => {
    const { getPanel } = renderPanel({
      backgroundColor: "gold",
      height: 500,
      position: "right",
      width: 350,
    })

    expect(getPanel()).toHaveClass(styles["panel--right"])
    expect(getPanel()).toHaveStyle({
      backgroundColor: "rgb(255, 215, 0)",
      height: "500px",
      width: "350px",
    })
  })

  it("applies the round geometry class when requested.", () => {
    const { getPanel } = renderPanel({
      panelGeometry: "round",
    })

    expect(getPanel()).toHaveClass(styles["panel--round"])
  })

  it("calls the canonical open change handler when the overlay closes.", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { getPanel, getOverlay } = renderPanel({
      isOpen: true,
      onOpenChange,
    })

    expect(getPanel()).toBeInTheDocument()

    await user.click(getOverlay()!)

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("does not leak wrapper props to the panel root.", () => {
    const { getPanel } = renderPanel({
      height: 500,
      width: 350,
      horizontalGap: 20,
      position: "right",
      panelGeometry: "rounded",
      backgroundColor: "gold",
      overlayBlur: true,
      raised: true,
      isOpen: true,
      onOpenChange: vi.fn(),
      isDismissable: false,
      isKeyboardDismissDisabled: true,
      customStyles: { color: "turquoise" },
      customOverlayStyles: { backgroundColor: "gold" },
      customClassName: "custom-panel-class",
      customOverlayClassName: "custom-panel-overlay-class",
    })

    expect(getPanel()).not.toHaveAttribute("height")
    expect(getPanel()).not.toHaveAttribute("width")
    expect(getPanel()).not.toHaveAttribute("horizontalgap")
    expect(getPanel()).not.toHaveAttribute("position")
    expect(getPanel()).not.toHaveAttribute("panelgeometry")
    expect(getPanel()).not.toHaveAttribute("backgroundcolor")
    expect(getPanel()).not.toHaveAttribute("overlayblur")
    expect(getPanel()).not.toHaveAttribute("raised")
    expect(getPanel()).not.toHaveAttribute("isopen")
    expect(getPanel()).not.toHaveAttribute("onopenchange")
    expect(getPanel()).not.toHaveAttribute("isdismissable")
    expect(getPanel()).not.toHaveAttribute("iskeyboarddismissdisabled")
    expect(getPanel()).not.toHaveAttribute("customstyles")
    expect(getPanel()).not.toHaveAttribute("customoverlaystyles")
    expect(getPanel()).not.toHaveAttribute("customclassname")
    expect(getPanel()).not.toHaveAttribute("customoverlayclassname")
  })

  it("closes when the overlay is clicked by default.", async () => {
    const user = userEvent.setup()
    const { getOverlay, onOpenChange } = renderPanel()

    await user.click(getOverlay()!)

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("keeps pointer dismissal disabled when requested.", async () => {
    const user = userEvent.setup()
    const { getOverlay, onOpenChange } = renderPanel({ isDismissable: false })

    await user.click(getOverlay()!)

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("closes when Escape is pressed by default.", async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderPanel()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("keeps keyboard dismissal disabled when requested.", async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderPanel({ isKeyboardDismissDisabled: true })

    await user.keyboard("{Escape}")

    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
