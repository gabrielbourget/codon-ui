import { cleanup, render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"

import buttonStyles from "../../Button/ButtonStyles.module.css"
import {
  AVAILABLE_PAGINATION_SUBCOMPONENTS,
  DEFAULT_ITEMS_PER_PAGE,
  PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE,
  type TPartialPaginationLabels,
  type TPaginationProps,
  type TPaginationSubComponent,
  type TPaginationSubComponentKeymap,
} from "../helpers"
import Pagination from "../Pagination"
import paginationStyles from "../PaginationStyles.module.css"

const setCurrentPage = vi.fn()
const setItemsPerPage = vi.fn()

const TestIcon = ({ label }: { label: string }) => (
  <svg aria-hidden="true" data-testid={`test-${label}-icon`} height={12} viewBox="0 0 12 12" width={12}>
    <path d="M2 2h8v8H2z" />
  </svg>
)

const PaginationExample = (props: Partial<TPaginationProps> = {}) => (
  <Pagination
    currentPage={3}
    setCurrentPage={setCurrentPage}
    itemsPerPage={10}
    setItemsPerPage={setItemsPerPage}
    numberOfItems={200}
    aria-label="pagination"
    {...props}
  />
)

const getPaginationNav = () => screen.getByRole("navigation", { name: /pagination navigation/iu })

const getPaginationPageNumberControls = () => {
  const pageNumberControls = screen.getByTestId("page-number-controls")
  return Array.from(pageNumberControls.querySelectorAll<HTMLButtonElement>(":scope > button"))
}

const getOverflowIndexes = () =>
  getPaginationPageNumberControls()
    .map((button, index) => (button.getAttribute("data-testid") === "pagination-overflow-trigger" ? index : -1))
    .filter((index) => index !== -1)

const getPageButtonPlacementIndex = (pageNum: number) => {
  const pageNumberControls = getPaginationPageNumberControls()
  const target = pageNumberControls.find((button) => button.getAttribute("aria-label") === `Go To Page ${pageNum}`)

  if (!target) {
    const labels = pageNumberControls.map((button) => button.getAttribute("aria-label"))
    throw new Error(`Could not find page button for page ${pageNum}. Buttons: ${JSON.stringify(labels, null, 2)}`)
  }

  return pageNumberControls.indexOf(target)
}

const expectOverflowTriggerCount = (expected: number) => {
  expect(getOverflowIndexes()).toHaveLength(expected)
}

const expectOverflowsBetweenPages = ({
  leftPage,
  rightPage,
  expectedBetween,
}: {
  leftPage: number
  rightPage: number
  expectedBetween: number
}) => {
  const leftIndex = getPageButtonPlacementIndex(leftPage)
  const rightIndex = getPageButtonPlacementIndex(rightPage)
  const overflowIndexes = getOverflowIndexes()
  const between = overflowIndexes.filter((index) => index > leftIndex && index < rightIndex)

  expect(between).toHaveLength(expectedBetween)
}

const getCurrentPageButton = () => screen.getByRole("button", { current: "page" })

const clickGoToPage = async (user: ReturnType<typeof userEvent.setup>, page: number) => {
  const nav = getPaginationNav()
  await user.click(within(nav).getByRole("button", { name: new RegExp(`go to page\\s+${page}\\b`, "iu") }))
}

const expectOnlyTheseSubcomponents = (expectedVisible: readonly TPaginationSubComponent[]) => {
  const nav = getPaginationNav()
  const scoped = within(nav)
  const expected = new Set(expectedVisible)

  AVAILABLE_PAGINATION_SUBCOMPONENTS.forEach((id) => {
    const element = scoped.queryByTestId(id)

    if (expected.has(id)) {
      expect(element).toBeInTheDocument()
    } else {
      expect(element).not.toBeInTheDocument()
    }
  })
}

describe("<Pagination />", () => {
  beforeEach(() => {
    setCurrentPage.mockClear()
    setItemsPerPage.mockClear()
  })

  it("renders.", () => {
    render(<PaginationExample />)

    expect(screen.getByTestId("pagination")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("merges native root className and style without losing computed styles.", () => {
      render(
        <PaginationExample
          customClassName="custom-pagination"
          className="native-pagination"
          customComponentStyles={{ backgroundColor: "turquoise", marginTop: 5 }}
          style={{ backgroundColor: "tomato", marginBottom: 10 }}
          data-testid="custom-pagination-testid"
        />,
      )

      const pagination = screen.getByTestId("custom-pagination-testid")

      expect(pagination).toHaveClass(paginationStyles.pagination)
      expect(pagination).toHaveClass("custom-pagination")
      expect(pagination).toHaveClass("native-pagination")
      expect(pagination).toHaveStyle({
        backgroundColor: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("maps labeling props onto root aria attributes.", () => {
      render(
        <PaginationExample
          labels={{ root: { navigationAriaLabel: "Alias label" } }}
          ariaLabelledBy="alias-label-id"
          ariaDescribedBy="alias-description-id"
          ariaDetails="alias-details-id"
        />,
      )

      const pagination = screen.getByTestId("pagination")

      expect(pagination).toHaveAttribute("aria-label", "Alias label")
      expect(pagination).toHaveAttribute("aria-labelledby", "alias-label-id")
      expect(pagination).toHaveAttribute("aria-describedby", "alias-description-id")
      expect(pagination).toHaveAttribute("aria-details", "alias-details-id")
    })

    it("responds to isDisabled prop.", () => {
      render(<PaginationExample isDisabled />)

      const pagination = screen.getByTestId("pagination")
      const nextPageButton = screen.getByRole("button", { name: /next page/iu })

      expect(pagination).toHaveAttribute("data-disabled", "true")
      expect(nextPageButton).toBeDisabled()
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <PaginationExample
          color="red"
          order="primary"
          maxVisiblePages={4}
          consolidationPlacement="right"
          isDisabled={false}
          customClassName="custom-pagination"
          customComponentStyles={{ marginTop: 5 }}
          customGeneralButtonProps={{ customClassName: "custom-button" }}
          customSeparatorClassName="custom-separator"
          customSeparatorStyles={{ marginInline: 5 }}
        />,
      )

      const pagination = screen.getByTestId("pagination")

      expect(pagination).not.toHaveAttribute("color")
      expect(pagination).not.toHaveAttribute("order")
      expect(pagination).not.toHaveAttribute("maxvisiblepages")
      expect(pagination).not.toHaveAttribute("consolidationplacement")
      expect(pagination).not.toHaveAttribute("isdisabled")
      expect(pagination).not.toHaveAttribute("customclassname")
      expect(pagination).not.toHaveAttribute("customcomponentstyles")
      expect(pagination).not.toHaveAttribute("customgeneralbuttonprops")
      expect(pagination).not.toHaveAttribute("customseparatorclassname")
      expect(pagination).not.toHaveAttribute("customseparatorstyles")
    })

    it("forwards nested PageInput prop objects as component props.", () => {
      render(
        <PaginationExample
          chosenPaginationSubcomponents={["page-input"]}
          customGeneralButtonProps={{ "data-testid": "custom-page-submit-button" }}
          customPageNumberInputFormFieldProps={{ "data-testid": "custom-page-input-field" }}
          customPageNumberInputProps={{ "data-testid": "custom-page-number-input" }}
        />,
      )

      expect(screen.getByTestId("custom-page-submit-button")).toBeInTheDocument()
      expect(screen.getByTestId("custom-page-input-field")).toBeInTheDocument()
      expect(screen.getByTestId("custom-page-number-input")).toBeInTheDocument()
    })

    it("merges overflow popover and options list styling hooks.", async () => {
      const user = userEvent.setup()

      render(
        <PaginationExample
          currentPage={10}
          maxVisiblePages={4}
          customClickPopoverProps={{
            className: "custom-overflow-popover",
            customDialogStyles: { backgroundColor: "tomato" },
          }}
          customOptionsListClassName="custom-overflow-options"
          customOptionsListStyles={{ backgroundColor: "navy" }}
        />,
      )

      await user.click(screen.getAllByTestId("pagination-overflow-trigger")[0])

      const popover = await screen.findByTestId("click-popover")
      const popoverDialog = await screen.findByTestId("click-popover-dialog")
      const optionsList = await screen.findByRole("listbox")

      expect(popover).toHaveClass("custom-overflow-popover")
      expect(popoverDialog).toHaveStyle({ backgroundColor: "rgb(255, 99, 71)" })
      expect(optionsList).toHaveClass("custom-overflow-options")
      expect(optionsList).toHaveStyle({ backgroundColor: "rgb(0, 0, 128)" })
    })

    it("responds to currentPage prop.", () => {
      render(<PaginationExample />)

      expect(document.querySelector("[aria-current='page']")).toHaveTextContent("3")
    })

    it("responds to itemsPerPage prop.", () => {
      render(<PaginationExample chosenPaginationSubcomponents={["items-per-page"]} />)

      const itemsPerPageControl = screen.getByTestId(PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE)
      const triggerButton = within(itemsPerPageControl).getByTestId("button")
      expect(triggerButton).toHaveTextContent(String(DEFAULT_ITEMS_PER_PAGE))
    })

    it("responds to itemsPerPage options prop.", async () => {
      const user = userEvent.setup()
      const itemsPerPageTestItems = [15, 30, 45, 60, 75, 90]

      render(
        <PaginationExample
          itemsPerPageOptions={itemsPerPageTestItems}
          chosenPaginationSubcomponents={["items-per-page", "primary-controls"]}
        />,
      )

      const itemsPerPageControl = screen.getByTestId(PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE)
      const triggerButton = within(itemsPerPageControl).getByTestId("button")

      await user.click(triggerButton)

      const listbox = await screen.findByRole("listbox")
      const options = within(listbox).getAllByRole("option")
      const labels = options.map((option) => Number(option.textContent?.trim()))

      expect(labels).toEqual(itemsPerPageTestItems)
      expect(labels).toHaveLength(itemsPerPageTestItems.length)
    })

    it("responds to maxVisiblePages prop.", () => {
      const assertMaxVisiblePageButtons = (pageNum: number) => {
        const { unmount } = render(<PaginationExample maxVisiblePages={4} currentPage={pageNum} />)

        const pageNumberControls = screen.getByTestId("page-number-controls")
        const slotButtons = Array.from(pageNumberControls.querySelectorAll(":scope > button"))
        const overflowButtons = pageNumberControls.querySelectorAll('[data-testid="pagination-overflow-trigger"]')

        expect(slotButtons).toHaveLength(4 + overflowButtons.length)
        expect(slotButtons.length - overflowButtons.length).toBe(4)

        unmount()
      }

      Array.from({ length: 20 }, (_, index) => index + 1).forEach(assertMaxVisiblePageButtons)
    })

    it("consolidates around current page according to consolidation placement.", () => {
      render(<PaginationExample maxVisiblePages={4} consolidationPlacement="right" currentPage={10} />)

      expectOverflowTriggerCount(2)
      expect(() => getPageButtonPlacementIndex(9)).not.toThrow()
      expect(() => getPageButtonPlacementIndex(11)).toThrow()
      expectOverflowsBetweenPages({ leftPage: 1, rightPage: 9, expectedBetween: 1 })
      expectOverflowsBetweenPages({ leftPage: 10, rightPage: 20, expectedBetween: 1 })

      cleanup()

      render(<PaginationExample maxVisiblePages={4} consolidationPlacement="left" currentPage={10} />)

      expectOverflowTriggerCount(2)
      expect(() => getPageButtonPlacementIndex(11)).not.toThrow()
      expect(() => getPageButtonPlacementIndex(9)).toThrow()
      expectOverflowsBetweenPages({ leftPage: 1, rightPage: 10, expectedBetween: 1 })
      expectOverflowsBetweenPages({ leftPage: 11, rightPage: 20, expectedBetween: 1 })
    })

    it("applies geometry props to pagination buttons.", async () => {
      const user = userEvent.setup()
      const testSubcomponents = [
        "page-counter",
        "page-input",
        "items-per-page",
        "primary-controls",
      ] as (keyof TPaginationSubComponentKeymap)[]

      const baseProps = {
        chosenPaginationSubcomponents: testSubcomponents,
        showFirstPageButton: true,
        showLastPageButton: true,
        numberOfItems: 200,
        itemsPerPage: 10,
        currentPage: 10,
        maxVisiblePages: 4,
      } as Partial<TPaginationProps>

      const getPaginationControls = () => {
        const itemsPerPageSelectTriggerButton = screen.getByTestId("select").querySelector("[data-triggerbtn]")
        const navigateToSelectedPageButton = screen.getByLabelText(/navigate to selected page/iu)
        const firstPageButton = screen.getByLabelText(/first page/iu)
        const previousPageButton = screen.getByLabelText(/previous page/iu)
        const nextPageButton = screen.getByLabelText(/next page/iu)
        const lastPageButton = screen.getByLabelText(/last page/iu)
        const pageNumberButtonExample = screen.getAllByLabelText(/go to page (\d+)/iu)[0]
        const overflowButton = screen.getAllByTestId("pagination-overflow-trigger")[0]

        return {
          itemsPerPageSelectTriggerButton: itemsPerPageSelectTriggerButton as HTMLElement,
          navigateToSelectedPageButton,
          firstPageButton,
          previousPageButton,
          nextPageButton,
          lastPageButton,
          pageNumberButtonExample,
          overflowButton,
        }
      }

      const expectButtonGeometry = (element: HTMLElement, geometry: "rounded" | "round" | "orthogonal") => {
        if (geometry === "rounded") {
          expect(element).toHaveClass(buttonStyles["button--rounded"])
          expect(element).not.toHaveClass(buttonStyles["button--round"])
          return
        }

        if (geometry === "round") {
          expect(element).toHaveClass(buttonStyles["button--round"])
          expect(element).not.toHaveClass(buttonStyles["button--rounded"])
          return
        }

        expect(element).not.toHaveClass(buttonStyles["button--rounded"])
        expect(element).not.toHaveClass(buttonStyles["button--round"])
      }

      const expectGeometryClasses = async (geometry: "rounded" | "round" | "orthogonal") => {
        const controls = getPaginationControls()

        Object.values(controls).forEach((element) => expectButtonGeometry(element, geometry))

        await user.click(controls.overflowButton)
        expect(await screen.findByRole("listbox")).toBeInTheDocument()
      }

      render(<PaginationExample geometry="rounded" {...baseProps} />)
      await expectGeometryClasses("rounded")

      cleanup()
      render(<PaginationExample geometry="round" {...baseProps} />)
      await expectGeometryClasses("round")

      cleanup()
      render(<PaginationExample geometry="orthogonal" {...baseProps} />)
      await expectGeometryClasses("orthogonal")
    })

    it("uses semantic defaults for no-order affordance colors.", () => {
      render(
        <PaginationExample
          currentPage={2}
          numberOfItems={50}
          itemsPerPage={10}
          showFirstPageButton
          chosenPaginationSubcomponents={["page-counter", "primary-controls"]}
          customSeparatorClassName="semantic-pagination-separator"
        />,
      )

      const separator = document.querySelector(".semantic-pagination-separator") as HTMLElement

      expect(screen.getByTestId("left-icon")).toHaveAttribute("stroke", "currentColor")
      expect(separator).toHaveStyle({ backgroundColor: "var(--cui-border)" })
    })

    it("resolves outline order icon colors through registry CSS variables.", () => {
      render(
        <PaginationExample
          buttonColorMode="outline"
          chosenPaginationSubcomponents={["primary-controls"]}
          currentPage={2}
          itemsPerPage={10}
          numberOfItems={50}
          order="primary"
        />,
      )

      expect(screen.getByTestId("left-icon")).toHaveAttribute("stroke", "var(--cui-color-primary-500)")
    })

    it("responds to custom text props.", () => {
      render(
        <PaginationExample
          showFirstPageButton
          showLastPageButton
          firstPageLabel="First Page"
          prevPageLabel="Previous Page"
          nextPageLabel="Next Page"
          lastPageLabel="Last Page"
          counterText="Total Pages"
          pageInputLabel="Go to Page <X>"
          pageInputSelectionButtonText="Go To Chosen Page"
          itemsPerPageLabel="Items Displayed Per Page"
          itemsPerPageSelectPlaceholder="Items/Page Placeholder"
          chosenPaginationSubcomponents={["page-counter", "page-input", "items-per-page", "primary-controls"]}
        />,
      )

      expect(screen.getByLabelText(/first page/iu)).toBeInTheDocument()
      expect(screen.getByLabelText(/previous page/iu)).toBeInTheDocument()
      expect(screen.getByLabelText(/next page/iu)).toBeInTheDocument()
      expect(screen.getByLabelText(/last page/iu)).toBeInTheDocument()
      expect(screen.getByText(/total pages/iu)).toBeInTheDocument()
      expect(screen.getByLabelText(/go to page <x>/iu)).toBeInTheDocument()
      expect(screen.getByText(/go to chosen page/iu)).toBeInTheDocument()
      expect(screen.getByLabelText(/items displayed per page/iu)).toBeInTheDocument()
    })

    it("supplies grouped labels through its subcomponents.", async () => {
      const user = userEvent.setup()
      const labels = {
        root: {
          navigationAriaLabel: "Localized pagination navigation",
        },
        primaryControls: {
          firstPageButton: "Start",
          firstPageButtonAriaLabel: "Go to first localized page",
          previousPageButton: "Back",
          previousPageButtonAriaLabel: "Go to previous localized page",
          nextPageButton: "Forward",
          nextPageButtonAriaLabel: "Go to next localized page",
          lastPageButton: "End",
          lastPageButtonAriaLabel: "Go to last localized page",
          pageButtonAriaLabel: (pageNum: number) => `Open localized page ${pageNum}`,
          overflowButtonAriaLabel: "Open localized hidden pages",
          overflowListAriaLabel: (position: number) => `Localized hidden page group ${position}`,
        },
        pageCounter: {
          counterText: "Localized pages",
          ariaLabel: "Localized page counter",
        },
        pageInput: {
          label: "Localized page chooser",
          placeholder: "Page number",
          submitButtonText: "Jump",
          submitButtonAriaLabel: "Jump to localized page",
          numberInput: {
            inputButtonGroupAriaLabel: "Localized page input controls",
          },
        },
        itemsPerPage: {
          label: "Localized rows per page",
          placeholder: "Rows/page",
        },
      } satisfies TPartialPaginationLabels

      render(
        <PaginationExample
          currentPage={10}
          maxVisiblePages={4}
          showFirstPageButton
          showLastPageButton
          labels={labels}
          chosenPaginationSubcomponents={["page-counter", "page-input", "items-per-page", "primary-controls"]}
        />,
      )

      expect(screen.getByRole("navigation", { name: "Localized pagination navigation" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Go to first localized page" })).toHaveTextContent("Start")
      expect(screen.getByRole("button", { name: "Go to previous localized page" })).toHaveTextContent("Back")
      expect(screen.getByRole("button", { name: "Go to next localized page" })).toHaveTextContent("Forward")
      expect(screen.getByRole("button", { name: "Go to last localized page" })).toHaveTextContent("End")
      expect(screen.getByTestId("counter")).toHaveAccessibleName("Localized page counter")
      expect(screen.getByText("Localized pages")).toBeInTheDocument()
      expect(screen.getByLabelText("Localized page chooser")).toHaveAttribute("placeholder", "Page number")
      expect(screen.getByRole("group", { name: "Localized page input controls" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Jump to localized page" })).toHaveTextContent("Jump")
      expect(screen.getByLabelText("Localized rows per page")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Open localized page 10" })).toHaveAttribute("aria-current", "page")

      await user.click(screen.getAllByRole("button", { name: "Open localized hidden pages" })[0])

      const overflowList = await screen.findByRole("listbox", { name: /localized hidden page group/iu })
      const overflowOption = within(overflowList).getAllByRole("option")[0]
      expect(overflowOption).toHaveAccessibleName(/open localized page \d+/iu)
    })

    it("responds to custom icon props.", () => {
      render(
        <PaginationExample
          currentPage={1}
          incrementAllDownIcon={<TestIcon label="all-down" />}
          incrementDownIcon={<TestIcon label="down" />}
          incrementUpIcon={<TestIcon label="up" />}
          incrementAllUpIcon={<TestIcon label="all-up" />}
          overflowItemsButtonIcon={<TestIcon label="overflow" />}
          chosenPaginationSubcomponents={["primary-controls"]}
          showFirstPageButton
          showLastPageButton
        />,
      )

      expect(screen.getByTestId("first-page-btn-icon")).toBeInTheDocument()
      expect(screen.getByTestId("prev-page-btn-icon")).toBeInTheDocument()
      expect(screen.getByTestId("next-page-btn-icon")).toBeInTheDocument()
      expect(screen.getByTestId("last-page-btn-icon")).toBeInTheDocument()
      expect(screen.getByTestId("overflow-items-btn-icon")).toBeInTheDocument()
      expect(screen.getByTestId("test-all-down-icon")).toBeInTheDocument()
      expect(screen.getByTestId("test-down-icon")).toBeInTheDocument()
      expect(screen.getByTestId("test-up-icon")).toBeInTheDocument()
      expect(screen.getByTestId("test-all-up-icon")).toBeInTheDocument()
      expect(screen.getByTestId("test-overflow-icon")).toBeInTheDocument()
    })

    it("showWithOnePage toggles rendering when numberOfItems <= itemsPerPage.", () => {
      const { rerender } = render(<PaginationExample showWithOnePage={true} itemsPerPage={10} numberOfItems={5} />)

      expect(screen.getByRole("navigation", { name: /pagination navigation/iu })).toBeInTheDocument()

      rerender(<PaginationExample showWithOnePage={false} itemsPerPage={10} numberOfItems={5} />)

      expect(screen.queryByRole("navigation", { name: /pagination navigation/iu })).not.toBeInTheDocument()
    })

    it("supports explicit subcomponent combinations.", () => {
      render(<PaginationExample />)
      expectOnlyTheseSubcomponents(["primary-controls"])

      cleanup()
      render(<PaginationExample chosenPaginationSubcomponents={[]} />)
      expectOnlyTheseSubcomponents(["primary-controls"])

      cleanup()
      const chosen: TPaginationSubComponent[] = ["page-counter", "items-per-page", "primary-controls"]
      render(<PaginationExample chosenPaginationSubcomponents={chosen} />)
      expectOnlyTheseSubcomponents(chosen)
    })
  })

  describe("user actions", () => {
    it("clicking the current page does not navigate.", async () => {
      const user = userEvent.setup()
      render(<PaginationExample />)

      const current = getCurrentPageButton()
      expect(current).toHaveTextContent("3")

      await user.click(current)

      expect(setCurrentPage).not.toHaveBeenCalled()
      expect(getCurrentPageButton()).toHaveTextContent("3")
    })

    it("clicking a different page navigates to that page.", async () => {
      const user = userEvent.setup()
      render(<PaginationExample />)

      await clickGoToPage(user, 5)

      expect(setCurrentPage).toHaveBeenCalledTimes(1)
      expect(setCurrentPage).toHaveBeenCalledWith(5)
    })

    it("clicking increment buttons navigates to expected pages.", async () => {
      const user = userEvent.setup()
      const { rerender } = render(<PaginationExample showFirstPageButton showLastPageButton />)

      await user.click(screen.getByRole("button", { name: /first page/iu }))
      expect(setCurrentPage).toHaveBeenLastCalledWith(1)

      await user.click(screen.getByRole("button", { name: /previous page/iu }))
      expect(setCurrentPage).toHaveBeenLastCalledWith(2)

      await user.click(screen.getByRole("button", { name: /next page/iu }))
      expect(setCurrentPage).toHaveBeenLastCalledWith(4)

      await user.click(screen.getByRole("button", { name: /last page/iu }))
      expect(setCurrentPage).toHaveBeenLastCalledWith(20)

      rerender(<PaginationExample />)
    })

    it("selecting a different items-per-page value updates itemsPerPage.", async () => {
      const user = userEvent.setup()
      render(<PaginationExample chosenPaginationSubcomponents={["items-per-page", "primary-controls"]} />)

      const trigger = within(screen.getByTestId(PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE)).getByLabelText(
        /items per page/iu,
      )
      await user.click(trigger)
      await user.click(screen.getByRole("option", { name: /^50$/u }))

      expect(setItemsPerPage).toHaveBeenCalledTimes(1)
      expect(setItemsPerPage).toHaveBeenCalledWith(50)
    })

    it("disables previous and next navigation at range boundaries.", async () => {
      const user = userEvent.setup()
      const { rerender } = render(<PaginationExample currentPage={1} />)

      const previous = screen.getByRole("button", { name: /previous page/iu })
      expect(previous).toBeDisabled()

      await user.click(previous)
      expect(setCurrentPage).not.toHaveBeenCalled()

      rerender(<PaginationExample currentPage={20} />)

      const next = screen.getByRole("button", { name: /next page/iu })
      expect(next).toBeDisabled()

      await user.click(next)
      expect(setCurrentPage).not.toHaveBeenCalled()
    })

    it("selecting an item from a consolidated overflow list navigates.", async () => {
      const user = userEvent.setup()
      render(<PaginationExample currentPage={10} itemsPerPage={10} numberOfItems={200} maxVisiblePages={5} />)

      const triggers = screen.getAllByTestId("pagination-overflow-trigger")
      expect(triggers.length).toBeGreaterThan(0)

      await user.click(triggers[0])

      const options = screen.getAllByRole("option")
      expect(options.length).toBeGreaterThan(0)

      await user.click(options[0])
      expect(setCurrentPage).toHaveBeenCalled()
    })
  })
})
