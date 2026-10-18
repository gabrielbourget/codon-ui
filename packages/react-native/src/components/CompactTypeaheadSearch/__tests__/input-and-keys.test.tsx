import { act, cleanup, fireEvent, render } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, findNodeHandle, type TextInput } from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "../../.."
import { getNativeFocusedTarget } from "../../../input/focus"
import { CompactTypeaheadSearch } from "../CompactTypeaheadSearch"

import { advance, installCompactNativeLayout, row } from "./fixtures/nativeLayout"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext(null),
}))
let fixture: ReturnType<typeof installCompactNativeLayout>
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  fixture = installCompactNativeLayout()
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const dataFor = (editor: TextInput, key: string, repeat = false) => {
  const host = row("host").props
  const policy = host.policies.find(
    (entry: { tokens: string[]; targetTag: number }) =>
      entry.tokens.includes(`0000:${key}`) && entry.targetTag === findNodeHandle(editor),
  )
  expect(policy).toBeDefined()
  return {
    kind: "keyboard",
    phase: "down",
    ownerId: host.ownerId,
    policyId: policy.id,
    target: findNodeHandle(fixture.hostRef.current),
    focusedTarget: findNodeHandle(editor),
    key,
    repeat,
    cancelled: false,
    nativeDefaultHandled: true,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    windowId: "compact-window",
    epoch: 1,
    policyRevision: host.policyRevision,
    nativeCode: key === "Enter" ? 66 : 20,
    timestamp: 100,
  }
}
const key = async (editor: TextInput, key: string, repeat = false) => {
  const packet = dataFor(editor, key, repeat)
  await act(() => row("host").props.onNativeScopedKey({ nativeEvent: packet }))
}
const setup = async () => {
  const editor = createRef<TextInput>(),
    onChange = jest.fn(),
    onInputChange = jest.fn(),
    onNativeChange = jest.fn()
  const node = (readOnly = false) => (
    <NativeThemeProvider>
      <NativeFloatingLayerHost ref={fixture.hostRef} testID="host">
        <CompactTypeaheadSearch
          inputRef={editor}
          accessibilityLabel="Editor"
          isOpen
          inputValue=""
          value={null}
          isReadOnly={readOnly}
          onChange={onChange}
          onInputChange={onInputChange}
          inputProps={{ onChange: onNativeChange }}
          items={[
            { id: 0, name: "First" },
            { id: "", name: "Second" },
          ]}
          getItemKey={(item) => item.id}
        />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
  const result = await render(node())
  await fixture.ready()
  expect(editor.current).not.toBeNull()
  expect(findNodeHandle(editor.current)).toBeGreaterThan(0)
  await fireEvent(row("type-ahead-search-input"), "focus", { nativeEvent: { target: findNodeHandle(editor.current) } })
  return { ...result, node, editor, onChange, onInputChange, onNativeChange }
}
it("NATIVE.compact.006 routes scoped navigation/commit while preserving the real controlled editor", async () => {
  const f = await setup(),
    target = f.editor.current!
  const write = jest.spyOn(target, "setNativeProps"),
    focus = jest.spyOn(target, "focus")
  await key(target, "ArrowDown")
  await key(target, "ArrowDown")
  await key(target, "Enter", true)
  expect(f.onChange).not.toHaveBeenCalled()
  await key(target, "Enter")
  await advance()
  expect(f.onChange).toHaveBeenCalledWith("")
  expect(f.onInputChange).not.toHaveBeenCalled()
  expect(f.onNativeChange).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
  expect(focus).toHaveBeenCalledTimes(1)
  expect(getNativeFocusedTarget()).toBe(target)
  expect(f.editor.current).toBe(target)
  expect(row("type-ahead-search-input").props.value).toBe("")
})
it("NATIVE.compact.007 retires an earlier native policy packet after read-only takeover", async () => {
  const f = await setup(),
    target = f.editor.current!
  await key(target, "ArrowDown")
  const stale = dataFor(target, "Enter"),
    callback = row("host").props.onNativeScopedKey
  await f.rerender(f.node(true))
  await act(() => callback({ nativeEvent: stale }))
  expect(f.onChange).not.toHaveBeenCalled()
  expect(f.onInputChange).not.toHaveBeenCalled()
})
it("NATIVE.compact.008 window loss retires deferred input focus even if the same window returns", async () => {
  const f = await setup(),
    target = f.editor.current!
  const focus = jest.spyOn(target, "focus")
  await key(target, "ArrowDown")
  await key(target, "Enter")
  await fixture.acknowledge(false)
  await fixture.acknowledge(true)
  await advance()
  expect(f.onChange).toHaveBeenCalledWith(0)
  expect(focus).not.toHaveBeenCalled()
  expect(row("type-ahead-search-input").props.value).toBe("")
})
