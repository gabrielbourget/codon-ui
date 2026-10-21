import { writeFileSync } from "node:fs"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, useContext, useState } from "react"
import { ComboBoxContext, ComboBoxStateContext } from "react-aria-components"
import { afterAll, expect, it, vi } from "vitest"

import ListBoxItem from "../../../../packages/react/src/components/ListBoxItem/ListBoxItem"
import TagComboBox from "../../../../packages/react/src/components/TagComboBox/TagComboBox"

const items = [{ id: 0, label: "Alpha" }]
const base = {
  "aria-label": "Source tags",
  items,
  selectedItems: [],
  getItemKey: (item: (typeof items)[number]) => item.id,
  getItemTextValue: (item: (typeof items)[number]) => item.label,
  onSelectedItemsChange: () => {},
  children: (item: (typeof items)[number]) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>,
}
const records: unknown[] = []
afterAll(() => {
  const path = process.env.CODON_TAG_COMBO_CONTRACT_OBSERVATIONS
  if (path) writeFileSync(path, JSON.stringify(records, null, 2))
})

it("inherits parent context at the inner ComboBox, preserves actual refs, and honors slot=null", () => {
  const root = createRef<HTMLDivElement>(),
    picker = createRef<HTMLDivElement>(),
    inherited = vi.fn(),
    authored = vi.fn()
  const content = (slot?: null) => (
    <ComboBoxContext.Provider
      value={{ ref: picker, isReadOnly: true, inputValue: "context query", onInputChange: inherited }}
    >
      <TagComboBox {...base} ref={root} slot={slot} onInputChange={authored} />
    </ComboBoxContext.Provider>
  )
  const view = render(content())
  expect(root.current).toBe(screen.getByTestId("tag-combobox"))
  expect(picker.current).toBe(screen.getByTestId("combo-box"))
  expect(picker.current).not.toBe(root.current)
  expect(screen.getByRole("combobox")).toHaveAttribute("readonly")
  expect(screen.getByRole("combobox")).toHaveValue("")
  view.rerender(content(null))
  expect(screen.getByRole("combobox")).not.toHaveAttribute("readonly")
  expect(picker.current).toBeNull()
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "owner query" } })
  expect(authored).toHaveBeenCalledWith("owner query")
  expect(inherited).not.toHaveBeenCalled()
  records.push({ context: "inner ComboBox", outerInputOverridesContext: true, slotNullOptsOut: true })
})

it("preserves duplicate form entries, null key ownership and the custom-value text override", () => {
  render(
    <form data-testid="owner-form">
      <TagComboBox {...base} name="entry" formValue="key" inputValue="held" />
      <TagComboBox {...base} name="entry" formValue="text" inputValue="held" />
      <TagComboBox {...base} name="custom" formValue="key" allowsCustomValue inputValue="draft" />
    </form>,
  )
  const entries = [...new FormData(screen.getByTestId("owner-form") as HTMLFormElement).entries()]
  expect(entries).toEqual([
    ["entry", ""],
    ["entry", "held"],
    ["custom", "draft"],
  ])
  records.push({ entries })
})

it("materializes declarative options without inventing item objects for the composite add callback", async () => {
  const selected = vi.fn()
  render(
    <TagComboBox {...base} items={undefined} onSelectedItemsChange={selected}>
      <ListBoxItem id="static">Static option</ListBoxItem>
    </TagComboBox>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  await user.click(await screen.findByRole("option", { name: "Static option" }))
  expect(selected).not.toHaveBeenCalled()
  expect(screen.getByRole("combobox")).toHaveValue("")
  records.push({ declarativeOptionRendered: true, compositeAddRequests: selected.mock.calls.length })
})

it("provides every parent render flag and keeps field, group and trigger names independent", () => {
  let flags: Record<string, unknown> = {}
  render(
    <TagComboBox
      {...base}
      isRequired
      isInvalid
      isReadOnly
      inputValue="Alpha"
      customComboBoxProps={{
        style: (state) => {
          flags = state as unknown as Record<string, unknown>
          return {}
        },
      }}
    />,
  )
  expect(flags).toMatchObject({ isOpen: false, isDisabled: false, isInvalid: true, isRequired: true, isReadOnly: true })
  expect(screen.getByRole("combobox")).toHaveAccessibleName("Source tags")
  expect(screen.getByRole("combobox")).toHaveAttribute("required")
  expect(screen.getByRole("combobox")).toHaveAttribute("readonly")
  expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true")
  expect(screen.getByRole("button", { name: "Show suggestions" })).toBeTruthy()
  expect(screen.getByRole("group", { name: "ComboBox Input Button Group" })).toBeTruthy()
  records.push({
    flags: Object.fromEntries(
      ["isOpen", "isDisabled", "isInvalid", "isRequired", "isReadOnly"].map((key) => [key, flags[key]]),
    ),
    fieldName: "Source tags",
    triggerName: "Show suggestions",
  })
})

it("keeps wrapper option authoring separate from a parent-controlled collection filter", async () => {
  const Owner = () => {
    const [query, setQuery] = useState("")
    return (
      <ComboBoxContext.Provider value={{ items: [{ id: "context-only", label: "Context only" }] }}>
        <TagComboBox {...base} inputValue={query} onInputChange={setQuery} />
      </ComboBoxContext.Provider>
    )
  }
  render(<Owner />)
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  expect(await screen.findByRole("option", { name: "Alpha" })).toBeTruthy()
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "missing" } })
  expect(await screen.findByRole("option", { name: "Alpha" })).toBeTruthy()
  expect(screen.queryByRole("option", { name: "Context only" })).toBeNull()
  records.push({ parentItemsControlFiltering: true, wrapperItemsAuthorOptions: true })
})

