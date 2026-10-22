import { writeFileSync } from "node:fs"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef, useContext, useState } from "react"
import { createPortal } from "react-dom"
import {
  Header,
  ListBoxSection,
  SelectionIndicatorContext,
  RouterProvider,
  ButtonContext,
  ComboBoxStateContext,
  ComboBoxValue,
  FieldError,
  FieldErrorContext,
  Form,
  GroupContext,
  Group,
  InputContext,
  Label,
  LabelContext,
  ListBoxContext,
  Text,
  TextContext,
  PopoverContext,
  Popover,
} from "react-aria-components"
import { afterAll, expect, it, vi } from "vitest"

import Button from "../../../../packages/react/src/components/Button/Button"
import ComboBox from "../../../../packages/react/src/components/ComboBox/ComboBox"
import Input from "../../../../packages/react/src/components/Input/Input"
import ListBoxItem from "../../../../packages/react/src/components/ListBoxItem/ListBoxItem"

const items = [
  { id: 0, label: "Alpha" },
  { id: "", label: "Empty" },
]
const options = {
  "aria-label": "Source field",
  items,
  children: (item: (typeof items)[number]) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>,
}
const records: unknown[] = []

it("selects an option on original mouse release after pressing its trigger", async () => {
  const user = userEvent.setup(),
    changes: unknown[] = []
  render(<ComboBox {...options} onChange={(key) => changes.push(key)} />)
  await user.pointer({ keys: "[MouseLeft>]", target: screen.getByRole("button", { name: "Show suggestions" }) })
  const option = await screen.findByRole("option", { name: "Alpha" })
  expect(changes).toEqual([])
  await user.pointer({ target: option })
  await user.pointer({ keys: "[/MouseLeft]", target: option })
  expect(changes).toEqual([0])
  records.push({ case: "trigger-to-option-release", changes })
})
afterAll(() => {
  if (process.env.CODON_FIELD_CONTEXT_OBSERVATIONS)
    writeFileSync(process.env.CODON_FIELD_CONTEXT_OBSERVATIONS, JSON.stringify(records, null, 2))
})

it("preserves Group's named/null context, original rendered ref and complete style/render values", () => {
  const inherited = createRef<HTMLDivElement>(),
    caller = createRef<HTMLDivElement>(),
    values: unknown[] = []
  let defaultStyle: unknown
  const view = render(
    <GroupContext.Provider value={{ slots: { named: { ref: inherited, isInvalid: true, style: { padding: 9 } } } }}>
      <Group
        ref={caller}
        slot="named"
        data-testid="source-group"
        style={(state) => {
          defaultStyle = state.defaultStyle
          return { color: "blue" }
        }}
        render={(props, state) => {
          values.push(state)
          return <div {...props} />
        }}
      >
        Group
      </Group>
      <Group slot={null} data-testid="isolated-group" />
    </GroupContext.Provider>,
  )
  expect(caller.current === inherited.current).toBe(true)
  expect(caller.current === screen.getByTestId("source-group")).toBe(true)
  expect(values.at(-1)).toMatchObject({
    isHovered: false,
    isFocusWithin: false,
    isFocusVisible: false,
    isDisabled: false,
    isInvalid: true,
  })
  expect(defaultStyle).toMatchObject({ padding: 9 })
  expect(screen.getByTestId("isolated-group").getAttribute("data-invalid")).toBeNull()
  view.unmount()
  expect([inherited.current, caller.current]).toEqual([null, null])
  records.push({ groupNamedNullContextsAndOriginalRenderRef: true, fullGroupStyleValues: true })
})

it("disables Group hover while retaining actual child focus and the text-input visibility rule", async () => {
  const user = userEvent.setup(),
    focus = vi.fn()
  const values: { isHovered: boolean; isFocusWithin: boolean; isFocusVisible: boolean; isDisabled: boolean }[] = []
  render(
    <Group isDisabled onFocus={focus}>
      {(state) => {
        values.push(state)
        return <input aria-label="Group editor" value="held" onChange={() => {}} />
      }}
    </Group>,
  )
  const editor = screen.getByRole("textbox", { name: "Group editor" })
  await user.click(editor)
  expect(values.at(-1)).toMatchObject({
    isHovered: false,
    isFocusWithin: true,
    isFocusVisible: false,
    isDisabled: true,
  })
  await user.keyboard("a")
  expect(values.at(-1)?.isFocusVisible).toBe(false)
  await user.keyboard("{Escape}")
  expect(values.at(-1)?.isFocusVisible).toBe(true)
  expect(focus).toHaveBeenCalledTimes(1)
  expect(focus.mock.calls[0][0].target === editor).toBe(true)
  records.push({ disabledGroupPreservesChildFocus: true, groupPointerTypingEscapeVisibility: true })
})

