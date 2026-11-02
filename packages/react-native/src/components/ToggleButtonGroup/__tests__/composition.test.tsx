import { act, fireEvent, screen, userEvent } from "@testing-library/react-native"
import { createRef, useContext, useState } from "react"
import { TextInput, View, type ViewProps } from "react-native"

import { NativeSelectionIndicatorContext } from "../../../collection/context"
import { NativeThemeProvider } from "../../../theme"
import { NativeButtonContext } from "../../Button/context"
import { NativeToggleButtonContext } from "../../ToggleButton/context"
import { ToggleButton } from "../../ToggleButton/ToggleButton"
import { NativeToggleButtonGroupContext } from "../context"
import { ToggleButtonGroup } from "../ToggleButtonGroup"

import { renderWithToggleKeyboard as render } from "./keyboard-fixture"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const press = (name: string) => userEvent.setup().press(screen.getByRole("button", { name }))

it("uses group membership instead of a keyed member's own selected/default/change props", async () => {
  const memberChange = jest.fn(),
    groupChange = jest.fn()
  await render(
    <ToggleButtonGroup defaultSelectedKeys={[0]} onSelectionChange={groupChange}>
      <ToggleButton id={0} aria-label="Numeric" isSelected={false} defaultSelected={false} onChange={memberChange}>
        {({ state }) => `Default: ${state.defaultSelected}`}
      </ToggleButton>
      <ToggleButton id="0" aria-label="String" isSelected defaultSelected onChange={memberChange} />
      <ToggleButton id="" aria-label="Empty" />
    </ToggleButtonGroup>,
  )
  expect(screen.getByRole("button", { name: "Numeric" }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByText("Default: true")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "String" }).props.accessibilityState.checked).toBe(false)
  await press("String")
  await press("Empty")
  expect(groupChange.mock.calls.map(([keys]) => [...keys])).toEqual([["0"], [""]])
  expect(memberChange).not.toHaveBeenCalled()
})

it("requests group selection before the member observes the same original activation", async () => {
  const calls: unknown[] = []
  await render(
    <ToggleButtonGroup onSelectionChange={(keys) => calls.push([...keys])}>
      <ToggleButton id={0} aria-label="Member" onPress={(original) => calls.push(original)} />
    </ToggleButtonGroup>,
  )
  const button = screen.getByRole("button", { name: "Member" })
  const event = {
    persist: jest.fn(),
    nativeEvent: {
      kind: "activation",
      ownerId: button.props.ownerId,
      target: 17,
      source: "android-click",
      observedAt: 10,
      activationId: 1,
      scopeOwnerId: "",
      windowId: "group-window",
      epoch: 0,
    },
  }
  await act(() => button.props.onNativeActivation(event))
  expect(calls).toEqual([[0], event])
  expect(calls[1]).toBe(event)
})

it("retains repeated owner veto, accepts an echo and preserves original members and editor drafts", async () => {
  const request = jest.fn(),
    root = createRef<View>()
  const Draft = () => {
    const [draft, setDraft] = useState("original")
    return <TextInput testID="independent-editor" value={draft} onChangeText={setDraft} />
  }
  const Example = ({ selected }: { selected: readonly (string | number)[] }) => (
    <ToggleButtonGroup ref={root} selectedKeys={selected} onSelectionChange={request}>
      <ToggleButton id={0} aria-label="Member" />
      <Draft />
    </ToggleButtonGroup>
  )
  const { rerender } = await render(<Example selected={[]} />)
  const originalRoot = root.current,
    member = screen.getByRole("button", { name: "Member" }),
    editor = screen.getByTestId("independent-editor")
  expect(originalRoot).not.toBeNull()
  await fireEvent.changeText(editor, "kept draft")
  await press("Member")
  await press("Member")
  expect(request.mock.calls.map(([keys]) => [...keys])).toEqual([[0], [0]])
  expect(member.props.accessibilityState.checked).toBe(false)
  await rerender(<Example selected={[0]} />)
  expect(screen.getByRole("button", { name: "Member" })).toBe(member)
  expect(root.current).toBe(originalRoot)
  expect(member.props.accessibilityState.checked).toBe(true)
  expect(screen.getByTestId("independent-editor")).toBe(editor)
  expect(editor).toHaveDisplayValue("kept draft")
  expect(request).toHaveBeenCalledTimes(2)
})

