import { writeFileSync } from "node:fs"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createRef, useContext, type ContextType } from "react"
import { createPortal } from "react-dom"
import { ComboBoxStateContext, Form } from "react-aria-components"
import { afterAll, expect, it, vi } from "vitest"

import Button from "../../../../packages/react/src/components/Button/Button"
import ComboBox from "../../../../packages/react/src/components/ComboBox/ComboBox"
import ListBoxItem from "../../../../packages/react/src/components/ListBoxItem/ListBoxItem"
import TagComboBox from "../../../../packages/react/src/components/TagComboBox/TagComboBox"

const items = [
  { id: 0, label: "Alpha" },
  { id: "", label: "Empty" },
  { id: "b", label: "Beta" },
]
const options = {
  "aria-label": "Source field",
  items,
  children: (item: (typeof items)[number]) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>,
}
const tags = {
  ...options,
  selectedItems: [],
  onSelectedItemsChange: () => {},
  getItemKey: (item: (typeof items)[number]) => item.id,
  getItemTextValue: (item: (typeof items)[number]) => item.label,
}
const entries = (form: HTMLFormElement) => [...new FormData(form).entries()]
const records: unknown[] = []
afterAll(() => {
  if (process.env.CODON_FORM_OBSERVATIONS)
    writeFileSync(process.env.CODON_FORM_OBSERVATIONS, JSON.stringify(records, null, 2))
})

it("serializes current inner keys and query text rather than selected tag objects", () => {
  const form = createRef<HTMLFormElement>()
  render(
    <Form ref={form}>
      <ComboBox {...options} name="same" selectedKey={0} />
      <ComboBox {...options} name="same" selectedKey="" />
      <TagComboBox {...tags} name="same" inputValue="held" selectedItems={[items[0]]} />
      <TagComboBox {...tags} name="text" formValue="text" inputValue="held" />
      <TagComboBox {...tags} name="custom" formValue="key" allowsCustomValue inputValue="draft" />
    </Form>,
  )
  const result = entries(form.current!)
  expect(result).toEqual([
    ["same", "0"],
    ["same", ""],
    ["same", ""],
    ["text", "held"],
    ["custom", "draft"],
  ])
  records.push({ serialization: result })
})

it("retains the pinned disabled hidden-key discrepancy and readonly text inclusion", () => {
  const form = createRef<HTMLFormElement>()
  render(
    <Form ref={form}>
      <ComboBox {...options} name="disabled-key" selectedKey={0} isDisabled />
      <ComboBox {...options} name="disabled-text" formValue="text" inputValue="excluded" isDisabled />
      <ComboBox {...options} name="readonly" formValue="text" inputValue="retained" isReadOnly />
      <ComboBox {...options} formValue="text" inputValue="unnamed" />
    </Form>,
  )
  const result = entries(form.current!)
  expect(result).toEqual([
    ["disabled-key", "0"],
    ["readonly", "retained"],
  ])
  records.push({
    disabledKeyHiddenInputIsNotDisabled: true,
    entries: result,
    approvedNativeDisabledExclusionRemainsExplicit: true,
  })
})

it("follows actual document order for external association, reorder, hidden mounted fields and empty form IDs", () => {
  const form = createRef<HTMLFormElement>()
  const content = (reverse: boolean) => (
    <>
      <ComboBox {...options} name="external" form="owner" formValue="text" inputValue="before" />
      <Form ref={form} id="owner">
        {(reverse ? ["second", "first"] : ["first", "second"]).map((name) => (
          <div key={name} hidden={name === "first"}>
            <ComboBox {...options} name="same" formValue="text" inputValue={name} />
          </div>
        ))}
        <ComboBox {...options} name="disassociated" form="" formValue="text" inputValue="no" />
      </Form>
      <ComboBox {...options} name="external" form="owner" formValue="text" inputValue="after" />
    </>
  )
  const view = render(content(false))
  expect(entries(form.current!)).toEqual([
    ["external", "before"],
    ["same", "first"],
    ["same", "second"],
    ["external", "after"],
  ])
  view.rerender(content(true))
  const result = entries(form.current!)
  expect(result).toEqual([
    ["external", "before"],
    ["same", "second"],
    ["same", "first"],
    ["external", "after"],
  ])
  records.push({ documentOrder: result, hiddenMountedIncluded: true })
})

