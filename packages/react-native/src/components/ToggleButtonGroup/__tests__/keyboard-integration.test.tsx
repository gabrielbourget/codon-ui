import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { TextInput, View } from "react-native"

import * as focus from "../../../input/focus"
import type { TNativeToolbarOriginalKeyEvent } from "../../../input/nativeToolbarKeyboard"
import type { TNativeToolbarDateKeyEvent } from "../../../input/ordinaryEditorKeys"
import { ToggleButton } from "../../ToggleButton/ToggleButton"
import { NativeToggleButtonGroupKeyboardScope } from "../NativeToggleButtonGroupKeyboardScope"
import { ToggleButtonGroup } from "../ToggleButtonGroup"

import { createToggleKeyboardFixture } from "./keyboard-fixture"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it.each([false, true])(
  "forwards capture listeners onto the same original default/custom root (%s), preserving controlled state and editor",
  async (custom) => {
    const f = createToggleKeyboardFixture(),
      root = createRef<View>(),
      editor = createRef<TextInput>(),
      request = jest.fn()
    const example = (selected: string[]) =>
      f.wrap(
        <ToggleButtonGroup
          ref={root}
          selectedKeys={selected}
          onSelectionChange={request}
          orientation="vertical"
          render={custom ? (props) => <View {...props} testID="original-root" /> : undefined}
        >
          <ToggleButton id="a" aria-label="Member" />
          <TextInput ref={editor} defaultValue="draft" />
        </ToggleButtonGroup>,
      )
    const result = await render(example([])),
      original = root.current,
      originalEditor = editor.current
    await f.acknowledge()
    const host = screen.getByTestId(custom ? "original-root" : "toggle-button-group")
    expect(original).not.toBeNull()
    expect(f.bindings()).toEqual([expect.objectContaining({ rootTarget: f.tag(original), orientation: "vertical" })])
    expect(host.props.onNativeOrdinaryEditorKeyCapture).toEqual(expect.any(Function))
    expect(host.props.onNativeDateKeyCapture).toEqual(expect.any(Function))
    await result.rerender(example(["a"]))
    expect(root.current).toBe(original)
    expect(editor.current).toBe(originalEditor)
    expect(screen.getByRole("radio").props.accessibilityState.checked).toBe(true)
    expect(request).not.toHaveBeenCalled()
  },
)

it("uses acknowledged physical nesting rather than React nesting and retires the old original root on replacement", async () => {
  const f = createToggleKeyboardFixture(),
    outer = createRef<View>(),
    inner = createRef<View>()
  const tree = (replace = false) =>
    f.wrap(
      <ToggleButtonGroup ref={outer} testID="outer" selectionMode="multiple">
        <ToggleButtonGroup
          ref={inner}
          selectionMode="multiple"
          testID="inner"
          render={replace ? (props) => <View {...props} key="replacement" /> : undefined}
        />
      </ToggleButtonGroup>,
    )
  const result = await render(tree())
  await f.acknowledge()
  expect(screen.getByTestId("inner").props.role).toBe("toolbar")
  await f.acknowledge(inner.current)
  expect(screen.getByTestId("inner").props.role).toBe("group")
  const retired = inner.current,
    oldBinding = f.bindings().find((item) => item.rootTarget === f.tag(retired))!
  await result.rerender(tree(true))
  expect(inner.current).not.toBe(retired)
  expect(f.bindings().some((item) => item.rootTarget === oldBinding.rootTarget)).toBe(false)
  await act(() =>
    f.toolbar.acceptStatus(
      JSON.stringify({
        ...oldBinding,
        ownerId: "toolbar",
        ...f.session,
        sequence: 999,
        ready: true,
        windowActive: true,
        nestedToolbar: true,
        error: "",
      }),
    ),
  )
  expect(screen.getByTestId("inner").props.role).toBe("toolbar")
  await f.acknowledge(inner.current)
  expect(screen.getByTestId("inner").props.role).toBe("group")
})

