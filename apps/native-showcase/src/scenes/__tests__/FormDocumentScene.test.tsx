import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { NativeThemeProvider } from "@codon-ui/react-native"

import { NativeFormRegistryContext } from "../../../../../packages/react-native/src/form/context"
import { NativeFormRegistry } from "../../../../../packages/react-native/src/form/registry"
import { FormDocumentScene } from "../FormDocumentScene"

const mockAdmit = jest.fn<Promise<string>, [string]>()
jest.mock("../../../../../packages/react-native/src/input/specs/CUIFormRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../../../../packages/react-native/src/input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../../../../packages/react-native/src/input/specs/NativeCUIFormDocument", () => ({
  __esModule: true,
  default: { admitForm: (request: string) => mockAdmit(request) },
}))
beforeEach(() => {
  const handles = new WeakMap<object, number>()
  let nextHandle = 100
  mockAdmit.mockReset().mockImplementation(async (encoded) => {
    const request = JSON.parse(encoded)
    return JSON.stringify({
      accepted: true,
      requestId: request.requestId,
      formRevision: request.form.descriptorRevision,
    })
  })
  jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation((host) => {
      if (!host || typeof host !== "object") return null
      if (!handles.has(host)) handles.set(host, ++nextHandle)
      return handles.get(host)!
    })
})
afterEach(() => jest.restoreAllMocks())

const setup = async () => {
  const registry = new NativeFormRegistry()
  const view = await render(
    <NativeThemeProvider>
      <NativeFormRegistryContext.Provider value={registry}>
        <FormDocumentScene />
      </NativeFormRegistryContext.Provider>
    </NativeThemeProvider>,
  )
  const acknowledge = async (hiddenFields: readonly string[] = [], modalWindow = false) => {
    for (const binding of [...registry.forms.values(), ...registry.fields.values()]) {
      const descriptor = binding.descriptor
      const metadata = view.container.queryAll(
        (node) =>
          node.props.descriptorId === descriptor.descriptorId && typeof node.props.onNativeFormCommit === "function",
      )[0]
      await act(() =>
        metadata.props.onNativeFormCommit({
          nativeEvent: {
            ...descriptor,
            target: descriptor.metadataTarget,
            originalTarget: descriptor.target,
            surfaceId: 1,
            windowId:
              modalWindow && "fieldId" in binding && binding.fieldId === "modal" ? "modal-window" : "fixture-window",
            epoch: 1,
            sequence: 1,
            mountRevision: descriptor.descriptorRevision,
            attached: true,
            active: !("fieldId" in binding && binding.fieldId && hiddenFields.includes(binding.fieldId)),
            complete: true,
            metadataOnly: true,
            originalClass: "FixtureOriginal",
            error: "",
          },
        }),
      )
    }
  }
  return { registry, view, acknowledge }
}
const capture = () => fireEvent.press(screen.getByRole("button", { name: "Capture explicit form model" }))
const report = () => JSON.parse(screen.getByTestId("form-document-report").props.children)

it("preserves original editors and drafts through declared reorder and hidden Activity", async () => {
  const value = await setup()
  const first = screen.getByLabelText("Form document first")
  const second = screen.getByLabelText("Form document second")
  const activity = screen.getByLabelText("Form document activity")
  await fireEvent.changeText(first, "Owner draft")
  await fireEvent.changeText(activity, "Retained hidden draft")
  await fireEvent.press(screen.getByRole("button", { name: "Reorder form document fields" }))
  expect(screen.getByLabelText("Form document first")).toBe(first)
  expect(screen.getByLabelText("Form document second")).toBe(second)
  await fireEvent.press(screen.getByRole("button", { name: "Toggle form document Activity" }))
  await value.acknowledge(["activity"])
  await capture()
  expect(report().fieldOrder).toEqual(["external-before", "second", "first", "activity", "external-after"])
  expect(report().fields.find((field: { id: string }) => field.id === "activity").entries).toEqual([
    ["activity", "Retained hidden draft"],
  ])
  await fireEvent.press(screen.getByRole("button", { name: "Toggle form document Activity" }))
  expect(screen.getByLabelText("Form document activity")).toBe(activity)
  expect(screen.getByLabelText("Form document first").props.value).toBe("Owner draft")
  expect(screen.getByLabelText("Form document activity").props.value).toBe("Retained hidden draft")
})

it("captures explicit external and React ownership only after exact original-host admission", async () => {
  const value = await setup()
  await value.acknowledge()
  await capture()
  expect(report().source).toBe("explicit-model")
  expect(report().fields.map((field: { id: string }) => field.id)).toEqual([
    "external-before",
    "first",
    "second",
    "activity",
    "external-after",
  ])
  expect(report()).not.toHaveProperty("documentId")
  const request = JSON.parse(mockAdmit.mock.calls[0][0])
  expect(request.formMount.originalTarget).toBe(request.form.target)
  expect(request.fields).toHaveLength(5)
  expect(
    request.fields.every(
      (row: { field: { target: number }; mount: { originalTarget: number } }) =>
        row.field.target === row.mount.originalTarget,
    ),
  ).toBe(true)
  expect(screen.getByLabelText("Form document disassociated").props.value).toBe("Draft disassociated")
})

it("never substitutes a declared-model result for missing receipts or native refusal", async () => {
  const value = await setup()
  await capture()
  expect(mockAdmit).not.toHaveBeenCalled()
  expect(screen.getByTestId("form-document-report")).toHaveTextContent(/Form capture rejected/)
  await value.acknowledge()
  mockAdmit.mockRejectedValueOnce(new Error("Native original retired"))
  await capture()
  expect(mockAdmit).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId("form-document-report")).toHaveTextContent(/Original native form hosts not admitted/)
})

it("rejects an admitted old model if declared order changed while the native request was pending", async () => {
  const value = await setup()
  await value.acknowledge()
  let finish!: () => void
  mockAdmit.mockImplementationOnce(
    (encoded) =>
      new Promise((resolve) => {
        const request = JSON.parse(encoded)
        finish = () =>
          resolve(
            JSON.stringify({
              accepted: true,
              requestId: request.requestId,
              formRevision: request.form.descriptorRevision,
            }),
          )
      }),
  )
  await capture()
  await fireEvent.press(screen.getByRole("button", { name: "Reorder form document fields" }))
  await act(() => finish())
  expect(screen.getByTestId("form-document-report")).toHaveTextContent(/Explicit form model changed during admission/)
})

it("keeps Modal ownership explicit and reports the native cross-window refusal", async () => {
  const value = await setup()
  await fireEvent.press(screen.getByRole("button", { name: "Toggle form document Modal" }))
  const form = [...value.registry.forms.values()][0]
  expect(value.registry.fieldsFor(form).map((field) => field.fieldId)).toContain("modal")
  await value.acknowledge([], true)
  mockAdmit.mockImplementationOnce(async (encoded) => {
    const request = JSON.parse(encoded)
    expect(request.fields.some((row: { mount: { windowId: string } }) => row.mount.windowId === "modal-window")).toBe(
      true,
    )
    return JSON.stringify({
      accepted: false,
      requestId: request.requestId,
      formRevision: request.form.descriptorRevision,
    })
  })
  await fireEvent.press(screen.getByRole("button", { name: "Capture modal form model" }))
  expect(screen.getByTestId("form-document-report")).toHaveTextContent(/Original native form hosts not admitted/)
  expect(mockAdmit).toHaveBeenCalledTimes(1)
})