it("forwards portal focus through React without treating the portal as a physical Group descendant", async () => {
  const focus = vi.fn(),
    user = userEvent.setup(),
    values: { isFocusWithin: boolean }[] = []
  render(
    <Group onFocus={focus} data-testid="physical-group">
      {(state) => {
        values.push(state)
        return createPortal(<input aria-label="Portalled editor" />, document.body)
      }}
    </Group>,
  )
  const editor = screen.getByRole("textbox", { name: "Portalled editor" })
  await user.click(editor)
  expect(focus).toHaveBeenCalledTimes(1)
  expect(focus.mock.calls[0][0].target === editor).toBe(true)
  expect(values.at(-1)?.isFocusWithin).toBe(false)
  expect(screen.getByTestId("physical-group").contains(editor)).toBe(false)
  records.push({ originalPortalFocusCallback: true, physicalGroupContainmentSeparateFromReactBubbling: true })
})

it("preserves Popover context/caller refs, callback order and one close request per owner", async () => {
  const anchor = createRef<HTMLButtonElement>(),
    inherited = createRef<HTMLDivElement>(),
    caller = createRef<HTMLDivElement>()
  const context = vi.fn(),
    authored = vi.fn(),
    order: string[] = [],
    seen: unknown[] = []
  const view = render(
    <>
      <button ref={anchor}>Anchor</button>
      <PopoverContext.Provider
        value={{
          ref: inherited,
          triggerRef: anchor,
          isOpen: true,
          isNonModal: true,
          trigger: "ComboBox",
          onOpenChange: context,
          style: { padding: 9 },
        }}
      >
        <Popover
          ref={caller}
          data-testid="source-popover"
          onOpenChange={authored}
          style={(state) => {
            order.push("style")
            expect(state.defaultStyle.padding).toBe(9)
            return { color: "blue" }
          }}
          render={(props, state) => {
            order.push("render")
            seen.push(state)
            return <div {...props} />
          }}
        >
          {(state) => {
            order.push("children")
            return <span>{state.trigger}</span>
          }}
        </Popover>
      </PopoverContext.Provider>
    </>,
  )
  await waitFor(() => expect(screen.getByTestId("source-popover").getAttribute("data-placement")).toBe("bottom"))
  expect(caller.current === inherited.current).toBe(true)
  expect(caller.current === screen.getByTestId("source-popover")).toBe(true)
  expect(seen.at(-1)).toMatchObject({ trigger: "ComboBox", placement: "bottom", isEntering: false, isExiting: false })
  expect(order.slice(-3)).toEqual(["style", "children", "render"])
  fireEvent.keyDown(screen.getByTestId("source-popover"), { key: "Escape" })
  expect(context.mock.calls).toEqual([[false]])
  expect(authored.mock.calls).toEqual([[false]])
  expect(screen.getByTestId("source-popover")).toBeInTheDocument()
  view.unmount()
  expect([caller.current, inherited.current]).toEqual([null, null])
  records.push({ popoverOriginalRefAndRenderOrder: true, controlledCloseRequestsOncePerMergedOwner: true })
})

it("does not evaluate visible Popover render/style/children callbacks when a normal popup is closed", () => {
  const anchor = createRef<HTMLButtonElement>(),
    style = vi.fn(() => ({})),
    children = vi.fn(() => null),
    renderHost = vi.fn((props) => <div {...props} />)
  render(
    <>
      <button ref={anchor}>Closed anchor</button>
      <Popover triggerRef={anchor} isOpen={false} style={style} render={renderHost}>
        {children}
      </Popover>
    </>,
  )
  expect(style).not.toHaveBeenCalled()
  expect(children).not.toHaveBeenCalled()
  expect(renderHost).not.toHaveBeenCalled()
  records.push({ closedPopoverDoesNotEvaluateVisibleCallbacks: true })
})

const listFocusItems = [...items, { id: "b", label: "Beta" }]
it.each(["first", "last", null] as const)(
  "retains the source list's %s strategy while keeping its physical render focus separate",
  async (strategy) => {
    let state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
    const Probe = () => {
      state = useContext(ComboBoxStateContext)!
      return null
    }
    render(
      <ComboBox
        aria-label="Source list"
        items={listFocusItems}
        render={(props) => (
          <div {...props}>
            {props.children}
            <Probe />
          </div>
        )}
      >
        {(item) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>}
      </ComboBox>,
    )
    await act(() => state.open(strategy, "manual"))
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument())
    const list = screen.getByRole("listbox")
    expect(state.selectionManager.isFocused).toBe(true)
    expect(state.selectionManager.focusedKey).toBe(strategy === "first" ? 0 : strategy === "last" ? "b" : null)
    expect(list.getAttribute("data-focused")).toBeNull()
    expect(list.getAttribute("data-focus-visible")).toBeNull()
    records.push({
      listStrategy: strategy,
      managerFocused: true,
      focusedKey: state.selectionManager.focusedKey,
      listPhysicallyFocused: false,
      activeDescendant: screen.getByRole("combobox").getAttribute("aria-activedescendant"),
    })
  },
)

it("gives an enabled selected empty key precedence over the requested last list strategy", async () => {
  let state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
  const Probe = () => {
    state = useContext(ComboBoxStateContext)!
    return null
  }
  render(
    <ComboBox
      aria-label="Selected source list"
      selectedKey=""
      items={listFocusItems}
      render={(props) => (
        <div {...props}>
          {props.children}
          <Probe />
        </div>
      )}
    >
      {(item) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>}
    </ComboBox>,
  )
  await act(() => state.open("last", "manual"))
  await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument())
  expect(state.selectionManager.focusedKey).toBe("")
  records.push({ listSelectedEmptyKeyWinsLastStrategy: true })
})

