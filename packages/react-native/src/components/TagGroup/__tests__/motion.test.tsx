import "../../../collection/__tests__/nativeReceipts"

import { act as actAfterUnmount, screen } from "@testing-library/react-native"
import { AccessibilityInfo, StyleSheet } from "react-native"

import { NativeThemeProvider, TagGroup, TagGroupItem } from "../../.."
import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"
import { resolveNativeTheme } from "../../../theme/defaults"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("animates grouped selection paint over250ms while the authored shadow changes immediately", async () => {
  const theme = resolveNativeTheme("light")
  const node = (selected: boolean) => (
    <NativeThemeProvider>
      <TagGroup selectionMode="multiple" selectedKeys={selected ? ["a"] : []} onRemove={() => {}}>
        <TagGroupItem id="a" testID="paint-tag" raised={selected}>
          Alpha
        </TagGroupItem>
      </TagGroup>
    </NativeThemeProvider>
  )
  const paint = () => StyleSheet.flatten(screen.getByTestId("paint-tag").props.style)
  const view = await render(node(false))
  const initial = paint()
  await view.rerender(node(true))
  expect(paint().backgroundColor).toBe(initial.backgroundColor)
  expect(paint().borderColor).toBe(initial.borderColor)
  expect(paint()).toMatchObject({ shadowOpacity: 0.24, shadowRadius: 3, elevation: 2 })
  expect(screen.getByText("Alpha")).toHaveStyle({ color: theme.colors.controlForeground })
  await act(() => jest.advanceTimersByTime(100))
  expect(paint().backgroundColor).not.toBe(initial.backgroundColor)
  expect(paint().backgroundColor).not.toBe(theme.colors.controlSelectedBackground)
  await act(() => jest.advanceTimersByTime(175))
  expect(paint()).toMatchObject({
    backgroundColor: theme.colors.controlSelectedBackground,
    borderColor: theme.colors.controlSelectedBackground,
  })
  expect(screen.getByText("Alpha")).toHaveStyle({ color: theme.colors.controlSelectedForeground })
  expect(screen.getByTestId("tag-default-close-icon", { includeHiddenElements: true }).props.fill).toBe(
    theme.colors.controlSelectedForeground,
  )
  await view.unmount()
})

it("retargets interrupted paint without changing selection and honors Reduce Motion", async () => {
  const theme = resolveNativeTheme("light")
  const change = jest.fn()
  const node = (selected: boolean) => (
    <TagGroup selectionMode="multiple" selectedKeys={selected ? ["a"] : []} onSelectionChange={change}>
      <TagGroupItem id="a" testID="interrupted-tag">
        Alpha
      </TagGroupItem>
    </TagGroup>
  )
  const paint = () => StyleSheet.flatten(screen.getByTestId("interrupted-tag").props.style).backgroundColor
  const view = await render(node(false))
  await view.rerender(node(true))
  await act(() => jest.advanceTimersByTime(100))
  const interrupted = paint()
  await view.rerender(node(false))
  expect(paint()).toBe(interrupted)
  expect(screen.getByTestId("interrupted-tag").props.accessibilityState.selected).toBe(false)
  await act(() => jest.advanceTimersByTime(275))
  expect(paint()).toBe(theme.colors.controlBackground)
  expect(change).not.toHaveBeenCalled()
  await view.unmount()

  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true)
  const reduced = await render(node(false))
  await reduced.rerender(node(true))
  expect(paint()).toBe(theme.colors.controlSelectedBackground)
  expect(change).not.toHaveBeenCalled()
  await reduced.unmount()
  await actAfterUnmount(() => jest.advanceTimersByTime(500))
  expect(change).not.toHaveBeenCalled()
})