it("records direct field reset before the bubbled form callback and capture-phase cancellation", () => {
  const form = createRef<HTMLFormElement>()
  const calls: unknown[] = []
  const changed = vi.fn((value) => calls.push(["key", value]))
  const content = (key: 0 | "b", cancel = false, capture = false) => (
    <Form
      ref={form}
      onResetCapture={(event) => {
        if (capture) event.preventDefault()
      }}
      onReset={(event) => {
        calls.push(["reset", event.type])
        if (cancel) event.preventDefault()
      }}
    >
      <ComboBox {...options} name="key" selectedKey={key} onSelectionChange={changed} />
    </Form>
  )
  const view = render(content(0))
  view.rerender(content("b"))
  calls.length = 0
  act(() => form.current!.reset())
  expect(calls).toEqual([
    ["key", 0],
    ["reset", "reset"],
  ])
  expect(entries(form.current!)).toEqual([["key", "b"]])
  view.rerender(content("b", true))
  calls.length = 0
  act(() => form.current!.reset())
  expect(calls).toEqual([
    ["key", 0],
    ["reset", "reset"],
  ])
  view.rerender(content("b", false, true))
  calls.length = 0
  act(() => form.current!.reset())
  expect(calls).toEqual([["reset", "reset"]])
  records.push({
    resetOrder: ["initial-key-request", "bubbled-form"],
    ownerVetoRetainsKey: true,
    bubbledCancellationDoesNotUndoField: true,
    captureCancellationSkipsField: true,
  })
})

it("retains all validity flags and form server errors through the complete state context", () => {
  let state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
  const Probe = () => {
    state = useContext(ComboBoxStateContext)!
    return null
  }
  render(
    <Form validationErrors={{ entry: "Server says no" }}>
      <ComboBox
        {...options}
        name="entry"
        render={(props) => (
          <div {...props}>
            {props.children}
            <Probe />
          </div>
        )}
      />
    </Form>,
  )
  expect(state.displayValidation.validationErrors).toEqual(["Server says no"])
  expect(Object.keys(state.displayValidation.validationDetails).sort()).toEqual([
    "badInput",
    "customError",
    "patternMismatch",
    "rangeOverflow",
    "rangeUnderflow",
    "stepMismatch",
    "tooLong",
    "tooShort",
    "typeMismatch",
    "valid",
    "valueMissing",
  ])
  expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true")
  records.push({
    serverErrors: state.displayValidation.validationErrors,
    validity: state.displayValidation.validationDetails,
  })
})

it("keeps aria validation observational while native requestSubmit suppresses invalid submission", () => {
  const submit = vi.fn((event) => event.preventDefault())
  const form = createRef<HTMLFormElement>()
  const content = (validationBehavior: "native" | "aria") => (
    <Form ref={form} validationBehavior={validationBehavior} onSubmit={submit}>
      <ComboBox {...options} name="entry" isRequired />
    </Form>
  )
  const view = render(content("native"))
  expect(screen.getByRole("combobox")).toHaveAttribute("required")
  act(() => form.current!.requestSubmit())
  expect(submit).not.toHaveBeenCalled()
  view.rerender(content("aria"))
  expect(screen.getByRole("combobox")).not.toHaveAttribute("required")
  expect(screen.getByRole("combobox")).toHaveAttribute("aria-required", "true")
  act(() => form.current!.requestSubmit())
  expect(submit).toHaveBeenCalledOnce()
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Alpha" } })
  records.push({ nativeInvalidSuppressesSubmit: true, ariaAllowsSubmit: true })
})

it("records DOM portal association separately from the approved native retained-tree correspondence", () => {
  const target = document.createElement("div")
  document.body.append(target)
  const form = createRef<HTMLFormElement>()
  const view = render(
    <Form id="source-portal-form" ref={form}>
      <ComboBox {...options} name="local" formValue="text" inputValue="inside" />
      {createPortal(
        <>
          <ComboBox {...options} name="implicit-portal" formValue="text" inputValue="outside" />
          <ComboBox
            {...options}
            name="explicit-portal"
            form="source-portal-form"
            formValue="text"
            inputValue="associated"
          />
        </>,
        target,
      )}
    </Form>,
  )
  expect(entries(form.current!)).toEqual([
    ["explicit-portal", "associated"],
    ["local", "inside"],
  ])
  records.push({
    sourcePortalMembershipUsesDOMAncestry: true,
    sourceEntries: entries(form.current!),
    approvedNativeCorrespondence:
      "One Fabric document uses retained committed ancestry/order, including logical portals and modal descendants",
  })
  view.unmount()
  target.remove()
})