it("keeps initial empty-list autofocus pending until committed items appear without replacing the list host", async () => {
  let state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>,
    setItems!: (items: typeof listFocusItems) => void
  const Probe = () => {
    state = useContext(ComboBoxStateContext)!
    return null
  }
  const Harness = () => {
    const [choices, update] = useState<typeof listFocusItems>([])
    setItems = update
    return (
      <ComboBox
        aria-label="Empty source list"
        allowsEmptyCollection
        items={choices}
        render={(props) => (
          <div {...props}>
            {props.children}
            <Probe />
          </div>
        )}
      >
        {(item) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>}
      </ComboBox>
    )
  }
  render(<Harness />)
  await act(() => state.open("first", "manual"))
  await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument())
  const original = screen.getByRole("listbox")
  expect(state.selectionManager.focusedKey).toBeNull()
  await act(() => setItems(listFocusItems))
  await waitFor(() => expect(state.selectionManager.focusedKey).toBe(0))
  expect(screen.getByRole("listbox") === original).toBe(true)
  records.push({ initialEmptyListWaitsForCommittedItems: true, originalListHostPreserved: true })
})

it("keeps scoped Input rendering, named/null contexts, caller refs and held controlled values", () => {
  const inherited = createRef<HTMLInputElement>(),
    caller = createRef<HTMLInputElement>()
  const order: string[] = [],
    events: unknown[] = []
  const view = render(
    <InputContext.Provider
      value={{
        slots: {
          search: {
            ref: inherited,
            value: "held",
            onChange: (event) => {
              order.push("context")
              events.push(event)
            },
            "aria-invalid": true,
          },
        },
      }}
    >
      <Input
        ref={caller}
        slot="search"
        onChange={(event) => {
          order.push("caller")
          events.push(event)
        }}
        render={(props, state) => <input {...props} data-testid="source-input" data-state-invalid={state.isInvalid} />}
      />
      <Input slot={null} data-testid="isolated-input" />
    </InputContext.Provider>,
  )
  expect(caller.current === inherited.current).toBe(true)
  expect(caller.current === screen.getByTestId("source-input")).toBe(true)
  expect(caller.current?.value).toBe("held")
  expect(caller.current?.dataset.stateInvalid).toBe("true")
  fireEvent.change(caller.current!, { target: { value: "request" } })
  expect(order).toEqual(["context", "caller"])
  expect(events[0] === events[1]).toBe(true)
  expect(caller.current?.value).toBe("held")
  expect((screen.getByTestId("isolated-input") as HTMLInputElement).value).toBe("")
  view.unmount()
  expect([inherited.current, caller.current]).toEqual([null, null])
  records.push({ originalInputRenderAndRefs: true, namedAndNullInputSlots: true, heldOwnerAndOriginalEvents: true })
})

it("keeps typed text from changing pointer-origin Input focus visibility until Escape", async () => {
  const values: {
    isHovered: boolean
    isFocused: boolean
    isFocusVisible: boolean
    isDisabled: boolean
    isInvalid: boolean
  }[] = []
  const user = userEvent.setup()
  render(
    <Input
      aria-label="Source editor"
      render={(props, state) => {
        values.push(state)
        return <input {...props} />
      }}
    />,
  )
  const editor = screen.getByRole("textbox", { name: "Source editor" })
  await user.click(editor)
  expect(values.at(-1)).toMatchObject({
    isFocused: true,
    isFocusVisible: false,
    isHovered: true,
    isDisabled: false,
    isInvalid: false,
  })
  await user.keyboard("a")
  expect(values.at(-1)?.isFocusVisible).toBe(false)
  await user.keyboard("{Escape}")
  expect(values.at(-1)?.isFocusVisible).toBe(true)
  records.push({
    textInputFocusVisibility: "pointer=false, typed-letter=false, Escape=true",
    hoverFromOriginalMouse: true,
  })
})

