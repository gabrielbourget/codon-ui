import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import Tag from "../Tag"
import styles from "../TagStyles.module.css"

describe("<Tag />", () => {
  it("renders.", () => {
    render(<Tag />)

    expect(screen.getByTestId("tag")).toBeInTheDocument()
  })

  it("renders in pressable mode.", () => {
    render(
      <Tag pressable isPressed onPress={() => null}>
        Tag text
      </Tag>,
    )
    const tag = screen.getByTestId("tag")

    expect(tag).toBeInTheDocument()
    expect(tag.tagName).toBe("BUTTON")
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<Tag height={50} width={150} />)
      const tag = screen.getByTestId("tag")

      expect(tag).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<Tag geometry="rounded" />)
      const tag = screen.getByTestId("tag")

      expect(tag).toHaveClass(styles["tag--rounded"])

      rerender(<Tag geometry="round" />)
      expect(tag).toHaveClass(styles["tag--round"])

      rerender(<Tag geometry="orthogonal" />)
      expect(tag).not.toHaveClass(styles["tag--rounded"])
      expect(tag).not.toHaveClass(styles["tag--round"])
    })

    it("responds to box-shadow props.", () => {
      const { rerender } = render(<Tag />)
      const tag = screen.getByTestId("tag")

      expect(tag).not.toHaveClass(styles["tag--raised"])

      rerender(<Tag raised />)
      expect(tag).toHaveClass(styles["tag--raised"])

      rerender(<Tag raised={false} raisedOnHover />)
      expect(tag).toHaveClass(styles["tag--raisedOnHover"])
    })

    it("responds to canonical disabled prop.", () => {
      render(
        <Tag pressable isDisabled isPressed onPress={() => null}>
          Tag text
        </Tag>,
      )
      const tag = screen.getByTestId("tag")

      expect(tag).toBeDisabled()
      expect(tag).toHaveAttribute("data-disabled", "true")
      expect(tag).toHaveClass(styles["tag--disabled"])
      expect(tag).not.toHaveAttribute("isdisabled")
    })

    it("can opt out of disabled state with the canonical prop.", () => {
      render(
        <Tag pressable isDisabled={false} isPressed onPress={() => null}>
          Tag text
        </Tag>,
      )
      const tag = screen.getByTestId("tag")

      expect(tag).not.toBeDisabled()
      expect(tag).not.toHaveAttribute("data-disabled")
      expect(tag).not.toHaveClass(styles["tag--disabled"])
    })

    it("responds to custom styles prop.", () => {
      render(
        <Tag
          className="native-tag-class"
          customClassName="custom-tag-class"
          customStyles={{ color: "turquoise", borderRadius: 0 }}
          style={{ backgroundColor: "blue" }}
        />,
      )
      const tag = screen.getByTestId("tag")

      expect(tag).toHaveClass("native-tag-class")
      expect(tag).toHaveClass("custom-tag-class")
      expect(tag).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
      expect(tag).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("responds to aria pressed props.", () => {
      const { rerender } = render(
        <Tag pressable isPressed onPress={() => null} aria-label="tag">
          Tag text
        </Tag>,
      )
      const tag = screen.getByRole("button", { name: "tag" })

      expect(tag).toHaveAttribute("aria-pressed", "true")

      rerender(
        <Tag pressable isPressed aria-pressed={false} onPress={() => null} aria-label="tag">
          Tag text
        </Tag>,
      )
      expect(tag).toHaveAttribute("aria-pressed", "false")
    })

    it("responds to semantic render mode.", () => {
      const { rerender } = render(<Tag aria-label="Static tag">Tag text</Tag>)
      const tag = screen.getByRole("status", { name: "Static tag" })

      expect(tag).toHaveAttribute("aria-live", "off")

      rerender(
        <Tag pressable isPressed onPress={() => null} aria-label="Interactive tag">
          Tag text
        </Tag>,
      )
      const interactiveTag = screen.getByRole("button", { name: "Interactive tag" })

      expect(interactiveTag.tagName).toBe("BUTTON")
      expect(interactiveTag).not.toHaveAttribute("role")
    })

    it("responds to color and border props.", () => {
      render(<Tag color="rgb(255, 0, 0)" border="2px solid rgb(0, 0, 255)" />)
      const tag = screen.getByTestId("tag")

      expect(tag).toHaveStyle({
        "--activeBGColor": "rgb(255, 0, 0)",
        "--inactiveBGColor": "rgb(255, 0, 0)",
        "--activeBorder": "2px solid rgb(0, 0, 255)",
        "--inactiveBorder": "2px solid rgb(0, 0, 255)",
      })
    })

    it("uses semantic default color variables when no color overrides are provided.", () => {
      const { rerender } = render(<Tag>Static tag</Tag>)
      let tag = screen.getByTestId("tag")

      expect(tag).toHaveStyle({
        "--activeBGColor": "var(--cui-control-selected-background)",
        "--inactiveBGColor": "var(--cui-control-selected-background)",
      })

      rerender(
        <Tag pressable isPressed={false} onPress={() => null}>
          Pressable tag
        </Tag>,
      )
      tag = screen.getByTestId("tag")

      expect(tag).toHaveStyle({
        "--activeBGColor": "var(--cui-control-selected-background)",
        "--inactiveBGColor": "var(--cui-control-background)",
      })
    })

    it("responds to hover cursor and background transition props.", () => {
      render(
        <Tag
          pressable
          isPressed
          onPress={() => null}
          hoverCursor="grab"
          backgroundColorTransition="background-color 1s linear"
        >
          Tag text
        </Tag>,
      )
      const tag = screen.getByTestId("tag")

      expect(tag).toHaveStyle({
        "--hoverCursor": "grab",
        "--bgColorTransition": "background-color 1s linear",
      })
    })

    it("keeps root transition defaults when no background transition override is provided.", () => {
      render(
        <Tag pressable isPressed onPress={() => null}>
          Tag text
        </Tag>,
      )
      const tag = screen.getByTestId("tag")

      expect(tag.getAttribute("style")).not.toContain("--bgColorTransition")
    })
  })

  describe("interactions", () => {
    it("responds when clicking it in pressable mode.", () => {
      const onPress = vi.fn()
      render(
        <Tag id="genre-witchhouse" pressable isPressed={false} onPress={onPress} aria-label="Interactive tag">
          Tag text
        </Tag>,
      )
      const tag = screen.getByRole("button", { name: "Interactive tag" })

      fireEvent.click(tag)

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(onPress).toHaveBeenCalledWith("genre-witchhouse")
    })

    it("does not leak wrapper props to the root element.", () => {
      render(
        <Tag
          id="genre-witchhouse"
          pressable
          isPressed={false}
          onPress={() => null}
          aria-label="Interactive tag"
          activeColor="red"
          activeBorder="1px solid red"
          inactiveColor="blue"
          inactiveBorder="1px solid blue"
          isDisabled={false}
          raised
          raisedOnHover
          customStyles={{ color: "turquoise" }}
          customClassName="custom-tag"
        >
          Tag text
        </Tag>,
      )

      const tag = screen.getByRole("button", { name: "Interactive tag" })

      expect(tag).not.toHaveAttribute("pressable")
      expect(tag).not.toHaveAttribute("ispressed")
      expect(tag).not.toHaveAttribute("activecolor")
      expect(tag).not.toHaveAttribute("activeborder")
      expect(tag).not.toHaveAttribute("inactivecolor")
      expect(tag).not.toHaveAttribute("inactiveborder")
      expect(tag).not.toHaveAttribute("isdisabled")
      expect(tag).not.toHaveAttribute("raised")
      expect(tag).not.toHaveAttribute("raisedonhover")
      expect(tag).not.toHaveAttribute("customstyles")
      expect(tag).not.toHaveAttribute("customclassname")
    })
  })
})
