import type { NativeFormActionStatus } from "../../input/specs/CUIFocusViewNativeComponent"
import { admitNativeFormAction } from "../actionAdmission"
import { decodeNativeFormDocument } from "../document"

jest.mock("../../input/specs/NativeCUIFormDocument", () => ({ __esModule: true, default: null }))

const setup = () => {
  const request = { target: 2, requestId: "read:1" }
  const lease: NativeFormActionStatus = {
    ownerId: "action",
    descriptorRevision: "action:1",
    viewOwnerId: "view:1",
    target: 2,
    surfaceId: 11,
    windowId: "window",
    epoch: 1,
    sequence: 1,
    scopeOwnerId: "",
    scopeEpoch: 0,
    attached: true,
    active: true,
    enabled: true,
  }
  const raw = {
    ...request,
    documentId: "doc",
    revision: "9",
    surfaceId: 11,
    rootTarget: 1,
    nodes: [
      { target: 1, parent: 0, component: "RootView" },
      { target: 2, parent: 1, component: "CUIFocusView" },
      { target: 3, parent: 1, component: "View" },
      { target: 4, parent: 3, component: "CUIFormRoot" },
    ].map((node) => ({ ...node, hidden: false, displayNone: false })),
    forms: [
      {
        ownerId: "form",
        descriptorId: "form",
        descriptorRevision: "form:1",
        target: 3,
        metadataTarget: 4,
        formId: "owner",
        position: 3,
      },
    ],
    fields: [],
  }
  const document = decodeNativeFormDocument(JSON.stringify(raw), request)
  const response = {
    ...raw,
    requestId: "read:1:admission",
    actionAdmission: {
      accepted: true,
      lease: { ...lease },
      documentId: "doc",
      revision: "9",
      formDescriptorId: "form",
      formDescriptorRevision: "form:1",
    },
  }
  const read = jest.fn(async () => JSON.stringify(response))
  return { lease, document, form: document.forms[0], response, read }
}

it("requires exact native admission for the same complete document, form and current button lease", async () => {
  const value = setup()
  expect(await admitNativeFormAction(value.lease, value.document, value.form, value.read)).toBe(true)
  expect(value.read).toHaveBeenCalledWith({
    target: 2,
    requestId: "read:1:admission",
    surfaceId: 11,
    actionAdmission: { lease: value.lease, form: value.form, documentId: "doc", revision: "9" },
  })
})

it.each([
  [
    "denied",
    (value: ReturnType<typeof setup>) => {
      value.response.actionAdmission.accepted = false
    },
  ],
  [
    "stale window",
    (value: ReturnType<typeof setup>) => {
      value.response.actionAdmission.lease.windowId = "other"
    },
  ],
  [
    "old sequence",
    (value: ReturnType<typeof setup>) => {
      value.response.actionAdmission.lease.sequence = 0
    },
  ],
  [
    "native replacement",
    (value: ReturnType<typeof setup>) => {
      value.response.actionAdmission.lease.viewOwnerId = "other"
    },
  ],
  [
    "changed form",
    (value: ReturnType<typeof setup>) => {
      value.response.actionAdmission.formDescriptorRevision = "other"
    },
  ],
  [
    "changed document",
    (value: ReturnType<typeof setup>) => {
      value.response.documentId = "other"
    },
  ],
  [
    "changed revision",
    (value: ReturnType<typeof setup>) => {
      value.response.revision = "10"
    },
  ],
  [
    "changed retained hierarchy",
    (value: ReturnType<typeof setup>) => {
      value.response.nodes[1].hidden = true
    },
  ],
] as const)("does not admit %s", async (_name, mutate) => {
  const value = setup()
  mutate(value)
  expect(await admitNativeFormAction(value.lease, value.document, value.form, value.read)).toBe(false)
})

it("propagates an unavailable native document so the controller retires the request", async () => {
  const value = setup()
  const read = jest.fn(async (): Promise<string> => {
    throw new Error("native unavailable")
  })
  await expect(admitNativeFormAction(value.lease, value.document, value.form, read)).rejects.toThrow(
    "native unavailable",
  )
})
