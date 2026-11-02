import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useState, type ReactElement } from "react"
import { AccessibilityInfo, TextInput, type View } from "react-native"

import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { createToggleKeyboardFixture } from "../../ToggleButtonGroup/__tests__/keyboard-fixture"
import { ToggleButtonGroup } from "../../ToggleButtonGroup/ToggleButtonGroup"
import { NativeToggleButtonContext } from "../context"
import { ToggleButton } from "../ToggleButton"
import type { TNativeToggleButtonProps } from "../types"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("passes resolved original root props and owned toggle state to its renderer after style and children without remounting editor or ref", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    layouts = jest.fn(),
    trace: string[] = [],
    states: unknown[] = []
  const Held = () => {
    const [draft, setDraft] = useState("initial")
    return <TextInput ref={editor} testID="held-editor" value={draft} onChangeText={setDraft} />
  }
  const node = (selected: boolean) => (
    <ToggleButton
      ref={root}
      isSelected={selected}
      onLayout={layouts}
      customStyles={{ padding: 3 }}
      style={({ defaultStyle }) => {
        trace.push("style")
        return { ...defaultStyle, padding: 5 }
      }}
      render={(props, state) => {
        trace.push("render")
        states.push(state)
        return <NativeFocusView {...props} testID="custom-toggle" />
      }}
    >
      {({ isSelected }) => {
        trace.push("children")
        expect(isSelected).toBe(selected)
        return <Held />
      }}
    </ToggleButton>
  )
  await render(node(false))
  const original = root.current,
    originalEditor = editor.current
  expect(original).not.toBeNull()
  expect(states.at(-1)).toMatchObject({ isSelected: false, state: { isSelected: false, defaultSelected: false } })
  expect(states.at(-1)).not.toHaveProperty("isPending")
  expect(states.at(-1)).not.toHaveProperty("isFocusVisible")
  expect(trace.slice(-3)).toEqual(["style", "children", "render"])
  expect(screen.getByTestId("custom-toggle")).toHaveStyle({ padding: 5 })
  await fireEvent.changeText(screen.getByTestId("held-editor"), "kept draft")
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 44, height: 44 } } }
  await act(() => screen.getByTestId("custom-toggle").props.onLayout(event))
  expect(layouts).toHaveBeenCalledWith(event)
  expect(layouts.mock.calls[0][0]).toBe(event)
  await screen.rerender(node(true))
  expect(root.current).toBe(original)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("held-editor")).toHaveDisplayValue("kept draft")
  expect(states.at(-1)).toMatchObject({ isSelected: true, state: { isSelected: true, defaultSelected: false } })
  await screen.unmount()
  expect(root.current).toBeNull()
  expect(editor.current).toBeNull()
})

it("receives default/named contextual renderers and preserves local render precedence, explicit false, slot null and original activation ordering", async () => {
  const root = createRef<View>(),
    inherited = createRef<View>(),
    calls: unknown[] = []
  const sourceRender: NonNullable<TNativeToggleButtonProps["render"]> = (props, state) => (
    <NativeFocusView {...props} testID={state.isSelected ? "context-selected" : "context-empty"} />
  )
  const tree = (slot?: string | null, ownRender?: TNativeToggleButtonProps["render"]): ReactElement => (
    <NativeToggleButtonContext.Provider
      value={{
        slots: {
          [NATIVE_DEFAULT_SLOT]: { defaultSelected: true, render: sourceRender, ref: inherited },
          named: { defaultSelected: true, render: sourceRender, ref: inherited },
        },
      }}
    >
      <ToggleButton
        ref={root}
        slot={slot}
        isSelected={false}
        onChange={(next) => calls.push(next)}
        onPress={(event) => calls.push(event)}
        render={ownRender}
      />
    </NativeToggleButtonContext.Provider>
  )
  await render(tree())
  const original = root.current
  expect(screen.getByTestId("context-empty")).toBeOnTheScreen()
  expect(inherited.current).toBe(original)
  await screen.rerender(tree("named", (props) => <NativeFocusView {...props} testID="local-render" />))
  expect(root.current).toBe(original)
  const member = screen.getByTestId("local-render"),
    event = {
      nativeEvent: {
        kind: "activation",
        ownerId: member.props.ownerId,
        target: 17,
        source: "ios-accessibility-activate",
        observedAt: 0,
        activationId: 1,
        scopeOwnerId: "",
        windowId: "window",
        epoch: 0,
      },
    }
  await act(() => member.props.onNativeActivation(event))
  expect(calls).toEqual([true, event])
  expect(calls[1]).toBe(event)
  await screen.rerender(tree(null))
  expect(inherited.current).toBeNull()
  expect(screen.getByTestId("toggle-button")).toBeOnTheScreen()
  expect(root.current).toBe(original)
})

it("matches canonical single-mode radio semantics and multiple-mode toolbar buttons while keeping typed keys and independent descendants", async () => {
  const keyboard = createToggleKeyboardFixture(),
    root = createRef<View>(),
    zero = createRef<View>(),
    request = jest.fn()
  const node = (multiple: boolean) =>
    keyboard.wrap(
      <ToggleButtonGroup
        ref={root}
        testID="group"
        selectionMode={multiple ? "multiple" : "single"}
        selectedKeys={[0]}
        onSelectionChange={request}
      >
        <ToggleButton ref={zero} id={0} aria-label="Numeric" />
        <ToggleButton id="0" aria-label="String" />
        <ToggleButton id="" aria-label="Empty" />
        <ToggleButton aria-label="Independent" />
      </ToggleButtonGroup>,
    )
  await render(node(false))
  const original = zero.current,
    group = root.current
  expect(screen.getByTestId("group").props.role).toBe("radiogroup")
  expect(screen.getAllByRole("radio")).toHaveLength(3)
  expect(screen.getByRole("radio", { name: "Numeric" }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByRole("radio", { name: "String" }).props.accessibilityState.checked).toBe(false)
  expect(screen.getByRole("button", { name: "Independent" })).toBeOnTheScreen()
  await screen.rerender(node(true))
  expect(root.current).toBe(group)
  expect(zero.current).toBe(original)
  expect(screen.getByTestId("group").props.role).toBe("toolbar")
  expect(screen.getAllByRole("button")).toHaveLength(4)
  expect(request).not.toHaveBeenCalled()
})