it("focuses the first invalid original editor in current document order after reorder", () => {
  const form = createRef<HTMLFormElement>(),
    focuses: EventTarget[] = [],
    submit = vi.fn()
  const content = (order: readonly string[]) => (
    <>
      <Form ref={form} onSubmit={submit}>
        {order.map((name) => (
          <ComboBox
            {...options}
            key={name}
            aria-label={name}
            name={name}
            formValue="text"
            inputValue=""
            isRequired
            onFocus={(event) => focuses.push(event.target)}
          />
        ))}
      </Form>
      <button type="button">Outside focus</button>
    </>
  )
  const view = render(content(["later", "first"]))
  const later = screen.getByRole("combobox", { name: "later" }),
    first = screen.getByRole("combobox", { name: "first" })
  act(() => form.current!.requestSubmit())
  expect(document.activeElement).toBe(later)
  expect(focuses.at(-1)).toBe(later)
  act(() => screen.getByText("Outside focus").focus())
  view.rerender(content(["first", "later"]))
  expect(screen.getByRole("combobox", { name: "first" })).toBe(first)
  expect(screen.getByRole("combobox", { name: "later" })).toBe(later)
  act(() => form.current!.requestSubmit())
  expect(document.activeElement).toBe(first)
  expect(focuses.at(-1)).toBe(first)
  expect(first).toHaveValue("")
  expect(later).toHaveValue("")
  expect(submit).not.toHaveBeenCalled()
  records.push({
    invalidFocusUsesCurrentDocumentOrder: true,
    originalEditorsRetained: true,
    heldEmptyQueriesRetained: true,
  })
})

it("retains the original outside focus when invalid capture prevents the source focus default", () => {
  const form = createRef<HTMLFormElement>(),
    focus = vi.fn(),
    invalid = vi.fn((event) => event.preventDefault())
  render(
    <>
      <Form ref={form} onInvalidCapture={invalid}>
        <ComboBox {...options} isRequired inputValue="" onFocus={focus} />
      </Form>
      <button type="button">Outside focus</button>
    </>,
  )
  const outside = screen.getByText("Outside focus"),
    editor = screen.getByRole("combobox")
  act(() => outside.focus())
  act(() => form.current!.requestSubmit())
  expect(invalid).toHaveBeenCalled()
  expect(document.activeElement).toBe(outside)
  expect(focus).not.toHaveBeenCalled()
  expect(editor).toHaveValue("")
  records.push({ invalidCapturePreventsSourceFocusDefault: true, originalOutsideFocusRetained: true })
})

it("excludes empty readonly and disabled controls from required constraint validation", () => {
  const form = createRef<HTMLFormElement>(),
    submit = vi.fn((event) => event.preventDefault())
  render(
    <Form ref={form} onSubmit={submit}>
      <ComboBox
        {...options}
        aria-label="Readonly"
        name="readonly"
        formValue="text"
        inputValue=""
        isRequired
        isReadOnly
      />
      <ComboBox
        {...options}
        aria-label="Disabled"
        name="disabled"
        formValue="text"
        inputValue=""
        isRequired
        isDisabled
      />
    </Form>,
  )
  for (const input of screen.getAllByRole("combobox") as HTMLInputElement[]) {
    expect(input.willValidate).toBe(false)
    expect(input.validity.valueMissing).toBe(false)
    expect(input.validity.valid).toBe(true)
  }
  act(() => form.current!.requestSubmit())
  expect(submit).toHaveBeenCalledOnce()
  expect(entries(form.current!)).toEqual([["readonly", ""]])
  records.push({ emptyReadonlyAndDisabledRequiredControlsAreNotInvalid: true, readonlyStillSerializes: true })
})

