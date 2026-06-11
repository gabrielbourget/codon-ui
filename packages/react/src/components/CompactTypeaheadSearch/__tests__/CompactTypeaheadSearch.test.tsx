import { render, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { describe, expect, it, vi } from "vitest"

import textStyles from "../../Text/TextStyles.module.css"
import CompactTypeaheadSearch from "../CompactTypeaheadSearch"
import styles from "../CompactTypeaheadSearchStyles.module.css"
import {
  TYPE_AHEAD_SEARCH_SIZE__LG,
  TYPE_AHEAD_SEARCH_SIZE__MD,
  TYPE_AHEAD_SEARCH_SIZE__SM,
  type TCompactTypeaheadSearchProps,
} from "../helpers"

type TCompactTypeaheadSearchTestItem = {
  id: string
  name: string
}

type TCompactTypeaheadSearchExampleProps = Partial<TCompactTypeaheadSearchProps<TCompactTypeaheadSearchTestItem>> & {
  onChangeSpy?: (key: string | number | null) => void
}

const testItems: TCompactTypeaheadSearchTestItem[] = [
  { id: "alpha-wave", name: "Alpha Wave" },
  { id: "beta-drift", name: "Beta Drift" },
  { id: "gamma-tide", name: "Gamma Tide" },
]

const CompactTypeaheadSearchExample = (props: TCompactTypeaheadSearchExampleProps = {}) => {
  const { onChangeSpy, ...rest } = props
  const [selectedKey, setSelectedKey] = useState<string | number | null>(null)

  return (
    <CompactTypeaheadSearch
      aria-label="CompactTypeaheadSearch"
      items={testItems}
      value={selectedKey}
      onChange={(key) => {
        onChangeSpy?.(key as string | number | null)
        setSelectedKey(key as string | number | null)
      }}
      {...rest}
    />
  )
}

const ControlledRenderItemCompactTypeaheadSearchExample = () => {
  const [query, setQuery] = useState("")
  const controlledItems =
    query.length >= 2 ? testItems.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())) : []

  return (
    <CompactTypeaheadSearch
      aria-label="Controlled RenderItem CompactTypeaheadSearch"
      inputValue={query}
      onInputChange={setQuery}
      items={controlledItems}
      minimumInputLength={2}
      getItemKey={(item) => item.id}
      getItemTextValue={(item) => item.name}
      renderItem={(item, args) => (
        <span
          data-testid={`render-item-result-${item.id}`}
        >{`${item.name} | ${args.query} | ${String(args.itemKey)}`}</span>
      )}
    />
  )
}

const LoadingStateCompactTypeaheadSearchExample = (
  props: Partial<TCompactTypeaheadSearchProps<TCompactTypeaheadSearchTestItem>> = {},
) => {
  const [query, setQuery] = useState("")

  return (
    <CompactTypeaheadSearch
      aria-label="Loading State CompactTypeaheadSearch"
      inputValue={query}
      onInputChange={setQuery}
      items={[]}
      isLoading={query.length >= 2}
      minimumInputLength={2}
      {...props}
    />
  )
}

const ClearOnSelectionControlledCompactTypeaheadSearchExample = () => {
  const [query, setQuery] = useState("")
  const [value, setValue] = useState<string | number | null>(null)

  const controlledItems =
    query.length >= 2 ? testItems.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())) : []

  return (
    <CompactTypeaheadSearch
      aria-label="Clear On Selection Controlled CompactTypeaheadSearch"
      inputValue={query}
      onInputChange={setQuery}
      items={controlledItems}
      value={value}
      minimumInputLength={2}
      getItemKey={(item) => item.id}
      getItemTextValue={(item) => item.name}
      onChange={(key) => {
        setValue(key as string | number | null)
        setQuery("")
      }}
    />
  )
}

const getInputButtonGroup = () => screen.getByRole("group", { name: "CompactTypeaheadSearch Input Button Group" })

const getRenderedElementsByTestId = (testID: string) =>
  screen.queryAllByTestId(testID).filter((element) => element.closest("template") == null)

const getRenderedElementsByRole = (role: string) =>
  screen.queryAllByRole(role).filter((element) => element.closest("template") == null)

const getVisibleByTestId = (testID: string) => getRenderedElementsByTestId(testID).at(-1) as HTMLElement

