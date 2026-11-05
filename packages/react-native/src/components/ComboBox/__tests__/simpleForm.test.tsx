import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import * as RN from "react-native"

import { ComboBox, type TNativeComboBoxProps } from "../../.."
import { NativeFormRegistryContext } from "../../../form/context"
import { NativeFormController } from "../../../form/controller"
import { NativeForm } from "../../../form/NativeForm"
import { NativeFormRegistry } from "../../../form/registry"
import { focusNativeTarget } from "../../../input/focus"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import type { NativeFormCommitData } from "../../../input/specs/CUIFormRootNativeComponent"

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    requestContainerFocus: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
jest.mock("../../../input/specs/CUIFormRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
let tags: WeakMap<object, number>, originals: Map<string, RN.View>
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  tags = new WeakMap()
  originals = new Map()
  let serial = 100
  jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockImplementation((view) => {
    if (!view || typeof view !== "object") return null
    if (!tags.has(view)) tags.set(view, ++serial)
    const id = (view as { props?: { testID?: string } }).props?.testID
    if (id) originals.set(id, view as RN.View)
    return tags.get(view)!
  })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
type TItem = { key: string | number; text: string }
const base: TNativeComboBoxProps<TItem> = {
  items: [
    { key: 0, text: "Zero" },
    { key: "0", text: "String zero" },
    { key: "", text: "Empty key" },
  ],
  getKey: (item) => item.key,
  getTextValue: (item) => item.text,
  accessibilityLabel: "Choose",
  inputLabel: "Query",
  closeLabel: "Close",
  name: "entry",
  formFieldId: "choice",
  isOpen: false,
}
const setup = async (initial: Partial<TNativeComboBoxProps<TItem>> = {}, errors = {}) => {
  const registry = new NativeFormRegistry(),
    root = createRef<RN.View>(),
    editor = createRef<RN.TextInput>(),
    form = createRef<RN.View>()
  const node = (props: typeof initial) => (
    <NativeFormRegistryContext.Provider value={registry}>
      <NativeForm ref={form} fieldOrder={["choice"]} id="checkout" validationErrors={errors}>
        <ComboBox {...base} {...props} ref={root} inputRef={editor} />
      </NativeForm>
    </NativeFormRegistryContext.Provider>
  )
  const view = await render(node(initial))
  const field = () => [...registry.fields.values()].find((entry) => entry.fieldId === "choice")!
  const metadata = (descriptorId: string) =>
    view.container.queryAll(
      (entry) => entry.props.descriptorId === descriptorId && typeof entry.props.onNativeFormCommit === "function",
    )[0]!
  return {
    registry,
    root,
    editor,
    form,
    view,
    field,
    metadata,
    update: (props: typeof initial) => view.rerender(node(props)),
  }
}
const mountedPacket = (
  descriptor: {
    ownerId: string
    descriptorId: string
    descriptorRevision: string
    metadataTarget: number
    target: number
  },
  sequence = 1,
): NativeFormCommitData => ({
  ownerId: descriptor.ownerId,
  descriptorId: descriptor.descriptorId,
  descriptorRevision: descriptor.descriptorRevision,
  target: descriptor.metadataTarget,
  originalTarget: descriptor.target,
  surfaceId: 1,
  windowId: "simple-form-source-window",
  epoch: 1,
  sequence,
  mountRevision: `${descriptor.descriptorRevision}:mount`,
  originalClass: "CUIFocusView",
  attached: true,
  active: true,
  complete: true,
  metadataOnly: true,
  error: "",
})

it("keeps the actual outer trigger participant and metadata descendant while the modal editor is absent", async () => {
  const v = await setup({ defaultValue: 0, defaultInputValue: "Zero" })
  const field = v.field(),
    trigger = originals.get("combo-box-trigger")!
  expect(screen.getByTestId("combo-box").props.collapsable).toBe(false)
  expect(v.editor.current).toBeNull()
  expect(screen.queryByTestId("combo-box-input")).toBeNull()
  expect(field.editor()).toBe(trigger)
  expect(field.editor()).not.toBe(v.root.current)
  expect(JSON.parse(field.descriptor.ownedControlBinding!)).toEqual({
    kind: "combo-box-trigger",
    rootTarget: tags.get(v.root.current!),
  })
  const metadata = v.metadata(field.descriptor.descriptorId)
  expect(metadata.props.editorTarget).toBe(tags.get(trigger))
  expect(metadata.props.ownedEditorBinding ?? "").toBe("")
  expect(metadata.props.ownedControlBinding).toBe(field.descriptor.ownedControlBinding)
  let parent = metadata.parent
  while (parent && parent.props.testID !== "combo-box-trigger") parent = parent.parent
  expect(parent).not.toBeNull()
  expect(JSON.parse(metadata.props.semanticBinding)).toMatchObject({
    text: { label: "Choose" },
    activeDescendant: null,
  })
  expect(field.data.entries).toEqual([["entry", "0"]])
  await v.update({ defaultValue: 0, defaultInputValue: "Zero", isOpen: true })
  expect(v.editor.current).not.toBeNull()
  expect(v.field()).toBe(field)
  expect(v.field().editor()).toBe(trigger)
  await v.update({ defaultValue: 0, defaultInputValue: "Zero", isOpen: false })
  expect(v.editor.current).toBeNull()
  expect(v.field()).toBe(field)
})

it("requests query before key reset without changing controlled owners or requesting an open change", async () => {
  const calls: unknown[][] = [],
    opened = jest.fn()
  const callbacks = {
    onInputChange: (query: string) => calls.push(["query", query]),
    onChange: (key: unknown) => calls.push(["key", key]),
    onOpenChange: opened,
  }
  const v = await setup({ ...callbacks, value: 0, inputValue: "initial held" })
  await v.update({ ...callbacks, value: "0", inputValue: "vetoed held", isOpen: false })
  const trigger = v.field().editor()
  await act(() => v.field().reset("programmatic"))
  expect(calls).toEqual([
    ["query", "Zero"],
    ["key", 0],
  ])
  expect(v.field().data.entries).toEqual([["entry", "0"]])
  expect(screen.getByTestId("combo-box-trigger").props.accessibilityValue).toEqual({ text: "vetoed held" })
  expect(v.field().editor()).toBe(trigger)
  expect(opened).not.toHaveBeenCalled()
  expect(v.editor.current).toBeNull()
})

it("serializes authoritative query text and resets readonly values while preserving server errors for programmatic reset", async () => {
  const v = await setup(
    { defaultValue: "", defaultInputValue: "query", formValue: "text", isReadOnly: true },
    { entry: "Server says no" },
  )
  expect(v.field().data.entries).toEqual([["entry", "query"]])
  expect(v.field().data.isReadOnly).toBe(true)
  expect(v.field().data.validation.validationErrors).toEqual(["Server says no"])
  await act(() => v.field().reset("programmatic"))
  expect(v.field().data.validation.validationErrors).toEqual(["Server says no"])
  await act(() => v.field().reset("native"))
  expect(v.field().data.validation.validationErrors).toEqual([])
  await v.update({ defaultValue: "", defaultInputValue: "query", formValue: "text", isDisabled: true })
  expect(v.field().data.isDisabled).toBe(true)
})

it("routes source-controller invalid focus to the acknowledged actual trigger without opening a closed picker", async () => {
  const opened = jest.fn(),
    v = await setup({ defaultValue: null, defaultInputValue: "", isRequired: true, onOpenChange: opened })
  const field = v.field(),
    form = [...v.registry.forms.values()][0]!
  await act(() => {
    v.metadata(field.descriptor.descriptorId).props.onNativeFormCommit({ nativeEvent: mountedPacket(field.descriptor) })
    v.metadata(form.descriptor.descriptorId).props.onNativeFormCommit({
      nativeEvent: { ...mountedPacket(form.descriptor), originalClass: "RCTView" },
    })
  })
  // These explicit source mock receipts exercise the controller; they do not qualify native trigger admission.
  const controller = new NativeFormController(
    v.registry,
    async (currentForm, fields) => {
      const root = currentForm.mount()?.getSnapshot()
      return (
        !!root?.active &&
        fields.every((entry) => {
          const mount = entry.mount()?.getSnapshot()
          return !!mount?.active && mount.windowId === root.windowId && entry.editor() === field.editor()
        })
      )
    },
    async (target) => ({ requested: focusNativeTarget(target), current: target === v.field().editor() }),
  )
  let result!: Awaited<ReturnType<typeof controller.request>>
  await act(async () => {
    result = await controller.request("submit", { origin: "programmatic", form: v.form.current! })
  })
  expect(result.status).toBe("invalid")
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(originals.get("combo-box-trigger"), expect.any(String))
  expect(result.focus).toMatchObject({ requested: true, observed: false })
  const trigger = screen.getByTestId("combo-box-trigger")
  await act(() =>
    trigger.props.onNativeFocusChange({
      nativeEvent: {
        ownerId: trigger.props.ownerId,
        target: v.field().descriptor.target,
        isFocused: true,
        isFocusVisible: true,
        origin: "programmatic",
        timestamp: 1,
      },
    }),
  )
  expect(v.field().isFocusObserved()).toBe(true)
  await act(() =>
    trigger.props.onNativeFocusChange({
      nativeEvent: {
        ownerId: trigger.props.ownerId,
        target: v.field().descriptor.target,
        isFocused: false,
        isFocusVisible: false,
        origin: "programmatic",
        timestamp: 2,
      },
    }),
  )
  expect(v.field().isFocusObserved()).toBe(false)
  expect(opened).not.toHaveBeenCalled()
  expect(v.editor.current).toBeNull()
  expect(screen.queryByTestId("combo-box-input")).toBeNull()
})

it("rejects wrong metadata and retires captured form callbacks after unmount", async () => {
  const changed = jest.fn(),
    v = await setup({ value: 0, inputValue: "held", onInputChange: changed })
  const field = v.field(),
    metadata = v.metadata(field.descriptor.descriptorId)
  await act(() =>
    metadata.props.onNativeFormCommit({
      nativeEvent: { ...mountedPacket(field.descriptor), originalTarget: field.descriptor.target + 1 },
    }),
  )
  expect(field.mount()).toBeNull()
  await act(() => metadata.props.onNativeFormCommit({ nativeEvent: mountedPacket(field.descriptor) }))
  expect(field.mount()?.getSnapshot()?.active).toBe(true)
  await v.view.unmount()
  expect(field.editor()).toBeNull()
  expect(field.mount()).toBeNull()
  await act(() => field.reset("programmatic"))
  expect(changed).not.toHaveBeenCalled()
})

it("resets uncontrolled typed selection and query in order while retaining the separately controlled open owner", async () => {
  const changed = jest.fn(),
    query = jest.fn(),
    opened = jest.fn()
  const v = await setup({
    defaultValue: 0,
    defaultInputValue: "Zero",
    isOpen: true,
    onChange: changed,
    onInputChange: query,
    onOpenChange: opened,
  })
  await fireEvent.changeText(screen.getByTestId("combo-box-input"), "draft")
  for (const ready of [false, true])
    await act(() => {
      const props = screen.getByTestId("combo-box-floating-host").props
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "source-picker-window",
          epoch: 1,
          ready,
          windowActive: true,
          policyRevision: props.policyRevision,
        },
      })
    })
  const row = screen.getByRole("radio", { name: "String zero" })
  const event = {
    persist: jest.fn(),
    stopPropagation: jest.fn(),
    target: 17,
    currentTarget: 17,
    nativeEvent: {
      target: 17,
      timestamp: 1,
      identifier: 1,
      pageX: 1,
      pageY: 1,
      locationX: 1,
      locationY: 1,
      touches: [],
      changedTouches: [],
    },
  }
  await act(() => row.props.onResponderGrant(event))
  await act(() => row.props.onResponderRelease(event))
  expect(screen.getByRole("radio", { name: "String zero" })).toBeChecked()
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("String zero")
  changed.mockClear()
  query.mockClear()
  opened.mockClear()
  await act(() => v.field().reset("programmatic"))
  expect(query.mock.calls).toEqual([["Zero"]])
  expect(changed.mock.calls).toEqual([[0]])
  expect(query.mock.invocationCallOrder[0]).toBeLessThan(changed.mock.invocationCallOrder[0]!)
  expect(screen.getByRole("radio", { name: "Zero" })).toBeChecked()
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("Zero")
  expect(opened).not.toHaveBeenCalled()
})

it("exposes field status on the original closed trigger independently of accessibility hints", async () => {
  const view = await setup({ isRequired: true, isReadOnly: true, isInvalid: true, accessibilityHint: "Optional help" })
  expect(screen.getByTestId("combo-box-trigger").props.accessibilityLabel).toBe("Choose, Required, Read only, Invalid")
  expect(screen.getByTestId("combo-box-trigger").props.accessibilityHint).toBe("Optional help")
  expect(view.editor.current).toBeNull()
  await view.update({ isRequired: false, isReadOnly: false, isInvalid: false })
  expect(screen.getByTestId("combo-box-trigger").props.accessibilityLabel).toBe("Choose")
  expect(view.editor.current).toBeNull()
})
