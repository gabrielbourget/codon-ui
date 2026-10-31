import { act, render } from "@testing-library/react-native"
import { Activity, createRef, useContext, useInsertionEffect } from "react"
import type * as RN from "react-native"

import { NATIVE_DEFAULT_SLOT } from "../../collection/context"
import { FormValidationContext, VALID_VALIDITY_STATE } from "../../components/ComboBox/state/useFormValidationState"
import { NativeFormBehaviorContext, NativeFormContext, NativeFormRegistryContext } from "../context"
import { NativeForm } from "../NativeForm"
import { NativeFormRegistry, type TNativeFormFieldBinding } from "../registry"

jest.mock("../../input/specs/CUIFormRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))

beforeEach(() => {
  const targets = new WeakMap<object, number>()
  let sequence = 100
  const native = jest.requireActual<typeof RN>("react-native")
  jest.spyOn(native, "findNodeHandle").mockImplementation((view) => {
    if (!view || typeof view !== "object") return null
    if (!targets.has(view)) targets.set(view, ++sequence)
    return targets.get(view)!
  })
})
afterEach(() => jest.restoreAllMocks())

it("forwards the actual original View and inherits complete error/behavior context", async () => {
  const registry = new NativeFormRegistry()
  const ref = createRef<RN.View>()
  const errors = { field: ["First", "Second"] }
  const observations: unknown[] = []
  const Probe = () => {
    observations.push([useContext(FormValidationContext), useContext(NativeFormBehaviorContext)])
    return null
  }
  const view = await render(
    <NativeFormRegistryContext.Provider value={registry}>
      <NativeForm
        ref={ref}
        testID="form"
        id="semantic"
        nativeID="caller"
        validationBehavior="aria"
        validationErrors={errors}
      >
        <Probe />
      </NativeForm>
    </NativeFormRegistryContext.Provider>,
  )
  const binding = [...registry.forms.values()][0]
  expect(binding.original).toBe(ref.current)
  expect(binding.current()).toBe(ref.current)
  expect(binding.descriptor.target).toBe(jest.requireActual<typeof RN>("react-native").findNodeHandle(ref.current))
  expect(binding.descriptor.formId).toBe("semantic")
  expect(view.getByTestId("form").props.nativeID).toBe("caller")
  expect(view.getByTestId("form").props.validationErrors).toBeUndefined()
  expect(observations.at(-1)).toEqual([errors, "aria"])
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(registry.forms.size).toBe(0)
})

it("keeps the original host and reads latest callback-only props without replacing its descriptor", async () => {
  const registry = new NativeFormRegistry()
  const ref = createRef<RN.View>()
  const first = jest.fn(),
    latest = jest.fn()
  const content = (onSubmit: typeof first) => (
    <NativeFormRegistryContext.Provider value={registry}>
      <NativeForm ref={ref} id="owner" onSubmit={onSubmit} />
    </NativeFormRegistryContext.Provider>
  )
  const view = await render(content(first))
  const original = ref.current,
    binding = [...registry.forms.values()][0]
  await view.rerender(content(latest))
  expect(ref.current).toBe(original)
  expect([...registry.forms.values()][0]).toBe(binding)
  expect(binding.props().onSubmit).toBe(latest)
  expect(binding.props().onSubmit).not.toBe(first)
})

it("supports default/named/null Form slots and original context refs", async () => {
  const registry = new NativeFormRegistry()
  const inherited = createRef<RN.View>(),
    named = createRef<RN.View>(),
    isolated = createRef<RN.View>()
  const view = await render(
    <NativeFormRegistryContext.Provider value={registry}>
      <NativeFormContext.Provider
        value={{
          slots: {
            [NATIVE_DEFAULT_SLOT]: { id: "default", ref: inherited },
            named: { id: "named", ref: named },
          },
        }}
      >
        <NativeForm />
        <NativeForm slot="named" />
        <NativeForm slot={null} ref={isolated} id="isolated" />
      </NativeFormContext.Provider>
    </NativeFormRegistryContext.Provider>,
  )
  for (const [id, ref] of [
    ["default", inherited],
    ["named", named],
    ["isolated", isolated],
  ] as const) {
    expect(ref.current).not.toBeNull()
    expect([...registry.forms.values()].find((form) => form.descriptor.formId === id)?.original).toBe(ref.current)
  }
  await view.unmount()
  expect([inherited.current, named.current, isolated.current]).toEqual([null, null, null])
})

it("retains logical Form registration across Activity hiding and retires it on removal", async () => {
  const registry = new NativeFormRegistry()
  const content = (mode: "visible" | "hidden") => (
    <NativeFormRegistryContext.Provider value={registry}>
      <Activity mode={mode}>
        <NativeForm id="retained" />
      </Activity>
    </NativeFormRegistryContext.Provider>
  )
  const view = await render(content("visible"))
  expect(registry.forms.size).toBe(1)
  await view.rerender(content("hidden"))
  expect(registry.forms.size).toBe(1)
  await view.rerender(content("visible"))
  expect(registry.forms.size).toBe(1)
  await view.unmount()
  expect(registry.forms.size).toBe(0)
})

it("updates the native root barrier when fields commit without changing the original Form", async () => {
  const registry = new NativeFormRegistry()
  const ref = createRef<RN.View>()
  const Field = () => {
    useInsertionEffect(
      () =>
        registry.commitField({
          descriptor: {
            ownerId: "model",
            descriptorId: "field",
            descriptorRevision: "1",
            target: 200,
            metadataTarget: 201,
            formId: "",
            hasFormAssociation: false,
          },
          data: {
            entries: [],
            isDisabled: false,
            isReadOnly: false,
            validationBehavior: "native",
            validation: { isInvalid: false, validationErrors: [], validationDetails: VALID_VALIDITY_STATE },
          },
          editor: () => null,
          mount: () => null,
          isFocusObserved: () => false,
          commitValidation: () => {},
          reset: () => {},
        } as TNativeFormFieldBinding),
      [],
    )
    return null
  }
  const content = (field: boolean) => (
    <NativeFormRegistryContext.Provider value={registry}>
      <NativeForm ref={ref}>{field && <Field />}</NativeForm>
    </NativeFormRegistryContext.Provider>
  )
  const view = await render(content(false))
  const original = ref.current
  await view.rerender(content(true))
  await act(() => Promise.resolve())
  const binding = [...registry.forms.values()][0]
  expect(binding.fieldRevision).toBe(registry.getRevision())
  expect(binding.original).toBe(original)
  await view.rerender(content(false))
  await act(() => Promise.resolve())
  expect([...registry.forms.values()][0].fieldRevision).toBe(registry.getRevision())
})
