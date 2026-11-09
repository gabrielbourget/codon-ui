import "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"

import { createRef } from "react"
import * as RN from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
  userEvent,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import {
  NativeComboBoxGroupContext,
  NativeComboBoxPopoverContext,
} from "../../../../../packages/react-native/src/components/ComboBox/collectionContext"
import { nativeFormRegistry } from "../../../../../packages/react-native/src/form/registry"
import { NativeFloatingLayerHost } from "../../../../../packages/react-native/src/overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../../../packages/react-native/src/overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../../../packages/react-native/src/theme"
import { TagComboBoxScene } from "../TagComboBoxScene"

const mockAdmitForm = jest.fn<Promise<string>, [string]>()
jest.mock("../../../../../packages/react-native/src/input/specs/NativeCUIFormDocument", () => ({
  __esModule: true,
  default: { admitForm: (request: string) => mockAdmitForm(request) },
}))
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const hidden = { includeHiddenElements: true }
const host = createRef<RN.View>(),
  anchor = createRef<RN.View>(),
  popup = createRef<RN.View>()
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameSequence = 0
let formSequence = 0
const scene = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost testID="fixture-host" ref={host}>
        <NativeComboBoxGroupContext.Provider value={{ ref: anchor }}>
          <NativeComboBoxPopoverContext.Provider value={{ ref: popup }}>
            <TagComboBoxScene />
          </NativeComboBoxPopoverContext.Provider>
        </NativeComboBoxGroupContext.Provider>
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const acknowledgeForm = async () => {
  for (const binding of [...nativeFormRegistry.forms.values(), ...nativeFormRegistry.fields.values()]) {
    const descriptor = binding.descriptor
    const metadata = screen.container.queryAll(
      (node) =>
        node.props.descriptorId === descriptor.descriptorId && typeof node.props.onNativeFormCommit === "function",
    )[0]
    await act(() =>
      metadata.props.onNativeFormCommit({
        nativeEvent: {
          ...descriptor,
          target: descriptor.metadataTarget,
          originalTarget: descriptor.target,
          surfaceId: 11,
          windowId: "source-model-window",
          epoch: 1,
          sequence: ++formSequence,
          mountRevision: descriptor.descriptorRevision,
          attached: true,
          active: true,
          complete: true,
          metadataOnly: true,
          originalClass: "FixtureOriginal",
          error: "",
        },
      }),
    )
  }
}
const press = async (name: string) => {
  if (name.endsWith("tag-combo form programmatically")) await acknowledgeForm()
  const target = screen.getByRole("button", { name, ...hidden })
  if (name !== "Show suggestions") return fireEvent.press(target)
  const event = {
    target: 17,
    currentTarget: 17,
    persist: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: { target: 17, identifier: 1, pageX: 4, pageY: 4, locationX: 4, locationY: 4, timestamp: 1 },
  }
  await fireEvent(target, "responderGrant", event)
  await fireEvent(target, "responderRelease", event)
}
const choose = (name: string) => act(() => userEvent.setup().press(screen.getByRole("option", { name })))
const show = async () => {
  const measure = (target: RN.View, box: number[]) =>
    Object.defineProperty(target, "measureInWindow", {
      configurable: true,
      value: (callback: (...values: number[]) => void) => callback(...box),
    })
  measure(host.current!, [0, 0, 360, 640])
  measure(anchor.current!, [10, 40, 260, 48])
  measure(popup.current!, [0, 0, 260, 180])
  await fireEvent(screen.getByTestId("fixture-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
  })
  await fireEvent(screen.getByTestId("combo-box-popover", hidden), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 260, height: 180 } },
  })
  for (const ready of [false, true]) {
    const scope = screen.getByTestId("fixture-host").props
    await act(() =>
      scope.onNativeScopeStatus({
        nativeEvent: {
          ownerId: scope.ownerId,
          windowId: "source-model-window",
          epoch: 1,
          policyRevision: scope.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  for (let turn = 0; turn < 3; turn++)
    await act(() => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(0))
    })
}

beforeEach(() => {
  jest.useFakeTimers()
  frames.clear()
  formSequence = 0
  const native = jest.requireActual<typeof RN>("react-native")
  const findHandle = jest.spyOn(native, "findNodeHandle")
  const inheritedFind = findHandle.getMockImplementation()!
  const formTargets = new WeakMap<object, number>()
  let nextFormTarget = 80000000
  findHandle.mockImplementation((host) => {
    const existing = inheritedFind(host)
    if (existing || !host || typeof host !== "object") return existing
    if (!formTargets.has(host)) formTargets.set(host, ++nextFormTarget)
    return formTargets.get(host)!
  })
  mockAdmitForm.mockReset().mockImplementation(async (encoded) => {
    const request = JSON.parse(encoded)
    // This acknowledges an explicit source model, never an installed native hierarchy.
    return JSON.stringify({
      accepted: true,
      requestId: request.requestId,
      formRevision: request.form.descriptorRevision,
    })
  })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameSequence
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id != null) frames.delete(id)
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("keeps popup requests subject to owner veto and opens only after an owner echo", async () => {
  await render(scene())
  await press("Toggle tag-combo popup veto")
  await press("Show suggestions")
  expect(screen.getByTestId("tag-combo-owner-state")).toHaveTextContent(/Open: false.*Popup: veto/)
  expect(screen.getByTestId("tag-combo-owner-requests")).toHaveTextContent("Requests: open:true.")
  await press("Toggle tag-combo popup veto")
  await press("Show suggestions")
  await show()
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Open: true/)
  expect(screen.getByTestId("combo-box-input")).toBeOnTheScreen()
})

it("retains held selection and query across repeated add requests, then shows the owner echo", async () => {
  await render(scene())
  await press("Run two-veto tag-combo selection")
  await show()
  await choose("Empty key")
  await choose("Empty key")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Selected: empty.*Query: "Empty"/)
  expect(screen.getByTestId("tag-combo-owner-requests", hidden)).toHaveTextContent(
    'Requests: add:string:"" → input:"" → nested-input:"" → add:string:"" → input:"" → nested-input:"".',
  )
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("Empty")
  await choose("Empty key")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(
    /Selected: string:"".*Query: "".*Open: true/,
  )
  expect(screen.queryByRole("option", { name: "Empty key" })).toBeNull()
})

it("preserves the original draft and receiver refs through theme, styles and item updates", async () => {
  const view = await render(scene())
  await press("Toggle tag-combo owner open")
  await show()
  const editor = screen.getByTestId("tag-combo-owner-editor", hidden)
  await fireEvent.changeText(editor, "original owner draft")
  await press("Inspect tag-combo refs")
  expect(screen.getByTestId("tag-combo-owner-editor-state", hidden)).not.toHaveTextContent(/replaced/)
  await press("Toggle tag-combo styles")
  await press("Toggle tag-combo text size")
  await press("Reverse tag-combo items")
  await view.rerender(scene("dark"))
  await press("Inspect tag-combo refs")
  expect(editor).toHaveDisplayValue("original owner draft")
  expect(screen.getByTestId("tag-combo-owner-editor-state", hidden)).toHaveTextContent(/Text events: 1\./)
  expect(screen.getByTestId("tag-combo-owner-editor-state", hidden)).not.toHaveTextContent(/replaced/)
})

it("keeps the source string-key exclusion rule while preserving typed owner keys", async () => {
  await render(scene())
  await press("Toggle tag-combo empty-collection allowance")
  await press("Set tag-combo number zero")
  await press("Toggle tag-combo owner open")
  await show()
  expect(screen.queryByRole("option", { name: "Number zero" })).toBeNull()
  expect(screen.queryByRole("option", { name: "String zero" })).toBeNull()
  expect(screen.getByRole("option", { name: "Empty key" })).toBeOnTheScreen()
  await press("Set tag-combo string zero")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Selected: string:"0"/)
  await press("Clear tag-combo items")
  expect(screen.getByTestId("combo-box-empty")).toBeOnTheScreen()
  await press("Restore tag-combo items")
  expect(screen.getByRole("option", { name: "Empty key" })).toBeOnTheScreen()
})

