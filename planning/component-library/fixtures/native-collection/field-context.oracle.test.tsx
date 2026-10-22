import { writeFileSync } from "node:fs"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef, useContext, useState } from "react"
import {
  ButtonContext,
  ComboBoxStateContext,
  ComboBoxValue,
  FieldError,
  FieldErrorContext,
  Form,
  GroupContext,
  InputContext,
  Label,
  LabelContext,
  ListBoxContext,
  Text,
  TextContext,
  PopoverContext,
} from "react-aria-components"
import { afterAll, expect, it } from "vitest"

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
afterAll(() => {
  if (process.env.CODON_FIELD_CONTEXT_OBSERVATIONS)
    writeFileSync(process.env.CODON_FIELD_CONTEXT_OBSERVATIONS, JSON.stringify(records, null, 2))
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
