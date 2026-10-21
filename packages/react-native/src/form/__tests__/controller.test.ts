import type { TextInput, View } from "react-native"

import { VALID_VALIDITY_STATE } from "../../components/ComboBox/state/useFormValidationState"
import type { TNativePressEvent } from "../../input/types"
import { NativeFormController } from "../controller"
import { NativeFormMountReceipt } from "../mount"
import { NativeFormRegistry, nativeFormRevision, type TNativeFormFieldBinding } from "../registry"
import type { TNativeFormProps } from "../types"

const setup = () => {
  const registry = new NativeFormRegistry()
  const form = {} as View
  let original: View | null = form
  let props: Pick<TNativeFormProps, "validationBehavior" | "onSubmit" | "onReset"> = {
    onSubmit: jest.fn(),
    onReset: jest.fn(),
  }
  const callbacks = new Map<string, { reset: jest.Mock; invalid: jest.Mock }>()
  const releases = new Map<string, () => void>()
  const data = {
    alpha: { name: "same", text: "a" },
    beta: { name: "same", text: "b" },
    outside: { name: "same", text: "external" },
    unassociated: { name: "unused", text: "no" },
  }
  const identities = { alpha: [4, 5, 6], beta: [7, 8, 9], outside: [10, 11, 12], unassociated: [13, 14, 15] } as const
  const publish = (
    id: keyof typeof data,
    updates: Partial<TNativeFormFieldBinding["data"]> = {},
    overrides: Partial<TNativeFormFieldBinding> = {},
  ) => {
    releases.get(id)?.()
    const [, _metadata, target] = identities[id]
    const reset = callbacks.get(id)?.reset ?? jest.fn(),
      invalid = callbacks.get(id)?.invalid ?? jest.fn()
    callbacks.set(id, { reset, invalid })
    const editor = {} as TextInput,
      metadata = {}
    const descriptor = {
      ownerId: `owner:${id}`,
      descriptorId: id,
      descriptorRevision: `field:${id}:${registry.getRevision()}`,
      metadataTarget: _metadata,
      target,
      formId: id === "outside" ? "owner" : "",
      hasFormAssociation: id === "outside" || id === "unassociated",
    }
    const mount = new NativeFormMountReceipt(
      { ...descriptor, target: _metadata, originalTarget: target },
      { metadata, original: editor, current: () => ({ metadata, original: editor }) },
    )
    mount.receive({
      ...descriptor,
      target: _metadata,
      originalTarget: target,
      surfaceId: 11,
      windowId: "window",
      epoch: 1,
      sequence: 1,
      mountRevision: "model",
      complete: true,
      attached: true,
      metadataOnly: true,
      originalClass: "OriginalModelEditor",
      error: "",
    })
    const binding: TNativeFormFieldBinding = {
      descriptor,
      data: {
        entries: [[data[id].name, data[id].text]],
        isDisabled: false,
        isReadOnly: false,
        validationBehavior: "native",
        validation: { isInvalid: false, validationDetails: VALID_VALIDITY_STATE, validationErrors: [] },
        ...updates,
      },
      editor: () => editor,
      mount: () => mount,
      isFocusObserved: () => false,
      commitValidation: invalid,
      reset,
      ...overrides,
    }
    releases.set(id, registry.commitField(binding))
  }
  for (const id of ["alpha", "unassociated", "outside", "beta"] as const) publish(id)
  let releaseForm: (() => void) | undefined
  const root = () => {
    releaseForm?.()
    releaseForm = registry.commitForm({
      descriptor: {
        ownerId: "form-owner",
        descriptorId: "form",
        descriptorRevision: nativeFormRevision("form-owner", 2, registry.getRevision()),
        target: 2,
        metadataTarget: 3,
        formId: "owner",
      },
      fieldRevision: registry.getRevision(),
      original: form,
      current: () => original,
      props: () => props,
    })
  }
  root()
  let hidden = false,
    mutate: ((value: ReturnType<typeof packet>) => void) | null = null
  const packet = (request: { target: number; requestId: string }) => {
    const rootDescriptor = registry.forms.get("form")!.descriptor
    const list = registry.fields
    const nodes = [
      { target: 1, parent: 0, component: "RootView" },
      { target: 10, parent: 1, component: "View" },
      { target: 11, parent: 10, component: "CUIFieldBinding" },
      { target: 12, parent: 10, component: "TextInput" },
      { target: 2, parent: 1, component: "View" },
      { target: 3, parent: 2, component: "CUIFormRoot" },
      { target: 7, parent: 2, component: "View", hidden },
      { target: 8, parent: 7, component: "CUIFieldBinding" },
      { target: 9, parent: 7, component: "TextInput" },
      { target: 4, parent: 2, component: "View" },
      { target: 5, parent: 4, component: "CUIFieldBinding" },
      { target: 6, parent: 4, component: "TextInput" },
      { target: 13, parent: 2, component: "View" },
      { target: 14, parent: 13, component: "CUIFieldBinding" },
      { target: 15, parent: 13, component: "TextInput" },
    ].map((node) => ({ hidden: false, displayNone: false, ...node }))
    return {
      documentId: "native-model-doc",
      rootTarget: 1,
      revision: "9",
      surfaceId: 11,
      ...request,
      nodes,
      forms: [{ ...rootDescriptor, position: 5 }],
      fields: (["outside", "beta", "alpha", "unassociated"] as const).map((id) => ({
        ...list.get(id)!.descriptor,
        position: nodes.findIndex((node) => node.target === list.get(id)!.descriptor.metadataTarget),
      })),
    }
  }
  const read = jest.fn(async (request: { target: number; requestId: string }) => {
    const value = packet(request)
    mutate?.(value)
    return JSON.stringify(value)
  })
  const focus = jest.fn(() => true)
  const controller = new NativeFormController(registry, read, focus)
  return {
    registry,
    form,
    controller,
    focus,
    read,
    callbacks,
    publish,
    root,
    packet,
    remove: (id: string) => releases.get(id)?.(),
    retire: () => {
      original = null
    },
    owner: (next: typeof props) => {
      props = next
    },
    hidden: () => {
      hidden = true
    },
    corrupt: (next: NonNullable<typeof mutate>) => {
      mutate = next
    },
  }
}