it("retains complete field, group, list and validation contexts and original label/text/error/value refs", () => {
  const label = createRef<HTMLLabelElement>(),
    text = createRef<HTMLElement>(),
    error = createRef<HTMLElement>(),
    value = createRef<HTMLDivElement>()
  let observed!: {
    input: unknown
    button: unknown
    group: unknown
    list: unknown
    popover: React.ContextType<typeof PopoverContext>
    errors: NonNullable<React.ContextType<typeof FieldErrorContext>>
  }
  const Probe = () => {
    observed = {
      input: useContext(InputContext),
      button: useContext(ButtonContext),
      group: useContext(GroupContext),
      list: useContext(ListBoxContext),
      popover: useContext(PopoverContext),
      errors: useContext(FieldErrorContext)!,
    }
    return (
      <>
        <Label ref={label} data-testid="label">
          A label
        </Label>
        <Text ref={text} slot="description" data-testid="description">
          A description
        </Text>
        <FieldError ref={error} data-testid="error" />
        <ComboBoxValue ref={value} data-testid="value" placeholder="Choose" />
      </>
    )
  }
  render(
    <Form validationErrors={{ entry: ["Server one", "Server two"] }}>
      <ComboBox
        {...options}
        name="entry"
        inputValue="held"
        shouldFocusWrap={false}
        render={(props) => (
          <div {...props}>
            {props.children}
            <Probe />
          </div>
        )}
      />
    </Form>,
  )
  expect(observed.input).toMatchObject({ value: "held", role: "combobox" })
  expect(observed.button).toMatchObject({ isPressed: false })
  expect(observed.group).toMatchObject({ isDisabled: false, isInvalid: true })
  expect(observed.list).toMatchObject({
    shouldUseVirtualFocus: true,
    shouldSelectOnPressUp: true,
    shouldFocusOnHover: true,
    linkBehavior: "selection",
  })
  expect(observed.popover?.clearContexts).toEqual([
    LabelContext,
    ButtonContext,
    InputContext,
    GroupContext,
    TextContext,
  ])
  expect(observed.errors.validationErrors).toEqual(["Server one", "Server two"])
  expect(Object.keys(observed.errors.validationDetails)).toHaveLength(11)
  expect(label.current === screen.getByTestId("label")).toBe(true)
  expect(text.current === screen.getByTestId("description")).toBe(true)
  expect(error.current === screen.getByTestId("error")).toBe(true)
  expect(value.current === screen.getByTestId("value")).toBe(true)
  expect(error.current?.textContent).toBe("Server one Server two")
  records.push({ completeFieldContexts: true, originalRefs: true, validation: observed.errors })
})

it("retains ComboBoxValue's original state/item identity, default text and empty selection placeholder", () => {
  let state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
  let values!: {
    state: typeof state
    selectedItems: unknown[]
    selectedText: string
    isPlaceholder: boolean
    defaultChildren: React.ReactNode
  }
  const Probe = () => {
    state = useContext(ComboBoxStateContext)!
    return (
      <ComboBoxValue data-testid="value" placeholder="Choose">
        {(value) => {
          values = value
          return value.defaultChildren
        }}
      </ComboBoxValue>
    )
  }
  const content = (key: 0 | null) => (
    <ComboBox
      {...options}
      selectedKey={key}
      render={(props) => (
        <div {...props}>
          {props.children}
          <Probe />
        </div>
      )}
    />
  )
  const view = render(content(0))
  expect(values.state === state).toBe(true)
  expect(values.selectedItems[0] === items[0]).toBe(true)
  expect(values.selectedText).toBe("Alpha")
  expect(values.isPlaceholder).toBe(false)
  expect(screen.getByTestId("value").textContent).toBe("Alpha")
  view.rerender(content(null))
  expect(values.selectedItems).toEqual([])
  expect(values.isPlaceholder).toBe(true)
  expect(screen.getByTestId("value").textContent).toBe("Choose")
  records.push({ originalValueStateAndItems: true, zeroIsSelected: true, nullUsesPlaceholder: true })
})

it("preserves named/null text and label slots, caller IDs and React19 ref cleanup", () => {
  const text = createRef<HTMLElement>(),
    label = createRef<HTMLLabelElement>()
  const view = render(
    <>
      <TextContext.Provider value={{ slots: { description: { id: "context-text", ref: text } } }}>
        <Text slot="description" id="caller-text" data-testid="named-text">
          Named
        </Text>
        <Text slot={null} data-testid="isolated-text">
          Isolated
        </Text>
      </TextContext.Provider>
      <LabelContext.Provider value={{ slots: { named: { id: "context-label", ref: label } } }}>
        <Label slot="named" id="caller-label" data-testid="named-label">
          Label
        </Label>
      </LabelContext.Provider>
    </>,
  )
  expect(text.current === screen.getByTestId("named-text")).toBe(true)
  expect(label.current === screen.getByTestId("named-label")).toBe(true)
  expect(screen.getByTestId("named-text").id).toBe("caller-text")
  expect(screen.getByTestId("named-label").id).toBe("caller-label")
  expect(screen.getByTestId("isolated-text").id).toBe("")
  view.unmount()
  expect([text.current, label.current]).toEqual([null, null])
  records.push({
    namedAndNullSlots: true,
    originalRefsRetire: true,
    explicitNativeIdPrecedenceIsSeparateCorrespondence: true,
  })
})

it("keeps controlled ButtonContext pressed state distinct from disabled activation", () => {
  let observed!: { isPressed: boolean; isDisabled: boolean }
  render(
    <ButtonContext.Provider value={{ isPressed: true, isDisabled: true }}>
      <Button>
        {(value) => {
          observed = value
          return "Pressed"
        }}
      </Button>
    </ButtonContext.Provider>,
  )
  expect(observed.isPressed).toBe(true)
  expect(observed.isDisabled).toBe(true)
  expect(screen.getByRole("button")).toBeDisabled()
  records.push({ controlledPressedRetainedWhileDisabled: true })
})

