import "../../../collection/__tests__/nativeReceipts"

import { createRef, useContext, useState, type ReactNode } from "react"
import { Text as RNText, TextInput, View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { NativeListStateContext } from "../../../collection/state"
import { registerNativeFocusTarget } from "../../../input/focus"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import type { TNativeTextRef } from "../../Text/types"
import { NativeCollectionComboBox } from "../CollectionComboBox"
import { NativeComboBoxButton } from "../CollectionComboBoxTrigger"
import {
  NativeComboBoxButtonContext,
  NativeComboBoxFieldErrorContext,
  NativeComboBoxFieldIdsContext,
  NativeComboBoxGroupContext,
  NativeComboBoxInputContext,
  NativeComboBoxLabelContext,
  NativeComboBoxListContext,
  NativeComboBoxOverlayTriggerStateContext,
  NativeComboBoxStateContext,
  NativeComboBoxTextContext,
  NativeComboBoxValueContext,
} from "../collectionContext"
import {
  NativeComboBoxFieldError,
  NativeComboBoxLabel,
  NativeComboBoxText,
  NativeComboBoxValue,
  NativeComboBoxPopoverBoundary,
} from "../fieldParts"
import { collection, ITEMS } from "../state/__tests__/collection"
import type { ComboBoxState, ValidationResult } from "../state/types"
import { useComboBoxState } from "../state/useComboBoxState"
import { FormValidationContext, VALID_VALIDITY_STATE } from "../state/useFormValidationState"

const wrap = (children: ReactNode) => <NativeThemeProvider>{children}</NativeThemeProvider>
const invalid: ValidationResult = {
  isInvalid: true,
  validationDetails: { ...VALID_VALIDITY_STATE, customError: true, valid: false },
  validationErrors: ["First", "Second"],
}
const textSlots = { slots: { errorMessage: { nativeID: "error" }, description: { nativeID: "description" } } }

it("retains default/named/null slots, caller precedence and the actual Text refs", async () => {
  const defaultRef = createRef<TNativeTextRef>(),
    namedRef = createRef<TNativeTextRef>(),
    caller = createRef<TNativeTextRef>()
  const view = await render(
    wrap(
      <NativeComboBoxTextContext.Provider
        value={{
          slots: {
            [NATIVE_DEFAULT_SLOT]: { ref: defaultRef, nativeID: "default", style: { color: "red" } },
            description: { ref: namedRef, nativeID: "context", style: { color: "blue" } },
          },
        }}
      >
        <NativeComboBoxText testID="default">Default</NativeComboBoxText>
        <NativeComboBoxText ref={caller} testID="named" slot="description" nativeID="caller" style={{ color: "green" }}>
          Named
        </NativeComboBoxText>
        <NativeComboBoxText testID="isolated" slot={null}>
          Isolated
        </NativeComboBoxText>
      </NativeComboBoxTextContext.Provider>,
    ),
  )
  expect(defaultRef.current).not.toBeNull()
  expect(namedRef.current === caller.current).toBe(true)
  expect(screen.getByTestId("named").props.nativeID).toBe("caller")
  expect(screen.getByTestId("named")).toHaveStyle({ color: "green" })
  expect(screen.getByTestId("isolated").props.nativeID).toBeUndefined()
  await view.unmount()
  expect([defaultRef.current, namedRef.current, caller.current]).toEqual([null, null, null])
})

it("preserves FieldError's full validity/default message values and null-versus-false children", async () => {
  const ref = createRef<TNativeTextRef>(),
    seen = jest.fn()
  const content = (children?: ReactNode | ((value: ValidationResult & { defaultChildren: ReactNode }) => ReactNode)) =>
    wrap(
      <NativeComboBoxFieldErrorContext.Provider value={invalid}>
        <NativeComboBoxTextContext.Provider value={textSlots}>
          <NativeComboBoxFieldError
            testID="error"
            ref={ref}
            style={(value) => {
              seen(value)
              return { color: "red" }
            }}
          >
            {children}
          </NativeComboBoxFieldError>
        </NativeComboBoxTextContext.Provider>
      </NativeComboBoxFieldErrorContext.Provider>,
    )
  const view = await render(content())
  expect(screen.getByTestId("error").props.nativeID).toBe("error")
  expect(screen.getByText("First Second")).toBeOnTheScreen()
  expect(Object.keys(seen.mock.calls[0][0].validationDetails)).toHaveLength(11)
  const values = jest.fn((_value: ValidationResult & { defaultChildren: ReactNode }) => false)
  await view.rerender(content(values))
  expect(values.mock.calls[0][0]).toMatchObject({ defaultChildren: "First Second", ...invalid })
  expect(ref.current).not.toBeNull()
  await view.rerender(content(null))
  expect(ref.current).not.toBeNull()
  expect(screen.getByText("First Second")).toBeOnTheScreen()
  await view.rerender(content(() => null))
  expect(screen.getByText("First Second")).toBeOnTheScreen()
})

it("does not render a FieldError without invalid validation context", async () => {
  const ref = createRef<TNativeTextRef>()
  const view = await render(wrap(<NativeComboBoxFieldError ref={ref}>Hidden</NativeComboBoxFieldError>))
  expect(screen.queryByText("Hidden")).toBeNull()
  await view.rerender(
    wrap(
      <NativeComboBoxFieldErrorContext.Provider value={{ ...invalid, isInvalid: false }}>
        <NativeComboBoxFieldError ref={ref}>Hidden</NativeComboBoxFieldError>
      </NativeComboBoxFieldErrorContext.Provider>,
    ),
  )
  expect(ref.current).toBeNull()
  expect(screen.queryByText("Hidden")).toBeNull()
})

it.each([0, null] as const)(
  "preserves ComboBoxValue's original item/state objects and placeholder for %s",
  async (value) => {
    const ref = createRef<View>(),
      inherited = createRef<View>(),
      renderValues = jest.fn(),
      styleValues = jest.fn()
    let state!: ComboBoxState<(typeof ITEMS)[number]>
    const original = collection()
    const Harness = () => {
      state = useComboBoxState({ collection: original, value, inputValue: "held" })
      return (
        <NativeComboBoxStateContext.Provider value={state}>
          <NativeComboBoxValueContext.Provider value={{ nativeID: "value", ref: inherited }}>
            <NativeComboBoxValue
              ref={ref}
              placeholder="Choose"
              style={(values) => {
                styleValues(values)
                return { width: 100 }
              }}
              render={(props, values) => {
                renderValues(values)
                return <View {...props} testID="value" />
              }}
            />
          </NativeComboBoxValueContext.Provider>
        </NativeComboBoxStateContext.Provider>
      )
    }
    await render(wrap(<Harness />))
    const latest = renderValues.mock.calls.at(-1)![0]
    expect(latest.state === state).toBe(true)
    expect(latest.isPlaceholder).toBe(value === null)
    expect(latest.selectedText).toBe(value === null ? "" : "Alpha")
    expect(latest.selectedItems.length).toBe(value === null ? 0 : 1)
    if (value === 0) expect(latest.selectedItems[0] === ITEMS[0]).toBe(true)
    expect(ref.current === inherited.current).toBe(true)
    expect(ref.current).not.toBeNull()
    expect(screen.getByText(value === null ? "Choose" : "Alpha")).toBeOnTheScreen()
    expect(styleValues.mock.calls.at(-1)![0].state === state).toBe(true)
  },
)

it("keeps a nonempty selection with empty text distinct from an empty placeholder selection", async () => {
  const values = jest.fn(),
    original = collection()
  const Harness = () => {
    const state = useComboBoxState({ collection: original, value: 0 })
    return (
      <NativeComboBoxStateContext.Provider
        value={{ ...state, selectedItems: state.selectedItems.map((node) => ({ ...node, textValue: "" })) }}
      >
        <NativeComboBoxValue placeholder="Fallback">
          {(value) => {
            values(value)
            return value.defaultChildren
          }}
        </NativeComboBoxValue>
      </NativeComboBoxStateContext.Provider>
    )
  }
  await render(wrap(<Harness />))
  expect(screen.getByText("Fallback")).toBeOnTheScreen()
  expect(values.mock.calls.at(-1)![0].isPlaceholder).toBe(false)
})

it("preserves the original label event and respects caller veto before the original input focus request", async () => {
  const input = createRef<TextInput>(),
    label = createRef<TNativeTextRef>(),
    calls: string[] = []
  let cancel = false
  const view = await render(
    wrap(
      <>
        <TextInput ref={input} testID="model-input" />
        <NativeComboBoxLabelContext.Provider value={{ labelTarget: input }}>
          <NativeComboBoxLabel
            ref={label}
            testID="label"
            onPress={(event) => {
              calls.push("label")
              if (cancel) event.preventDefault()
            }}
          >
            Label
          </NativeComboBoxLabel>
        </NativeComboBoxLabelContext.Provider>
      </>,
    ),
  )
  const focus = jest.fn(() => calls.push("focus"))
  const release = registerNativeFocusTarget(input.current!, { focus, blur: () => {}, canFocus: () => true })
  const press = async () => {
    let prevented = false
    const event = {
      nativeEvent: {},
      get defaultPrevented() {
        return prevented
      },
      preventDefault: () => {
        prevented = true
      },
      isDefaultPrevented: () => prevented,
    }
    await act(() => screen.getByTestId("label").props.onPress(event))
  }
  await press()
  cancel = true
  await press()
  expect(calls).toEqual(["label", "focus", "label"])
  expect(focus).toHaveBeenCalledTimes(1)
  await view.unmount()
  release()
})

it("provides complete family state, field, validation and list contexts inside the custom root", async () => {
  const observations: unknown[] = []
  const Probe = () => {
    const state = useContext(NativeComboBoxStateContext)!
    const input = useContext(NativeComboBoxInputContext) as { value: string; ref: unknown }
    const button = useContext(NativeComboBoxButtonContext) as { isPressed: boolean }
    const group = useContext(NativeComboBoxGroupContext) as { isDisabled: boolean; isInvalid: boolean }
    const list = useContext(NativeComboBoxListContext) as { shouldUseVirtualFocus: boolean; shouldFocusWrap: boolean }
    const errors = useContext(NativeComboBoxFieldErrorContext)!
    observations.push({
      query: input.value,
      pressed: button.isPressed,
      group,
      list,
      sameOverlay: useContext(NativeComboBoxOverlayTriggerStateContext) === state,
      sameList: useContext(NativeListStateContext) === state,
      ids: useContext(NativeComboBoxFieldIdsContext),
      errors,
    })
    return (
      <>
        <NativeComboBoxLabel testID="label">A label</NativeComboBoxLabel>
        <NativeComboBoxText testID="description" slot="description">
          A description
        </NativeComboBoxText>
        <NativeComboBoxFieldError testID="field-error" />
        <NativeComboBoxValue testID="value" placeholder="Choose" />
      </>
    )
  }
  await render(
    wrap(
      <NativeOverlayProvider>
        <NativeFloatingLayerHost>
          <FormValidationContext.Provider value={{ entry: ["Server one", "Server two"] }}>
            <NativeCollectionComboBox
              items={ITEMS}
              getKey={(item) => item.id}
              getTextValue={(item) => item.label}
              inputLabel="Input"
              closeLabel="Close"
              name="entry"
              inputValue="held"
              shouldFocusWrap={false}
              render={(props) => (
                <NativeFocusHost {...props}>
                  {props.children}
                  <Probe />
                </NativeFocusHost>
              )}
            />
          </FormValidationContext.Provider>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>,
    ),
  )
  const latest = observations.at(-1) as {
    ids: { label: string; description: string; value: string }
    errors: ValidationResult
  }
  expect(latest).toMatchObject({
    query: "held",
    pressed: false,
    sameOverlay: true,
    sameList: true,
    group: { isDisabled: false, isInvalid: true },
    list: { shouldUseVirtualFocus: true, shouldFocusWrap: false },
  })
  expect(latest.errors.validationErrors).toEqual(["Server one", "Server two"])
  expect(Object.keys(latest.errors.validationDetails)).toHaveLength(11)
  expect(screen.getByTestId("label").props.nativeID).toBe(latest.ids.label)
  expect(screen.getByTestId("description").props.nativeID).toBe(latest.ids.description)
  expect(screen.getByTestId("value").props.nativeID).toBe(latest.ids.value)
})

it("keeps controlled pressed rendering independent from disabled native activation", async () => {
  const values = jest.fn()
  await render(
    wrap(
      <NativeComboBoxButtonContext.Provider value={{ isPressed: true, isDisabled: true }}>
        <NativeComboBoxButton>
          {(value) => {
            values(value)
            return "Pressed"
          }}
        </NativeComboBoxButton>
      </NativeComboBoxButtonContext.Provider>,
    ),
  )
  expect(values.mock.calls.at(-1)![0]).toMatchObject({ isPressed: true, isDisabled: true })
  expect(screen.getByRole("button")).toBeDisabled()
})

it("binds current original text refs and semantic aliases without copying the editor query or label bodies", async () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const inherited = jest.mocked(native.findNodeHandle).getMockImplementation()!
  const targets = new WeakMap<object, number>()
  let nextTarget = 500000
  jest.mocked(native.findNodeHandle).mockImplementation((view) => {
    const original = inherited(view)
    if (original) return original
    if (!view || typeof view !== "object") return null
    if (!targets.has(view)) targets.set(view, ++nextTarget)
    return targets.get(view)!
  })
  const input = createRef<TextInput>(),
    label = createRef<TNativeTextRef>(),
    description = createRef<TNativeTextRef>()
  const changed = jest.fn()
  const content = (showDescription: boolean) =>
    wrap(
      <NativeOverlayProvider>
        <NativeFloatingLayerHost>
          <FormValidationContext.Provider value={{ entry: ["Server message body"] }}>
            <NativeCollectionComboBox
              items={ITEMS}
              getKey={(item) => item.id}
              getTextValue={(item) => item.label}
              id="source-input"
              inputRef={input}
              inputLabel="Input"
              closeLabel="Close"
              name="entry"
              inputValue="held business query"
              onInputChange={changed}
              nativeAccessibilityLabels={{ role: "Liste" }}
              render={(props) => (
                <NativeFocusHost {...props}>
                  {props.children}
                  <NativeComboBoxLabel ref={label} nativeID="caller-label">
                    Visible label body
                  </NativeComboBoxLabel>
                  {showDescription && (
                    <NativeComboBoxText ref={description} slot="description">
                      Visible description body
                    </NativeComboBoxText>
                  )}
                  <NativeComboBoxFieldError />
                </NativeFocusHost>
              )}
            />
          </FormValidationContext.Provider>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>,
    )
  const view = await render(content(true))
  const original = input.current,
    focus = original!.focus
  const binding = () =>
    JSON.parse(
      view.container.queryAll((node) => typeof node.props.semanticBinding === "string")[0].props.semanticBinding,
    )
  const first = binding()
  expect(first.aliases).toContainEqual({ id: "source-input", target: native.findNodeHandle(original) })
  expect(first.labelledBy).toHaveLength(1)
  expect(first.aliases).toContainEqual({ id: first.labelledBy[0], target: native.findNodeHandle(label.current) })
  expect(first.describedBy).toHaveLength(1)
  expect(first.aliases).toContainEqual({ id: first.describedBy[0], target: native.findNodeHandle(description.current) })
  expect(first).toMatchObject({ invalid: true, expanded: false, labels: { role: "Liste" } })
  expect(first.errorMessageBy).toHaveLength(1)
  for (const value of ["held business query", "Visible label body", "Visible description body", "Server message body"])
    expect(JSON.stringify(first)).not.toContain(value)
  await view.rerender(content(false))
  expect(binding().describedBy).toEqual([])
  expect(binding().aliases.some((alias: { id: string }) => alias.id === first.describedBy[0])).toBe(false)
  expect(input.current === original).toBe(true)
  expect(input.current!.focus === focus).toBe(true)
  expect(changed).not.toHaveBeenCalled()
})

