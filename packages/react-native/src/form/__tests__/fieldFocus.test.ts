import { requestNativeFormFieldFocus, type TNativeFormFieldFocusRequest } from "../fieldFocus"

jest.mock("../../input/specs/NativeCUIFormDocument", () => ({ __esModule: true, default: null }))
const scope = (): TNativeFormFieldFocusRequest => {
  const form = {
    ownerId: "form",
    descriptorId: "form",
    descriptorRevision: "form:2",
    metadataTarget: 2,
    target: 1,
    formId: "checkout",
  }
  const field = {
    ownerId: "field",
    descriptorId: "field",
    descriptorRevision: "field:3",
    metadataTarget: 4,
    target: 5,
    formId: "",
    hasFormAssociation: false,
  }
  const mount = {
    ownerId: field.ownerId,
    descriptorId: field.descriptorId,
    descriptorRevision: field.descriptorRevision,
    target: 4,
    originalTarget: 5,
    surfaceId: 11,
    windowId: "window",
    epoch: 2,
    sequence: 3,
    mountRevision: "mount",
    attached: true,
    active: true,
    complete: true,
    metadataOnly: true,
    originalClass: "OriginalEditor",
    error: "",
  }
  return {
    form,
    field,
    mount,
    formMount: { ...mount, ownerId: "form", target: 2, originalTarget: 1 },
    origin: "programmatic",
  }
}
it("distinguishes a dispatched original-host focus request from current native ownership", async () => {
  const value = scope()
  const focus = jest.fn(async () =>
    JSON.stringify({
      descriptorId: "field",
      descriptorRevision: "field:3",
      target: 5,
      mount: value.mount,
      requested: true,
      current: false,
    }),
  )
  expect(await requestNativeFormFieldFocus(value, focus)).toEqual({ requested: true, current: false })
})
it.each(["inactive", "missing root", "wrong target", "missing action lease"])(
  "rejects %s before sending focus",
  async (mode) => {
    const value = scope(),
      focus = jest.fn()
    const request =
      mode === "inactive"
        ? { ...value, mount: { ...value.mount, active: false } }
        : mode === "missing root"
          ? { ...value, formMount: null }
          : mode === "wrong target"
            ? { ...value, mount: { ...value.mount, originalTarget: 99 } }
            : { ...value, origin: "native" as const }
    expect(await requestNativeFormFieldFocus(request, focus)).toEqual({ requested: false, current: false })
    expect(focus).not.toHaveBeenCalled()
  },
)
it("rejects a late response from a replaced original mount", async () => {
  const value = scope()
  const focus = async () =>
    JSON.stringify({
      descriptorId: "field",
      descriptorRevision: "field:3",
      target: 5,
      mount: { ...value.mount, epoch: 1 },
      requested: true,
      current: true,
    })
  expect(await requestNativeFormFieldFocus(value, focus)).toEqual({ requested: false, current: false })
})