it("submits duplicate entries in actual native order with external associations and original form identity", async () => {
  const value = setup(),
    submit = jest.fn()
  value.owner({ onSubmit: submit })
  const result = await value.controller.request("submit", { origin: "programmatic", form: value.form })
  expect(result.status).toBe("submitted")
  expect(result.request?.entries).toEqual([
    ["same", "external"],
    ["same", "b"],
    ["same", "a"],
  ])
  expect(result.request?.form).toBe(value.form)
  expect(result.request?.origin).toBe("programmatic")
  expect(result.request).not.toHaveProperty("sourceEvent")
  expect(submit).toHaveBeenCalledWith(result.request)
  expect(Object.isFrozen(result.request?.entries[0])).toBe(true)
})

it("excludes disabled entries and includes readonly values without an owner echo", async () => {
  const value = setup()
  value.publish("alpha", { isDisabled: true })
  value.publish("beta", { isReadOnly: true })
  value.root()
  const result = await value.controller.request("submit", { origin: "programmatic", form: value.form })
  expect(result.request?.entries).toEqual([
    ["same", "external"],
    ["same", "b"],
  ])
  expect(value.callbacks.get("alpha")!.reset).not.toHaveBeenCalled()
})

it("retains owned data snapshots when the caller later mutates source entry/error arrays", async () => {
  const value = setup(),
    entries: [string, string][] = [["same", "held"]],
    errors = ["Held error"]
  value.publish("alpha", {
    entries,
    validation: {
      isInvalid: true,
      validationDetails: { ...VALID_VALIDITY_STATE, valid: false, customError: true },
      validationErrors: errors,
    },
    validationBehavior: "aria",
  })
  value.root()
  entries[0][1] = "mutated"
  errors[0] = "mutated"
  const result = await value.controller.request("submit", { origin: "programmatic", form: value.form })
  expect(result.request?.entries.at(-1)).toEqual(["same", "held"])
  expect(value.registry.fields.get("alpha")!.data.validation.validationErrors).toEqual(["Held error"])
})

