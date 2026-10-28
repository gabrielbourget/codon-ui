import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, findNodeHandle, StyleSheet, TextInput } from "react-native"
import type * as RN from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { focusNativeTarget, getNativeFocusedTarget } from "../../../input/focus"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeKeyboardScope } from "../../../input/NativeKeyboardScope"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { QueryPanelDialog } from "../QueryDialog"
import { SortAndFilterPanel, type TNativeSortAndFilterPanelProps } from "../SortAndFilterPanel"

const mockViews = new Map<string, RN.View>()
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react"),
    Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const bind = React.useCallback(
        (view: RN.View | null) => {
          if (view) mockViews.set(props.ownerId, view)
          else mockViews.delete(props.ownerId)
          if (typeof ref === "function") ref(view)
          else if (ref) ref.current = view
        },
        [ref, props.ownerId],
      )
      return <Native.View {...props} ref={bind} />
    }),
    Commands: {
      requestKeyboardFocus: jest.fn(),
      requestContainerFocus: jest.fn(),
      requestKeyboardBlur: jest.fn(),
      inspectAccessibility: jest.fn(),
    },
  }
})
jest.unmock("react-native/Libraries/Components/View/View")
jest.unmock("react-native/Libraries/Components/View/ViewNativeComponent")
jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: jest.requireActual("react-native").View }))
const host = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const tree = (style?: TNativeSortAndFilterPanelProps["customDialogStyles"]) => (
  <NativeThemeProvider>
    <NativeOverlayProvider>
      <SortAndFilterPanel
        title="Query dialog"
        possibleSortCriteria={[]}
        possibleFilterCriteria={[]}
        isOpen
        overlayBlur={false}
        onOpenChange={() => {}}
        applyPendingSortAndFilterChanges={() => {}}
        customDialogStyles={style}
      />
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const present = async () => {
  await fireEvent(host("sort-filter-panel-window"), "show")
  await fireEvent(host("sort-filter-panel"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 600 } },
  })
  for (const ready of [false, true]) {
    const scope = host("sort-filter-panel-floating-host").props
    await act(() =>
      scope.onNativeScopeStatus({
        nativeEvent: {
          ownerId: scope.ownerId,
          windowId: "query-dialog-window",
          epoch: 1,
          ready,
          windowActive: true,
          policyRevision: scope.policyRevision,
        },
      }),
    )
  }
}
const observe = async (node: ReturnType<typeof host>, focused: boolean, extra: Record<string, unknown> = {}) =>
  act(() =>
    node.props.onNativeFocusChange({
      nativeEvent: {
        ownerId: node.props.ownerId,
        target: findNodeHandle(mockViews.get(node.props.ownerId)!),
        isFocused: focused,
        isFocusVisible: false,
        ...extra,
      },
    }),
  )
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
  mockViews.clear()
})

it("paints only the actual focused Sort dialog, preserves inline overrides, and keeps its original native target", async () => {
  const f = await render(tree())
  await present()
  const dialog = host("query-panel-dialog"),
    original = mockViews.get(dialog.props.ownerId)!
  const style = () => StyleSheet.flatten(dialog.props.style)
  expect(original).toBeDefined()
  expect(style().outlineWidth).toBeUndefined()
  await act(() => {
    expect(focusNativeTarget(original)).toBe(true)
  })
  expect(style().outlineWidth).toBeUndefined()
  await observe(dialog, true, { ownerId: "foreign" })
  expect(style().outlineWidth).toBeUndefined()
  await observe(dialog, true, { target: -1 })
  expect(style().outlineWidth).toBeUndefined()
  await observe(dialog, true)
  expect(getNativeFocusedTarget()).toBe(original)
  expect(style()).toMatchObject({ outlineWidth: 1.5, outlineStyle: "solid", outlineColor: "#2563eb" })
  await f.rerender(tree({ outlineWidth: 4, outlineStyle: "dashed", outlineColor: "plum", outlineOffset: 3 }))
  expect(style()).toMatchObject({ outlineWidth: 4, outlineStyle: "dashed", outlineColor: "plum", outlineOffset: 3 })
  await f.rerender(tree({ outlineWidth: 0 }))
  expect(style().outlineWidth).toBe(0)
  await f.rerender(tree({ outlineWidth: undefined, outlineColor: undefined, outlineStyle: undefined }))
  expect(style()).toMatchObject({ outlineWidth: 1.5, outlineStyle: "solid", outlineColor: "#2563eb" })
  expect(mockViews.get(dialog.props.ownerId)).toBe(original)
  expect(host("query-panel-dialog")).toBe(dialog)
  await observe(screen.getByRole("button", { name: "Add Sort Criteria" }), true)
  expect(style().outlineWidth).toBeUndefined()
})

