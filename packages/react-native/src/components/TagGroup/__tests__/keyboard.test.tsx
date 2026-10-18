import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import * as RN from "react-native"

import { NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "../../.."
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { Tag } from "../Tag"
import { TagGroup } from "../TagGroup"
import type { TNativeTagGroupProps } from "../types"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
beforeEach(() => {
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())
const fixture = async (props: TNativeTagGroupProps, children: ReactNode) => {
  const view = await render(
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost testID="host">
          <TagGroup {...props}>{children}</TagGroup>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>,
  )
  await fireEvent(row("tag-list"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 80 } } })
  for (const ready of [false, true]) {
    const host = row("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "tags-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  return view
}
const scoped = async (
  value: string,
  focused: RN.View | null,
  token = `0000:${value}`,
  extra: Record<string, unknown> = {},
) => {
  const host = row("host").props,
    policy = host.policies.find((entry: { tokens: string[] }) => entry.tokens.includes(token))
  expect(!!policy).toBe(true)
  const event = {
    preventDefault: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.ownerId,
      policyId: policy.id,
      target: 17,
      focusedTarget: RN.findNodeHandle(focused),
      windowId: "tags-window",
      epoch: 1,
      policyRevision: host.policyRevision,
      key: value,
      phase: "down",
      repeat: false,
      cancelled: false,
      nativeCode: 1,
      characters: "",
      nativeDefaultHandled: true,
      timestamp: 100,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      ...extra,
    },
  }
  await act(() => host.onNativeScopedKey(event))
  return { host, event }
}
it("Delete/Backspace requests selected owner membership, while the remove button remains item-only", async () => {
  const ref = createRef<RN.View>(),
    remove = jest.fn(),
    owner = new Set<string | number>([0, "missing"])
  await fixture(
    { selectionMode: "multiple", selectedKeys: owner, onRemove: remove },
    <Tag ref={ref} id={0} testID="zero">
      Zero
    </Tag>,
  )
  await scoped("Delete", ref.current)
  await scoped("Backspace", ref.current)
  expect(remove.mock.calls.map(([keys]) => [...keys])).toEqual([
    [0, "missing"],
    [0, "missing"],
  ])
  expect(remove.mock.calls[0][0] === owner).toBe(false)
  expect([...owner]).toEqual([0, "missing"])
  expect(row("zero")).toBeOnTheScreen()
})
it("none mode and unselected items remove only their own typed key", async () => {
  const ref = createRef<RN.View>(),
    remove = jest.fn()
  await fixture(
    { selectionMode: "none", selectedKeys: [0, "missing"], onRemove: remove },
    <Tag ref={ref} id="" testID="empty">
      Empty
    </Tag>,
  )
  await scoped("Delete", ref.current)
  expect([...remove.mock.calls[0][0]]).toEqual([""])
})
it("navigates actual item refs with wrapping and disabled skipping without changing controlled membership", async () => {
  const a = createRef<RN.View>(),
    b = createRef<RN.View>(),
    c = createRef<RN.View>(),
    change = jest.fn()
  await fixture(
    { selectionMode: "multiple", selectedKeys: [0], selectionBehavior: "replace", onSelectionChange: change },
    <>
      <Tag ref={a} id={0}>
        Zero
      </Tag>
      <Tag ref={b} id="disabled" isDisabled>
        Disabled
      </Tag>
      <Tag ref={c} id="">
        Empty
      </Tag>
    </>,
  )
  await scoped("ArrowDown", a.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === c.current).toBe(true)
  expect([...change.mock.calls[0][0]]).toEqual([""])
  await scoped("ArrowDown", c.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === a.current).toBe(true)
  await scoped("Home", c.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === a.current).toBe(true)
  await scoped("End", a.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === c.current).toBe(true)
  expect(b.current).not.toBeNull()
})
it("does not capture ordinary letters and retains typed select-all/escape owner requests", async () => {
  const ref = createRef<RN.View>(),
    change = jest.fn()
  await fixture(
    { selectionMode: "multiple", selectedKeys: [], onSelectionChange: change },
    <Tag ref={ref} id={0}>
      Zero
    </Tag>,
  )
  const tokens = row("host").props.policies.flatMap((policy: { tokens: string[] }) => policy.tokens)
  expect(tokens).not.toContain("0000:a")
  expect(tokens).not.toContain("0010:ArrowRight")
  await scoped("a", ref.current, "0010:a", { ctrlKey: true })
  expect(change.mock.calls[0][0]).toBe("all")
  await scoped("Escape", ref.current)
  expect(change).toHaveBeenCalledTimes(1)
})
it("rejects key-up, cancelled/repeated removal and retired window epochs", async () => {
  const ref = createRef<RN.View>(),
    remove = jest.fn()
  await fixture(
    { onRemove: remove },
    <Tag ref={ref} id={0}>
      Zero
    </Tag>,
  )
  await scoped("Delete", ref.current, "0000:Delete", { phase: "up" })
  await scoped("Delete", ref.current, "0000:Delete", { cancelled: true })
  await scoped("Delete", ref.current, "0000:Delete", { repeat: true })
  await scoped("Delete", ref.current, "0000:Delete", { epoch: 0 })
  expect(remove).not.toHaveBeenCalled()
  await scoped("Delete", ref.current)
  expect(remove).toHaveBeenCalledTimes(1)
})
it("preserves owner keys on Escape when selection mode is omitted and defaults to none", async () => {
  const ref = createRef<RN.View>(),
    change = jest.fn(),
    owner = new Set([0])
  await fixture(
    { selectedKeys: owner, onSelectionChange: change },
    <Tag ref={ref} id={0}>
      Zero
    </Tag>,
  )
  await scoped("Escape", ref.current)
  expect(change).not.toHaveBeenCalled()
  expect([...owner]).toEqual([0])
})