it("combines member/group user guards without disabling unrelated original controls", async () => {
  const request = jest.fn()
  await render(
    <ToggleButtonGroup isDisabled onSelectionChange={request}>
      <ToggleButton id={0} aria-label="Guarded" isDisabled={false} />
      <ToggleButton aria-label="Independent toggle" />
      <TextInput testID="editor" />
    </ToggleButtonGroup>,
  )
  await press("Guarded")
  expect(request).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Guarded" })).toBeDisabled()
  await press("Independent toggle")
  expect(screen.getByRole("button", { name: "Independent toggle" }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByTestId("editor").props.editable).not.toBe(false)
})

it("isolates nested selection owners and leaves members without ids standalone", async () => {
  const outer = jest.fn(),
    inner = jest.fn()
  await render(
    <ToggleButtonGroup onSelectionChange={outer}>
      <ToggleButton id="same" aria-label="Outer" />
      <ToggleButtonGroup onSelectionChange={inner}>
        <ToggleButton id="same" aria-label="Inner" />
      </ToggleButtonGroup>
      <ToggleButton aria-label="Standalone" />
    </ToggleButtonGroup>,
  )
  await press("Inner")
  await press("Standalone")
  expect(inner.mock.calls.map(([keys]) => [...keys])).toEqual([["same"]])
  expect(outer).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Outer" }).props.accessibilityState.checked).toBe(false)
  expect(screen.getByRole("button", { name: "Standalone" }).props.accessibilityState.checked).toBe(true)
})

it("keeps standalone id aliases separate from grouped selection keys and explicit native identity", async () => {
  await render(
    <>
      <ToggleButton id={0} aria-label="Standalone" />
      <ToggleButton id={0} nativeID="explicit" aria-label="Explicit standalone" />
      <ToggleButtonGroup>
        <ToggleButton id={0} aria-label="Grouped" />
        <ToggleButton id="key" nativeID="group-original" aria-label="Explicit grouped" />
      </ToggleButtonGroup>
    </>,
  )
  expect(screen.getByRole("button", { name: "Standalone" }).props.nativeID).toBe("0")
  expect(screen.getByRole("button", { name: "Explicit standalone" }).props.nativeID).toBe("explicit")
  expect(screen.getByRole("button", { name: "Grouped" }).props.nativeID).toBeUndefined()
  expect(screen.getByRole("button", { name: "Explicit grouped" }).props.nativeID).toBe("group-original")
})

it("merges toggle slots and original refs while retaining foreign Button context isolation", async () => {
  const inherited = createRef<View>(),
    own = createRef<View>(),
    foreign = jest.fn()
  const { unmount } = await render(
    <NativeButtonContext.Provider value={{ isPending: true, onPress: foreign }}>
      <NativeToggleButtonContext.Provider value={{ slots: { member: { ref: inherited, defaultSelected: true } } }}>
        <ToggleButton slot="member" ref={own} aria-label="Slotted" />
        <ToggleButton slot={null} aria-label="Unslotted" />
      </NativeToggleButtonContext.Provider>
    </NativeButtonContext.Provider>,
  )
  expect(inherited.current).not.toBeNull()
  expect(inherited.current).toBe(own.current)
  expect(screen.getByRole("button", { name: "Slotted" }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByRole("button", { name: "Unslotted" }).props.accessibilityState.checked).toBe(false)
  await press("Slotted")
  expect(foreign).not.toHaveBeenCalled()
  await unmount()
  expect(inherited.current).toBeNull()
  expect(own.current).toBeNull()
})

it("publishes nearest selected membership through the existing boolean indicator context", async () => {
  const Probe = ({ name }: { name: string }) => {
    const selected = useContext(NativeSelectionIndicatorContext).isSelected
    return <View testID={name} accessibilityLabel={String(selected)} />
  }
  await render(
    <ToggleButtonGroup selectionMode="multiple" defaultSelectedKeys={[0, "0"]}>
      <ToggleButton id={0} aria-label="First">
        <Probe name="first" />
      </ToggleButton>
      <ToggleButton id="0" aria-label="Second">
        <Probe name="second" />
      </ToggleButton>
      <ToggleButton id="" aria-label="Third">
        <Probe name="third" />
      </ToggleButton>
    </ToggleButtonGroup>,
  )
  expect(screen.getByTestId("first").props.accessibilityLabel).toBe("true")
  expect(screen.getByTestId("second").props.accessibilityLabel).toBe("true")
  expect(screen.getByTestId("third").props.accessibilityLabel).toBe("false")
})

it("passes group context styles, current state and the original root/ref/event to its renderer", async () => {
  const contextRef = createRef<View>(),
    ownRef = createRef<View>(),
    onLayout = jest.fn(),
    event = { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 40 } } }
  const rendered: { props?: ViewProps } = {}
  await render(
    <NativeToggleButtonGroupContext.Provider value={{ ref: contextRef, orientation: "vertical", style: { gap: 4 } }}>
      <ToggleButtonGroup
        ref={ownRef}
        onLayout={onLayout}
        customStyles={{ padding: 2 }}
        style={({ defaultStyle }) => ({ ...defaultStyle, gap: 6 })}
        render={(props, values) => {
          rendered.props = props
          expect(values.orientation).toBe("vertical")
          return <View {...props} />
        }}
      />
    </NativeToggleButtonGroupContext.Provider>,
  )
  expect(ownRef.current).not.toBeNull()
  expect(contextRef.current).toBe(ownRef.current)
  expect(screen.getByTestId("toggle-button-group")).toHaveStyle({
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 2,
    gap: 6,
  })
  await fireEvent(screen.getByTestId("toggle-button-group"), "layout", event)
  expect(onLayout).toHaveBeenCalledWith(event)
  expect(rendered.props?.onLayout).toBe(onLayout)
})

it("retains the original owner through live theme changes without selection requests", async () => {
  const request = jest.fn()
  const Example = () => {
    const [dark, setDark] = useState(false)
    return (
      <NativeThemeProvider mode={dark ? "dark" : "light"}>
        <ToggleButton aria-label="Theme" onPress={() => setDark(!dark)} />
        <ToggleButtonGroup selectedKeys={[0]} onSelectionChange={request}>
          <ToggleButton id={0} aria-label="Held" />
        </ToggleButtonGroup>
      </NativeThemeProvider>
    )
  }
  await render(<Example />)
  const held = screen.getByRole("button", { name: "Held" })
  await press("Theme")
  expect(screen.getByRole("button", { name: "Held" })).toBe(held)
  expect(held.props.accessibilityState.checked).toBe(true)
  expect(request).not.toHaveBeenCalled()
})