it("uses FieldError's default children for null results, keeps false, and supplies an empty defaultStyle object", () => {
  const ref = createRef<HTMLElement>()
  let styleDefault: unknown
  const content = (children: React.ReactNode | (() => React.ReactNode)) => (
    <Form validationErrors={{ entry: ["One", "Two"] }}>
      <ComboBox
        {...options}
        name="entry"
        render={(props) => (
          <div {...props}>
            {props.children}
            <FieldError
              ref={ref}
              data-testid="error"
              style={(values) => {
                styleDefault = values.defaultStyle
                return {}
              }}
            >
              {children}
            </FieldError>
          </div>
        )}
      />
    </Form>
  )
  const view = render(content(null))
  expect(screen.getByTestId("error").textContent).toBe("One Two")
  expect(styleDefault).toEqual({})
  view.rerender(content(() => null))
  expect(screen.getByTestId("error").textContent).toBe("One Two")
  view.rerender(content(() => false))
  expect(ref.current).not.toBeNull()
  expect(screen.getByTestId("error").textContent).toBe("")
  records.push({ fieldErrorNullUsesDefault: true, falseIsRetained: true, defaultStyleIsEmptyObject: true })
})

it("uses ComboBoxValue's default children for null results and retains false", () => {
  const ref = createRef<HTMLDivElement>()
  let styleDefault: unknown
  const content = (children: React.ReactNode | (() => React.ReactNode)) => (
    <ComboBox
      {...options}
      selectedKey={0}
      render={(props) => (
        <div {...props}>
          {props.children}
          <ComboBoxValue
            ref={ref}
            data-testid="value"
            style={(values) => {
              styleDefault = values.defaultStyle
              return {}
            }}
          >
            {children}
          </ComboBoxValue>
        </div>
      )}
    />
  )
  const view = render(content(null))
  expect(screen.getByTestId("value").textContent).toBe("Alpha")
  expect(styleDefault).toEqual({})
  view.rerender(content(() => null))
  expect(screen.getByTestId("value").textContent).toBe("Alpha")
  view.rerender(content(() => false))
  expect(ref.current).not.toBeNull()
  expect(screen.getByTestId("value").textContent).toBe("")
  records.push({ valueNullUsesDefault: true, falseIsRetained: true, defaultStyleIsEmptyObject: true })
})

it("evaluates FieldError style before children and passes complete validation to the custom host", () => {
  const order: string[] = []
  let errors: readonly string[] = []
  render(
    <Form validationErrors={{ entry: ["One", "Two"] }}>
      <ComboBox
        {...options}
        name="entry"
        render={(props) => (
          <div {...props}>
            {props.children}
            <FieldError
              style={() => {
                order.push("style")
                return {}
              }}
              render={(props, validation) => {
                order.push("render")
                errors = validation.validationErrors
                return <span {...props} data-testid="custom-error" />
              }}
            >
              {() => {
                order.push("children")
                return null
              }}
            </FieldError>
          </div>
        )}
      />
    </Form>,
  )
  expect(order.slice(0, 3)).toEqual(["style", "children", "render"])
  expect(errors).toEqual(["One", "Two"])
  expect(screen.getByTestId("custom-error").textContent).toBe("One Two")
  records.push({ styleChildrenRenderOrder: true, completeValidationInCustomHost: true })
})

it.each(
  ["selection", "action", "link", "action-link"].flatMap((kind) =>
    ["mouse", "enter", "tab"].map((mode) => ({ kind, mode })),
  ),
)("preserves original item callbacks and business action precedence: $kind/$mode", async ({ kind, mode }) => {
  const trace: unknown[] = [],
    user = userEvent.setup()
  render(
    <RouterProvider navigate={(href) => trace.push(["navigate", href])}>
      <ComboBox
        aria-label="Item actions"
        items={[{ id: 0, label: "Zero" }]}
        value={null}
        inputValue=""
        isOpen
        onChange={(key) => trace.push(["select", key])}
        onOpenChange={(value) => trace.push(["open", value])}
      >
        {(item) => (
          <ListBoxItem
            id={item.id}
            textValue={item.label}
            href={kind.includes("link") ? "/zero" : undefined}
            onAction={kind.includes("action") ? () => trace.push(["action"]) : undefined}
            onPressChange={(value) => trace.push(["change", value])}
            onPressStart={() => trace.push(["start"])}
            onPressUp={() => trace.push(["up"])}
            onPressEnd={() => trace.push(["end"])}
            onPress={() => trace.push(["press"])}
          >
            {item.label}
          </ListBoxItem>
        )}
      </ComboBox>
    </RouterProvider>,
  )
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  trace.length = 0
  const option = await screen.findByRole("option", { name: "Zero" }),
    input = screen.getByRole("combobox")
  const business =
    kind === "selection"
      ? [["select", 0]]
      : kind === "action" || (kind === "action-link" && mode === "mouse")
        ? [["action"], ["open", false]]
        : mode === "tab"
          ? [["open", false]]
          : [
              ["navigate", "/zero"],
              ["open", false],
            ]
  if (mode === "mouse") {
    await user.pointer({ target: option, keys: "[MouseLeft>]" })
    expect(trace).toEqual([["start"], ["change", true]])
    await user.pointer({ target: option, keys: "[/MouseLeft]" })
    const expected = kind.includes("action")
      ? [["start"], ["change", true], ["up"], ["end"], ["change", false], ...business, ["press"]]
      : [["start"], ["change", true], ...business, ["up"], ["end"], ["change", false], ["press"]]
    expect(trace).toEqual(expected)
  } else {
    await act(() => (input as HTMLInputElement).focus())
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" })
    trace.length = 0
    fireEvent.keyDown(input, { key: mode === "enter" ? "Enter" : "Tab", code: mode === "enter" ? "Enter" : "Tab" })
    expect(trace).toEqual(business)
  }
  records.push({ case: "item-action-order", kind, mode, trace })
})