it("exposes a nonempty native constraint message in the complete source validation context", () => {
  const form = createRef<HTMLFormElement>()
  let state!: NonNullable<ContextType<typeof ComboBoxStateContext>>
  const Probe = () => {
    state = useContext(ComboBoxStateContext)!
    return null
  }
  render(
    <Form ref={form}>
      <ComboBox
        {...options}
        name="required"
        formValue="text"
        inputValue=""
        isRequired
        render={(props) => (
          <div {...props}>
            {props.children}
            <Probe />
          </div>
        )}
      />
    </Form>,
  )
  act(() => form.current!.requestSubmit())
  const validation = state!.displayValidation
  expect(validation.isInvalid).toBe(true)
  expect(validation.validationDetails.valueMissing).toBe(true)
  expect(validation.validationErrors.length).toBeGreaterThan(0)
  expect(validation.validationErrors[0].length).toBeGreaterThan(0)
  records.push({
    requiredConstraintMessageIsNonempty: true,
    sourceMessage: validation.validationErrors[0],
    nativeMessageUsesLocalizableCaption: true,
  })
})

it("requests the default query before the initial key and leaves controlled owners authoritative", () => {
  const form = createRef<HTMLFormElement>()
  const calls: unknown[] = []
  const content = (key: 0 | "b", query: string) => (
    <Form ref={form} onReset={() => calls.push(["form"])}>
      <ComboBox
        {...options}
        name="entry"
        selectedKey={key}
        inputValue={query}
        onInputChange={(value) => calls.push(["query", value])}
        onSelectionChange={(value) => calls.push(["key", value])}
      />
    </Form>
  )
  const view = render(content(0, "initial controlled query"))
  view.rerender(content("b", "held draft"))
  calls.length = 0
  act(() => form.current!.reset())
  expect(calls).toEqual([["query", "Alpha"], ["key", 0], ["form"]])
  expect(screen.getByRole("combobox")).toHaveValue("held draft")
  expect(entries(form.current!)).toEqual([["entry", "b"]])
  records.push({ resetQueryBeforeKey: calls, controlledQueryAndKeyRemainAuthoritative: true })
})

it("retains server errors for programmatic reset and clears them for the original reset button event", () => {
  const form = createRef<HTMLFormElement>()
  let state!: NonNullable<React.ContextType<typeof ComboBoxStateContext>>
  const Probe = () => {
    state = useContext(ComboBoxStateContext)!
    return null
  }
  render(
    <Form ref={form} validationErrors={{ entry: "Server says no" }}>
      <ComboBox
        {...options}
        name="entry"
        render={(props) => (
          <div {...props}>
            {props.children}
            <Probe />
          </div>
        )}
      />
      <button type="reset">Reset fields</button>
    </Form>,
  )
  expect(state.displayValidation.validationErrors).toEqual(["Server says no"])
  act(() => form.current!.reset())
  expect(state.displayValidation.validationErrors).toEqual(["Server says no"])
  fireEvent.click(screen.getByRole("button", { name: "Reset fields" }))
  expect(state.displayValidation.validationErrors).toEqual([])
  records.push({ programmaticResetRetainsServerErrors: true, nativeResetEventClearsServerErrors: true })
})

it("records original submit-button click identity and cancellation before the form default", () => {
  const button = createRef<HTMLButtonElement>()
  const submitted = vi.fn((event) => event.preventDefault())
  const observed: Event[] = []
  let cancel = true
  render(
    <Form id="submit-owner" onSubmit={submitted}>
      <Button
        ref={button}
        type="submit"
        onClick={(event) => {
          observed.push(event.nativeEvent)
          if (cancel) event.preventDefault()
        }}
      >
        Submit fields
      </Button>
    </Form>,
  )
  const original = button.current
  const prevented = new MouseEvent("click", { bubbles: true, cancelable: true })
  act(() => {
    button.current!.dispatchEvent(prevented)
  })
  expect(observed[0] === prevented).toBe(true)
  expect(prevented.defaultPrevented).toBe(true)
  expect(submitted).not.toHaveBeenCalled()
  cancel = false
  const allowed = new MouseEvent("click", { bubbles: true, cancelable: true })
  act(() => {
    button.current!.dispatchEvent(allowed)
  })
  expect(observed[1] === allowed).toBe(true)
  expect(submitted).toHaveBeenCalledOnce()
  expect(button.current === original).toBe(true)
  records.push({
    originalSourceClickIdentity: true,
    cancelledClickStopsFormDefault: true,
    nativeCorrespondence:
      "NativeFormAction retains its original admitted native press/key/activation event and its veto before native form callbacks",
  })
})