it("commits all invalid fields, requests only the first current target and keeps focus observation separate", async () => {
  const value = setup(),
    submit = jest.fn()
  const invalid = {
    isInvalid: true,
    validationDetails: { ...VALID_VALIDITY_STATE, valid: false, valueMissing: true },
    validationErrors: ["Required"],
  }
  value.publish("alpha", { validation: invalid })
  value.publish("beta", { validation: invalid })
  value.root()
  value.owner({ onSubmit: submit })
  const result = await value.controller.request("submit", { origin: "programmatic", form: value.form })
  expect(result.status).toBe("invalid")
  expect(result.invalidFields?.map((field) => field.descriptorId)).toEqual(["beta", "alpha"])
  expect(value.callbacks.get("beta")!.invalid).toHaveBeenCalledTimes(1)
  expect(value.callbacks.get("alpha")!.invalid).toHaveBeenCalledTimes(1)
  expect(value.focus).toHaveBeenCalledTimes(1)
  expect(result.focus).toMatchObject({ descriptorId: "beta", requested: true, observed: false })
  expect(submit).not.toHaveBeenCalled()
})

it("does not fabricate a focus request for a retained hidden invalid first field", async () => {
  const value = setup()
  value.hidden()
  value.publish("beta", {
    validation: {
      isInvalid: true,
      validationDetails: { ...VALID_VALIDITY_STATE, valueMissing: true, valid: false },
      validationErrors: ["Required"],
    },
  })
  value.root()
  const result = await value.controller.request("submit", { origin: "programmatic", form: value.form })
  expect(result.status).toBe("invalid")
  expect(result.focus).toMatchObject({ requested: false, observed: false })
  expect(value.focus).not.toHaveBeenCalled()
})

it.each(["form", "field", "readonly"] as const)("retains %s aria/readonly submission policy", async (policy) => {
  const value = setup()
  value.publish("beta", {
    validation: {
      isInvalid: true,
      validationDetails: { ...VALID_VALIDITY_STATE, valid: false, customError: true },
      validationErrors: ["Custom"],
    },
    ...(policy === "field" ? { validationBehavior: "aria" } : policy === "readonly" ? { isReadOnly: true } : {}),
  })
  value.root()
  if (policy === "form") value.owner({ validationBehavior: "aria" })
  expect((await value.controller.request("submit", { origin: "programmatic", form: value.form })).status).toBe(
    "submitted",
  )
})

it("requests reset in native order before the form callback and preserves the programmatic origin", async () => {
  const value = setup(),
    order: string[] = []
  for (const id of ["outside", "beta", "alpha"])
    value.callbacks.get(id)!.reset.mockImplementation((origin) => order.push(`${id}:${origin}`))
  value.owner({
    onReset: (request) => {
      order.push("form")
      request.preventDefault()
    },
  })
  const result = await value.controller.request("reset", { origin: "programmatic", form: value.form })
  expect(order).toEqual(["outside:programmatic", "beta:programmatic", "alpha:programmatic", "form"])
  expect(result.status).toBe("cancelled")
  expect(result.requestedFields).toEqual(["outside", "beta", "alpha"])
  expect(result.request?.defaultPrevented).toBe(true)
})

it("stops reset requests immediately when an owner retires the original form", async () => {
  const value = setup(),
    reset = jest.fn()
  value.owner({ onReset: reset })
  value.callbacks.get("outside")!.reset.mockImplementation(value.retire)
  const result = await value.controller.request("reset", { origin: "programmatic", form: value.form })
  expect(result).toMatchObject({ status: "retired", requestedFields: ["outside"] })
  expect(value.callbacks.get("beta")!.reset).not.toHaveBeenCalled()
  expect(reset).not.toHaveBeenCalled()
})