it.each(["pointer-empty", "input-zero"])(
  "preserves a declined controlled selection without a close request: %s",
  async (mode) => {
    const changes: unknown[] = [],
      closes: unknown[] = [],
      user = userEvent.setup()
    let state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
    const Capture = () => {
      state = useContext(ComboBoxStateContext)!
      return null
    }
    const values = mode === "pointer-empty" ? [{ id: "", label: "Empty" }] : [{ id: 0, label: "Zero" }]
    render(
      <>
        <ComboBox
          aria-label="Veto choices"
          items={values}
          value={null}
          inputValue={mode === "pointer-empty" ? "Empty" : ""}
          isOpen
          onChange={(key) => changes.push(key)}
          onOpenChange={(value) => closes.push(value)}
        >
          {(item) => (
            <ListBoxItem id={item.id} textValue={item.label}>
              <Capture />
              {item.label}
            </ListBoxItem>
          )}
        </ComboBox>
      </>,
    )
    await user.click(screen.getByRole("button", { name: "Show suggestions" }))
    closes.length = 0
    const editor = screen.getByRole("combobox")
    for (let turn = 0; turn < 2; turn++) {
      if (mode === "pointer-empty") await user.click(await screen.findByRole("option", { name: "Empty" }))
      else {
        await act(() => (editor as HTMLInputElement).focus())
        if (turn === 0) fireEvent.keyDown(editor, { key: "ArrowDown", code: "ArrowDown" })
        fireEvent.keyDown(editor, { key: "Enter", code: "Enter" })
        expect(state.selectionManager.focusedKey).toBe(0)
      }
    }
    expect(changes).toEqual(mode === "pointer-empty" ? ["", ""] : [0, 0])
    expect(closes).toEqual([])
    expect(state.value).toBeNull()
    expect(screen.getByRole("combobox")).toBe(editor)
    records.push({ case: "controlled-selection-veto", mode, changes, closes })
  },
)

it("retains complete item render/style values, custom original host and label/description/indicator contexts", async () => {
  const original = createRef<HTMLDivElement>(),
    label = createRef<HTMLElement>(),
    description = createRef<HTMLElement>()
  let flags: Record<string, unknown> = {},
    renderFlags: Record<string, unknown> = {},
    styleFlags: Record<string, unknown> = {},
    indicator: unknown
  const Capture = () => {
    indicator = useContext(SelectionIndicatorContext)
    return null
  }
  const user = userEvent.setup()
  render(
    <ComboBox aria-label="Item render choices" items={[{ id: 0, label: "Zero" }]} isOpen>
      {(item) => (
        <ListBoxItem
          id={item.id}
          textValue={item.label}
          ref={original}
          textSize="large"
          customStyles={{ padding: 9 }}
          style={(values) => {
            styleFlags = values
            return { marginTop: 3 }
          }}
          render={(props, values) => {
            renderFlags = values
            return <div {...props} data-testid="rendered-item" />
          }}
        >
          {(values) => {
            flags = values
            return (
              <>
                <Capture />
                <Text ref={label} slot="label">
                  Zero
                </Text>
                <Text ref={description} slot="description">
                  Detail
                </Text>
              </>
            )
          }}
        </ListBoxItem>
      )}
    </ComboBox>,
  )
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  const host = await screen.findByTestId("rendered-item")
  const expected = {
    isSelected: false,
    isDisabled: false,
    isHovered: false,
    isPressed: false,
    allowsSelection: true,
    hasAction: false,
    allowsDragging: false,
    selectionMode: "single",
    selectionBehavior: "toggle",
  }
  for (const values of [flags, renderFlags, styleFlags]) {
    expect(values).toMatchObject(expected)
    expect(values).toHaveProperty("isDragging")
    expect(values).toHaveProperty("isDropTarget")
  }
  expect(original.current).toBe(host)
  expect(host.style.padding).toBe("9px")
  expect(host.style.marginTop).toBe("3px")
  expect(host.getAttribute("aria-labelledby")?.split(" ")).toContain(label.current!.id)
  expect(host.getAttribute("aria-describedby")?.split(" ")).toContain(description.current!.id)
  expect(indicator).toMatchObject({ isSelected: false })
  records.push({
    case: "item-render-context",
    flags: Object.fromEntries(
      Object.entries(flags).map(([key, value]) => [key, value === undefined ? "[undefined]" : value]),
    ),
    styleKeys: Object.keys(styleFlags),
    customOriginalHost: true,
    labelId: label.current!.id,
    descriptionId: description.current!.id,
  })
})