const renderCompactTypeaheadSearchWithOutsideFocusTarget = (ui: ReactNode) => {
  return render(
    <>
      {ui}
      <button type="button" data-testid="outside-focus-target">
        Outside Focus Target
      </button>
    </>,
  )
}

describe("<CompactTypeaheadSearch />", () => {
  it("renders.", () => {
    render(<CompactTypeaheadSearchExample />)

    expect(screen.getByTestId("type-ahead-search")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("stretches to the width of its parent container by default.", () => {
      render(<CompactTypeaheadSearchExample />)

      expect(screen.getByTestId("type-ahead-search")).toHaveStyle({ width: "100%" })
      expect(getInputButtonGroup()).toHaveStyle({ width: "100%" })
    })

    it("responds to height and width props.", () => {
      render(<CompactTypeaheadSearchExample height={50} width={150} />)
      const typeAheadSearch = screen.getByTestId("type-ahead-search")

      expect(typeAheadSearch).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color prop.", () => {
      render(<CompactTypeaheadSearchExample color="turquoise" />)

      expect(getInputButtonGroup()).toHaveStyle({ color: "rgb(64, 224, 208)" })
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<CompactTypeaheadSearchExample geometry="rounded" />)
      const inputButtonGroup = getInputButtonGroup()

      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--rounded"])

      rerender(<CompactTypeaheadSearchExample geometry="round" />)
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--round"])

      rerender(<CompactTypeaheadSearchExample geometry="orthogonal" />)
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--rounded"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--round"])
    })

    it("responds to text size props.", () => {
      const { rerender } = render(<CompactTypeaheadSearchExample textSize={TYPE_AHEAD_SEARCH_SIZE__SM} />)
      const input = screen.getByTestId("type-ahead-search-input")

      expect(input).toHaveClass(textStyles.b11)

      rerender(<CompactTypeaheadSearchExample textSize={TYPE_AHEAD_SEARCH_SIZE__MD} />)
      expect(input).toHaveClass(textStyles.b10)

      rerender(<CompactTypeaheadSearchExample textSize={TYPE_AHEAD_SEARCH_SIZE__LG} />)
      expect(input).toHaveClass(textStyles.b9)
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<CompactTypeaheadSearchExample />)
      const inputButtonGroup = getInputButtonGroup()

      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--applyFocusStyle"])
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--offsetFocusRing"])

      rerender(<CompactTypeaheadSearchExample enableFocusStyle={false} offsetFocusRing={false} />)
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--applyFocusStyle"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<CompactTypeaheadSearchExample isDisabled />)

      expect(screen.getByTestId("type-ahead-search")).toHaveAttribute("data-disabled", "true")
    })

    it("responds to isOpen prop.", () => {
      render(<CompactTypeaheadSearchExample isOpen={false} />)

      expect(screen.queryByRole("option", { name: "Alpha Wave" })).toBeNull()
    })

    it("responds to form element status props.", () => {
      const { rerender } = render(<CompactTypeaheadSearchExample errorState />)
      const inputButtonGroup = getInputButtonGroup()

      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--errorState"])

      rerender(<CompactTypeaheadSearchExample warningState />)
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--warningState"])

      rerender(<CompactTypeaheadSearchExample successState />)
      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      render(<CompactTypeaheadSearchExample errorState warningState successState />)
      const inputButtonGroup = getInputButtonGroup()

      expect(inputButtonGroup).toHaveClass(styles["inputButtonGroup--errorState"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--warningState"])
      expect(inputButtonGroup).not.toHaveClass(styles["inputButtonGroup--successState"])
    })

    it("responds to custom style props.", () => {
      render(
        <CompactTypeaheadSearchExample
          customStyles={{ color: "turquoise", borderRadius: 0 }}
          customInputButtonGroupStyles={{ backgroundColor: "orange" }}
          customButtonStyles={{ borderRadius: 6 }}
          customInputStyles={{ backgroundColor: "green" }}
        />,
      )

      const typeAheadSearch = screen.getByTestId("type-ahead-search")
      const inputButtonGroup = getInputButtonGroup()
      const input = screen.getByTestId("type-ahead-search-input")
      const button = screen.getByTestId("type-ahead-search-button")

      expect(typeAheadSearch).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
      expect(inputButtonGroup).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(input).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
      expect(button).toHaveStyle({ borderRadius: "6px" })
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <CompactTypeaheadSearchExample
          height={50}
          width={150}
          color="turquoise"
          customStyles={{ marginTop: 5 }}
          className="native-compact-typeahead-class"
          style={{ color: "tomato", width: 175, marginBottom: 10 }}
        />,
      )

      const typeAheadSearch = screen.getByTestId("type-ahead-search")

      expect(typeAheadSearch).toHaveClass(styles.typeAheadSearch)
      expect(typeAheadSearch).toHaveClass("native-compact-typeahead-class")
      expect(typeAheadSearch).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("merges render-prop className and style without losing computed root values.", () => {
      render(
        <CompactTypeaheadSearchExample
          height={50}
          width={150}
          color="turquoise"
          customStyles={{ marginTop: 5 }}
          className={() => "render-prop-compact-typeahead-class"}
          style={() => ({ color: "tomato", width: 175, marginBottom: 10 })}
        />,
      )

      const typeAheadSearch = screen.getByTestId("type-ahead-search")

      expect(typeAheadSearch).toHaveClass(styles.typeAheadSearch)
      expect(typeAheadSearch).toHaveClass("render-prop-compact-typeahead-class")
      expect(typeAheadSearch).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <CompactTypeaheadSearchExample
          height={50}
          width={150}
          color="turquoise"
          textSize={TYPE_AHEAD_SEARCH_SIZE__SM}
          geometry="round"
          placement="top"
          enableFocusStyle={false}
          offsetFocusRing={false}
          errorState
          warningState
          successState
          isOpen={false}
          isDisabled={false}
          isLoading
          emptyListMessage="Nothing here"
          loadingMessage="Loading"
          minimumInputLength={2}
          minimumInputLengthMessage="Need more"
          labels={{ searchButtonAriaLabel: "Search" }}
          shouldFocusWrap={false}
          rtl
          SearchIcon={<span data-testid="custom-search-icon">S</span>}
          LoadingIndicator={<span data-testid="custom-loading-indicator">L</span>}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.name}
          renderItem={(item) => item.name}
          customStyles={{ marginTop: 5 }}
          customInputStyles={{ marginTop: 5 }}
          customButtonStyles={{ marginTop: 5 }}
          customInputButtonGroupStyles={{ marginTop: 5 }}
          customOptionsListStyles={{ marginTop: 5 }}
        />,
      )

      const typeAheadSearch = screen.getByTestId("type-ahead-search")

      expect(typeAheadSearch).not.toHaveAttribute("height")
      expect(typeAheadSearch).not.toHaveAttribute("width")
      expect(typeAheadSearch).not.toHaveAttribute("color")
      expect(typeAheadSearch).not.toHaveAttribute("textsize")
      expect(typeAheadSearch).not.toHaveAttribute("geometry")
      expect(typeAheadSearch).not.toHaveAttribute("placement")
      expect(typeAheadSearch).not.toHaveAttribute("enablefocusstyle")
      expect(typeAheadSearch).not.toHaveAttribute("offsetfocusring")
      expect(typeAheadSearch).not.toHaveAttribute("errorstate")
      expect(typeAheadSearch).not.toHaveAttribute("warningstate")
      expect(typeAheadSearch).not.toHaveAttribute("successstate")
      expect(typeAheadSearch).not.toHaveAttribute("isopen")
      expect(typeAheadSearch).not.toHaveAttribute("isdisabled")
      expect(typeAheadSearch).not.toHaveAttribute("isloading")
      expect(typeAheadSearch).not.toHaveAttribute("emptylistmessage")
      expect(typeAheadSearch).not.toHaveAttribute("loadingmessage")
      expect(typeAheadSearch).not.toHaveAttribute("minimuminputlength")
      expect(typeAheadSearch).not.toHaveAttribute("minimuminputlengthmessage")
      expect(typeAheadSearch).not.toHaveAttribute("labels")
      expect(typeAheadSearch).not.toHaveAttribute("shouldfocuswrap")
      expect(typeAheadSearch).not.toHaveAttribute("searchicon")
      expect(typeAheadSearch).not.toHaveAttribute("loadingindicator")
      expect(typeAheadSearch).not.toHaveAttribute("getitemkey")
      expect(typeAheadSearch).not.toHaveAttribute("getitemtextvalue")
      expect(typeAheadSearch).not.toHaveAttribute("renderitem")
      expect(typeAheadSearch).not.toHaveAttribute("customstyles")
      expect(typeAheadSearch).not.toHaveAttribute("custominputstyles")
      expect(typeAheadSearch).not.toHaveAttribute("custombuttonstyles")
      expect(typeAheadSearch).not.toHaveAttribute("custominputbuttongroupstyles")
      expect(typeAheadSearch).not.toHaveAttribute("customoptionsliststyles")
    })

    it("responds to rtl and custom search icon props.", () => {
      render(<CompactTypeaheadSearchExample rtl SearchIcon={<span data-testid="custom-search-icon">S</span>} />)

      const typeAheadSearch = screen.getByTestId("type-ahead-search")
      const searchButton = screen.getByTestId("type-ahead-search-button")

      expect(typeAheadSearch).toHaveAttribute("dir", "rtl")
      expect(searchButton).toContainElement(screen.getByTestId("custom-search-icon"))
    })

    it("owns its default search affordance.", () => {
      render(<CompactTypeaheadSearchExample />)

      expect(screen.getByTestId("type-ahead-search-button")).toContainElement(
        screen.getByTestId("type-ahead-search-default-search-icon"),
      )
    })

    it("accepts a grouped labels map.", async () => {
      const user = userEvent.setup()
      render(
        <CompactTypeaheadSearchExample
          minimumInputLength={3}
          labels={{
            inputButtonGroupAriaLabel: "Localized compact search controls",
            searchButtonAriaLabel: "Run compact search",
            suggestionsListAriaLabel: "Localized suggestions",
            status: {
              minimumInputLengthMessage: ({ minimumInputLength }) => `Need ${minimumInputLength} characters`,
            },
          }}
        />,
      )

      expect(screen.getByRole("group", { name: "Localized compact search controls" })).toBeVisible()
      await user.click(screen.getByRole("button", { name: "Run compact search" }))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Al")

      expect(screen.getByRole("listbox", { name: "Localized suggestions" })).toBeVisible()
      expect(getVisibleByTestId("type-ahead-search-minimum-query-state")).toHaveTextContent("Need 3 characters")
    })
  })

  describe("interactions", () => {
    it("shows a minimum query message before enough input is provided.", async () => {
      const user = userEvent.setup()
      render(<CompactTypeaheadSearchExample minimumInputLength={3} />)

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Al")

      expect(getVisibleByTestId("type-ahead-search-minimum-query-state")).toHaveTextContent(
        "Enter at least 3 characters to search",
      )
    })

    it("responds to custom minimum query and empty list messages.", async () => {
      const user = userEvent.setup()
      render(
        <CompactTypeaheadSearchExample
          items={[]}
          minimumInputLength={2}
          minimumInputLengthMessage="Need more characters"
          emptyListMessage="Nothing matched"
        />,
      )

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "A")

      expect(getVisibleByTestId("type-ahead-search-minimum-query-state")).toHaveTextContent("Need more characters")

      await user.type(screen.getByTestId("type-ahead-search-input"), "l")

      expect(getVisibleByTestId("type-ahead-search-empty-state")).toHaveTextContent("Nothing matched")
    })

    it("closes its minimum query popover state when focus leaves the input group.", async () => {
      const user = userEvent.setup()
      renderCompactTypeaheadSearchWithOutsideFocusTarget(<CompactTypeaheadSearchExample minimumInputLength={3} />)

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Al")

      expect(getVisibleByTestId("type-ahead-search-minimum-query-state")).toBeInTheDocument()

      await user.click(screen.getByTestId("outside-focus-target"))

      await waitFor(() => {
        expect(getRenderedElementsByTestId("type-ahead-search-minimum-query-state")).toHaveLength(0)
      })
    })

    it("closes its empty-state popover when focus leaves the input group.", async () => {
      const user = userEvent.setup()
      renderCompactTypeaheadSearchWithOutsideFocusTarget(
        <CompactTypeaheadSearchExample items={[]} minimumInputLength={2} emptyListMessage="Nothing matched" />,
      )

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Al")

      expect(getVisibleByTestId("type-ahead-search-empty-state")).toBeInTheDocument()

      await user.click(screen.getByTestId("outside-focus-target"))

      await waitFor(() => {
        expect(getRenderedElementsByTestId("type-ahead-search-empty-state")).toHaveLength(0)
      })
    })

    it("can show a parent-controlled loading state.", async () => {
      const user = userEvent.setup()

      render(
        <LoadingStateCompactTypeaheadSearchExample
          loadingMessage="Searching..."
          LoadingIndicator={<span data-testid="custom-loading-indicator">Loading</span>}
        />,
      )

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Al")

      const loadingState = getVisibleByTestId("type-ahead-search-loading-state")
      expect(loadingState).toBeInTheDocument()
      expect(loadingState).toHaveTextContent("Searching...")
      expect(within(loadingState).getByTestId("custom-loading-indicator")).toBeInTheDocument()
    })

    it("closes its loading-state popover when focus leaves the input group.", async () => {
      const user = userEvent.setup()

      renderCompactTypeaheadSearchWithOutsideFocusTarget(
        <LoadingStateCompactTypeaheadSearchExample loadingMessage="Searching..." />,
      )

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Al")

      expect(getVisibleByTestId("type-ahead-search-loading-state")).toBeInTheDocument()

      await user.click(screen.getByTestId("outside-focus-target"))

      await waitFor(() => {
        expect(getRenderedElementsByTestId("type-ahead-search-loading-state")).toHaveLength(0)
      })
    })

    it("uses its default loading indicator when no custom loading indicator is provided.", async () => {
      const user = userEvent.setup()

      render(<LoadingStateCompactTypeaheadSearchExample />)

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Al")

      const loadingState = getVisibleByTestId("type-ahead-search-loading-state")
      expect(within(loadingState).getByTestId("type-ahead-search-default-loading-indicator")).toBeInTheDocument()
    })

    it("keeps the search icon static in the trigger while loading.", async () => {
      const user = userEvent.setup()

      render(
        <LoadingStateCompactTypeaheadSearchExample
          SearchIcon={<span data-testid="type-ahead-search-static-search-icon">S</span>}
        />,
      )

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Al")

      expect(screen.getByTestId("type-ahead-search-button")).toContainElement(
        screen.getByTestId("type-ahead-search-static-search-icon"),
      )
      expect(getVisibleByTestId("type-ahead-search-loading-state")).toBeInTheDocument()
    })

    it("can render results through renderItem.", async () => {
      const user = userEvent.setup()

      render(
        <CompactTypeaheadSearch
          aria-label="CompactTypeaheadSearch"
          items={testItems}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.name}
          renderItem={(item, args) => (
            <span
              data-testid={`render-item-${item.id}`}
            >{`${item.name} | ${args.query} | ${String(args.itemKey)}`}</span>
          )}
        />,
      )

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Be")

      await waitFor(() => {
        expect(screen.getByTestId("render-item-beta-drift")).toHaveTextContent("Beta Drift | Be | beta-drift")
      })
    })

    it("renders controlled parent-provided results through the renderItem path.", async () => {
      const user = userEvent.setup()

      render(<ControlledRenderItemCompactTypeaheadSearchExample />)

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(screen.getByTestId("type-ahead-search-input"), "Be")

      await waitFor(() => {
        expect(screen.getByTestId("render-item-result-beta-drift")).toHaveTextContent("Beta Drift | Be | beta-drift")
      })
    })

    it("emits selection changes when a result is chosen.", async () => {
      const user = userEvent.setup()
      const onChangeSpy = vi.fn()

      render(<CompactTypeaheadSearchExample onChangeSpy={onChangeSpy} />)

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))

      await waitFor(() => {
        expect(onChangeSpy).toHaveBeenCalledWith("alpha-wave")
      })
    })

    it("does not reopen the minimum query popover immediately after a controlled selection clears the query.", async () => {
      const user = userEvent.setup()

      render(<ClearOnSelectionControlledCompactTypeaheadSearchExample />)

      const input = screen.getByTestId("type-ahead-search-input")

      await user.click(screen.getByTestId("type-ahead-search-button"))
      await user.type(input, "Al")
      await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))

      await waitFor(() => {
        expect(getRenderedElementsByTestId("type-ahead-search-minimum-query-state")).toHaveLength(0)
      })

      expect(getRenderedElementsByTestId("type-ahead-search-empty-state")).toHaveLength(0)
      expect(getRenderedElementsByRole("listbox")).toHaveLength(0)
      expect(input).toHaveFocus()
    })
  })
})
