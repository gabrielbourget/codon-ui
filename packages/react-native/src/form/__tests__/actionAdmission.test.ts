import { admitNativeFormAction } from "../actionAdmission"
import type { TNativeFormBinding, TNativeFormFieldBinding } from "../registry"

jest.mock("../../input/specs/NativeCUIFormDocument", () => ({ __esModule: true, default: null }))
const setup = () => {
  const form = {
    descriptor: { descriptorRevision: "form:current" },
    mount: () => ({ getSnapshot: () => ({ target: 3, epoch: 4 }) }),
  } as unknown as TNativeFormBinding
  const fields = [
    { descriptor: { target: 8 }, mount: () => ({ getSnapshot: () => ({ target: 7, originalTarget: 8, epoch: 2 }) }) },
  ] as unknown as TNativeFormFieldBinding[]
  const admit = jest.fn(async (encoded: string) => {
    const request = JSON.parse(encoded)
    return JSON.stringify({
      accepted: true,
      requestId: request.requestId,
      formRevision: request.form.descriptorRevision,
    })
  })
  return { form, fields, admit }
}
it("admits only the explicit model and exact acknowledged original-host receipts", async () => {
  const { form, fields, admit } = setup()
  expect(await admitNativeFormAction(form, fields, undefined, admit)).toBe(true)
  const request = JSON.parse(admit.mock.calls[0][0])
  expect(request.formMount).toEqual({ target: 3, epoch: 4 })
  expect(request.fields).toEqual([{ field: { target: 8 }, mount: { target: 7, originalTarget: 8, epoch: 2 } }])
  expect(request).not.toHaveProperty("nodes")
})
it.each(["request", "revision", "denied", "throws"])("rejects %s admission responses", async (mode) => {
  const value = setup()
  value.admit.mockImplementation(async (encoded) => {
    const request = JSON.parse(encoded)
    if (mode === "throws") throw new Error("unavailable")
    return JSON.stringify({
      accepted: mode !== "denied",
      requestId: mode === "request" ? "old" : request.requestId,
      formRevision: mode === "revision" ? "old" : request.form.descriptorRevision,
    })
  })
  expect(await admitNativeFormAction(value.form, value.fields, undefined, value.admit)).toBe(false)
})
it("does not invent a root or field mount receipt", async () => {
  const value = setup()
  expect(await admitNativeFormAction({ ...value.form, mount: () => null }, value.fields, undefined, value.admit)).toBe(
    false,
  )
  expect(
    await admitNativeFormAction(value.form, [{ ...value.fields[0], mount: () => null }], undefined, value.admit),
  ).toBe(false)
  expect(value.admit).not.toHaveBeenCalled()
})