it("retires the focused key when an authored option becomes disabled", async () => {
  let disable!: () => void, state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
  const Capture = () => {
    state = useContext(ComboBoxStateContext)!
    return null
  }
  const Harness = () => {
    const [disabled, setDisabled] = useState(false)
    disable = () => setDisabled(true)
    return (
      <ComboBox aria-label="Disabled takeover" items={[{ id: 0, label: "Zero", disabled }]} isOpen>
        {(item) => (
          <ListBoxItem id={item.id} textValue={item.label} isDisabled={item.disabled}>
            <Capture />
            {item.label}
          </ListBoxItem>
        )}
      </ComboBox>
    )
  }
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  const original = await screen.findByRole("option", { name: "Zero" })
  await user.hover(original)
  expect(state.selectionManager.focusedKey).toBe(0)
  await act(disable)
  expect(state.selectionManager.focusedKey).toBeNull()
  expect(screen.getByRole("option", { name: "Zero" })).toBe(original)
  expect(original.getAttribute("aria-disabled")).toBe("true")
  records.push({ case: "authored-disabled-focus-retirement", focusedKey: null, originalHost: true })
})

it.each([null, false, 0, "", undefined])(
  "preserves explicit item content independently of its textValue: %s",
  async (children) => {
    const user = userEvent.setup()
    render(
      <ComboBox aria-label="Content ownership" items={[{ id: 0 }]} isOpen>
        {(item) => (
          <ListBoxItem id={item.id} textValue="Search text">
            {children}
          </ListBoxItem>
        )}
      </ComboBox>,
    )
    await user.click(screen.getByRole("button", { name: "Show suggestions" }))
    const option = await screen.findByRole("option")
    expect(option.textContent).toBe(children === 0 ? "0" : "")
    records.push({
      case: "item-content-presence",
      input: children === undefined ? "[undefined]" : children,
      text: option.textContent,
    })
  },
)

it("retains section/header custom hosts, original refs and presentational group naming", async () => {
  const section = createRef<HTMLElement>(),
    header = createRef<HTMLElement>(),
    user = userEvent.setup()
  const sectionValues: unknown[] = [],
    headerValues: unknown[] = []
  render(
    <ComboBox aria-label="Sections" items={[]} isOpen>
      <ListBoxSection
        id="metadata-section"
        aria-label="Fallback"
        ref={section}
        style={{ padding: 6 }}
        render={(props, values) => {
          sectionValues.push(values)
          return <section {...props} data-testid="source-section" />
        }}
      >
        <Header
          id="authored-heading"
          ref={header}
          style={{ color: "red" }}
          render={(props, values) => {
            headerValues.push(values)
            return <header {...props} data-testid="source-heading" />
          }}
        >
          Choices
        </Header>
        <ListBoxItem id={0} textValue="Zero">
          Zero
        </ListBoxItem>
      </ListBoxSection>
    </ComboBox>,
  )
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  const group = await screen.findByRole("group", { name: "Choices" }),
    heading = screen.getByTestId("source-heading")
  expect(group).toBe(section.current)
  expect(heading).toBe(header.current)
  expect(group.id).toBe("")
  expect(group.getAttribute("aria-labelledby")).toBe(heading.id)
  expect(heading.id).not.toBe("")
  expect(heading.id).not.toBe("authored-heading")
  expect(heading.getAttribute("role")).toBe("presentation")
  expect(group.style.padding).toBe("6px")
  expect(heading.style.color).toBe("red")
  expect(sectionValues.length).toBeGreaterThan(0)
  expect(sectionValues.every((value) => value === undefined)).toBe(true)
  expect(headerValues.length).toBeGreaterThan(0)
  expect(headerValues.every((value) => value === undefined)).toBe(true)
  const input = screen.getByRole("combobox")
  await act(() => (input as HTMLInputElement).focus())
  await user.click(heading)
  expect(document.activeElement).toBe(input)
  records.push({
    case: "section-header-original-host",
    groupName: "Choices",
    headerRole: "presentation",
    renderState: "undefined",
    inputRetained: true,
  })
})

it("retires section heading references on original header replacement and removal", async () => {
  let replace!: () => void, remove!: () => void
  const section = createRef<HTMLElement>(),
    header = createRef<HTMLElement>(),
    user = userEvent.setup()
  const Harness = () => {
    const [phase, setPhase] = useState(0)
    replace = () => setPhase(1)
    remove = () => setPhase(2)
    return (
      <ComboBox aria-label="Header lifetime" items={[]} isOpen>
        <ListBoxSection id="section" aria-label="Fallback" ref={section}>
          {phase === 2 ? null : (
            <Header key={phase} id={phase === 0 ? "before" : "after"} ref={header}>
              Choices
            </Header>
          )}
          <ListBoxItem id={0} textValue="Zero">
            Zero
          </ListBoxItem>
        </ListBoxSection>
      </ComboBox>
    )
  }
  render(<Harness />)
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  await screen.findByRole("group", { name: "Choices" })
  const original = header.current
  const generatedID = header.current!.id
  expect(section.current!.getAttribute("aria-labelledby")).toBe(generatedID)
  await act(replace)
  expect(header.current).not.toBe(original)
  expect(header.current).not.toBeNull()
  expect(header.current!.id).toBe(generatedID)
  expect(section.current!.getAttribute("aria-labelledby")).toBe(generatedID)
  await act(remove)
  expect(header.current).toBeNull()
  expect(section.current!.getAttribute("aria-labelledby")).toBeNull()
  expect(screen.getByRole("group", { name: "Fallback" })).toBe(section.current)
  records.push({ case: "section-header-lifetime", originalRetiredOnKeyReplacement: true, referenceRetired: true })
})

