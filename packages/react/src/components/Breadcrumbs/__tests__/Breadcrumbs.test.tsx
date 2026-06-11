import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import linkStyles from "../../Link/LinkStyles.module.css"
import Breadcrumbs from "../Breadcrumbs"
import breadcrumbsStyles from "../BreadcrumbsStyles.module.css"
import { mockBreadcrumbItems, type TBreadcrumbsProps } from "../helpers"

const BreadcrumbsExample = (props: Partial<TBreadcrumbsProps> = {}) => (
  <Breadcrumbs aria-label="Navigation Breadcrumbs" items={mockBreadcrumbItems} {...props} />
)

describe("<Breadcrumbs />", () => {
  it("renders.", () => {
    render(<BreadcrumbsExample />)

    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to color props.", () => {
      render(<BreadcrumbsExample color="red" />)

      const breadcrumbs = screen.getByTestId("breadcrumbs")
      const breadcrumb = screen.getAllByTestId("breadcrumb")[0]
      expect(breadcrumbs).toHaveStyle({ color: "rgb(255, 0, 0)" })
      expect(breadcrumb).toHaveStyle({ color: "rgb(255, 0, 0)" })
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<BreadcrumbsExample order="primary" />)

      const cases = [
        { order: "primary", className: "link--primary" },
        { order: "secondary", className: "link--secondary" },
        { order: "tertiary", className: "link--tertiary" },
        { order: "quaternary", className: "link--quaternary" },
        { order: "quintenary", className: "link--quintenary" },
      ] as const

      cases.forEach(({ order, className }) => {
        rerender(<BreadcrumbsExample order={order} />)

        screen.getAllByTestId("link").forEach((link) => {
          expect(link).toHaveClass(linkStyles[className])
        })
      })
    })

    it("resolves order colors through registry CSS variables.", () => {
      render(<BreadcrumbsExample order="primary" />)

      const breadcrumbs = screen.getByTestId("breadcrumbs")
      const breadcrumb = screen.getAllByTestId("breadcrumb")[0]

      expect(breadcrumbs.getAttribute("style")).toContain("color: var(--cui-color-primary-500)")
      expect(breadcrumb.getAttribute("style")).toContain("color: var(--cui-color-primary-500)")
    })

    it("responds to maxVisibleItems prop.", () => {
      render(<BreadcrumbsExample maxVisibleItems={3} />)

      expect(screen.getAllByRole("link")).toHaveLength(2)
    })

    it("responds to consolidation placement prop.", () => {
      const { rerender } = render(<BreadcrumbsExample maxVisibleItems={3} consolidationPlacement="left" />)

      let breadcrumbs = screen.getAllByTestId("breadcrumb")
      let consolidatedBreadcrumbIndex = breadcrumbs.findIndex(
        (node) => node.getAttribute("data-overflowbreadcrumb") === "true",
      )

      expect(consolidatedBreadcrumbIndex).toBe(1)

      rerender(<BreadcrumbsExample maxVisibleItems={3} consolidationPlacement="right" />)

      breadcrumbs = screen.getAllByTestId("breadcrumb")
      consolidatedBreadcrumbIndex = breadcrumbs.findIndex(
        (node) => node.getAttribute("data-overflowbreadcrumb") === "true",
      )

      expect(consolidatedBreadcrumbIndex).toBe(2)
    })

    it("responds to isDisabled prop.", () => {
      render(<BreadcrumbsExample isDisabled />)

      const breadcrumbs = screen.getByTestId("breadcrumbs")
      const links = screen.getAllByTestId("link")
      const popoverButton = screen.getByTestId("button")

      expect(breadcrumbs).toHaveAttribute("data-disabled")
      expect(popoverButton).toHaveAttribute("data-disabled")
      links.forEach((link) => expect(link).toHaveAttribute("data-disabled"))
    })

    it("responds to custom style props.", async () => {
      const user = userEvent.setup()

      render(
        <BreadcrumbsExample
          customStyles={{ backgroundColor: "turquoise", borderRadius: 0 }}
          customBreadcrumbClassName="custom-breadcrumb"
          customBreadcrumbStyles={{ color: "green" }}
          customOptionsListClassName="custom-options-list"
          customOptionsListStyles={{ backgroundColor: "blue" }}
          customOverflowItemsPopoverButtonClassName="custom-overflow-button"
          customOverflowItemsPopoverButtonStyles={{ backgroundColor: "magenta" }}
          customPopoverClassName="custom-popover"
          maxVisibleItems={3}
        />,
      )

      const breadcrumbsContainer = screen.getByTestId("breadcrumbs")
      const breadcrumbItems = screen.getAllByTestId("breadcrumb")
      const breadcrumbs = screen.getAllByTestId("link")
      const overflowListButton = screen.getByRole("button", { name: "Visually Consolidated Breadcrumbs" })

      expect(breadcrumbsContainer).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)", borderRadius: 0 })

      breadcrumbItems.forEach((breadcrumb) => {
        expect(breadcrumb).toHaveClass("custom-breadcrumb")
      })

      breadcrumbs.forEach((breadcrumb) => {
        expect(breadcrumb).toHaveStyle({ color: "rgb(0, 128, 0)" })
      })

      expect(overflowListButton).toHaveClass("custom-overflow-button")
      expect(overflowListButton).toHaveStyle({ backgroundColor: "rgb(255, 0, 255)" })

      await user.click(overflowListButton)

      const popover = await screen.findByTestId("click-popover")
      const listBox = await screen.findByTestId("Consolidated Breadcrumb Items")
      expect(popover).toHaveClass("custom-popover")
      expect(listBox).toHaveClass("custom-options-list")
      expect(listBox).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("merges native root className and style without losing computed styles.", () => {
      render(
        <BreadcrumbsExample
          customClassName="custom-breadcrumbs"
          className="native-breadcrumbs"
          customStyles={{ backgroundColor: "turquoise", marginTop: 5 }}
          style={{ backgroundColor: "tomato", marginBottom: 10 }}
        />,
      )

      const breadcrumbs = screen.getByTestId("breadcrumbs")

      expect(breadcrumbs).toHaveClass(breadcrumbsStyles.breadcrumbs)
      expect(breadcrumbs).toHaveClass("custom-breadcrumbs")
      expect(breadcrumbs).toHaveClass("native-breadcrumbs")
      expect(breadcrumbs).toHaveStyle({
        backgroundColor: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("merges custom breadcrumb link props without replacing computed link props.", () => {
      render(
        <BreadcrumbsExample
          order="primary"
          customBreadcrumbStyles={{ color: "green" }}
          customBreadcrumbLinkProps={{
            className: "native-breadcrumb-link",
            customClassName: "custom-breadcrumb-link",
            customStyles: { backgroundColor: "yellow" },
            href: "#overridden",
            isDisabled: true,
            order: "secondary",
            style: { marginTop: 4 },
            target: "_self",
          }}
        />,
      )

      const link = screen.getAllByTestId("link")[0]

      expect(link).toHaveClass(linkStyles["link--primary"])
      expect(link).not.toHaveClass(linkStyles["link--secondary"])
      expect(link).toHaveClass("native-breadcrumb-link")
      expect(link).toHaveClass("custom-breadcrumb-link")
      expect(link).toHaveAttribute("href", "#levelA")
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).not.toHaveAttribute("data-disabled")
      expect(link).toHaveStyle({
        backgroundColor: "rgb(255, 255, 0)",
        color: "rgb(0, 128, 0)",
        marginTop: "4px",
      })
    })

    it("maps aria labeling aliases onto root aria attributes.", () => {
      render(
        <Breadcrumbs
          items={mockBreadcrumbItems}
          ariaLabel="Alias label"
          ariaLabelledBy="alias-label-id"
          ariaDescribedBy="alias-description-id"
          ariaDetails="alias-details-id"
        />,
      )

      const breadcrumbs = screen.getByTestId("breadcrumbs")

      expect(breadcrumbs).toHaveAttribute("aria-label", "Alias label")
      expect(breadcrumbs).toHaveAttribute("aria-labelledby", "alias-label-id")
      expect(breadcrumbs).toHaveAttribute("aria-describedby", "alias-description-id")
      expect(breadcrumbs).toHaveAttribute("aria-details", "alias-details-id")
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <BreadcrumbsExample
          color="red"
          order="primary"
          geometry="round"
          maxVisibleItems={3}
          consolidationPlacement="left"
          linkTarget="_self"
          customClassName="custom-breadcrumbs"
          customStyles={{ marginTop: 5 }}
          customBreadcrumbClassName="custom-breadcrumb"
          customBreadcrumbStyles={{ color: "green" }}
          customOptionsListClassName="custom-options-list"
          customOptionsListStyles={{ backgroundColor: "blue" }}
          customOverflowItemsPopoverButtonClassName="custom-overflow-button"
          customOverflowItemsPopoverButtonStyles={{ backgroundColor: "magenta" }}
          customPopoverClassName="custom-popover"
          onNavigate={vi.fn()}
        />,
      )

      const breadcrumbs = screen.getByTestId("breadcrumbs")

      expect(breadcrumbs).not.toHaveAttribute("color")
      expect(breadcrumbs).not.toHaveAttribute("order")
      expect(breadcrumbs).not.toHaveAttribute("geometry")
      expect(breadcrumbs).not.toHaveAttribute("maxvisibleitems")
      expect(breadcrumbs).not.toHaveAttribute("consolidationplacement")
      expect(breadcrumbs).not.toHaveAttribute("linktarget")
      expect(breadcrumbs).not.toHaveAttribute("customclassname")
      expect(breadcrumbs).not.toHaveAttribute("customstyles")
      expect(breadcrumbs).not.toHaveAttribute("custombreadcrumbclassname")
      expect(breadcrumbs).not.toHaveAttribute("custombreadcrumbstyles")
      expect(breadcrumbs).not.toHaveAttribute("customoptionslistclassname")
      expect(breadcrumbs).not.toHaveAttribute("customoptionsliststyles")
      expect(breadcrumbs).not.toHaveAttribute("customoverflowitemspopoverbuttonclassname")
      expect(breadcrumbs).not.toHaveAttribute("customoverflowitemspopoverbuttonstyles")
      expect(breadcrumbs).not.toHaveAttribute("custompopoverclassname")
      expect(breadcrumbs).not.toHaveAttribute("onnavigate")
    })

    it("delegates overflow item navigation when onNavigate is provided.", async () => {
      const user = userEvent.setup()
      const onNavigate = vi.fn()
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)

      render(<BreadcrumbsExample maxVisibleItems={3} linkTarget="_self" onNavigate={onNavigate} />)

      await user.click(screen.getByRole("button", { name: "Visually Consolidated Breadcrumbs" }))
      await user.click(await screen.findByRole("option", { name: "Level C" }))

      expect(onNavigate).toHaveBeenCalledWith({ href: "#levelC", item: mockBreadcrumbItems[2], target: "_self" })
      expect(openSpy).not.toHaveBeenCalled()

      openSpy.mockRestore()
    })

    it("opens overflow item links with the browser fallback when onNavigate is omitted.", async () => {
      const user = userEvent.setup()
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)

      render(<BreadcrumbsExample maxVisibleItems={3} />)

      await user.click(screen.getByRole("button", { name: "Visually Consolidated Breadcrumbs" }))
      await user.click(await screen.findByRole("option", { name: "Level D" }))

      expect(openSpy).toHaveBeenCalledWith("#levelD", "_blank", "noopener,noreferrer")

      openSpy.mockRestore()
    })

    it("accepts custom labels for internal navigation chrome.", async () => {
      const user = userEvent.setup()

      render(
        <Breadcrumbs
          items={mockBreadcrumbItems}
          maxVisibleItems={3}
          labels={{
            navAriaLabel: "Localized breadcrumb trail",
            overflowBreadcrumbAriaLabel: "Localized collapsed breadcrumb",
            overflowButtonAriaLabel: "Show localized breadcrumbs",
            overflowListAriaLabel: "Localized hidden breadcrumb items",
          }}
        />,
      )

      expect(screen.getByRole("navigation", { name: "Localized breadcrumb trail" })).toBeVisible()
      expect(screen.getByRole("button", { name: "Show localized breadcrumbs" })).toBeVisible()

      await user.click(screen.getByRole("button", { name: "Show localized breadcrumbs" }))

      expect(await screen.findByRole("listbox", { name: "Localized hidden breadcrumb items" })).toBeVisible()
    })
  })
})