it.each(["down", "up"] as const)(
  "forwards original %s event through the headless container and target in capture/target/bubble order",
  async (phase) => {
    const f = createToggleKeyboardFixture(),
      root = createRef<View>(),
      ancestor = createRef<View>(),
      target = createRef<View>(),
      calls: unknown[][] = []
    const record = (name: string) => (event: unknown) => {
      const original = event as TNativeToolbarOriginalKeyEvent
      expect(original.target).toBe(target.current)
      expect(original.currentTarget).toBe(name === "target" ? target.current : ancestor.current)
      calls.push([name, event])
    }
    await render(
      f.wrap(
        <NativeToggleButtonGroupKeyboardScope
          containerRef={ancestor}
          onKeyDownCapture={record("capture")}
          onKeyUpCapture={record("capture")}
          onKeyDown={record("bubble")}
          onKeyUp={record("bubble")}
        >
          {(props) => (
            <View {...props} ref={ancestor} testID="ancestor">
              <ToggleButtonGroup ref={root}>
                <ToggleButton ref={target} onKeyDown={record("target")} onKeyUp={record("target")} />
              </ToggleButtonGroup>
            </View>
          )}
        </NativeToggleButtonGroupKeyboardScope>,
      ),
    )
    await f.acknowledge()
    const host = screen.getByTestId("ancestor"),
      member = screen.getByRole("button"),
      event = f.event(root.current, target.current, ancestor.current, { phase })
    expect(Object.keys(host.props).filter((key) => key.startsWith("onNative"))).toEqual(
      expect.arrayContaining([
        "onNativeOrdinaryEditorKeyCapture",
        "onNativeOrdinaryEditorKey",
        "onNativeDateKeyCapture",
        "onNativeDateKey",
      ]),
    )
    await act(() => host.props.onNativeOrdinaryEditorKeyCapture(event))
    expect(event.currentTarget).toBe(ancestor.current)
    event.currentTarget = target.current!
    await act(() => member.props.onNativeOrdinaryEditorKey(event))
    event.currentTarget = ancestor.current!
    await act(() => host.props.onNativeOrdinaryEditorKey(event))
    expect(calls.map(([name]) => name)).toEqual(["capture", "target", "bubble"])
    expect(calls.every(([, received]) => received === event)).toBe(true)
    expect(event.target).toBe(target.current)
    expect(event.preventDefault).not.toHaveBeenCalled()
  },
)

it("retains ancestor stopPropagation, committed callback replacement and rejects physical outsiders/stale epochs", async () => {
  const f = createToggleKeyboardFixture(),
    root = createRef<View>(),
    ancestor = createRef<View>(),
    target = createRef<TextInput>(),
    first = jest.fn(),
    second = jest.fn(),
    bubble = jest.fn()
  const tree = (stop: boolean) =>
    f.wrap(
      <NativeToggleButtonGroupKeyboardScope
        containerRef={ancestor}
        onKeyDownCapture={(event) => {
          ;(stop ? first : second)(event)
          if (stop) event.stopPropagation()
        }}
        onKeyDown={bubble}
      >
        {(props) => (
          <View {...props} ref={ancestor} testID="ancestor">
            <ToggleButtonGroup ref={root}>
              <TextInput ref={target} />
            </ToggleButtonGroup>
          </View>
        )}
      </NativeToggleButtonGroupKeyboardScope>,
    )
  const result = await render(tree(true))
  await f.acknowledge()
  const host = screen.getByTestId("ancestor"),
    event = f.event(root.current, target.current, ancestor.current)
  await act(() => {
    host.props.onNativeOrdinaryEditorKeyCapture(event)
    host.props.onNativeOrdinaryEditorKey(event)
  })
  expect(first).toHaveBeenCalledWith(event)
  expect(bubble).not.toHaveBeenCalled()
  await result.rerender(tree(false))
  const next = f.event(root.current, target.current, ancestor.current)
  await act(() => host.props.onNativeOrdinaryEditorKeyCapture(next))
  expect(second).toHaveBeenCalledWith(next)
  const outsider = f.event(root.current, target.current, ancestor.current)
  outsider.currentTarget = {} as View
  await act(() => host.props.onNativeOrdinaryEditorKeyCapture(outsider))
  f.session.epoch++
  const stale = f.event(root.current, target.current, ancestor.current)
  await act(() => host.props.onNativeOrdinaryEditorKeyCapture(stale))
  expect(second).toHaveBeenCalledTimes(1)
})

