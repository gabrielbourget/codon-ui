import { render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import ListBoxItem from "../../ListBoxItem/ListBoxItem"
import textStyles from "../../Text/TextStyles.module.css"
import {
  TAGCOMBOBOX_SIZE__LG,
  TAGCOMBOBOX_SIZE__MD,
  TAGCOMBOBOX_SIZE__SM,
  type TTagComboBoxChangeDetails,
  type TTagComboBoxProps,
} from "../helpers"
import TagComboBox from "../TagComboBox"
import tagComboBoxStyles from "../TagComboBoxStyles.module.css"

type TTagComboBoxTestItem = {
  slug: string
  label: string
  group: string
}

type TTagComboBoxExampleProps = Omit<
  Partial<TTagComboBoxProps<TTagComboBoxTestItem>>,
  "children" | "getItemKey" | "getItemTextValue" | "items" | "onSelectedItemsChange" | "selectedItems"
> & {
  initialSelectedItems?: TTagComboBoxTestItem[]
  items?: TTagComboBoxTestItem[]
  onSelectedItemsChangeSpy?: (
    nextSelectedItems: TTagComboBoxTestItem[],
    details: TTagComboBoxChangeDetails<TTagComboBoxTestItem>,
  ) => void
}

const testItems: TTagComboBoxTestItem[] = [
  { slug: "alpha-wave", label: "Alpha Wave", group: "Synth" },
  { slug: "beta-drift", label: "Beta Drift", group: "Ambient" },
  { slug: "gamma-tide", label: "Gamma Tide", group: "Downtempo" },
  { slug: "delta-bloom", label: "Delta Bloom", group: "Chillwave" },
  { slug: "epsilon-glow", label: "Epsilon Glow", group: "Electronic" },
]

const getTriggerButton = () =>
  screen.getByRole("group", { name: "ComboBox Input Button Group" }).querySelector("button") as HTMLButtonElement

const TagComboBoxExample = (props: TTagComboBoxExampleProps = {}) => {
  const { initialSelectedItems = [], items = testItems, onSelectedItemsChangeSpy, ...rest } = props
  const [selectedItems, setSelectedItems] = useState(initialSelectedItems)

  return (
    <TagComboBox
      aria-label="TagComboBox"
      items={items}
      selectedItems={selectedItems}
      onSelectedItemsChange={(nextSelectedItems, details) => {
        onSelectedItemsChangeSpy?.(nextSelectedItems, details)
        setSelectedItems(nextSelectedItems)
      }}
      getItemKey={(item) => item.slug}
      getItemTextValue={(item) => item.label}
      {...rest}
    >
      {(item) => <ListBoxItem id={item.slug}>{item.label}</ListBoxItem>}
    </TagComboBox>
  )
}

describe("<TagComboBox />", () => {
  it("renders.", () => {
    render(<TagComboBoxExample />)

    expect(screen.getByTestId("tag-combobox")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<TagComboBoxExample height={50} width={150} />)
      const tagComboBox = screen.getByTestId("tag-combobox")

      expect(tagComboBox).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color prop.", () => {
      render(<TagComboBoxExample color="turquoise" initialSelectedItems={[testItems[0]]} />)
      const tag = screen.getByTestId("tag")
      const comboBoxGroup = screen.getByRole("group", { name: "ComboBox Input Button Group" })

      expect(tag).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)" })
      expect(comboBoxGroup).toHaveStyle({ color: "rgb(64, 224, 208)" })
    })

    it("responds to text size props.", () => {
      const { rerender } = render(<TagComboBoxExample textSize={TAGCOMBOBOX_SIZE__SM} />)
      const input = screen.getByTestId("input")

      expect(input).toHaveClass(textStyles.b11)

      rerender(<TagComboBoxExample textSize={TAGCOMBOBOX_SIZE__MD} />)
      expect(input).toHaveClass(textStyles.b10)

      rerender(<TagComboBoxExample textSize={TAGCOMBOBOX_SIZE__LG} />)
      expect(input).toHaveClass(textStyles.b9)
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<TagComboBoxExample />)
      const tagComboBox = screen.getByTestId("tag-combobox")

      expect(tagComboBox).toHaveClass(tagComboBoxStyles["tagComboBox--applyFocusStyle"])
      expect(tagComboBox).toHaveClass(tagComboBoxStyles["tagComboBox--offsetFocusRing"])

      rerender(<TagComboBoxExample enableFocusStyle={false} offsetFocusRing={false} />)
      expect(tagComboBox).not.toHaveClass(tagComboBoxStyles["tagComboBox--applyFocusStyle"])
      expect(tagComboBox).not.toHaveClass(tagComboBoxStyles["tagComboBox--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<TagComboBoxExample isDisabled />)
      const tagComboBox = screen.getByTestId("tag-combobox")
      const comboBox = screen.getByTestId("combo-box")

      expect(tagComboBox).toHaveAttribute("aria-disabled", "true")
      expect(comboBox).toHaveAttribute("data-disabled", "true")
    })

    it("responds to isOpen prop.", () => {
      render(<TagComboBoxExample isOpen={false} />)

      expect(screen.queryByRole("option", { name: "Alpha Wave" })).toBeNull()
    })

    it("responds to form element status props.", () => {
      const { rerender } = render(<TagComboBoxExample errorState />)
      const tagComboBox = screen.getByTestId("tag-combobox")

      expect(tagComboBox).toHaveClass(tagComboBoxStyles["tagComboBox--errorState"])

      rerender(<TagComboBoxExample warningState />)
      expect(tagComboBox).toHaveClass(tagComboBoxStyles["tagComboBox--warningState"])

      rerender(<TagComboBoxExample successState />)
      expect(tagComboBox).toHaveClass(tagComboBoxStyles["tagComboBox--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      render(<TagComboBoxExample errorState warningState successState />)
      const tagComboBox = screen.getByTestId("tag-combobox")

      expect(tagComboBox).toHaveClass(tagComboBoxStyles["tagComboBox--errorState"])
      expect(tagComboBox).not.toHaveClass(tagComboBoxStyles["tagComboBox--warningState"])
      expect(tagComboBox).not.toHaveClass(tagComboBoxStyles["tagComboBox--successState"])
    })

    it("responds to custom style props.", () => {
      render(
        <TagComboBoxExample
          initialSelectedItems={[testItems[0]]}
          customStyles={{ backgroundColor: "turquoise" }}
          customTagGroupStyles={{ backgroundColor: "orange" }}
          customTagStyles={{ backgroundColor: "green" }}
          customComboBoxStyles={{ backgroundColor: "blue" }}
        />,
      )

      const tagComboBox = screen.getByTestId("tag-combobox")
      const tagGroup = screen.getByTestId("tag-group")
      const tag = screen.getByTestId("tag")
      const comboBox = screen.getByTestId("combo-box")

      expect(tagComboBox).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)" })
      expect(tagGroup).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(tag).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
      expect(comboBox).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("forwards custom subpart props and resolves style precedence.", () => {
      render(
        <TagComboBoxExample
          initialSelectedItems={[testItems[0]]}
          customTagGroupStyles={{ backgroundColor: "gold" }}
          customTagGroupProps={{
            "data-testid": "selected-tag-group",
            customStyles: { color: "teal" },
          }}
          customTagStyles={{ color: "orange" }}
          customTagProps={{
            "data-testid": "selected-tag",
            customStyles: { backgroundColor: "purple" },
          }}
          customComboBoxStyles={{ backgroundColor: "blue" }}
          customComboBoxProps={{
            "data-testid": "tag-combobox-input",
            customStyles: { color: "green" },
          }}
        />,
      )

      expect(screen.getByTestId("selected-tag-group")).toHaveStyle({
        backgroundColor: "rgb(255, 215, 0)",
        color: "rgb(0, 128, 128)",
      })
      expect(screen.getByTestId("selected-tag")).toHaveStyle({
        backgroundColor: "rgb(128, 0, 128)",
        color: "rgb(255, 165, 0)",
      })
      expect(screen.getByTestId("tag-combobox-input")).toHaveStyle({
        backgroundColor: "rgb(0, 0, 255)",
        color: "rgb(0, 128, 0)",
      })
    })

    it("preserves the ComboBox ComponentIcon override path.", () => {
      render(<TagComboBoxExample ComponentIcon={<span data-testid="custom-combobox-icon">Open</span>} />)

      expect(screen.getByTestId("custom-combobox-icon")).toBeInTheDocument()
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <TagComboBoxExample
          height={50}
          width={150}
          minWidth={60}
          maxWidth={300}
          customStyles={{ color: "turquoise", marginTop: 5 }}
          className="native-tag-combobox-class"
          style={{ color: "tomato", width: 175, marginBottom: 10 }}
        />,
      )

      const tagComboBox = screen.getByTestId("tag-combobox")

      expect(tagComboBox).toHaveClass(tagComboBoxStyles.tagComboBox)
      expect(tagComboBox).toHaveClass("native-tag-combobox-class")
      expect(tagComboBox).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <TagComboBoxExample
          height={50}
          width={150}
          minWidth={60}
          maxWidth={300}
          color="turquoise"
          order="primary"
          textSize={TAGCOMBOBOX_SIZE__SM}
          geometry="round"
          placement="top"
          enableFocusStyle={false}
          offsetFocusRing={false}
          errorState
          warningState
          successState
          isOpen={false}
          isDisabled={false}
          labels={{ groupAriaLabel: "Tag controls" }}
          shouldFocusWrap={false}
          renderTagContent={(item) => item.label}
          customStyles={{ marginTop: 5 }}
          customTagGroupStyles={{ marginTop: 5 }}
          customTagStyles={{ marginTop: 5 }}
          customComboBoxStyles={{ marginTop: 5 }}
          customComboBoxProps={{ labels: { triggerButtonAriaLabel: "Open" } }}
        />,
      )

      const tagComboBox = screen.getByTestId("tag-combobox")

      expect(tagComboBox).not.toHaveAttribute("height")
      expect(tagComboBox).not.toHaveAttribute("width")
      expect(tagComboBox).not.toHaveAttribute("minwidth")
      expect(tagComboBox).not.toHaveAttribute("maxwidth")
      expect(tagComboBox).not.toHaveAttribute("color")
      expect(tagComboBox).not.toHaveAttribute("order")
      expect(tagComboBox).not.toHaveAttribute("textsize")
      expect(tagComboBox).not.toHaveAttribute("geometry")
      expect(tagComboBox).not.toHaveAttribute("placement")
      expect(tagComboBox).not.toHaveAttribute("enablefocusstyle")
      expect(tagComboBox).not.toHaveAttribute("offsetfocusring")
      expect(tagComboBox).not.toHaveAttribute("errorstate")
      expect(tagComboBox).not.toHaveAttribute("warningstate")
      expect(tagComboBox).not.toHaveAttribute("successstate")
      expect(tagComboBox).not.toHaveAttribute("isopen")
      expect(tagComboBox).not.toHaveAttribute("isdisabled")
      expect(tagComboBox).not.toHaveAttribute("labels")
      expect(tagComboBox).not.toHaveAttribute("shouldfocuswrap")
      expect(tagComboBox).not.toHaveAttribute("rendertagcontent")
      expect(tagComboBox).not.toHaveAttribute("customstyles")
      expect(tagComboBox).not.toHaveAttribute("customtaggroupstyles")
      expect(tagComboBox).not.toHaveAttribute("customtagstyles")
      expect(tagComboBox).not.toHaveAttribute("customcomboboxstyles")
      expect(tagComboBox).not.toHaveAttribute("customcomboboxprops")
      expect(tagComboBox).not.toHaveAttribute("customtaggroupprops")
      expect(tagComboBox).not.toHaveAttribute("customtagprops")
    })

    it("accepts custom labels for its internal groups.", () => {
      render(
        <TagComboBoxExample
          labels={{
            groupAriaLabel: "Localized tag combo controls",
            tagGroupAriaLabel: "Localized selected items",
            comboBox: {
              inputButtonGroupAriaLabel: "Localized tag combo input controls",
              triggerButtonAriaLabel: "Open localized tag combo choices",
            },
          }}
        />,
      )

      expect(screen.getByRole("group", { name: "Localized tag combo controls" })).toBeVisible()
      expect(screen.getByTestId("tag-list")).toHaveAccessibleName("Localized selected items")
      expect(screen.getByRole("group", { name: "Localized tag combo input controls" })).toBeVisible()
      expect(screen.getByRole("button", { name: "Open localized tag combo choices" })).toBeVisible()
    })
  })

  describe("interactions", () => {
    it("can add a selected item to its set of selected item tags.", async () => {
      const user = userEvent.setup()
      render(<TagComboBoxExample />)

      await user.click(getTriggerButton())
      const optionToSelect = await screen.findByRole("option", { name: "Alpha Wave" })
      await user.click(optionToSelect)

      expect(screen.getByTestId("tag")).toHaveTextContent("Alpha Wave")
    })

    it("removes selected items from the dropdown list after selection.", async () => {
      const user = userEvent.setup()
      render(<TagComboBoxExample />)

      await user.click(getTriggerButton())
      await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))
      await user.type(screen.getByTestId("input"), "B")

      expect(screen.queryByRole("option", { name: "Alpha Wave" })).toBeNull()
      expect(await screen.findByRole("option", { name: "Beta Drift" })).toBeInTheDocument()
    })

    it("can remove a selected item from its set of selected item tags.", async () => {
      const user = userEvent.setup()
      render(<TagComboBoxExample initialSelectedItems={[testItems[0]]} />)

      const selectedTag = screen.getByTestId("tag")
      const removeButton = within(selectedTag).getByRole("button", { name: /remove/iu })

      await user.click(removeButton)

      expect(screen.queryByTestId("tag")).toBeNull()

      await user.click(getTriggerButton())
      expect(await screen.findByRole("option", { name: "Alpha Wave" })).toBeInTheDocument()
    })

    it("prevents duplicate selections by filtering already selected items out of the dropdown.", async () => {
      const user = userEvent.setup()
      render(<TagComboBoxExample initialSelectedItems={[testItems[0]]} />)

      expect(screen.getByTestId("tag")).toHaveTextContent("Alpha Wave")

      await user.click(getTriggerButton())
      expect(screen.queryByRole("option", { name: "Alpha Wave" })).toBeNull()
      expect(screen.getByRole("option", { name: "Beta Drift" })).toBeInTheDocument()
    })

    it("uses getItemTextValue for its default selected tag text.", () => {
      render(<TagComboBoxExample initialSelectedItems={[testItems[1]]} />)

      expect(screen.getByTestId("tag")).toHaveTextContent("Beta Drift")
    })

    it("supports renderTagContent overrides.", () => {
      render(
        <TagComboBoxExample
          initialSelectedItems={[testItems[1]]}
          renderTagContent={(item) => <span data-testid={`custom-tag-content-${item.slug}`}>Group: {item.group}</span>}
        />,
      )

      expect(screen.getByTestId("custom-tag-content-beta-drift")).toHaveTextContent("Group: Ambient")
    })

    it("clears uncontrolled input after selection.", async () => {
      const user = userEvent.setup()
      render(<TagComboBoxExample />)

      const input = screen.getByTestId("input")
      await user.type(input, "Alpha")
      expect(input).toHaveValue("Alpha")

      await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))
      expect(input).toHaveValue("")
    })

    it("emits an empty input value after selection when inputValue is controlled.", async () => {
      const user = userEvent.setup()
      const onInputChange = vi.fn()

      render(<TagComboBoxExample inputValue="Alpha" onInputChange={onInputChange} />)

      await user.click(getTriggerButton())
      await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))

      expect(onInputChange).toHaveBeenLastCalledWith("")
    })

    it("emits change details for add interactions.", async () => {
      const user = userEvent.setup()
      const onSelectedItemsChangeSpy = vi.fn()

      render(<TagComboBoxExample onSelectedItemsChangeSpy={onSelectedItemsChangeSpy} />)

      await user.click(getTriggerButton())
      await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))

      expect(onSelectedItemsChangeSpy).toHaveBeenCalledWith(
        [testItems[0]],
        expect.objectContaining({
          action: "add",
          changedItems: [testItems[0]],
          changedKeys: ["alpha-wave"],
        }),
      )
    })

    it("emits change details for remove interactions.", async () => {
      const user = userEvent.setup()
      const onSelectedItemsChangeSpy = vi.fn()

      render(
        <TagComboBoxExample
          initialSelectedItems={[testItems[0], testItems[1]]}
          onSelectedItemsChangeSpy={onSelectedItemsChangeSpy}
        />,
      )

      const selectedTags = screen.getAllByTestId("tag")
      const removeButton = within(selectedTags[0]).getByRole("button", { name: /remove/iu })

      await user.click(removeButton)

      expect(onSelectedItemsChangeSpy).toHaveBeenCalledWith(
        [testItems[1]],
        expect.objectContaining({
          action: "remove",
          changedItems: [testItems[0]],
          changedKeys: ["alpha-wave"],
        }),
      )
    })
  })
})