it("selects on mouse release over an option after an editor-origin press", async () => {
  const user = userEvent.setup(),
    changes: unknown[] = []
  render(<ComboBox {...options} value={null} inputValue="" isOpen onChange={(key) => changes.push(key)} />)
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  const input = screen.getByRole("combobox"),
    option = await screen.findByRole("option", { name: "Alpha" })
  await user.pointer({ target: input, keys: "[MouseLeft>]" })
  expect(changes).toEqual([])
  await user.pointer({ target: option })
  await user.pointer({ target: option, keys: "[/MouseLeft]" })
  expect(changes).toEqual([0])
  records.push({ case: "editor-origin-option-release", changes })
})

let keyboardState: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
const KeyboardCapture = () => {
  keyboardState = useContext(ComboBoxStateContext)!
  return null
}
const keyboardItems = Array.from({ length: 8 }, (_, id) => ({ id, label: `Option ${id}` }))
const mountKeyboardOracle = async () => {
  const user = userEvent.setup()
  render(
    <ComboBox aria-label="Query" items={keyboardItems} inputValue="" onInputChange={() => {}}>
      {(item) => (
        <ListBoxItem id={item.id} textValue={item.label}>
          <KeyboardCapture />
          {item.label}
        </ListBoxItem>
      )}
    </ComboBox>,
  )
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  await screen.findByRole("option", { name: "Option 0" })
  return screen.getByRole("combobox")
}
it("preserves original editor boundary and Shift+Home navigation", async () => {
  const input = await mountKeyboardOracle()
  expect(keyboardState.selectionManager.focusedKey).toBe(null)
  fireEvent.keyDown(input, { key: "Home", shiftKey: true })
  expect(keyboardState.selectionManager.focusedKey).toBe(null)
  fireEvent.keyDown(input, { key: "End" })
  expect(keyboardState.selectionManager.focusedKey).toBe(7)
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(keyboardState.selectionManager.focusedKey).toBe(7)
  fireEvent.keyDown(input, { key: "Home" })
  fireEvent.keyDown(input, { key: "ArrowUp" })
  expect(keyboardState.selectionManager.focusedKey).toBe(0)
})
it("uses original scrollable list row and viewport geometry for page navigation", async () => {
  const input = await mountKeyboardOracle()
  const list = screen.getByRole("listbox")
  Object.defineProperties(list, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 240 },
    clientWidth: { configurable: true, value: 100 },
    scrollWidth: { configurable: true, value: 100 },
  })
  list.style.overflowY = "auto"
  list.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    toJSON: () => ({}),
  })
  screen.getAllByRole("option").forEach((node, i) => {
    node.getBoundingClientRect = () => ({
      x: 0,
      y: i * 30,
      left: 0,
      top: i * 30,
      right: 100,
      bottom: i * 30 + 30,
      width: 100,
      height: 30,
      toJSON: () => ({}),
    })
  })
  fireEvent.keyDown(input, { key: "Home" })
  expect(keyboardState.selectionManager.focusedKey).toBe(0)
  fireEvent.keyDown(input, { key: "PageDown" })
  expect(keyboardState.selectionManager.focusedKey).toBe(3)
  fireEvent.keyDown(input, { key: "PageDown" })
  expect(keyboardState.selectionManager.focusedKey).toBe(6)
  fireEvent.keyDown(input, { key: "PageUp" })
  expect(keyboardState.selectionManager.focusedKey).toBe(3)
})

it("retains original editor boundaries after opaque linked collection reordering", async () => {
  const user = userEvent.setup()
  let reverse!: () => void
  const Opaque = () => {
    const [reversed, setReversed] = useState(false)
    reverse = () => setReversed(true)
    return (reversed ? [...keyboardItems].reverse() : keyboardItems).map((item) => (
      <ListBoxItem key={item.id} id={item.id} textValue={item.label}>
        <KeyboardCapture />
        {item.label}
      </ListBoxItem>
    ))
  }
  render(
    <ComboBox aria-label="Query" items={keyboardItems} inputValue="" onInputChange={() => {}}>
      <Opaque />
    </ComboBox>,
  )
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  await screen.findByRole("option", { name: "Option 0" })
  const input = screen.getByRole("combobox")
  fireEvent.keyDown(input, { key: "Home" })
  expect(keyboardState.selectionManager.focusedKey).toBe(0)
  await act(reverse)
  fireEvent.keyDown(input, { key: "Home" })
  expect(keyboardState.selectionManager.focusedKey).toBe(7)
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(keyboardState.selectionManager.focusedKey).toBe(6)
  fireEvent.keyDown(input, { key: "End" })
  expect(keyboardState.selectionManager.focusedKey).toBe(0)
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(keyboardState.selectionManager.focusedKey).toBe(0)
})