it.each([
  { key: "ArrowRight", disposition: "arrow" as const, prevent: true, shiftKey: false },
  { key: "Tab", disposition: "tab" as const, prevent: false, shiftKey: false },
  { key: "Tab", disposition: "tab" as const, prevent: false, shiftKey: true },
])("keeps $key shift=$shiftKey routing independent of selection and leaves Tab default intact", async (options) => {
  const f = createToggleKeyboardFixture(),
    root = createRef<View>(),
    target = createRef<View>(),
    request = jest.fn(),
    independent = jest.fn()
  await render(
    f.wrap(
      <ToggleButtonGroup ref={root} isDisabled selectedKeys={[]} onSelectionChange={request}>
        <ToggleButton ref={target} aria-label="Independent" onChange={independent} />
      </ToggleButtonGroup>,
    ),
  )
  await f.acknowledge()
  const event = f.event(root.current, target.current, root.current, options)
  await act(() => screen.getByTestId("toggle-button-group").props.onNativeOrdinaryEditorKeyCapture(event))
  expect(event.stopPropagation).toHaveBeenCalledTimes(1)
  expect(event.preventDefault).toHaveBeenCalledTimes(options.prevent ? 1 : 0)
  expect(event.nativeEvent.nativeDefaultHandled).toBe(false)
  const member = screen.getByRole("button")
  expect(member.props.accessibilityState.disabled).toBe(false)
  expect(independent).not.toHaveBeenCalled()
  expect(request).not.toHaveBeenCalled()
  await act(() =>
    member.props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        ownerId: member.props.ownerId,
        target: f.tag(target.current),
        source: "ios-accessibility-activate",
        observedAt: 0,
        activationId: 1,
        scopeOwnerId: "",
        windowId: "window",
        epoch: 0,
      },
    }),
  )
  expect(independent).toHaveBeenCalledWith(true)
  expect(request).not.toHaveBeenCalled()
})

it.each([false, true])(
  "leaves field-owned/composing arrows untouched on the actual ordinary/date capture listener (date=%s)",
  async (date) => {
    const f = createToggleKeyboardFixture(),
      root = createRef<View>(),
      target = createRef<TextInput>()
    await render(
      f.wrap(
        <ToggleButtonGroup ref={root}>
          <TextInput ref={target} />
        </ToggleButtonGroup>,
      ),
    )
    await f.acknowledge()
    const event = f.event(root.current, target.current, root.current, { key: "ArrowLeft", isComposing: true, date })
    await act(() =>
      screen
        .getByTestId("toggle-button-group")
        .props[date ? "onNativeDateKeyCapture" : "onNativeOrdinaryEditorKeyCapture"](event),
    )
    expect(event.persist).toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  },
)

it.each([undefined, false, true])(
  "maps preventFocusOnPress=%s only to original pointer focus, retaining selection request before activation",
  async (preventFocusOnPress) => {
    const root = createRef<View>(),
      calls: unknown[] = [],
      observed = jest.fn()
    const request = jest.spyOn(focus, "focusNativeTarget").mockImplementation((target) => {
      expect(target).toBe(root.current)
      calls.push("focus")
      return false
    })
    await render(
      <ToggleButton
        ref={root}
        isSelected={false}
        preventFocusOnPress={preventFocusOnPress}
        onPressStart={(event) => calls.push(event)}
        onChange={(value) => calls.push(value)}
        onPress={(event) => calls.push(event)}
        onFocus={observed}
      />,
    )
    const host = screen.getByRole("button"),
      original = root.current
    const touch = (timestamp: number) => ({
      persist: jest.fn(),
      target: 17,
      currentTarget: 17,
      nativeEvent: { target: 17, timestamp, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
    })
    const down = touch(0),
      up = touch(200)
    await act(() => host.props.onResponderGrant(down))
    await act(() => host.props.onResponderRelease(up))
    await act(() => jest.runOnlyPendingTimers())
    expect(request).toHaveBeenCalledTimes(preventFocusOnPress ? 0 : 1)
    expect(calls[0]).toBe(down)
    expect(calls.slice(preventFocusOnPress ? 1 : 2)[0]).toBe(true)
    expect(calls).toHaveLength(preventFocusOnPress ? 3 : 4)
    expect(observed).not.toHaveBeenCalled()
    expect(root.current).toBe(original)
    expect(host.props.accessibilityState.checked).toBe(false)
  },
)

it("preserves hardware and accessibility activation without requesting pointer focus", async () => {
  const request = jest.spyOn(focus, "focusNativeTarget").mockReturnValue(true),
    change = jest.fn()
  await render(<ToggleButton isSelected={false} onChange={change} />)
  const host = screen.getByRole("button")
  const key = (phase: "down" | "up") => ({
    persist: jest.fn(),
    preventDefault: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.props.ownerId,
      nativeCode: 40,
      key: "Enter",
      phase,
      nativeDefaultHandled: true,
    },
  })
  await act(() => host.props.onNativeKey(key("down")))
  await act(() => host.props.onNativeKey(key("up")))
  const activation = {
    nativeEvent: {
      kind: "activation",
      ownerId: host.props.ownerId,
      target: 17,
      source: "ios-accessibility-activate",
      observedAt: 0,
      activationId: 1,
      scopeOwnerId: "",
      windowId: "window",
      epoch: 0,
    },
  }
  await act(() => host.props.onNativeActivation(activation))
  expect(change.mock.calls).toEqual([[true], [true]])
  expect(request).not.toHaveBeenCalled()
})

