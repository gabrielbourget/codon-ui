import { act, fireEvent, render } from "@testing-library/react-native"
import { Activity, createRef, useCallback, useRef, useState } from "react"
import * as RN from "react-native"

import { FormValidationContext } from "../../components/ComboBox/state/useFormValidationState"
import { useNativeStepperNumberFieldState } from "../../components/NumberInput/stepperState"
import type { TNativeStepperNumberFieldProps } from "../../components/NumberInput/stepperTypes"
import { Stepper } from "../../components/Stepper/Stepper"
import { NativeFormOwnerContext, NativeFormRegistryContext } from "../context"
import { NativeFormController } from "../controller"
import { NativeForm } from "../NativeForm"
import { NativeFormRegistry } from "../registry"
import { useNativeNumberFieldForm } from "../useNumberField"

jest.mock("../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../input/specs/CUIFormRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add", decrementLabel: "Reduce" }
beforeEach(() => {
  jest.useFakeTimers()
  const targets = new WeakMap<object, number>()
  let next = 100
  jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockImplementation((value) => {
    if (!value || typeof value !== "object") return null
    if (!targets.has(value)) targets.set(value, ++next)
    return targets.get(value)!
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const setup = async (initial: Partial<TNativeStepperNumberFieldProps> = {}, errors = {}) => {
  const registry = new NativeFormRegistry()
  let state!: ReturnType<typeof useNativeStepperNumberFieldState>
  let original: RN.TextInput | null = null
  const Harness = (props: Partial<TNativeStepperNumberFieldProps>) => {
    state = useNativeStepperNumberFieldState({ ...names, ...props, name: "quantity" })
    const input = useRef<RN.TextInput | null>(null)
    const [editor, setEditor] = useState<Readonly<{ editor: RN.TextInput; target: number }> | null>(null)
    const bind = useCallback((value: RN.TextInput | null) => {
      original = input.current = value
      if (value)
        setEditor((previous) =>
          previous?.editor === value
            ? previous
            : { editor: value, target: jest.requireActual<typeof RN>("react-native").findNodeHandle(value)! },
        )
    }, [])
    const field = useNativeNumberFieldForm(
      { ...props, name: "quantity", formFieldId: "quantity" },
      state,
      editor,
      () => input.current,
      () => false,
      "",
    )
    return (
      <>
        <RN.TextInput ref={bind} value={state.inputValue} />
        {field.metadata}
      </>
    )
  }
  const content = (props: typeof initial, mode: "visible" | "hidden" = "visible") => (
    <NativeFormRegistryContext.Provider value={registry}>
      <NativeFormOwnerContext.Provider value="owner">
        <FormValidationContext.Provider value={errors}>
          <Activity mode={mode}>
            <Harness {...props} />
          </Activity>
        </FormValidationContext.Provider>
      </NativeFormOwnerContext.Provider>
    </NativeFormRegistryContext.Provider>
  )
  const view = await render(content(initial))
  return {
    registry,
    view,
    state: () => state,
    original: () => original,
    field: () => [...registry.fields.values()][0],
    update: (props: typeof initial, mode?: "visible" | "hidden") => view.rerender(content(props, mode)),
  }
}

it("registers actual original editor and raw numeric entries while preserving uncontrolled reset and pending-final retirement", async () => {
  const value = await setup({ defaultValue: 0.12, formatOptions: { style: "percent" } })
  const original = value.original()
  expect(value.field().data.entries).toEqual([["quantity", "0.12"]])
  expect(value.field().editor()).toBe(original)
  expect(value.field().fieldId).toBe("quantity")
  expect(value.field().formOwnerId).toBe("owner")
  await act(() => {
    value.state().change("25%")
    value.state().pressStart()
  })
  expect(value.state().value).toBe(0.12)
  expect(value.field().data.entries).toEqual([["quantity", "0.25"]])
  const oldFinal = value.state().commit,
    key = value.state().configurationKey
  await act(() => value.field().reset("native"))
  await act(() => oldFinal("35%"))
  expect(value.state().value).toBe(0.12)
  expect(value.state().inputValue).toBe("12%")
  expect(value.state().configurationKey).not.toBe(key)
  expect(value.original()).toBe(original)
})

it("reads callback-only updates without replacing the field descriptor or original editor", async () => {
  const first = jest.fn(),
    latest = jest.fn()
  const value = await setup({ value: 2, defaultValue: 1, onChange: first })
  const field = value.field(),
    original = value.original(),
    revision = value.registry.getRevision()
  await value.update({ value: 2, defaultValue: 1, onChange: latest })
  expect(value.field()).toBe(field)
  expect(value.registry.getRevision()).toBe(revision)
  await act(() => field.reset("programmatic"))
  expect(latest.mock.calls).toEqual([[1]])
  expect(first).not.toHaveBeenCalled()
  expect(value.state().value).toBe(2)
  expect(value.original()).toBe(original)
})

it("preserves programmatic server errors and clears them for native reset origin", async () => {
  const value = await setup({ defaultValue: 1 }, { quantity: "Server error" })
  expect(value.state().displayValidation.validationErrors).toEqual(["Server error"])
  await act(() => value.field().reset("programmatic"))
  expect(value.state().displayValidation.validationErrors).toEqual(["Server error"])
  await act(() => value.field().reset("native"))
  expect(value.state().displayValidation.validationErrors).toEqual([])
})

it("disconnects physical editor/reset authority in retained Activity and removes logical registration on unmount", async () => {
  const changed = jest.fn(),
    props = { value: 2, defaultValue: 1, onChange: changed }
  const value = await setup(props)
  const original = value.original()
  await value.update(props, "hidden")
  expect(value.registry.fields.size).toBe(1)
  expect(value.field().editor()).toBeNull()
  await act(() => value.field().reset("native"))
  expect(changed).not.toHaveBeenCalled()
  await value.update(props, "visible")
  expect(value.original()).toBe(original)
  await act(() => value.field().reset("native"))
  expect(changed.mock.calls).toEqual([[1]])
  await value.view.unmount()
  expect(value.registry.fields.size).toBe(0)
})

it("requires current actual metadata/original receipt identities and rejects a saved packet after field revision", async () => {
  const value = await setup({ defaultValue: 1 })
  const metadata = () => value.view.container.queryAll((node) => typeof node.props.editorTarget === "number")[0]
  const props = metadata().props,
    descriptor = value.field().descriptor
  const packet = {
    ...descriptor,
    target: descriptor.metadataTarget,
    originalTarget: descriptor.target,
    surfaceId: 1,
    windowId: "form-window",
    epoch: 1,
    sequence: 1,
    mountRevision: "mounted",
    attached: true,
    active: true,
    complete: true,
    metadataOnly: true,
    originalClass: "RCTTextInputComponentView",
    error: "",
  }
  for (const bad of [undefined, null, [], {}, { ...packet, originalTarget: 999 }])
    await act(() => props.onNativeFormCommit({ nativeEvent: bad }))
  expect(value.field().mount()).toBeNull()
  await act(() => props.onNativeFormCommit({ nativeEvent: packet }))
  expect(value.field().mount()?.getSnapshot()).toMatchObject({ active: true, originalTarget: descriptor.target })
  const old = value.field().mount()
  await act(() => value.state().change("3"))
  await act(() => props.onNativeFormCommit({ nativeEvent: { ...packet, sequence: 2 } }))
  expect(old?.isRetired).toBe(true)
  expect(value.field().mount()).toBeNull()
})

it("uses explicit Form order/external association, serialization, native validation and disabled omission through the current controller", async () => {
  const registry = new NativeFormRegistry(),
    form = createRef<RN.View>(),
    submit = jest.fn()
  const content = (isDisabled = false, validationBehavior: "native" | "aria" = "native", isReadOnly = false) => (
    <NativeFormRegistryContext.Provider value={registry}>
      <NativeForm
        id="order"
        ref={form}
        fieldOrder={["quantity"]}
        onSubmit={submit}
        validationBehavior={validationBehavior}
      />
      <Stepper
        {...names}
        name="amount"
        form="order"
        formFieldId="quantity"
        value={0.12}
        commitBehavior="validate"
        isInvalid={false}
        formatOptions={{ style: "percent" }}
        isDisabled={isDisabled}
        isReadOnly={isReadOnly}
      />
    </NativeFormRegistryContext.Provider>
  )
  const view = await render(content())
  const binding = [...registry.forms.values()][0]
  expect(registry.fieldsFor(binding)[0].data.entries).toEqual([["amount", "0.12"]])
  // This is a source/model admission boundary; it does not qualify installed native hosts.
  const controller = new NativeFormController(
    registry,
    async () => true,
    async () => ({ requested: false, current: true }),
  )
  const request = async () => {
    let result: Awaited<ReturnType<typeof controller.request>> | undefined
    await act(async () => {
      result = await controller.request("submit", { origin: "programmatic", form: form.current! })
    })
    return result!
  }
  let outcome = await request()
  expect(outcome.status).toBe("invalid")
  await view.rerender(content(false, "aria"))
  outcome = await request()
  expect(outcome.status).toBe("submitted")
  expect(outcome.request?.entries).toEqual([["amount", "0.12"]])
  await view.rerender(content(true))
  outcome = await request()
  expect(outcome.status).toBe("submitted")
  expect(outcome.request?.entries).toEqual([])
  await view.rerender(content(false, "native", true))
  outcome = await request()
  expect(outcome.status).toBe("submitted")
  expect(outcome.request?.entries).toEqual([["amount", "0.12"]])
})

it("attaches supported value/status/error/description semantics to the same stock editor", async () => {
  const editor = createRef<RN.TextInput>(),
    changed = jest.fn()
  const view = await render(
    <Stepper
      {...names}
      ref={editor}
      defaultValue={-12}
      minValue={-20}
      maxValue={20}
      locale="fr-FR"
      isRequired
      validate={() => "Quantité refusée"}
      validationBehavior="aria"
      onChange={changed}
      inputProps={{ accessibilityHint: "Quantité en litres" }}
    />,
  )
  const input = view.getByTestId("stepper-input"),
    original = editor.current
  expect(input.props.accessibilityLabel).toContain("Quantité refusée")
  expect(input.props.accessibilityLabel).toContain("Required")
  expect(input.props.accessibilityHint).toBe("Quantité en litres")
  const metadata = view.container.queryAll((node) => typeof node.props.editorTarget === "number")[0]
  expect(JSON.parse(metadata.props.semanticBinding).labels.role).toBe("Number field")
  expect(input.props.accessibilityValue).toEqual({ min: -20, max: 20, now: -12, text: "−12" })
  await fireEvent.changeText(input, "")
  expect(view.getByTestId("stepper-input").props.accessibilityValue).toEqual({
    min: -20,
    max: 20,
    now: undefined,
    text: "Vide",
  })
  expect(editor.current).toBe(original)
  expect(changed).not.toHaveBeenCalled()
})

it("announces only changed localized value text for the current actually focused editor in an active acknowledged window", async () => {
  const editor = createRef<RN.TextInput>()
  const announce = jest.spyOn(RN.AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {})
  const view = await render(<Stepper {...names} ref={editor} defaultValue={12} locale="fr-FR" />)
  jest.spyOn(editor.current!, "isFocused").mockReturnValue(true)
  const root = () => view.getByTestId("stepper")
  for (const ready of [false, true]) {
    const props = root().props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "semantic-window",
          epoch: 1,
          policyRevision: props.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  await fireEvent(view.getByTestId("stepper-input"), "focus", { nativeEvent: {} })
  expect(announce).not.toHaveBeenCalled()
  await fireEvent.changeText(view.getByTestId("stepper-input"), "")
  expect(announce.mock.calls).toEqual([["Vide"]])
  const props = root().props
  await act(() =>
    props.onNativeScopeStatus({
      nativeEvent: {
        ownerId: props.ownerId,
        windowId: "semantic-window",
        epoch: 2,
        policyRevision: props.policyRevision,
        ready: false,
        windowActive: false,
      },
    }),
  )
  await fireEvent.changeText(view.getByTestId("stepper-input"), "14")
  expect(announce.mock.calls).toEqual([["Vide"]])
})