it("observes semantic slots that mount and retire in a child-only commit", async () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const inherited = jest.mocked(native.findNodeHandle).getMockImplementation()!
  const targets = new WeakMap<object, number>()
  let nextTarget = 600000,
    toggle!: () => void
  jest.mocked(native.findNodeHandle).mockImplementation((view) => {
    const original = inherited(view)
    if (original) return original
    if (!view || typeof view !== "object") return null
    if (!targets.has(view)) targets.set(view, ++nextTarget)
    return targets.get(view)!
  })
  const DeferredDescription = () => {
    const [show, setShow] = useState(false)
    toggle = () => setShow((value) => !value)
    return show ? <NativeComboBoxText slot="description">Deferred description</NativeComboBoxText> : null
  }
  const view = await render(
    wrap(
      <NativeOverlayProvider>
        <NativeFloatingLayerHost>
          <NativeCollectionComboBox
            items={ITEMS}
            getKey={(item) => item.id}
            getTextValue={(item) => item.label}
            inputLabel="Input"
            closeLabel="Close"
            render={(props) => (
              <NativeFocusHost {...props}>
                {props.children}
                <DeferredDescription />
              </NativeFocusHost>
            )}
          />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>,
    ),
  )
  const binding = () =>
    JSON.parse(
      view.container.queryAll((node) => typeof node.props.semanticBinding === "string")[0].props.semanticBinding,
    )
  expect(binding().describedBy).toEqual([])
  await act(toggle)
  const descriptionId = binding().describedBy[0]
  expect(typeof descriptionId).toBe("string")
  expect(binding().aliases.some((alias: { id: string }) => alias.id === descriptionId)).toBe(true)
  await act(toggle)
  expect(binding().describedBy).toEqual([])
})

