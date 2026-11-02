import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native"
import { Activity, createRef } from "react"
import * as RN from "react-native"
import { useSliderState } from "react-stately/useSliderState"

import { NativeSliderContext, Slider, type SliderProps, type TNativeSliderStyleState } from "../../.."
import { NativeFormRegistryContext } from "../../../form/context"
import { NativeFormController } from "../../../form/controller"
import { NativeForm } from "../../../form/NativeForm"
import { NativeFormRegistry } from "../../../form/registry"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import type { NativeFormCommitData } from "../../../input/specs/CUIFormRootNativeComponent"

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

let byID: Map<string, RN.View>
let tags: WeakMap<object, number>
beforeEach(() => {
  jest.clearAllMocks()
  byID = new Map()
  tags = new WeakMap()
  let sequence = 200
  jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockImplementation((view) => {
    if (!view || typeof view !== "object") return null
    if (!tags.has(view)) tags.set(view, ++sequence)
    const id = (view as { props?: { testID?: string } }).props?.testID
    if (id) byID.set(id, view as RN.View)
    return tags.get(view)!
  })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

const setup = async (
  initial: SliderProps = { label: "Range" },
  forms = false,
  callbacks: { onSubmit?: jest.Mock; onReset?: jest.Mock } = {},
  context?: Partial<SliderProps>,
) => {
  const registry = new NativeFormRegistry(),
    ref = createRef<RN.View>()
  let state!: TNativeSliderStyleState
  const node = (props: SliderProps, mode: "visible" | "hidden" = "visible", key = "root") => {
    const control = (
      <Activity mode={mode}>
        <Slider
          {...props}
          ref={ref}
          style={(current) => {
            state = current
            return {}
          }}
          render={(props) => <RN.View {...props} key={key} />}
        />
      </Activity>
    )
    const content = (
      <NativeFormRegistryContext.Provider value={registry}>
        {forms ? (
          <>
            <NativeForm id="contained" testID="contained-form" {...callbacks}>
              {control}
            </NativeForm>
            <NativeForm id="other" testID="other-form" />
            <Slider testID="outside-slider" label="Outside" value={[33]} thumbNames={["outside"]} />
          </>
        ) : (
          control
        )}
      </NativeFormRegistryContext.Provider>
    )
    return context ? <NativeSliderContext.Provider value={context}>{content}</NativeSliderContext.Provider> : content
  }
  const view = await render(node(initial))
  const field = (index = 0) => {
    const original = byID.get(`slider-thumb-${index + 1}-target`)!
    return [...registry.fields.values()].find((field) => field.descriptor.target === tags.get(original))!
  }
  const metadata = (index = 0) =>
    view.container.queryAll(
      (node) =>
        node.props.descriptorId === field(index).descriptor.descriptorId &&
        typeof node.props.onNativeFormCommit === "function",
    )[0]
  return {
    registry,
    ref,
    view,
    field,
    metadata,
    state: () => state,
    update: (props: SliderProps, mode?: "visible" | "hidden", key?: string) => view.rerender(node(props, mode, key)),
  }
}

it("registers every actual thumb under the actual root with numeric names and no editor semantics", async () => {
  const value = [0, 12.5, 100]
  const result = await setup({
    label: "Range",
    value,
    step: 0.5,
    thumbNames: ["value", "value", ""],
    locale: "de-DE",
    customOutputFormatter: () => "not submitted",
  })
  expect(result.registry.fields.size).toBe(3)
  expect(result.ref.current).not.toBeNull()
  for (let i = 0; i < 3; i++) {
    const field = result.field(i),
      metadata = result.metadata(i)
    expect(field.editor()).toBe(byID.get(`slider-thumb-${i + 1}-target`))
    expect(field.descriptor.ownedControlBinding).toBe(
      JSON.stringify({ kind: "range-thumb", rootTarget: tags.get(result.ref.current!) }),
    )
    expect(field.descriptor).toMatchObject({ hasFormAssociation: false, formId: "" })
    expect(metadata.props.ownedControlBinding).toBe(field.descriptor.ownedControlBinding)
    expect(metadata.props.ownedEditorBinding).toBeUndefined()
    expect(metadata.props.semanticBinding).toBeUndefined()
    expect(metadata.props.accessible).toBe(false)
    expect(metadata.props.pointerEvents).toBe("none")
    expect(field.data).toMatchObject({
      isDisabled: false,
      isReadOnly: false,
      validationBehavior: "native",
      validation: { isInvalid: false },
    })
    expect(field.mount()).toBeNull()
  }
  expect(result.field(0).data.entries).toEqual([["value", "0"]])
  expect(result.field(1).data.entries).toEqual([["value", "12.5"]])
  expect(result.field(2).data.entries).toEqual([])
  expect(value).toEqual([0, 12.5, 100])
  expect(screen.getByTestId("slider").props.collapsable).toBe(false)
  expect(screen.getByTestId("slider").props.thumbNames).toBeUndefined()
})

it("keeps unnamed/short-name members registered and ignores surplus names", async () => {
  const result = await setup({ label: "Range", value: [0, 20], thumbNames: ["first"] })
  expect(result.registry.fields.size).toBe(2)
  expect(result.field(1).data.entries).toEqual([])
  await result.update({ label: "Range", value: [0, 20], thumbNames: ["first", "second", "extra"] })
  expect(result.registry.fields.size).toBe(2)
  expect(result.field(1).data.entries).toEqual([["second", "20"]])
})

it("describes root and per-thumb disabled omission without inventing range validation", async () => {
  const result = await setup({ label: "Range", value: [0, 20], thumbNames: ["a", "b"] })
  await act(() => result.state().state.setThumbEditable(1, false))
  expect(result.field(0).data.isDisabled).toBe(false)
  expect(result.field(1).data.isDisabled).toBe(true)
  expect(result.field(0).data.validation.isInvalid).toBe(false)
  await result.update({ label: "Range", value: [0, 20], thumbNames: ["a", "b"], isDisabled: true })
  expect(result.field(0).data.isDisabled).toBe(true)
  expect(result.field(1).data.isDisabled).toBe(true)
})

it("resets each uncontrolled thumb through current guarded defaults with numeric requests and no gesture end", async () => {
  const onChange = jest.fn(),
    onChangeEnd = jest.fn()
  const props = { label: "Range", defaultValue: [10, 80], onChange, onChangeEnd }
  const result = await setup(props)
  await act(() => {
    result.state().state.setThumbValue(0, 20)
    result.state().state.setThumbValue(1, 70)
  })
  onChange.mockClear()
  await act(() => {
    result.field(0).reset("native")
    result.field(1).reset("native")
  })
  expect(onChange.mock.calls).toEqual([[[10, 70]], [[10, 80]]])
  expect(result.state().state.values).toEqual([10, 80])
  expect(onChangeEnd).not.toHaveBeenCalled()
  await result.update({ ...props, defaultValue: [30, 60] })
  await act(() => {
    result.field(0).reset("programmatic")
    result.field(1).reset("programmatic")
  })
  expect(result.state().state.values).toEqual([30, 60])
  expect(onChangeEnd).not.toHaveBeenCalled()
})

it.each([0, 10])(
  "keeps controlled scalar owner authority on reset to %s without fabricating end",
  async (defaultValue) => {
    const onChange = jest.fn(),
      onChangeEnd = jest.fn()
    const result = await setup({
      label: "Quantity",
      value: 50,
      defaultValue,
      onChange,
      onChangeEnd,
      thumbNames: ["quantity"],
    })
    await act(() => result.field().reset("native"))
    expect(onChange).toHaveBeenCalledWith(defaultValue)
    expect(result.state().state.values).toEqual([50])
    expect(result.field().data.entries).toEqual([["quantity", "50"]])
    expect(onChangeEnd).not.toHaveBeenCalled()
  },
)

it("keeps per-thumb controlled range resets separate and honors each current neighboring bound", async () => {
  const onChange = jest.fn()
  const result = await setup({ label: "Range", value: [40, 60], defaultValue: [10, 90], onChange })
  await act(() => {
    result.field(0).reset("native")
    result.field(1).reset("native")
  })
  expect(onChange.mock.calls).toEqual([[[10, 60]], [[40, 90]]])
  expect(result.state().state.values).toEqual([40, 60])
})

it("uses the latest callbacks without replacing a field, and retires old registrations on name/default changes", async () => {
  const first = jest.fn(),
    latest = jest.fn()
  const props = { label: "Range", value: [50], defaultValue: [10], thumbNames: ["first"] }
  const result = await setup({ ...props, onChange: first })
  const field = result.field(),
    original = field.editor(),
    revision = result.registry.getRevision()
  await result.update({ ...props, onChange: latest })
  expect(result.field()).toBe(field)
  expect(result.field().editor()).toBe(original)
  expect(result.registry.getRevision()).toBe(revision)
  await act(() => field.reset("programmatic"))
  expect(first).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledWith([10])
  latest.mockClear()
  await result.update({ ...props, defaultValue: [20], thumbNames: ["next"], onChange: latest })
  await act(() => field.reset("native"))
  expect(latest).not.toHaveBeenCalled()
  expect(field.editor()).toBeNull()
  await act(() => result.field().reset("native"))
  expect(latest).toHaveBeenCalledWith([20])
})

it("admits only current original metadata acknowledgments and retires their receipt on actual root replacement", async () => {
  const onChange = jest.fn()
  const props = { label: "Range", value: [50], defaultValue: [10], onChange }
  const result = await setup(props)
  const field = result.field(),
    notify = result.metadata().props.onNativeFormCommit
  const packet: NativeFormCommitData = {
    ...field.descriptor,
    target: field.descriptor.metadataTarget,
    originalTarget: field.descriptor.target,
    surfaceId: 1,
    windowId: "source-window",
    epoch: 1,
    sequence: 1,
    mountRevision: "source-mount",
    attached: true,
    active: true,
    complete: true,
    metadataOnly: true,
    originalClass: "CUIFocusView",
    error: "",
  }
  for (const data of [null, undefined, {}, { ...packet, originalTarget: packet.originalTarget + 1 }])
    await act(() => notify({ nativeEvent: data }))
  expect(field.mount()).toBeNull()
  await act(() => notify({ nativeEvent: packet }))
  const receipt = field.mount()!
  expect(receipt.getSnapshot()).toMatchObject({ originalTarget: field.descriptor.target, windowId: "source-window" })
  await result.update(props, "visible", "replacement")
  expect(result.field().editor()).not.toBe(field.editor())
  expect(receipt.getSnapshot()).toBeNull()
  await act(() => {
    notify({ nativeEvent: { ...packet, sequence: 2 } })
    field.reset("native")
  })
  expect(onChange).not.toHaveBeenCalled()
  expect(result.field().mount()).toBeNull()
})

it("retains logical hidden membership but rejects old reset authority, then retires removed/unmounted thumbs", async () => {
  const onChange = jest.fn()
  const props = { label: "Range", value: [40, 60], defaultValue: [10, 90], onChange }
  const result = await setup(props)
  const first = result.field(0),
    second = result.field(1)
  await result.update(props, "hidden")
  expect(result.registry.fields.size).toBe(2)
  expect(first.editor()).toBeNull()
  await act(() => {
    first.reset("native")
    second.reset("native")
  })
  expect(onChange).not.toHaveBeenCalled()
  await result.update({ ...props, value: [40], defaultValue: [10] })
  expect(result.registry.fields.size).toBe(1)
  await act(() => second.reset("native"))
  expect(onChange).not.toHaveBeenCalled()
  await result.view.unmount()
  expect(result.registry.fields.size).toBe(0)
  await act(() => first.reset("native"))
  expect(onChange).not.toHaveBeenCalled()
})

it("requests label focus on the same admitted original custom thumb host without inventing an observed focus", async () => {
  const result = await setup({ label: "Range", value: [10] })
  expect(result.field().isFocusObserved()).toBe(false)
  await fireEvent.press(screen.getByTestId("slider-label"))
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(
    result.field().editor(),
    screen.getByTestId("slider-thumb-1-target").props.ownerId,
  )
  expect(result.field().isFocusObserved()).toBe(false)
})

it.each([
  { value: 0, defaultValue: 10, names: ["quantity"], entries: [["quantity", "0"]], resets: [10] },
  {
    value: [20, 70],
    defaultValue: [10, 80],
    names: ["same", "same"],
    entries: [
      ["same", "20"],
      ["same", "70"],
    ],
    resets: [
      [10, 70],
      [20, 80],
    ],
    reverse: false,
  },
  {
    value: [20, 70],
    defaultValue: [10, 80],
    names: ["same", "same"],
    entries: [
      ["same", "70"],
      ["same", "20"],
    ],
    resets: [
      [20, 80],
      [10, 70],
    ],
    reverse: true,
  },
  {
    value: [20, 40, 70],
    defaultValue: [10, 60],
    names: ["same", "same", "same"],
    entries: [
      ["same", "70"],
      ["same", "40"],
      ["same", "20"],
    ],
    resets: [
      [20, 60, 70],
      [10, 40, 70],
    ],
    reverse: true,
  },
])(
  "submits and resets actual containing-form members for $value without adopting outside controls or matching root IDs",
  async ({ value, defaultValue, names, entries, resets, reverse }) => {
    const onSubmit = jest.fn(),
      onReset = jest.fn(),
      onChange = jest.fn(),
      onChangeEnd = jest.fn()
    const result = await setup(
      { label: "Quantity", value, defaultValue, thumbNames: names, nativeID: "other", onChange, onChangeEnd },
      true,
      { onSubmit, onReset },
    )
    const inside = [...result.state().state.values].map((_, index) => result.field(index))
    const outsideTarget = tags.get(byID.get("outside-slider-thumb-1-target")!)
    const outside = [...result.registry.fields.values()].find((field) => field.descriptor.target === outsideTarget)!
    const forms = [...result.registry.forms.values()]
    const form = forms.find((binding) => binding.descriptor.formId === "contained")!
    const other = forms.find((binding) => binding.descriptor.formId === "other")!
    expect(form.original).toBe(byID.get("contained-form"))
    const all = [...inside, outside]
    for (const field of all) {
      const metadata = result.view.container.queryAll(
        (node) =>
          node.props.descriptorId === field.descriptor.descriptorId &&
          typeof node.props.onNativeFormCommit === "function",
      )[0]
      await act(() =>
        metadata.props.onNativeFormCommit({
          nativeEvent: {
            ...field.descriptor,
            target: field.descriptor.metadataTarget,
            originalTarget: field.descriptor.target,
            surfaceId: 1,
            windowId: "source-window",
            epoch: 1,
            sequence: 1,
            mountRevision: "source-mount",
            attached: true,
            active: true,
            complete: true,
            metadataOnly: true,
            originalClass: "CUIFocusView",
            error: "",
          },
        }),
      )
    }
    const read = jest.fn(async (request: { target: number; requestId: string }) => {
      const nodes: {
        target: number
        parent: number
        component: string
        hidden: boolean
        displayNone: boolean
        rangeThumb?: boolean
      }[] = []
      const append = (target: number, parent: number, component: string, rangeThumb?: boolean) => {
        nodes.push({
          target,
          parent,
          component,
          hidden: false,
          displayNone: false,
          ...(rangeThumb ? { rangeThumb } : {}),
        })
        return nodes.length - 1
      }
      const fields: object[] = [],
        descriptors: object[] = []
      append(100000, 0, "View")
      const group = (members: typeof inside, parent: number) => {
        if (!members.length) return
        const root = (JSON.parse(members[0].descriptor.ownedControlBinding!) as { rootTarget: number }).rootTarget
        append(root, parent, "View")
        for (const member of members) {
          append(member.descriptor.target, root, "CUIFocusView", true)
          const position = append(member.descriptor.metadataTarget, member.descriptor.target, "CUIFieldBinding")
          fields.push({ ...member.descriptor, position })
        }
      }
      for (const binding of [form, other]) {
        append(binding.descriptor.target, 100000, "View")
        const position = append(binding.descriptor.metadataTarget, binding.descriptor.target, "CUIFormRoot")
        descriptors.push({ ...binding.descriptor, position })
        if (binding === form) group(reverse ? [...inside].reverse() : inside, binding.descriptor.target)
      }
      group([outside], 100000)
      return JSON.stringify({
        ...request,
        documentId: "source-native-document",
        surfaceId: 1,
        rootTarget: 100000,
        revision: "1",
        nodes,
        forms: descriptors,
        fields,
      })
    })
    const focus = jest.fn()
    const controller = new NativeFormController(result.registry, read, focus)
    let status = ""
    await act(async () => {
      status = (await controller.request("submit", { origin: "programmatic", form: form.original })).status
    })
    expect(status).toBe("submitted")
    expect(onSubmit.mock.calls[0][0].entries).toEqual(entries)
    expect(onSubmit.mock.calls[0][0].form).toBe(form.original)
    await act(async () => {
      const otherResult = await controller.request("submit", { origin: "programmatic", form: other.original })
      expect(otherResult.request?.entries).toEqual([])
    })
    await act(async () => {
      status = (await controller.request("reset", { origin: "programmatic", form: form.original })).status
    })
    expect(status).toBe("reset")
    expect(onReset.mock.calls[0][0].entries).toEqual(entries)
    expect(onChange.mock.calls.map(([next]) => next)).toEqual(resets)
    expect(onChangeEnd).not.toHaveBeenCalled()
    expect(result.state().state.values).toEqual(typeof value === "number" ? [value] : value)
    expect(focus).not.toHaveBeenCalled()
  },
)

it("documents the pinned grown-thumb missing reset baseline while preserving native finite-value guards", async () => {
  const upstreamChange = jest.fn()
  const upstream = await renderHook(
    ({ value }: { value: number[] }) =>
      useSliderState({
        value,
        minValue: 0,
        maxValue: 100,
        numberFormatter: new Intl.NumberFormat("en-US"),
        onChange: upstreamChange,
      }),
    { initialProps: { value: [10] } },
  )
  await upstream.rerender({ value: [10, 20] })
  expect(upstream.result.current.defaultValues).toEqual([10])
  await act(() => {
    upstream.result.current.setThumbEditable(1, true)
    upstream.result.current.setThumbValue(1, upstream.result.current.defaultValues[1]!)
  })
  expect(upstreamChange.mock.calls[0][0][0]).toBe(10)
  expect(upstreamChange.mock.calls[0][0][1]).toBeNaN()
  const changed = jest.fn()
  const result = await setup({ label: "Range", value: [10], onChange: changed })
  await result.update({ label: "Range", value: [10, 20], onChange: changed })
  expect(result.state().state.defaultValues).toEqual([10])
  expect(() => result.state().state.setThumbValue(1, undefined as never)).toThrow(
    "Slider: requested values must be finite",
  )
  expect(changed).not.toHaveBeenCalled()
  expect(result.state().state.values).toEqual([10, 20])
})

it("restores enabled form data and reset authority after retained Activity visibility returns", async () => {
  const onChange = jest.fn()
  const props = { label: "Range", value: [50], defaultValue: [10], thumbNames: ["value"], onChange }
  const result = await setup(props)
  await result.update(props, "hidden")
  await result.update(props, "visible")
  expect(result.state().state.isThumbEditable(0)).toBe(true)
  expect(result.field().data.isDisabled).toBe(false)
  expect(screen.getByTestId("slider-thumb-1-target").props.focusable).toBe(true)
  await act(() => result.field().reset("native"))
  expect(onChange).toHaveBeenCalledWith([10])
})

it("registers a contextual scalar's numeric form value and preserves scalar reset requests for both callback owners", async () => {
  const inherited = jest.fn(),
    own = jest.fn()
  const result = await setup(
    { label: "Quantity", thumbNames: ["quantity"], onChange: own },
    false,
    {},
    { value: 50, defaultValue: 10, onChange: inherited },
  )
  expect(result.field().data.entries).toEqual([["quantity", "50"]])
  await act(() => result.field().reset("native"))
  expect(inherited.mock.calls).toEqual([[10]])
  expect(own.mock.calls).toEqual([[10]])
  expect(result.state().state.values).toEqual([50])
  expect(result.field().data.entries).toEqual([["quantity", "50"]])
})

it("skips a grown thumb's missing reset baseline while preserving the current finite owner value and later explicit defaults", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const props = { label: "Range", value: [10], onChange: changed, onChangeEnd: ended }
  const result = await setup(props)
  const original = result.ref.current
  const value = [40, 60]
  await result.update({ ...props, value })
  expect(result.state().state.defaultValues).toEqual([10])
  await act(() => {
    result.field(1).reset("native")
    result.field(0).reset("native")
  })
  expect(changed.mock.calls).toEqual([[[10, 60]]])
  expect(result.state().state.values).toEqual(value)
  expect(value).toEqual([40, 60])
  expect(result.ref.current).toBe(original)
  expect(ended).not.toHaveBeenCalled()
  await result.update({ ...props, value: [10, 60] })
  changed.mockClear()
  await act(() => result.field(1).reset("programmatic"))
  expect(changed).not.toHaveBeenCalled()
  expect(result.state().state.values).toEqual([10, 60])
  await result.update({ ...props, value: [10, 60], defaultValue: [10, 30] })
  await act(() => result.field(1).reset("native"))
  expect(changed.mock.calls).toEqual([[[10, 30]]])
  expect(result.state().state.values).toEqual([10, 60])
  expect(ended).not.toHaveBeenCalled()
})

it("skips short reset defaults without aborting remaining uncontrolled resets or fabricating an end callback", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const props = { label: "Range", defaultValue: [10, 40, 80], onChange: changed, onChangeEnd: ended }
  const result = await setup(props)
  await act(() => {
    result.state().state.setThumbValue(0, 20)
    result.state().state.setThumbValue(1, 50)
    result.state().state.setThumbValue(2, 90)
  })
  await result.update({ ...props, defaultValue: [5] })
  changed.mockClear()
  await act(() => {
    result.field(2).reset("programmatic")
    result.field(1).reset("programmatic")
    result.field(0).reset("programmatic")
  })
  expect(changed.mock.calls).toEqual([[[5, 50, 90]]])
  expect(result.state().state.values).toEqual([5, 50, 90])
  expect(ended).not.toHaveBeenCalled()
})