it("retires a request if committed field data changes while native ownership is being read", async () => {
  const value = setup(),
    submit = jest.fn()
  value.owner({ onSubmit: submit })
  let resolve!: (text: string) => void
  const controller = new NativeFormController(
    value.registry,
    (request) =>
      new Promise((done) => {
        resolve = () => done(JSON.stringify(value.packet(request)))
      }),
  )
  const pending = controller.request("submit", { origin: "programmatic", form: value.form })
  value.publish("alpha", { entries: [["same", "new"]] })
  value.root()
  resolve("")
  expect((await pending).status).toBe("retired")
  expect(submit).not.toHaveBeenCalled()
})

it("rejects partial/foreign native descriptors rather than returning empty successful data", async () => {
  const value = setup(),
    submit = jest.fn()
  value.owner({ onSubmit: submit })
  value.corrupt((packet) => {
    packet.fields[0].descriptorRevision = "foreign"
  })
  expect((await value.controller.request("submit", { origin: "programmatic", form: value.form })).status).toBe(
    "retired",
  )
  expect(submit).not.toHaveBeenCalled()
})

it("retains the exact original native event only after a current native admission", async () => {
  const value = setup(),
    event = { nativeEvent: { kind: "activation" }, defaultPrevented: false } as TNativePressEvent
  const admit = jest.fn(async () => true)
  const result = await value.controller.request("submit", {
    origin: "native",
    sourceEvent: event,
    target: 6,
    isCurrent: () => true,
    admit,
  })
  expect(result.status).toBe("submitted")
  expect(result.request?.sourceEvent).toBe(event)
  expect(admit).toHaveBeenCalledTimes(1)
})

it("does not issue callbacks when native admission is denied or the original event is prevented", async () => {
  const value = setup(),
    submit = jest.fn()
  value.owner({ onSubmit: submit })
  const event = { nativeEvent: { kind: "activation" }, defaultPrevented: false } as TNativePressEvent
  const source = {
    origin: "native" as const,
    sourceEvent: event,
    target: 6,
    isCurrent: () => true,
    admit: jest.fn(async () => false),
  }
  expect((await value.controller.request("submit", source)).status).toBe("retired")
  const prevented = { ...event, defaultPrevented: true } as TNativePressEvent
  expect((await value.controller.request("submit", { ...source, sourceEvent: prevented })).status).toBe("retired")
  expect(source.admit).toHaveBeenCalledTimes(1)
  expect(submit).not.toHaveBeenCalled()
})

it("rejects a new committed field until the native root barrier catches up", async () => {
  const value = setup()
  value.publish("alpha", { entries: [["same", "new"]] })
  const pending = await value.controller.request("submit", { origin: "programmatic", form: value.form })
  expect(pending.status).toBe("retired")
  value.root()
  expect(
    (await value.controller.request("submit", { origin: "programmatic", form: value.form })).request?.entries.at(-1),
  ).toEqual(["same", "new"])
})

it("reads the latest committed form callback after an asynchronous native document read", async () => {
  const value = setup(),
    first = jest.fn(),
    latest = jest.fn()
  value.owner({ onSubmit: first })
  let finish!: () => void
  const controller = new NativeFormController(
    value.registry,
    (request) =>
      new Promise((resolve) => {
        const encoded = JSON.stringify(value.packet(request))
        finish = () => resolve(encoded)
      }),
  )
  const pending = controller.request("submit", { origin: "programmatic", form: value.form })
  value.owner({ onSubmit: latest })
  finish()
  const result = await pending
  expect(result.status).toBe("submitted")
  expect(first).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledWith(result.request)
})

it("does not move focus after an invalid callback retires its form", async () => {
  const value = setup()
  value.publish(
    "beta",
    {
      validation: {
        isInvalid: true,
        validationDetails: { ...VALID_VALIDITY_STATE, valid: false, customError: true },
        validationErrors: ["Invalid"],
      },
    },
    { commitValidation: value.retire },
  )
  value.root()
  expect((await value.controller.request("submit", { origin: "programmatic", form: value.form })).status).toBe(
    "retired",
  )
  expect(value.focus).not.toHaveBeenCalled()
})