it("requests closing once when the confirmed collection becomes empty under the default policy", async () => {
  await render(scene())
  await press("Toggle tag-combo owner open")
  await show()
  await press("Clear tag-combo items")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Open: false/)
  expect(screen.getByTestId("tag-combo-owner-requests", hidden)).toHaveTextContent("Requests: open:false.")
  expect(screen.getByTestId("combo-box-input")).toBeOnTheScreen()
})

it("replaces the requested custom picker host while retaining the wrapper, owner query and independent editor", async () => {
  await render(scene())
  await press("Set tag-combo owner query")
  const wrapper = screen.getByTestId("tag-combobox"),
    editor = screen.getByTestId("tag-combo-owner-editor"),
    before = screen.getByTestId("combo-box-input")
  await fireEvent.changeText(editor, "independent draft")
  expect(before.props.nativeID).toBe("tag-combo-owner-query-field")
  await press("Toggle tag-combo custom picker root")
  const after = screen.getByTestId("combo-box-input")
  expect(screen.getByTestId("tag-combo-owner-custom-picker")).toBeOnTheScreen()
  expect(screen.getByTestId("tag-combobox") === wrapper).toBe(true)
  expect(after).toHaveDisplayValue("held query")
  expect(after.props.nativeID).toBe("tag-combo-owner-query-field")
  expect(editor).toHaveDisplayValue("independent draft")
  expect(screen.getByTestId("tag-combo-owner-requests")).toHaveTextContent("Requests: none.")
  await press("Toggle tag-combo custom picker root")
  expect(screen.queryByTestId("tag-combo-owner-custom-picker")).toBeNull()
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("held query")
})