it("retains the actual custom picker root, five render fields and source input identity", () => {
  const outer = createRef<HTMLDivElement>(),
    picker = createRef<HTMLDivElement>()
  let flags: Record<string, unknown> = {}
  const content = (custom: boolean) => (
    <ComboBoxContext.Provider value={{ ref: picker, "aria-label": "Parent field" }}>
      <TagComboBox
        {...base}
        ref={outer}
        id="source-field"
        aria-label="Source field"
        isRequired
        isInvalid
        customComboBoxProps={{ id: "nested-field", "aria-label": "Nested field" }}
        render={
          custom
            ? (props, values) => {
                flags = values as unknown as Record<string, unknown>
                return <div {...props} data-testid="custom-source-picker" />
              }
            : undefined
        }
      />
    </ComboBoxContext.Provider>
  )
  const view = render(content(true))
  const original = screen.getByTestId("custom-source-picker")
  const input = screen.getByRole("combobox")
  expect(picker.current).toBe(original)
  expect(outer.current).toBe(screen.getByTestId("tag-combobox"))
  expect(outer.current).not.toBe(original)
  expect(outer.current!.id).toBe("")
  expect(original.id).toBe("")
  expect(input).toHaveAttribute("id", "source-field")
  expect(input).toHaveAccessibleName("Source field")
  expect(flags).toMatchObject({
    isOpen: false,
    isDisabled: false,
    isInvalid: true,
    isRequired: true,
    isReadOnly: false,
  })
  view.rerender(content(false))
  expect(screen.queryByTestId("custom-source-picker")).toBeNull()
  expect(picker.current).toBe(screen.getByTestId("combo-box"))
  expect(screen.getByRole("combobox")).toHaveAttribute("id", "source-field")
  records.push({
    customRootOriginalRef: true,
    fieldID: "source-field",
    rootIDAbsent: true,
    fieldName: "Source field",
    flags: Object.keys(flags).sort(),
  })
})

it.each([false, true])("preserves nested and parent field identity with nested=%s", (nested) => {
  const { "aria-label": _label, ...unlabelled } = base
  render(
    <ComboBoxContext.Provider value={{ id: "parent-field", "aria-label": "Parent field" }}>
      <TagComboBox
        {...unlabelled}
        customComboBoxProps={nested ? { id: "nested-field", "aria-label": "Nested field" } : undefined}
      />
    </ComboBoxContext.Provider>,
  )
  const input = screen.getByRole("combobox")
  expect(input).toHaveAttribute("id", nested ? "nested-field" : "parent-field")
  expect(input).toHaveAccessibleName(nested ? "Nested field" : "Parent field")
  records.push({ nested, fieldID: input.id, fieldName: input.getAttribute("aria-label") })
})

it.each(["isDisabled", "isReadOnly"] as const)(
  "keeps explicit state requests available with %s while the owner vetoes",
  async (guard) => {
    const events: string[] = []
    let state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
    const Capture = () => {
      state = useContext(ComboBoxStateContext)!
      return null
    }
    render(
      <TagComboBox
        {...base}
        {...{ [guard]: true }}
        inputValue="held"
        onInputChange={(value) => events.push("input:" + value)}
        onSelectedItemsChange={(next, details) => {
          expect(next[0]).toBe(items[0])
          expect(details.action).toBe("add")
          events.push("selected")
        }}
        render={(props) => (
          <div {...props}>
            {props.children}
            <Capture />
          </div>
        )}
      />,
    )
    await act(() => state.setInputValue("explicit"))
    await act(() => state.setValue(0))
    expect(events).toEqual(["input:explicit", "selected", "input:"])
    expect(state.value).toBeNull()
    expect(screen.getByRole("combobox")).toHaveValue("held")
    records.push({ guard, programmaticRequests: events, ownerValue: null, ownerInput: "held" })
  },
)

it("records actual focus/state when a custom picker host is replaced", async () => {
  const events: string[] = []
  let state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
  const Capture = () => {
    state = useContext(ComboBoxStateContext)!
    return null
  }
  const content = (revision: number) => (
    <TagComboBox
      {...base}
      inputValue="held"
      onFocus={() => events.push("focus")}
      onBlur={() => events.push("blur")}
      onFocusChange={(value) => events.push("within:" + value)}
      render={(props) => (
        <div {...props} key={revision}>
          {props.children}
          <Capture />
        </div>
      )}
    />
  )
  const view = render(content(0))
  const before = screen.getByRole("combobox")
  const user = userEvent.setup()
  await user.click(before)
  expect(state.isFocused).toBe(true)
  view.rerender(content(1))
  const after = screen.getByRole("combobox")
  const observation = {
    inputReplaced: before !== after,
    actualFocused: document.activeElement === after,
    logicalFocused: state.isFocused,
    ownerInput: (after as HTMLInputElement).value,
  }
  expect(observation.inputReplaced).toBe(true)
  expect(observation.ownerInput).toBe("held")
  records.push({ hostReplacement: observation, beforeRefocus: [...events] })
  await user.click(after)
  records.push({ afterRefocus: [...events], logicalFocused: state.isFocused })
})
