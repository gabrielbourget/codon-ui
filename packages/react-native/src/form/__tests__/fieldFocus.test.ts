import type { NativeFormActionStatus } from "../../input/specs/CUIFocusViewNativeComponent"
import { decodeNativeFormDocument } from "../document"
import { requestNativeFormFieldFocus, type TNativeFormFieldFocusRequest } from "../fieldFocus"

const setup = () => {
  const request = { target: 2, requestId: "form-request" }
  const form = {
    ownerId: "form-owner",
    descriptorId: "form",
    descriptorRevision: "form:1",
    target: 2,
    metadataTarget: 3,
    formId: "form-id",
    position: 2,
  }
  const field = {
    ownerId: "field-owner",
    descriptorId: "field",
    descriptorRevision: "field:1",
    target: 5,
    metadataTarget: 4,
    formId: "",
    hasFormAssociation: false,
    position: 3,
  }
  const packet = {
    ...request,
    documentId: "document",
    revision: "9",
    surfaceId: 11,
    rootTarget: 1,
    nodes: [
      { target: 1, parent: 0, component: "RootView" },
      { target: 2, parent: 1, component: "View" },
      { target: 3, parent: 2, component: "CUIFormRoot" },
      { target: 4, parent: 2, component: "CUIFieldBinding" },
      { target: 5, parent: 2, component: "TextInput" },
    ].map((node) => ({ ...node, hidden: false, displayNone: false })),
    forms: [form],
    fields: [field],
  }
  const document = decodeNativeFormDocument(JSON.stringify(packet), request)
  const scope: TNativeFormFieldFocusRequest = {
    document,
    form: document.forms[0],
    field: document.fields[0],
    origin: "programmatic",
    mount: {
      ownerId: field.ownerId,
      descriptorId: field.descriptorId,
      descriptorRevision: field.descriptorRevision,
      target: 4,
      originalTarget: 5,
      surfaceId: 11,
      windowId: "window",
      epoch: 3,
      sequence: 4,
      mountRevision: "mount:1",
      attached: true,
      active: true,
      complete: true,
      metadataOnly: true,
      originalClass: "OriginalEditor",
      error: "",
    },
  }
  const reply = (encoded: string, changes: Record<string, unknown> = {}) => {
    const received = JSON.parse(encoded)
    return JSON.stringify({
      ...packet,
      requestId: received.requestId,
      focus: {
        descriptorId: field.descriptorId,
        descriptorRevision: field.descriptorRevision,
        target: field.target,
        mount: Object.fromEntries(Object.entries(scope.mount).reverse()),
        requested: true,
        current: true,
      },
      ...changes,
    })
  }
  const command = jest.fn(async (encoded: string) => reply(encoded))
  return { scope, packet, command, reply }
}

it("requests the explicit native command with the exact document, field and original mount acknowledgment", async () => {
  const value = setup()
  expect(await requestNativeFormFieldFocus(value.scope, value.command)).toEqual({ requested: true, current: true })
  const request = JSON.parse(value.command.mock.calls[0][0])
  expect(request).toEqual({
    target: 2,
    surfaceId: 11,
    requestId: "form-request:focus",
    documentId: "document",
    revision: "9",
    form: value.scope.form,
    field: value.scope.field,
    mount: value.scope.mount,
    origin: "programmatic",
  })
})

it.each([
  ["inactive", { active: false }],
  ["incomplete", { complete: false }],
  ["detached", { attached: false }],
  ["foreign owner", { ownerId: "other" }],
  ["old descriptor", { descriptorRevision: "old" }],
  ["foreign metadata", { target: 90 }],
  ["foreign editor", { originalTarget: 90 }],
  ["foreign surface", { surfaceId: 90 }],
] as const)("rejects an %s mount before any native focus command", async (_name, updates) => {
  const value = setup()
  const result = await requestNativeFormFieldFocus(
    { ...value.scope, mount: { ...value.scope.mount, ...updates } },
    value.command,
  )
  expect(result.requested).toBe(false)
  expect(value.command).not.toHaveBeenCalled()
})

it("requires the native action's original lease and forwards it for readmission in the focus command", async () => {
  const value = setup()
  expect((await requestNativeFormFieldFocus({ ...value.scope, origin: "native" }, value.command)).requested).toBe(false)
  expect(value.command).not.toHaveBeenCalled()
  const actionLease: NativeFormActionStatus = {
    ownerId: "action",
    descriptorRevision: "action:1",
    viewOwnerId: "original-button",
    target: 2,
    surfaceId: 11,
    windowId: "window",
    scopeOwnerId: "scope",
    scopeEpoch: 1,
    epoch: 1,
    sequence: 1,
    attached: true,
    active: true,
    enabled: true,
  }
  expect(
    (await requestNativeFormFieldFocus({ ...value.scope, origin: "native", actionLease }, value.command)).requested,
  ).toBe(true)
  expect(JSON.parse(value.command.mock.calls[0][0]).actionAdmission).toEqual({
    lease: actionLease,
    form: value.scope.form,
    documentId: "document",
    revision: "9",
  })
})

it.each(["document", "revision", "editor", "mount", "missing", "malformed"] as const)(
  "rejects a %s native response",
  async (kind) => {
    const value = setup()
    const command = jest.fn(async (encoded: string) => {
      const result = JSON.parse(value.reply(encoded))
      if (kind === "document") result.documentId = "other"
      if (kind === "revision") result.revision = "old"
      if (kind === "editor") result.focus.target = 90
      if (kind === "mount") result.focus.mount.epoch++
      if (kind === "missing") delete result.focus
      return kind === "malformed" ? "[" : JSON.stringify(result)
    })
    expect(await requestNativeFormFieldFocus(value.scope, command)).toEqual({ requested: false, current: false })
  },
)

it("retains an issued request when native authority retires during the original command", async () => {
  const value = setup()
  const command = async (encoded: string) => {
    const result = JSON.parse(value.reply(encoded))
    result.focus.current = false
    return JSON.stringify(result)
  }
  expect(await requestNativeFormFieldFocus(value.scope, command)).toEqual({ requested: true, current: false })
})

it("does not turn a rejected native command into a focus request", async () => {
  const value = setup()
  expect(
    await requestNativeFormFieldFocus(value.scope, async () => {
      throw new Error("retired")
    }),
  ).toEqual({ requested: false, current: false })
})