it("submits the current named query through its actual Form ref while retaining the independent draft", async () => {
  await render(scene())
  const input = screen.getByTestId("combo-box-input"),
    draft = screen.getByTestId("tag-combo-owner-editor"),
    form = [...nativeFormRegistry.forms.values()][0].original
  await fireEvent.changeText(draft, "independent draft")
  await press("Set tag-combo owner query")
  await press("Submit tag-combo form programmatically")
  expect(screen.getByTestId("tag-combo-form-requests")).toHaveTextContent(
    /submit:programmatic:\[\["tagQuery","held query"\]\]/,
  )
  expect(screen.getByTestId("tag-combo-form-state")).toHaveTextContent(/Result: submitted\./)
  const request = JSON.parse(mockAdmitForm.mock.calls[0][0])
  expect(request.formMount.originalTarget).toBe(request.form.target)
  expect(request.fields).toHaveLength(1)
  expect(request.fields[0].mount.originalTarget).toBe(request.fields[0].field.target)
  expect([...nativeFormRegistry.forms.values()][0].original === form).toBe(true)
  expect(screen.getByTestId("combo-box-input") === input).toBe(true)
  expect(draft).toHaveDisplayValue("independent draft")
})

it("keeps form cancellation separate from owner-vetoed reset requests and their later echo", async () => {
  await render(scene())
  await press("Set tag-combo owner query")
  await press("Set tag-combo number zero")
  await press("Toggle tag-combo input veto")
  await press("Toggle tag-combo form veto")
  await press("Reset tag-combo form programmatically")
  expect(screen.getByTestId("tag-combo-form-state")).toHaveTextContent(/Result: cancelled\./)
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("held query")
  expect(screen.getByTestId("tag-combo-owner-requests")).toHaveTextContent(/input:"" → nested-input:""/)
  await press("Toggle tag-combo form veto")
  await press("Reset tag-combo form programmatically")
  expect(screen.getByTestId("tag-combo-form-state")).toHaveTextContent(/Result: reset\./)
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("held query")
  expect(screen.getByTestId("tag-combo-owner-requests")).toHaveTextContent(/input:"" → nested-input:""/)
  await press("Toggle tag-combo input veto")
  await press("Reset tag-combo form programmatically")
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("")
  expect(screen.getByTestId("tag-combo-owner-state")).toHaveTextContent(/Selected: number:0/)
})

it("uses committed disabled and explicit association policy without replacing its field", async () => {
  await render(scene())
  const original = screen.getByTestId("combo-box-input")
  await press("Set tag-combo owner query")
  await press("Toggle tag-combo disabled")
  await press("Submit tag-combo form programmatically")
  expect(screen.getByTestId("tag-combo-form-requests")).toHaveTextContent(/submit:programmatic:\[\]/)
  await press("Toggle tag-combo disabled")
  await press("Toggle tag-combo form association")
  await press("Submit tag-combo form programmatically")
  expect(screen.getByTestId("tag-combo-form-requests")).toHaveTextContent(/submit:programmatic:\[\]/)
  await press("Toggle tag-combo form association")
  await press("Toggle tag-combo read only")
  await press("Submit tag-combo form programmatically")
  expect(screen.getByTestId("tag-combo-form-requests")).toHaveTextContent(
    /submit:programmatic:\[\["tagQuery","held query"\]\]/,
  )
  expect(screen.getByTestId("combo-box-input") === original).toBe(true)
})

