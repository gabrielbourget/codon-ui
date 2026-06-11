import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Link from "../Link"
import styles from "../LinkStyles.module.css"

const linkStylesSource = readFileSync("src/components/Link/LinkStyles.module.css", "utf8")

describe("<Link />", () => {
  it("renders.", () => {
    render(<Link href="#test-id">Link Text</Link>)

    const link = screen.getByTestId("link")
    expect(link).toBeInTheDocument()
    expect(link).toHaveTextContent(/link text/iu)
  })

  describe("props API surface", () => {
    it("responds to a custom color prop.", () => {
      render(
        <Link href="#test-id" color="red">
          Link Text
        </Link>,
      )

      const link = screen.getByTestId("link")
      expect(link).toHaveStyle({ color: "rgb(255, 0, 0)" })
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<Link href="#test-id" order="primary" />)
      const link = screen.getByTestId("link")
      expect(link).toHaveClass(styles["link--primary"])

      rerender(
        <Link href="#test-id" order="secondary">
          Link Text
        </Link>,
      )
      expect(link).toHaveClass(styles["link--secondary"])

      rerender(
        <Link href="#test-id" order="tertiary">
          Link Text
        </Link>,
      )
      expect(link).toHaveClass(styles["link--tertiary"])

      rerender(
        <Link href="#test-id" order="quaternary">
          Link Text
        </Link>,
      )
      expect(link).toHaveClass(styles["link--quaternary"])

      rerender(
        <Link href="#test-id" order="quintenary">
          Link Text
        </Link>,
      )
      expect(link).toHaveClass(styles["link--quintenary"])
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(linkStylesSource).toContain("var(--cui-color-primary-500)")
      expect(linkStylesSource).toContain("var(--cui-color-primary-600)")
      expect(linkStylesSource).toContain("var(--cui-color-primary-700)")
      expect(linkStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to text decoration prop.", () => {
      render(
        <Link href="#test-id" textDecoration="underline">
          Link Text
        </Link>,
      )

      const link = screen.getByTestId("link")
      expect(link).toHaveClass(styles["link--underline"])
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<Link href="#test-id">Link Text</Link>)
      const link = screen.getByTestId("link")
      expect(link).toHaveClass(styles["link--applyFocusStyle"])
      expect(link).toHaveClass(styles["link--offsetFocusRing"])

      rerender(<Link href="#test-id" enableFocusStyle={false} offsetFocusRing={false} />)
      expect(link).not.toHaveClass(styles["link--applyFocusStyle"])
      expect(link).not.toHaveClass(styles["link--offsetFocusRing"])
    })

    it("responds to isDisabled prop.", () => {
      render(
        <Link href="#link-id" isDisabled>
          Link Text
        </Link>,
      )

      const link = screen.getByTestId("link")
      expect(link).toHaveAttribute("data-disabled", "true")
      expect(link).toHaveAttribute("aria-disabled", "true")
    })

    it("responds to custom styles prop.", () => {
      render(
        <Link href="#-test-id" customStyles={{ color: "turquoise", height: 20 }}>
          Link Text
        </Link>,
      )

      const link = screen.getByTestId("link")
      expect(link).toHaveStyle({ color: "rgb(64, 224, 208)", height: "20px" })
    })

    it("merges native root className and style without losing computed styles.", () => {
      render(
        <Link
          href="#test-id"
          color="turquoise"
          customClassName="custom-link-class"
          className="native-link-class"
          customStyles={{ marginTop: 5 }}
          style={{ color: "tomato", marginBottom: 10 }}
        >
          Link Text
        </Link>,
      )

      const link = screen.getByTestId("link")

      expect(link).toHaveClass(styles.link)
      expect(link).toHaveClass("custom-link-class")
      expect(link).toHaveClass("native-link-class")
      expect(link).toHaveStyle({
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("maps aria labeling aliases onto root aria attributes.", () => {
      render(
        <Link
          href="#test-id"
          ariaLabel="Alias label"
          ariaLabelledBy="alias-label-id"
          ariaDescribedBy="alias-description-id"
          ariaDetails="alias-details-id"
        >
          Link Text
        </Link>,
      )

      const link = screen.getByTestId("link")

      expect(link).toHaveAttribute("aria-label", "Alias label")
      expect(link).toHaveAttribute("aria-labelledby", "alias-label-id")
      expect(link).toHaveAttribute("aria-describedby", "alias-description-id")
      expect(link).toHaveAttribute("aria-details", "alias-details-id")
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <Link
          href="#test-id"
          color="turquoise"
          order="primary"
          textDecoration="underline"
          enableFocusStyle={false}
          offsetFocusRing={false}
          isDisabled={false}
          customClassName="custom-link-class"
          customStyles={{ marginTop: 5 }}
        >
          Link Text
        </Link>,
      )

      const link = screen.getByTestId("link")

      expect(link).not.toHaveAttribute("color")
      expect(link).not.toHaveAttribute("order")
      expect(link).not.toHaveAttribute("textdecoration")
      expect(link).not.toHaveAttribute("enablefocusstyle")
      expect(link).not.toHaveAttribute("offsetfocusring")
      expect(link).not.toHaveAttribute("isdisabled")
      expect(link).not.toHaveAttribute("customclassname")
      expect(link).not.toHaveAttribute("customstyles")
    })
  })
})
