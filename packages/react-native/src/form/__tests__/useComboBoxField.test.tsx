import { act, render } from "@testing-library/react-native"
import { Activity, useCallback, useRef, useState } from "react"
import * as RN from "react-native"

import { collection, type TItem } from "../../components/ComboBox/state/__tests__/collection"
import type { ComboBoxState, ComboBoxStateOptions } from "../../components/ComboBox/state/types"
import { useComboBoxState } from "../../components/ComboBox/state/useComboBoxState"
import { FormValidationContext } from "../../components/ComboBox/state/useFormValidationState"
import { NativeFormRegistryContext } from "../context"
import { NativeFormRegistry } from "../registry"
import { useNativeComboBoxField } from "../useComboBoxField"

jest.mock("../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))

beforeEach(() => {
  const targets = new WeakMap<object, number>()
  let sequence = 200
  jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockImplementation((view) => {
    if (!view || typeof view !== "object") return null
    if (!targets.has(view)) targets.set(view, ++sequence)
    return targets.get(view)!
  })
})
afterEach(() => jest.restoreAllMocks())

const setup = async (initial: Partial<ComboBoxStateOptions<TItem>> = {}, errors = {}) => {
  const registry = new NativeFormRegistry()
  const values = collection()
  let state!: ComboBoxState<TItem>
  let original: RN.TextInput | null = null
  const Field = (props: Partial<ComboBoxStateOptions<TItem>>) => {
    state = useComboBoxState({ ...props, collection: values })
    const input = useRef<RN.TextInput | null>(null)
    const [editor, setEditor] = useState<Readonly<{ editor: RN.TextInput; target: number }> | null>(null)
    const bind = useCallback((value: RN.TextInput | null) => {
      original = input.current = value
      if (value)
        setEditor((previous) =>
          previous?.editor === value
            ? previous
            : {
                editor: value,
                target: jest.requireActual<typeof RN>("react-native").findNodeHandle(value)!,
              },
        )
    }, [])
    const field = useNativeComboBoxField(
      { ...props, name: "entry" },
      state,
      editor,
      () => input.current,
      () => false,
    )
    return (
      <>
        <RN.TextInput ref={bind} value={state.inputValue} />
        {field.metadata}
      </>
    )
  }
  const content = (props: typeof initial, mode: "hidden" | "visible" = "visible") => (
    <NativeFormRegistryContext.Provider value={registry}>
      <FormValidationContext.Provider value={errors}>
        <Activity mode={mode}>
          <Field {...props} name="entry" />
        </Activity>
      </FormValidationContext.Provider>
    </NativeFormRegistryContext.Provider>
  )
  const view = await render(content(initial))
  return {
    registry,
    view,
    state: () => state,
    original: () => original,
    field: () => [...registry.fields.values()][0],
    update: (props: typeof initial, mode?: "hidden" | "visible") => view.rerender(content(props, mode)),
  }
}

it("matches the source query-before-key reset requests without changing controlled owners", async () => {
  const calls: unknown[] = []
  const callbacks = {
    onChange: (value: unknown) => calls.push(["key", value]),
    onInputChange: (value: string) => calls.push(["query", value]),
  }
  const value = await setup({ ...callbacks, value: 0, inputValue: "initial controlled query" })
  const original = value.original()
  await value.update({ ...callbacks, value: "b", inputValue: "held draft" })
  calls.length = 0
  await act(() => value.field().reset("programmatic"))
  expect(calls).toEqual([
    ["query", "Alpha"],
    ["key", 0],
  ])
  expect(value.state().value).toBe("b")
  expect(value.state().inputValue).toBe("held draft")
  expect(value.original()).toBe(original)
  expect(value.field().data.entries).toEqual([["entry", "b"]])
})

it("retains server errors for programmatic reset and clears them for native-origin reset", async () => {
  const value = await setup({}, { entry: "Server says no" })
  expect(value.state().displayValidation.validationErrors).toEqual(["Server says no"])
  await act(() => value.field().reset("programmatic"))
  expect(value.state().displayValidation.validationErrors).toEqual(["Server says no"])
  await act(() => value.field().reset("native"))
  expect(value.state().displayValidation.validationErrors).toEqual([])
})

it("keeps retained Activity membership while disconnecting reset listeners and physical editor authority", async () => {
  const changed = jest.fn()
  const props = { value: "b", defaultValue: 0, inputValue: "held", onChange: changed }
  const value = await setup(props)
  const original = value.original()
  await value.update(props, "hidden")
  expect(value.registry.fields.size).toBe(1)
  expect(value.field().editor()).toBeNull()
  await act(() => value.field().reset("native"))
  expect(changed).not.toHaveBeenCalled()
  await value.update(props, "visible")
  expect(value.original()).toBe(original)
  await act(() => value.field().reset("native"))
  expect(changed).toHaveBeenCalledWith(0)
  await value.view.unmount()
  expect(value.registry.fields.size).toBe(0)
})

it("uses callback-only owner updates without replacing the committed field or original editor", async () => {
  const first = jest.fn(),
    latest = jest.fn()
  const props = { value: "b", defaultValue: 0, inputValue: "held" }
  const value = await setup({ ...props, onChange: first })
  const field = value.field(),
    original = value.original(),
    revision = value.registry.getRevision()
  await value.update({ ...props, onChange: latest })
  expect(value.field()).toBe(field)
  expect(value.original()).toBe(original)
  expect(value.registry.getRevision()).toBe(revision)
  await act(() => field.reset("programmatic"))
  expect(first).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledWith(0)
})

it("ignores malformed original mount callbacks without granting editor authority", async () => {
  const value = await setup()
  const metadata = value.view.container.queryAll((node) => typeof node.props.editorTarget === "number")[0]
  for (const packet of [undefined, null, [], {}])
    await act(() => metadata.props.onNativeFormCommit({ nativeEvent: packet }))
  expect(value.field().mount()?.getSnapshot() ?? null).toBeNull()
})