it("shows validation outcomes and never treats an unavailable native document as a successful empty form", async () => {
  await render(scene())
  await press("Toggle tag-combo required")
  await press("Submit tag-combo form programmatically")
  expect(screen.getByTestId("tag-combo-form-state")).toHaveTextContent(/Result: invalid\./)
  expect(screen.getByTestId("tag-combo-form-requests")).toHaveTextContent("Form requests: none.")
  await press("Toggle tag-combo form validation")
  await press("Submit tag-combo form programmatically")
  expect(screen.getByTestId("tag-combo-form-state")).toHaveTextContent(/Result: submitted\./)
  mockAdmitForm.mockRejectedValueOnce(new Error("Original native form hosts unavailable"))
  await press("Submit tag-combo form programmatically")
  expect(screen.getByTestId("tag-combo-form-state")).toHaveTextContent(/Result: retired:form-originals-not-admitted\./)
})

it("does not admit a programmatic form request without original form and field mount receipts", async () => {
  await render(scene())
  await fireEvent.press(screen.getByRole("button", { name: "Submit tag-combo form programmatically" }))
  expect(mockAdmitForm).not.toHaveBeenCalled()
  expect(screen.getByTestId("tag-combo-form-requests")).toHaveTextContent("Form requests: none.")
  expect(screen.getByTestId("tag-combo-form-state")).toHaveTextContent(/Result: retired:form-originals-not-admitted\./)
})

it("keeps an original form-action press without a native acknowledgement from becoming a successful submit", async () => {
  await render(scene())
  await act(() => userEvent.setup().press(screen.getByRole("button", { name: "Submit tag-combo form" })))
  expect(screen.getByTestId("tag-combo-form-requests")).toHaveTextContent("Form requests: none.")
  expect(screen.getByTestId("tag-combo-form-state")).toHaveTextContent(/Result: retired:/)
})

it("materializes the picker through the actual VirtualizedList while its selected tags keep their ordinary renderer", async () => {
  await render(scene())
  const input = screen.getByTestId("combo-box-input"),
    draft = screen.getByTestId("tag-combo-owner-editor")
  await fireEvent.changeText(draft, "virtualized owner draft")
  await press("Set tag-combo number zero")
  await press("Toggle 72-item tag-combo virtualization")
  await press("Toggle tag-combo owner open")
  await show()
  expect(screen.getByTestId("tag-combo-owner-virtual-list")).toBeOnTheScreen()
  expect(screen.getByTestId("tag-combo-owner-profile", hidden)).toHaveTextContent(
    /Logical items: 72\. Renderer: VirtualizedList/,
  )
  expect(screen.getByText("Number zero")).toBeOnTheScreen()
  expect(screen.getAllByRole("option").length).toBeLessThan(70)
  expect(screen.queryByRole("option", { name: "Window choice 68" })).toBeNull()
  expect(screen.getByTestId("combo-box-input") === input).toBe(true)
  expect(draft).toHaveDisplayValue("virtualized owner draft")
})

it("retains its original editor and held query when direction and large text change", async () => {
  await render(scene())
  await press("Set tag-combo owner query")
  const original = screen.getByTestId("combo-box-input")
  await press("Toggle tag-combo direction")
  await press("Toggle tag-combo text size")
  expect(RN.StyleSheet.flatten(screen.getByTestId("tag-combobox").props.style).direction).toBe("rtl")
  expect(screen.getByTestId("tag-combo-owner-profile")).toHaveTextContent(/Direction: rtl\. Text: large\./)
  expect(screen.getByTestId("combo-box-input") === original).toBe(true)
  expect(original).toHaveDisplayValue("held query")
})

it("executes native Intl.ListFormat on original selected labels and exposes an unavailable formatter", async () => {
  await render(scene())
  await press("Set two selected tags")
  await press("Format selected tag names")
  expect(screen.getByTestId("tag-combo-owner-formatted-selection")).toHaveTextContent(
    "Formatted selection: Number zero and Dernière étiquette.",
  )
  jest.spyOn(Intl, "ListFormat").mockImplementation(() => {
    throw new Error("Native formatter missing")
  })
  await press("Format selected tag names")
  expect(screen.getByTestId("tag-combo-owner-formatted-selection")).toHaveTextContent(
    /Unavailable: Error: Native formatter missing/,
  )
})
