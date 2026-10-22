import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { act, render } from "@testing-library/react-native"
import { Activity } from "react"
import type * as RN from "react-native"

import { FormValidationContext } from "../../components/ComboBox/state/useFormValidationState"
import type { TimeFieldStateOptions } from "../../date/state/useTimeFieldState"
import { useTimeFieldState } from "../../date/state/useTimeFieldState"
import { NativeFormRegistryContext } from "../context"
import type { TNativeDateSegmentFormTarget } from "../dateSegments"
import { NativeFormRegistry } from "../registry"
import { useNativeTimeFieldForm } from "../useTimeField"

jest.mock("../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
beforeEach(() => jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockReturnValue(100))
afterEach(() => jest.restoreAllMocks())

const originals = () => ({
  root: {} as RN.View,
  rootTarget: 4,
  segments: ["hour", "minute"].map(
    (segmentId, index): TNativeDateSegmentFormTarget => ({
      original: {} as RN.View,
      identity: {
        ownerId: "time-owner",
        segmentId,
        target: 6 + index,
        bindingRevision: "wire:1",
        nativeInstance: `native:${index}`,
        surfaceId: 11,
        windowId: "window:1",
        epoch: 5,
      },
    }),
  ),
})
const setup = async (initial: Partial<TimeFieldStateOptions> = {}, errors = {}) => {
  const registry = new NativeFormRegistry(),
    original = originals()
  let actual: ReturnType<typeof originals> | null = original
  let state!: ReturnType<typeof useTimeFieldState>
  const Field = (props: Partial<TimeFieldStateOptions>) => {
    const stateProps: TimeFieldStateOptions & { name: string } = { locale: "en-GB", ...props, name: "clock" }
    state = useTimeFieldState(stateProps)
    return useNativeTimeFieldForm(
      { name: "clock", form: "form-id" },
      state,
      original,
      () => actual,
      () => true,
    )
  }
  const content = (props: typeof initial, mode: "hidden" | "visible" = "visible") => (
    <NativeFormRegistryContext.Provider value={registry}>
      <FormValidationContext.Provider value={errors}>
        <Activity mode={mode}>
          <Field {...props} />
        </Activity>
      </FormValidationContext.Provider>
    </NativeFormRegistryContext.Provider>
  )
  const view = await render(content(initial))
  return {
    registry,
    view,
    original,
    state: () => state,
    field: () => [...registry.fields.values()][0],
    update: (props: typeof initial, mode?: "hidden" | "visible") => view.rerender(content(props, mode)),
    replace: (value: typeof actual) => {
      actual = value
    },
  }
}
it.each([
  new Time(13, 45),
  new CalendarDateTime(2024, 10, 1, 13, 45),
  parseZonedDateTime("2024-10-01T13:45[America/New_York]"),
])("registers one field and preserves source time-only serialization for %s", async (owner) => {
  const value = await setup({ value: owner })
  expect(value.registry.fields.size).toBe(1)
  expect(value.field().data.entries).toEqual([["clock", "13:45:00"]])
  expect(value.field().editor()).toBe(value.original.segments[0].original)
  expect(JSON.parse(value.field().descriptor.ownedEditorBinding!)).toMatchObject({
    rootTarget: 4,
    segments: value.original.segments.map((row) => row.identity),
  })
  await value.view.unmount()
  expect(value.registry.fields.size).toBe(0)
})
it("requests class-preserving controlled reset through the latest callback without changing the owner", async () => {
  const first = jest.fn(),
    latest = jest.fn()
  const initial = new CalendarDateTime(2024, 10, 1, 13, 45),
    held = new CalendarDateTime(2025, 2, 2, 18, 20)
  const props = { value: held, defaultValue: initial }
  const value = await setup({ ...props, onChange: first })
  const binding = value.field()
  await value.update({ ...props, onChange: latest })
  expect(value.field()).toBe(binding)
  await act(() => value.field().reset("programmatic"))
  expect(first).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledTimes(1)
  expect(latest.mock.calls[0][0]).toBeInstanceOf(CalendarDateTime)
  expect(latest.mock.calls[0][0].toString()).toBe(initial.toString())
  expect(value.state().timeValue.toString()).toBe("18:20:00")
  expect(value.field().editor()).toBe(value.original.segments[0].original)
})
it("retains programmatic server errors and clears them only for a native reset", async () => {
  const value = await setup({}, { clock: "Server says no" })
  await act(() => value.field().reset("programmatic"))
  expect(value.state().displayValidation.validationErrors).toEqual(["Server says no"])
  await act(() => value.field().reset("native"))
  expect(value.state().displayValidation.validationErrors).toEqual([])
})
it("commits readonly required validation without changing segment interaction or requesting an owner value", async () => {
  const changed = jest.fn(),
    value = await setup({ value: null, isReadOnly: true, isRequired: true, onChange: changed })
  expect(value.field().data.isReadOnly).toBe(false)
  await act(() => value.field().commitValidation())
  expect(value.state().displayValidation).toMatchObject({ isInvalid: true, validationDetails: { valueMissing: true } })
  expect(value.state().isReadOnly).toBe(true)
  expect(changed).not.toHaveBeenCalled()
})
it("retires physical authority when any original or its identity changes, including non-primary segments", async () => {
  const value = await setup({ value: new Time(13, 45) })
  const field = value.field()
  for (const actual of [
    { ...value.original, root: {} as RN.View },
    { ...value.original, segments: [value.original.segments[0]] },
    {
      ...value.original,
      segments: [value.original.segments[0], { ...value.original.segments[1], original: {} as RN.View }],
    },
    {
      ...value.original,
      segments: [
        value.original.segments[0],
        { ...value.original.segments[1], identity: { ...value.original.segments[1].identity, epoch: 6 } },
      ],
    },
  ]) {
    value.replace(actual)
    expect(field.editor()).toBeNull()
    expect(field.isFocusObserved()).toBe(false)
  }
})
it("disconnects reset listeners in retained hidden Activity content and rejects malformed mount packets", async () => {
  const changed = jest.fn(),
    props = { value: new Time(18, 20), defaultValue: new Time(13, 45), onChange: changed }
  const value = await setup(props)
  const host = value.view.container.queryAll((node) => typeof node.props.editorTarget === "number")[0]
  for (const packet of [undefined, null, [], {}])
    await act(() => host.props.onNativeFormCommit({ nativeEvent: packet }))
  expect(value.field().mount()?.getSnapshot() ?? null).toBeNull()
  await value.update(props, "hidden")
  expect(value.registry.fields.size).toBe(1)
  await act(() => value.field().reset("native"))
  expect(changed).not.toHaveBeenCalled()
  await value.update(props, "visible")
  await act(() => value.field().reset("native"))
  expect(changed).toHaveBeenCalledTimes(1)
})

it("clears native reset validation after an owner queues validation during the value request", async () => {
  const currentState: { value?: ReturnType<typeof useTimeFieldState> } = {}
  const value = await setup({
    value: new Time(18, 20),
    defaultValue: new Time(13, 45),
    validationBehavior: "native",
    validate: () => "Still invalid",
    onChange: () => currentState.value?.commitValidation(),
  })
  currentState.value = value.state()
  expect(currentState.value.displayValidation.isInvalid).toBe(false)
  await act(() => value.field().reset("native"))
  expect(value.state().displayValidation.isInvalid).toBe(false)
  expect(value.state().displayValidation.validationErrors).toEqual([])
})