it("preserves style/children/host rendering order, full error values and the actual custom Text ref", async () => {
  const ref = createRef<TNativeTextRef>(),
    order: string[] = []
  let rendered: ValidationResult | null = null
  await render(
    wrap(
      <NativeComboBoxFieldErrorContext.Provider value={invalid}>
        <NativeComboBoxTextContext.Provider value={textSlots}>
          <NativeComboBoxFieldError
            ref={ref}
            style={(values) => {
              order.push("style")
              expect(values.defaultStyle).toEqual({})
              return { color: "red" }
            }}
            render={(props, values) => {
              order.push("render")
              rendered = values
              return <RNText {...props} testID="custom-error" />
            }}
          >
            {() => {
              order.push("children")
              return null
            }}
          </NativeComboBoxFieldError>
        </NativeComboBoxTextContext.Provider>
      </NativeComboBoxFieldErrorContext.Provider>,
    ),
  )
  expect(order.slice(0, 3)).toEqual(["style", "children", "render"])
  expect(rendered === invalid).toBe(true)
  expect(ref.current).not.toBeNull()
  expect(screen.getByTestId("custom-error").props.nativeID).toBe("error")
  expect(screen.getByTestId("custom-error")).toHaveStyle({ color: "red" })
  expect(screen.getByText("First Second")).toBeOnTheScreen()
})