it.each(["down", "up"] as const)(
  "forwards the original date %s event through both headless phases without converting its emitter",
  async (phase) => {
    const f = createToggleKeyboardFixture(),
      root = createRef<View>(),
      ancestor = createRef<View>(),
      field = createRef<TextInput>(),
      calls: unknown[][] = []
    const record = (name: string) => (event: unknown) => {
      const original = event as TNativeToolbarDateKeyEvent
      expect(original.target).toBe(field.current)
      expect(original.currentTarget).toBe(ancestor.current)
      calls.push([name, event])
    }
    await render(
      f.wrap(
        <NativeToggleButtonGroupKeyboardScope
          containerRef={ancestor}
          onKeyDownCapture={record("capture")}
          onKeyUpCapture={record("capture")}
          onKeyDown={record("bubble")}
          onKeyUp={record("bubble")}
        >
          {(props) => (
            <View {...props} ref={ancestor} testID="ancestor">
              <ToggleButtonGroup ref={root}>
                <TextInput ref={field} />
              </ToggleButtonGroup>
            </View>
          )}
        </NativeToggleButtonGroupKeyboardScope>,
      ),
    )
    await f.acknowledge()
    const event = f.event(root.current, field.current, ancestor.current, { date: true, phase }),
      host = screen.getByTestId("ancestor")
    await act(() => host.props.onNativeDateKeyCapture(event))
    await act(() => host.props.onNativeDateKey(event))
    expect(calls).toEqual([
      ["capture", event],
      ["bubble", event],
    ])
    expect(calls.every(([, received]) => received === event)).toBe(true)
    expect(event.nativeEvent.segmentId).toBe("day")
    expect(event.preventDefault).not.toHaveBeenCalled()
  },
)

it("retires forwarded listeners when their original containers unmount and releases original refs", async () => {
  const f = createToggleKeyboardFixture(),
    root = createRef<View>(),
    ancestor = createRef<View>(),
    field = createRef<TextInput>(),
    receive = jest.fn()
  const result = await render(
    f.wrap(
      <NativeToggleButtonGroupKeyboardScope containerRef={ancestor} onKeyDownCapture={receive}>
        {(props) => (
          <View {...props} ref={ancestor} testID="ancestor">
            <ToggleButtonGroup ref={root}>
              <TextInput ref={field} />
            </ToggleButtonGroup>
          </View>
        )}
      </NativeToggleButtonGroupKeyboardScope>,
    ),
  )
  await f.acknowledge()
  const listener = screen.getByTestId("ancestor").props.onNativeOrdinaryEditorKeyCapture
  const event = f.event(root.current, field.current, ancestor.current)
  await result.unmount()
  expect(root.current).toBeNull()
  expect(ancestor.current).toBeNull()
  expect(field.current).toBeNull()
  expect(f.bindings()).toEqual([])
  expect(f.ordinary.bindings()).toEqual([])
  await act(() => listener(event))
  expect(receive).not.toHaveBeenCalled()
  expect(event.persist).not.toHaveBeenCalled()
})

it("reports the exact same-window host dependency rather than rendering an inert group", async () => {
  await expect(render(<ToggleButtonGroup />)).rejects.toThrow("same-window NativeFloatingLayerHost")
})

it.each([false, true])(
  "preserves a noncomposing field-owned arrow without group interception (date=%s)",
  async (date) => {
    const f = createToggleKeyboardFixture(),
      root = createRef<View>(),
      field = createRef<TextInput>()
    await render(
      f.wrap(
        <ToggleButtonGroup ref={root}>
          <TextInput ref={field} />
        </ToggleButtonGroup>,
      ),
    )
    await f.acknowledge()
    const event = f.event(root.current, field.current, root.current, { key: "ArrowLeft", date })
    expect(event.nativeEvent.isComposing).toBe(false)
    await act(() =>
      screen
        .getByTestId("toggle-button-group")
        .props[date ? "onNativeDateKeyCapture" : "onNativeOrdinaryEditorKeyCapture"](event),
    )
    expect(event.persist).toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  },
)
