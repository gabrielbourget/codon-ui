import { render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import inputStyles from "../../../Input/InputStyles.module.css"
import placeholderTextStyles from "../../../Text/variants/PlaceholderText/PlaceholderTextStyles.module.css"
import {
  TYPEAHEAD_SEARCH_STATUS__EMPTY,
  TYPEAHEAD_SEARCH_STATUS__ERROR,
  TYPEAHEAD_SEARCH_STATUS__IDLE,
  TYPEAHEAD_SEARCH_STATUS__LOADING,
  TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY,
  TYPEAHEAD_SEARCH_STATUS__RESULTS,
} from "../status"
import TypeaheadSearch from "../TypeaheadSearch"
import styles from "../TypeaheadSearchStyles.module.css"

type TTypeaheadSearchTestItem = {
  id: string
  name: string
}

const testItems: TTypeaheadSearchTestItem[] = [
  { id: "alpha-wave", name: "Alpha Wave" },
  { id: "beta-drift", name: "Beta Drift" },
]

const TypeaheadSearchInputExample = ({
  onInputChangeSpy,
  onSubmitQuery,
}: {
  onInputChangeSpy: (value: string) => void
  onSubmitQuery: (query: string) => void
}) => {
  const [query, setQuery] = useState("")

  return (
    <TypeaheadSearch
      aria-label="Search artists"
      inputValue={query}
      onInputChange={(value) => {
        onInputChangeSpy(value)
        setQuery(value)
      }}
      onSubmitQuery={onSubmitQuery}
      searchButtonAriaLabel="Submit search"
      status={TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY}
    />
  )
}

describe("<TypeaheadSearch />", () => {
  it("renders an input and style-configurable results container.", () => {
    render(
      <TypeaheadSearch
        aria-label="Search artists"
        items={testItems}
        inputValue=""
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY}
        minimumInputLength={2}
        customClassName="test-typeahead-shell"
        customResultsContainerStyles={{ height: 320, maxHeight: 320 }}
      />,
    )

    expect(screen.getByTestId("typeahead-search")).toHaveClass("test-typeahead-shell")
    expect(screen.getByLabelText("Search artists")).toBeInTheDocument()
    expect(screen.getByTestId("typeahead-search-minimum-query-state")).toHaveTextContent(
      "Enter at least 2 characters to search",
    )
    const resultsContainer = screen.getByTestId("typeahead-search-minimum-query-state").parentElement as HTMLElement

    expect(resultsContainer).toHaveStyle({
      height: "320px",
      maxHeight: "320px",
    })
    expect(screen.getByTestId("typeahead-search-input")).toHaveClass(inputStyles["input--noFocusStyle"])
  })

  it("merges native className and style without losing computed root styles.", () => {
    render(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue=""
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY}
        customClassName="legacy-typeahead-class"
        customStyles={{ color: "turquoise", marginTop: 5 }}
        className="native-typeahead-class"
        style={{ color: "tomato", marginBottom: 10 }}
      />,
    )

    const typeaheadSearch = screen.getByTestId("typeahead-search")

    expect(typeaheadSearch).toHaveClass(styles.typeaheadSearch)
    expect(typeaheadSearch).toHaveClass("legacy-typeahead-class")
    expect(typeaheadSearch).toHaveClass("native-typeahead-class")
    expect(typeaheadSearch).toHaveStyle({
      color: "rgb(255, 99, 71)",
      marginTop: "5px",
      marginBottom: "10px",
    })
  })

  it("forwards slot styles without losing computed slot classes.", () => {
    render(
      <TypeaheadSearch
        aria-label="Search artists"
        items={testItems}
        inputValue="alpha"
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__RESULTS}
        customInputRowStyles={{ backgroundColor: "pink" }}
        customInputStyles={{ paddingLeft: 15 }}
        customSearchButtonStyles={{ height: 35 }}
        customResultsContainerStyles={{ marginTop: 5 }}
        customResultsListStyles={{ gap: 15 }}
      />,
    )

    const input = screen.getByTestId("typeahead-search-input")
    const inputRow = input.closest(`.${styles.typeaheadSearch__inputRow}`) as HTMLElement
    const searchButton = screen.getByTestId("typeahead-search-button")
    const resultsList = screen.getByRole("listbox", { name: "Search results" })
    const resultsContainer = resultsList.parentElement as HTMLElement

    expect(inputRow).toHaveClass(styles.typeaheadSearch__inputRow)
    expect(inputRow).toHaveStyle({ backgroundColor: "rgb(255, 192, 203)" })
    expect(input).toHaveClass(styles.typeaheadSearch__input)
    expect(input).toHaveStyle({ paddingLeft: "15px" })
    expect(searchButton).toHaveClass(styles.typeaheadSearch__searchButton)
    expect(searchButton).toHaveStyle({ height: "35px" })
    expect(resultsContainer).toHaveClass(styles.typeaheadSearch__resultsContainer)
    expect(resultsContainer).toHaveStyle({ marginTop: "5px" })
    expect(resultsList).toHaveClass(styles.typeaheadSearch__resultsList)
    expect(resultsList).toHaveStyle({ gap: "15px" })
  })

  it("responds to canonical disabled prop.", () => {
    render(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue=""
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY}
        isDisabled
      />,
    )

    expect(screen.getByTestId("typeahead-search")).toHaveAttribute("data-disabled", "true")
    expect(screen.getByTestId("typeahead-search-input")).toBeDisabled()
    expect(screen.getByTestId("typeahead-search-button")).toHaveAttribute("data-disabled", "true")
  })

  it("does not leak wrapper props onto the root element.", () => {
    render(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue=""
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__MINIMUM_QUERY}
        minimumInputLength={2}
        idleMessage="Idle"
        minimumInputLengthMessage="Minimum"
        loadingMessage="Loading"
        emptyListMessage="Empty"
        errorMessage="Error"
        searchButtonAriaLabel="Search"
        labels={{ resultsListAriaLabel: "Results" }}
        shouldAutoFocusInput
        shouldFocusWrap={false}
        geometry="round"
        SearchIcon={<span data-testid="custom-search-icon">S</span>}
        LoadingIndicator={<span data-testid="custom-loading-indicator">L</span>}
        getItemKey={(item: TTypeaheadSearchTestItem) => item.id}
        getItemTextValue={(item: TTypeaheadSearchTestItem) => item.name}
        renderItem={(item) => item.name}
        onSelectionChange={vi.fn()}
        onSubmitQuery={vi.fn()}
        customClassName="legacy-typeahead-class"
        customStyles={{ marginTop: 5 }}
        customInputRowStyles={{ marginTop: 5 }}
        customInputStyles={{ marginTop: 5 }}
        customSearchButtonStyles={{ marginTop: 5 }}
        customResultsContainerStyles={{ marginTop: 5 }}
        customResultsListStyles={{ marginTop: 5 }}
      />,
    )

    const typeaheadSearch = screen.getByTestId("typeahead-search")

    expect(typeaheadSearch).not.toHaveAttribute("status")
    expect(typeaheadSearch).not.toHaveAttribute("minimuminputlength")
    expect(typeaheadSearch).not.toHaveAttribute("idlemessage")
    expect(typeaheadSearch).not.toHaveAttribute("minimuminputlengthmessage")
    expect(typeaheadSearch).not.toHaveAttribute("loadingmessage")
    expect(typeaheadSearch).not.toHaveAttribute("emptylistmessage")
    expect(typeaheadSearch).not.toHaveAttribute("errormessage")
    expect(typeaheadSearch).not.toHaveAttribute("searchbuttonarialabel")
    expect(typeaheadSearch).not.toHaveAttribute("labels")
    expect(typeaheadSearch).not.toHaveAttribute("shouldautofocusinput")
    expect(typeaheadSearch).not.toHaveAttribute("shouldfocuswrap")
    expect(typeaheadSearch).not.toHaveAttribute("geometry")
    expect(typeaheadSearch).not.toHaveAttribute("searchicon")
    expect(typeaheadSearch).not.toHaveAttribute("loadingindicator")
    expect(typeaheadSearch).not.toHaveAttribute("getitemkey")
    expect(typeaheadSearch).not.toHaveAttribute("getitemtextvalue")
    expect(typeaheadSearch).not.toHaveAttribute("renderitem")
    expect(typeaheadSearch).not.toHaveAttribute("onsubmitquery")
    expect(typeaheadSearch).not.toHaveAttribute("customclassname")
    expect(typeaheadSearch).not.toHaveAttribute("customstyles")
    expect(typeaheadSearch).not.toHaveAttribute("custominputrowstyles")
    expect(typeaheadSearch).not.toHaveAttribute("custominputstyles")
    expect(typeaheadSearch).not.toHaveAttribute("customsearchbuttonstyles")
    expect(typeaheadSearch).not.toHaveAttribute("customresultscontainerstyles")
    expect(typeaheadSearch).not.toHaveAttribute("customresultsliststyles")
  })

  it("emits input changes and query submission.", async () => {
    const user = userEvent.setup()
    const onInputChange = vi.fn()
    const onSubmitQuery = vi.fn()

    render(<TypeaheadSearchInputExample onInputChangeSpy={onInputChange} onSubmitQuery={onSubmitQuery} />)

    await user.type(screen.getByLabelText("Search artists"), "alpha")
    await user.click(screen.getByRole("button", { name: "Submit search" }))

    expect(onInputChange).toHaveBeenLastCalledWith("alpha")
    expect(onSubmitQuery).toHaveBeenCalledWith("alpha")
  })

  it("submits the trimmed controlled query on enter.", async () => {
    const user = userEvent.setup()
    const onSubmitQuery = vi.fn()

    render(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue="  alpha  "
        onInputChange={vi.fn()}
        onSubmitQuery={onSubmitQuery}
        status={TYPEAHEAD_SEARCH_STATUS__RESULTS}
      />,
    )

    await user.type(screen.getByLabelText("Search artists"), "{Enter}")

    expect(onSubmitQuery).toHaveBeenCalledWith("alpha")
  })

  it("renders status states.", () => {
    const { rerender } = render(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue=""
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__IDLE}
        idleMessage="Start typing to search"
      />,
    )

    expect(screen.getByTestId("typeahead-search-idle-state")).toHaveTextContent("Start typing to search")
    expect(screen.getByText("Start typing to search")).toHaveClass(placeholderTextStyles.placeholderText)

    rerender(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue="al"
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__LOADING}
        loadingMessage="Searching..."
      />,
    )

    expect(screen.getByTestId("typeahead-search-loading-state")).toHaveTextContent("Searching...")

    rerender(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue="al"
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__EMPTY}
        emptyListMessage="Nothing matched"
      />,
    )
    expect(screen.getByTestId("typeahead-search-empty-state")).toHaveTextContent("Nothing matched")

    rerender(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue="al"
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__ERROR}
        errorMessage="Search failed"
      />,
    )
    expect(screen.getByTestId("typeahead-search-error-state")).toHaveTextContent("Search failed")
  })

  it("owns its default search and loading affordances.", () => {
    render(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue="al"
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__LOADING}
        loadingMessage="Searching..."
      />,
    )

    expect(screen.getByTestId("typeahead-search-button")).toContainElement(
      screen.getByTestId("typeahead-search-default-search-icon"),
    )
    expect(screen.getByTestId("typeahead-search-loading-state")).toContainElement(
      screen.getByTestId("typeahead-search-default-loading-indicator"),
    )
  })

  it("preserves custom search and loading affordance overrides.", () => {
    render(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue="al"
        onInputChange={vi.fn()}
        status={TYPEAHEAD_SEARCH_STATUS__LOADING}
        SearchIcon={<span data-testid="custom-typeahead-search-icon">S</span>}
        LoadingIndicator={<span data-testid="custom-typeahead-loading-indicator">Loading</span>}
      />,
    )

    expect(screen.getByTestId("typeahead-search-button")).toContainElement(
      screen.getByTestId("custom-typeahead-search-icon"),
    )
    expect(screen.getByTestId("typeahead-search-loading-state")).toContainElement(
      screen.getByTestId("custom-typeahead-loading-indicator"),
    )
    expect(screen.queryByTestId("typeahead-search-default-search-icon")).toBeNull()
    expect(screen.queryByTestId("typeahead-search-default-loading-indicator")).toBeNull()
  })

  it("accepts a grouped labels map.", () => {
    render(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue="alpha"
        onInputChange={vi.fn()}
        items={testItems}
        status={TYPEAHEAD_SEARCH_STATUS__RESULTS}
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.name}
        labels={{
          searchButtonAriaLabel: "Run localized search",
          resultsListAriaLabel: "Localized search results",
        }}
      />,
    )

    expect(screen.getByRole("button", { name: "Run localized search" })).toBeVisible()
    expect(screen.getByRole("listbox", { name: "Localized search results" })).toBeVisible()
  })

  it("renders result rows and emits selection changes.", async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()

    render(
      <TypeaheadSearch
        aria-label="Search artists"
        inputValue="alpha"
        onInputChange={vi.fn()}
        items={testItems}
        status={TYPEAHEAD_SEARCH_STATUS__RESULTS}
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.name}
        renderItem={(item, args) => <span data-testid={`result-${item.id}`}>{`${item.name} | ${args.query}`}</span>}
        onSelectionChange={onSelectionChange}
      />,
    )

    const listBox = screen.getByRole("listbox", { name: "Search results" })

    expect(within(listBox).getByTestId("result-alpha-wave")).toHaveTextContent("Alpha Wave | alpha")

    await user.click(within(listBox).getByText("Alpha Wave | alpha"))

    expect(onSelectionChange).toHaveBeenCalledWith("alpha-wave")
  })
})
