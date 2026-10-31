import { writeFileSync } from "node:fs"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, useContext, useState } from "react"
import { ComboBoxContext, ComboBoxStateContext } from "react-aria-components"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

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
const originalPointerEvent = globalThis.PointerEvent
beforeAll(() => {
  if (!globalThis.PointerEvent)
    globalThis.PointerEvent = class extends MouseEvent {
      pointerType: string
      pointerId: number
      width: number
      height: number
      pressure: number
      isPrimary: boolean
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerType = init.pointerType ?? "mouse"
        this.pointerId = init.pointerId ?? 1
        this.width = init.width ?? 1
        this.height = init.height ?? 1
        this.pressure = init.pressure ?? 0.5
        this.isPrimary = init.isPrimary ?? true
      }
    } as typeof PointerEvent
})

const records: unknown[] = []
afterAll(() => {
  globalThis.PointerEvent = originalPointerEvent
  const path = process.env.CODON_TAG_COMBO_CONTRACT_OBSERVATIONS
  if (path) writeFileSync(path, JSON.stringify(records, null, 2))
})

it("retains controlled open and original input across repeated vetoed selections", async () => {
  const trace: unknown[] = []
  const Owner = () => {
    const [open, setOpen] = useState(false)
    return (
      <TagComboBox
        {...base}
        inputValue="Alpha"
        isOpen={open}
        onSelectedItemsChange={(_items, details) => trace.push(["selection", details.changedKeys])}
        onInputChange={(value) => trace.push(["input", value])}
        onOpenChange={(value) => {
          if (value) setOpen(true)
          else trace.push(["open", value])
        }}
      />
    )
  }
  render(<Owner />)
  const original = screen.getByRole("combobox")
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  await user.click(await screen.findByRole("option", { name: "Alpha" }))
  await user.click(await screen.findByRole("option", { name: "Alpha" }))
  expect(trace).toEqual([
    ["selection", [0]],
    ["input", ""],
    ["selection", [0]],
    ["input", ""],
  ])
  expect(screen.getByRole("combobox")).toBe(original)
  expect(original).toHaveValue("Alpha")
  expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument()
  records.push({ vetoedSelectionOriginalRequests: trace, originalEditorRetained: true })
})

it("retains inherited capture callbacks and their original input-focus default veto", async () => {
  const observed: MouseEvent[] = []
  let veto = true
  render(
    <TagComboBox
      {...base}
      onMouseDownCapture={(event) => {
        observed.push(event.nativeEvent)
        if (veto) event.preventDefault()
      }}
    />,
  )
  const original = screen.getByRole("combobox")
  const user = userEvent.setup()
  await user.click(original)
  expect(observed).toHaveLength(1)
  expect(observed[0].target).toBe(original)
  expect(observed[0].defaultPrevented).toBe(true)
  expect(document.activeElement).not.toBe(original)
  veto = false
  await user.click(original)
  expect(observed).toHaveLength(2)
  expect(observed[1].target).toBe(original)
  expect(observed[1].defaultPrevented).toBe(false)
  expect(document.activeElement).toBe(original)
  expect(screen.getByRole("combobox")).toBe(original)
  records.push({ inheritedMouseCaptureDefaultVeto: true, originalInputAndEvents: true })
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

it("records the uncontrolled source state behind a controlled wrapper popup", async () => {
  let flags: Record<string, unknown> = {}
  const requests: unknown[] = []
  render(
    <TagComboBox
      {...base}
      isOpen={false}
      onOpenChange={(open, trigger) => requests.push([open, trigger ?? null])}
      render={(props, state) => {
        flags = state as unknown as Record<string, unknown>
        return <div {...props} />
      }}
    />,
  )
  const user = userEvent.setup()
  expect(flags.isOpen).toBe(false)
  const trigger = screen.getByRole("button", { name: "Show suggestions" })
  await user.click(trigger)
  expect(requests).toEqual([[true, "manual"]])
  expect(flags.isOpen).toBe(true)
  expect(screen.queryByRole("listbox")).toBeNull()
  await user.click(trigger)
  expect(requests).toEqual([
    [true, "manual"],
    [false, null],
  ])
  expect(flags.isOpen).toBe(false)
  records.push({ wrapperVisualOpen: false, innerRequests: requests, innerStateIndependent: true })
})
it.each([false, true])(
  "records ignored parent source isOpen=%s with independent wrapper visibility",
  async (stateOpen) => {
    let flags: Record<string, unknown> = {}
    const requests: unknown[] = []
    render(
      <ComboBoxContext.Provider value={{ isOpen: stateOpen }}>
        <TagComboBox
          {...base}
          isOpen={!stateOpen}
          onOpenChange={(open, trigger) => requests.push([open, trigger ?? null])}
          render={(props, state) => {
            flags = state as unknown as Record<string, unknown>
            return <div {...props} />
          }}
        />
      </ComboBoxContext.Provider>,
    )
    expect(flags.isOpen).toBe(false)
    expect(!!screen.queryByRole("listbox")).toBe(!stateOpen)
    await userEvent.setup().click(screen.getByRole("button", { name: "Show suggestions" }))
    expect(requests).toEqual([[true, "manual"]])
    expect(flags.isOpen).toBe(true)
    expect(!!screen.queryByRole("listbox")).toBe(!stateOpen)
    records.push({ parentStateOpen: stateOpen, wrapperVisualOpen: !stateOpen, requests })
  },
)

it.each(["mouse", "pen"])("toggles the actual source %s trigger on press start only", async (type) => {
  let flags: Record<string, unknown> = {}
  const changed: unknown[] = []
  render(
    <TagComboBox
      {...base}
      onOpenChange={(open, trigger) => changed.push([open, trigger ?? null])}
      render={(props, state) => {
        flags = state as unknown as Record<string, unknown>
        return <div {...props} />
      }}
    />,
  )
  const button = screen.getByRole("button", { name: "Show suggestions" })
  fireEvent.pointerDown(button, {
    pointerType: type,
    pointerId: 1,
    isPrimary: true,
    width: 2,
    height: 2,
    pressure: 0.5,
    detail: 1,
    button: 0,
    buttons: 1,
  })
  expect(await screen.findByRole("listbox")).toBeTruthy()
  expect(flags.isOpen).toBe(true)
  expect(changed).toEqual([[true, "manual"]])
  fireEvent.pointerUp(button, {
    pointerType: type,
    pointerId: 1,
    isPrimary: true,
    width: 2,
    height: 2,
    pressure: 0,
    detail: 1,
    button: 0,
    buttons: 0,
  })
  expect(flags.isOpen).toBe(true)
  expect(changed).toEqual([[true, "manual"]])
  records.push({ physicalPointerModel: type, opensOn: "start", singleRequest: changed })
})

it.each([false, true])("handles closed Enter with readonly=%s through the actual source input", async (readonly) => {
  const requests: string[] = []
  const opened: unknown[] = []
  render(
    <TagComboBox
      {...base}
      inputValue="Alpha"
      isReadOnly={readonly}
      onInputChange={(value) => requests.push(value)}
      onOpenChange={(open, trigger) => opened.push([open, trigger])}
    />,
  )
  const input = screen.getByRole("combobox")
  await userEvent.setup().click(input)
  const allowed = fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
  expect(requests).toEqual([])
  expect(opened).toEqual(readonly ? [] : [[true, "input"]])
  expect(input).toHaveValue("Alpha")
  records.push({ closedEnter: true, readonly, requests, opened, defaultAllowed: allowed })
})
