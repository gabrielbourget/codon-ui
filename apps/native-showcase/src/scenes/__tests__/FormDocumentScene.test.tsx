import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { NativeThemeProvider } from "@codon-ui/react-native"

import Document from "../../../../../packages/react-native/src/input/specs/NativeCUIFormDocument"
import { FormDocumentScene } from "../FormDocumentScene"

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
  default: { getSnapshot: jest.fn() },
}))
const scene = (
  <NativeThemeProvider>
    <FormDocumentScene />
  </NativeThemeProvider>
)
const handles = new WeakMap<object, number>()
let nextHandle = 100
beforeEach(() => {
  jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation((host) => {
      if (!host || typeof host !== "object") return null
      if (!handles.has(host)) handles.set(host, ++nextHandle)
      return handles.get(host)!
    })
})
afterEach(() => jest.restoreAllMocks())

it("preserves actual editors and independent drafts through keyed reorder and Activity changes", async () => {
  await render(scene)
  const first = screen.getByLabelText("Form document first")
  const second = screen.getByLabelText("Form document second")
  await fireEvent.changeText(first, "Owner draft")
  await fireEvent.press(screen.getByRole("button", { name: "Reorder form document fields" }))
  expect(screen.getByLabelText("Form document first")).toBe(first)
  expect(screen.getByLabelText("Form document second")).toBe(second)
  expect(screen.getByLabelText("Form document first").props.value).toBe("Owner draft")
  await fireEvent.press(screen.getByRole("button", { name: "Toggle form document Activity" }))
  await fireEvent.press(screen.getByRole("button", { name: "Toggle form document Activity" }))
  expect(screen.getByLabelText("Form document first").props.value).toBe("Owner draft")
})

it("reports native query rejection and never substitutes a JavaScript ordering result", async () => {
  jest.mocked(Document!.getSnapshot).mockRejectedValueOnce(new Error("Native document incomplete"))
  await render(scene)
  await act(() => fireEvent.press(screen.getByRole("button", { name: "Capture native form document" })))
  expect(screen.getByTestId("form-document-report")).toHaveTextContent(
    "Native document rejected: Error: Native document incomplete",
  )
  const encoded = jest.mocked(Document!.getSnapshot).mock.calls.at(-1)![0]
  expect(JSON.parse(encoded)).toEqual({ target: expect.any(Number), requestId: expect.any(String) })
  expect(screen.getByLabelText("Form document external-before").props.value).toBe("Draft external-before")
})