it("restores stylesheet dialog dimensions and spacing after undefined inline fields without resetting its native host", async () => {
  const f = await render(tree({ width: 120, height: 90, padding: 3, gap: 7 }))
  await present()
  const dialog = host("query-panel-dialog"),
    original = mockViews.get(dialog.props.ownerId)
  expect(dialog).toHaveStyle({ width: 120, height: 90, padding: 3, gap: 7 })
  await f.rerender(
    tree([
      { width: 120, height: 90, padding: 3, gap: 7 },
      { width: undefined, height: undefined, padding: undefined, gap: undefined },
    ]),
  )
  expect(dialog).toHaveStyle({ width: "100%", height: "100%", padding: 10, gap: 10 })
  expect(mockViews.get(dialog.props.ownerId)).toBe(original)
  expect(host("query-panel-dialog")).toBe(dialog)
})

it("retains the original empty editor and native dialog across focus, theme and window retirement", async () => {
  const editor = createRef<TextInput>(),
    changed = jest.fn()
  const activeWindow = () => true,
    inactiveWindow = () => false
  const node = (active: boolean, color: string) => (
    <NativeThemeProvider overrides={{ colors: { focusRing: color } }}>
      <NativeFloatingWindowContext.Provider value={active ? activeWindow : inactiveWindow}>
        <NativeKeyboardScope captureEnabled>
          <QueryPanelDialog testID="standalone-dialog" role="dialog" accessible={false} nativeTabStop={false}>
            <TextInput ref={editor} testID="dialog-held-editor" value="" onChangeText={changed} />
            <NativeFocusHost testID="dialog-child" />
          </QueryPanelDialog>
        </NativeKeyboardScope>
      </NativeFloatingWindowContext.Provider>
    </NativeThemeProvider>
  )
  const f = await render(node(true, "teal"))
  const dialog = host("standalone-dialog"),
    original = mockViews.get(dialog.props.ownerId),
    held = editor.current
  expect(original).toBeDefined()
  expect(held).not.toBeNull()
  await observe(dialog, true)
  expect(dialog).toHaveStyle({ outlineWidth: 1.5, outlineColor: "teal" })
  await f.rerender(node(true, "orange"))
  expect(dialog).toHaveStyle({ outlineWidth: 1.5, outlineColor: "orange" })
  expect(mockViews.get(dialog.props.ownerId)).toBe(original)
  expect(editor.current).toBe(held)
  await observe(host("dialog-child"), true)
  expect(StyleSheet.flatten(dialog.props.style).outlineWidth).toBeUndefined()
  await observe(dialog, true)
  expect(dialog).toHaveStyle({ outlineWidth: 1.5 })
  await f.rerender(node(false, "orange"))
  expect(getNativeFocusedTarget()).toBeNull()
  expect(StyleSheet.flatten(dialog.props.style).outlineWidth).toBeUndefined()
  await observe(dialog, true)
  expect(StyleSheet.flatten(dialog.props.style).outlineWidth).toBeUndefined()
  expect(editor.current).toBe(held)
  expect(host("dialog-held-editor").props.value).toBe("")
  expect(changed).not.toHaveBeenCalled()
})

it("preserves canonical box sizing and flex shrink through explicit dialog overrides and removal", async () => {
  const result = await render(tree())
  await present()
  const dialog = host("query-panel-dialog"),
    original = mockViews.get(dialog.props.ownerId)
  const control = screen.getByRole("button", { name: "Add Sort Criteria" })
  expect(dialog).toHaveStyle({ boxSizing: "content-box", flexShrink: 1, width: "100%", height: "100%", padding: 10 })
  await result.rerender(tree({ boxSizing: "border-box", flexShrink: 0 }))
  expect(dialog).toHaveStyle({ boxSizing: "border-box", flexShrink: 0 })
  await result.rerender(
    tree([
      { boxSizing: "border-box", flexShrink: 0 },
      { boxSizing: undefined, flexShrink: undefined },
    ]),
  )
  expect(dialog).toHaveStyle({ boxSizing: "content-box", flexShrink: 1 })
  expect(mockViews.get(dialog.props.ownerId)).toBe(original)
  expect(screen.getByRole("button", { name: "Add Sort Criteria" })).toBe(control)
})
