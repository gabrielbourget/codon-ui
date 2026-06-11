import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Slider from "../Slider"
import styles from "../SliderStyles.module.css"

const sliderStylesSource = readFileSync("src/components/Slider/SliderStyles.module.css", "utf8")

describe("<Slider />", () => {
  it("renders.", () => {
    render(<Slider aria-label="slider" />)

    expect(screen.getByTestId("slider")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<Slider height={50} width={150} aria-label="slider" />)
      const slider = screen.getByTestId("slider")

      expect(slider).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("preserves CSS size strings for maxWidth.", () => {
      const { rerender } = render(<Slider maxWidth="50%" aria-label="slider" />)
      const slider = screen.getByTestId("slider")

      expect(slider).toHaveStyle({ "--max-width": "50%" })

      rerender(<Slider maxWidth="2rem" aria-label="slider" />)
      expect(slider).toHaveStyle({ "--max-width": "2rem" })

      rerender(<Slider maxWidth="calc(100% - 20px)" aria-label="slider" />)
      expect(slider).toHaveStyle({ "--max-width": "calc(100% - 20px)" })

      rerender(<Slider maxWidth={320} aria-label="slider" />)
      expect(slider).toHaveStyle({ "--max-width": "320px" })
    })

    it("responds to color props.", () => {
      render(<Slider trackColor="red" thumbColor="blue" aria-label="slider" />)
      const track = document.querySelector(`.${styles.slider__track}`)!
      const thumb = document.querySelector(`.${styles.slider__thumb}`)!
      const trackComputedStyles = getComputedStyle(track)
      const thumbComputedStyles = getComputedStyle(thumb)

      expect(trackComputedStyles.backgroundColor).toBe("rgb(255, 0, 0)")
      expect(thumbComputedStyles.backgroundColor).toBe("rgb(0, 0, 255)")
    })

    it("responds to corner geometry props.", () => {
      {
        const { unmount } = render(<Slider aria-label="slider" />)
        const track = screen.getByTestId("slider-track")
        const thumb = screen.getByTestId("slider-thumb-1")

        expect(track).toHaveClass(styles["slider__track--round"])
        expect(thumb).toHaveClass(styles["slider__thumb--round"])

        unmount()
      }

      {
        const { unmount } = render(<Slider aria-label="slider" geometry="rounded" />)
        const track = screen.getByTestId("slider-track")
        const thumb = screen.getByTestId("slider-thumb-1")

        expect(track).toHaveClass(styles["slider__track--rounded"])
        expect(thumb).toHaveClass(styles["slider__thumb--rounded"])

        unmount()
      }

      {
        render(<Slider aria-label="slider" geometry="orthogonal" />)
        const track = screen.getByTestId("slider-track")
        const thumb = screen.getByTestId("slider-thumb-1")

        expect(track).not.toHaveClass(styles["slider__track--round"])
        expect(thumb).not.toHaveClass(styles["slider__thumb--round"])
        expect(track).not.toHaveClass(styles["slider__track--rounded"])
        expect(thumb).not.toHaveClass(styles["slider__thumb--rounded"])
      }
    })

    it("responds to theming order props.", () => {
      {
        const { unmount } = render(<Slider order="primary" aria-label="slider" />)
        const thumb = screen.getByTestId("slider-thumb-1")
        expect(thumb).toHaveClass(styles["slider__thumb--primary"])

        unmount()
      }

      {
        const { unmount } = render(<Slider order="secondary" aria-label="slider" />)
        const thumb = screen.getByTestId("slider-thumb-1")
        expect(thumb).toHaveClass(styles["slider__thumb--secondary"])

        unmount()
      }

      {
        const { unmount } = render(<Slider order="tertiary" aria-label="slider" />)
        const thumb = screen.getByTestId("slider-thumb-1")
        expect(thumb).toHaveClass(styles["slider__thumb--tertiary"])

        unmount()
      }

      {
        const { unmount } = render(<Slider order="quaternary" aria-label="slider" />)
        const thumb = screen.getByTestId("slider-thumb-1")
        expect(thumb).toHaveClass(styles["slider__thumb--quaternary"])

        unmount()
      }

      {
        const { unmount } = render(<Slider order="quintenary" aria-label="slider" />)
        const thumb = screen.getByTestId("slider-thumb-1")
        expect(thumb).toHaveClass(styles["slider__thumb--quintenary"])

        unmount()
      }
    })

    it("order styles use numbered palette tokens.", () => {
      expect(sliderStylesSource).toContain("var(--cui-color-primary-500)")
      expect(sliderStylesSource).toContain("var(--cui-color-primary-600)")
      expect(sliderStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to box-shadow props.", () => {
      const { rerender } = render(<Slider aria-label="slider" />)
      const thumb = screen.getByTestId("slider-thumb-1")

      expect(thumb).toHaveClass(styles["slider__thumb--raised"])

      rerender(<Slider aria-label="slider" raised={false} />)
      expect(thumb).not.toHaveClass(styles["slider__thumb--raised"])
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<Slider aria-label="slider" />)
      const thumb = screen.getByTestId("slider-thumb-1")

      expect(thumb).toHaveClass(styles["slider__thumb--applyFocusStyle"])
      expect(thumb).toHaveClass(styles["slider__thumb--offsetFocusRing"])

      rerender(<Slider enableFocusStyle={false} offsetFocusRing={false} aria-label="slider" />)
      expect(thumb).not.toHaveClass(styles["slider__thumb--applyFocusStyle"])
      expect(thumb).not.toHaveClass(styles["slider__thumb--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<Slider isDisabled aria-label="slider" />)
      const slider = screen.getByTestId("slider")

      expect(slider).toHaveAttribute("data-disabled", "true")
    })

    it("can opt out of disabled state with the canonical prop.", () => {
      render(<Slider isDisabled={false} aria-label="slider" />)
      const slider = screen.getByTestId("slider")

      expect(slider).not.toHaveAttribute("data-disabled")
    })

    it("responds to custom style props.", () => {
      render(
        <Slider
          label="Slider"
          customStyles={{ backgroundColor: "turquoise", borderRadius: 0 }}
          customLabelStyles={{ color: "green" }}
          customOutputStyles={{ color: "blue" }}
          customTrackStyles={{ backgroundColor: "yellow" }}
          customThumbStyles={{ backgroundColor: "magenta" }}
          aria-label="slider"
        />,
      )

      const slider = screen.getByTestId("slider")
      const label = screen.getByTestId("slider-label")
      const output = screen.getByTestId("slider-output")
      const track = screen.getByTestId("slider-track")
      const thumb = screen.getByTestId("slider-thumb-1")

      expect(slider).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)", borderRadius: 0 })
      expect(label).toHaveStyle({ color: "rgb(0, 128, 0)" })
      expect(output).toHaveStyle({ color: "rgb(0, 0, 255)" })
      expect(track).toHaveStyle({ backgroundColor: "rgb(255, 255, 0)" })
      expect(thumb).toHaveStyle({ backgroundColor: "rgb(255, 0, 255)" })
    })

    it("merges native root className and style without losing computed styles.", () => {
      render(
        <Slider
          height={50}
          width={150}
          maxWidth="50%"
          customStyles={{ backgroundColor: "turquoise", marginTop: 5 }}
          className="native-slider-class"
          style={{ backgroundColor: "tomato", marginBottom: 10 }}
          aria-label="slider"
        />,
      )

      const slider = screen.getByTestId("slider")

      expect(slider).toHaveClass(styles.slider)
      expect(slider).toHaveClass("native-slider-class")
      expect(slider).toHaveStyle({
        "--max-width": "50%",
        height: "50px",
        width: "150px",
        backgroundColor: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <Slider
          height={50}
          width={150}
          maxWidth="50%"
          trackColor="red"
          thumbColor="blue"
          geometry="round"
          order="primary"
          raised
          enableFocusStyle={false}
          offsetFocusRing={false}
          customStyles={{ marginTop: 5 }}
          customLabelStyles={{ color: "green" }}
          customOutputStyles={{ color: "blue" }}
          customTrackStyles={{ backgroundColor: "yellow" }}
          customThumbStyles={{ backgroundColor: "magenta" }}
          aria-label="slider"
        />,
      )

      const slider = screen.getByTestId("slider")

      expect(slider).not.toHaveAttribute("maxwidth")
      expect(slider).not.toHaveAttribute("trackcolor")
      expect(slider).not.toHaveAttribute("thumbcolor")
      expect(slider).not.toHaveAttribute("geometry")
      expect(slider).not.toHaveAttribute("order")
      expect(slider).not.toHaveAttribute("raised")
      expect(slider).not.toHaveAttribute("enablefocusstyle")
      expect(slider).not.toHaveAttribute("offsetfocusring")
      expect(slider).not.toHaveAttribute("customstyles")
      expect(slider).not.toHaveAttribute("customlabelstyles")
      expect(slider).not.toHaveAttribute("customoutputstyles")
      expect(slider).not.toHaveAttribute("customtrackstyles")
      expect(slider).not.toHaveAttribute("customthumbstyles")
    })
  })
})