it("clears the five source popup contexts while retaining field errors and original state/list objects", async () => {
  const observations: unknown[] = [],
    original = collection()
  const Probe = () => {
    observations.push({
      label: useContext(NativeComboBoxLabelContext),
      button: useContext(NativeComboBoxButtonContext),
      input: useContext(NativeComboBoxInputContext),
      group: useContext(NativeComboBoxGroupContext),
      text: useContext(NativeComboBoxTextContext),
      errors: useContext(NativeComboBoxFieldErrorContext),
      state: useContext(NativeComboBoxStateContext),
      list: useContext(NativeListStateContext),
    })
    return null
  }
  let state!: ComboBoxState<(typeof ITEMS)[number]>
  const Harness = () => {
    state = useComboBoxState({ collection: original })
    return (
      <NativeComboBoxStateContext.Provider value={state}>
        <NativeListStateContext.Provider value={state}>
          <NativeComboBoxFieldErrorContext.Provider value={invalid}>
            <NativeComboBoxLabelContext.Provider value={{ nativeID: "label" }}>
              <NativeComboBoxInputContext.Provider value={{ value: "held" }}>
                <NativeComboBoxButtonContext.Provider value={{ isPressed: true }}>
                  <NativeComboBoxGroupContext.Provider value={{ isInvalid: true }}>
                    <NativeComboBoxTextContext.Provider value={textSlots}>
                      <NativeComboBoxPopoverBoundary>
                        <Probe />
                      </NativeComboBoxPopoverBoundary>
                    </NativeComboBoxTextContext.Provider>
                  </NativeComboBoxGroupContext.Provider>
                </NativeComboBoxButtonContext.Provider>
              </NativeComboBoxInputContext.Provider>
            </NativeComboBoxLabelContext.Provider>
          </NativeComboBoxFieldErrorContext.Provider>
        </NativeListStateContext.Provider>
      </NativeComboBoxStateContext.Provider>
    )
  }
  await render(wrap(<Harness />))
  const value = observations.at(-1) as { state: unknown; list: unknown; errors: unknown }
  expect(value.state === state).toBe(true)
  expect(value.list === state).toBe(true)
  expect(value.errors === invalid).toBe(true)
  for (const key of ["label", "button", "input", "group", "text"])
    expect((value as Record<string, unknown>)[key]).toBeNull()
})
