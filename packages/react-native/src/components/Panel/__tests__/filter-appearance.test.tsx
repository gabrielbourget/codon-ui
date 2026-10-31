import { act, cleanup, render, screen } from "@testing-library/react-native"
import { createRef, type RefObject } from "react"
import { Animated, StyleSheet, TextInput, type View, type ViewStyle } from "react-native"

import { resolveNativeTheme } from "../../../theme/defaults"
import { useNativePanelAppearance } from "../appearance"
import { getNativePanelStyles } from "../styles"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
const theme = resolveNativeTheme("light")
const Probe = ({
  filter,
  opacity = 1,
  zIndex,
  reduced = false,
  root,
  editor,
  changed,
}: {
  filter?: ViewStyle["filter"]
  opacity?: number
  zIndex?: number
  reduced?: boolean
  root: RefObject<View | null>
  editor: RefObject<TextInput | null>
  changed: (value: string) => void
}) => {
  const styles = getNativePanelStyles(
    { accessibilityLabel: "Filter", customStyles: { color: "navy", filter, opacity, zIndex } },
    theme,
    300,
  )
  const appearance = useNativePanelAppearance(
    styles.view,
    styles.text,
    reduced,
    { width: 300, height: 500 },
    {
      color: "navy",
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 20,
    },
  )
  return (
    <Animated.View ref={root} testID="filter-appearance" style={appearance.view}>
      <TextInput ref={editor} testID="filter-editor" value="held" onChangeText={changed} />
    </Animated.View>
  )
}
beforeEach(() => jest.useFakeTimers())
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const style = () => StyleSheet.flatten(screen.getByTestId("filter-appearance").props.style)
const advance = (milliseconds: number) => act(() => jest.advanceTimersByTime(milliseconds))
const setup = async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const node = (props: { filter?: ViewStyle["filter"]; opacity?: number; zIndex?: number; reduced?: boolean }) => (
    <Probe {...props} root={root} editor={editor} changed={changed} />
  )
  const view = await render(node({ filter: "brightness(50%) blur(4px)" }))
  expect(root.current).not.toBeNull()
  expect(editor.current).not.toBeNull()
  return { ...view, root, editor, changed, node }
}

it("retargets and clears filters on their own timeline while retaining the original editor and independent opacity", async () => {
  const f = await setup(),
    root = f.root.current,
    editor = f.editor.current
  await f.rerender(f.node({ filter: "brightness(150%) blur(12px) opacity(25%)", opacity: 0.4 }))
  await advance(175)
  const current = style()
  const filters = current.filter as [{ brightness: number }, { blur: number }, { opacity: number }]
  expect(filters[0].brightness).toBeGreaterThan(0.8)
  expect(filters[0].brightness).toBeLessThan(1.2)
  expect(filters[1].blur).toBeGreaterThan(6)
  expect(filters[1].blur).toBeLessThan(10)
  expect(filters[2].opacity).toBeGreaterThan(0.5)
  expect(filters[2].opacity).toBeLessThan(0.8)
  expect(current.opacity).toBeGreaterThan(0.6)
  expect(current.opacity).toBeLessThan(0.8)
  await f.rerender(f.node({ opacity: 0.4 }))
  await advance(200)
  expect(style().opacity).toBe(0.4)
  expect((style().filter as { blur?: number }[])[1].blur).toBeGreaterThan(0)
  await advance(200)
  expect(style().filter).toBeUndefined()
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(screen.getByTestId("filter-editor").props.value).toBe("held")
  expect(f.changed).not.toHaveBeenCalled()
})

it("keeps incompatible filters discrete and reduced-motion updates static without restarting the original host", async () => {
  const f = await setup(),
    root = f.root.current,
    editor = f.editor.current
  await f.rerender(f.node({ filter: "blur(8px) brightness(150%)", opacity: 0.4 }))
  expect(style().filter).toEqual([{ blur: 8 }, { brightness: 1.5 }])
  expect(style().opacity).toBe(1)
  await advance(175)
  expect(style().opacity).toBeGreaterThan(0.6)
  await f.rerender(f.node({ filter: "drop-shadow(8px -4px 6px)", opacity: 0.4, reduced: true }))
  expect(style().filter).toEqual([{ dropShadow: { offsetX: 8, offsetY: -4, standardDeviation: 6, color: "navy" } }])
  expect(style().opacity).toBe(0.4)
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(f.changed).not.toHaveBeenCalled()
})

it("keeps equivalent clamped opacity targets on the same deadline while stacking updates stay integral", async () => {
  const f = await setup(),
    root = f.root.current,
    editor = f.editor.current
  const filter = "brightness(50%) blur(4px)"
  await f.rerender(f.node({ filter, opacity: 2, zIndex: 0 }))
  expect(style().opacity).toBe(1)
  await f.rerender(f.node({ filter, opacity: 3, zIndex: 5 }))
  await advance(175)
  expect(style().opacity).toBe(1)
  expect(Number.isInteger(style().zIndex)).toBe(true)
  expect(style().zIndex).toBeGreaterThan(0)
  expect(style().zIndex).toBeLessThan(5)
  await f.rerender(f.node({ filter, opacity: 2, zIndex: 5 }))
  await advance(200)
  expect(style().opacity).toBe(1)
  expect(style().zIndex).toBe(5)
  await f.rerender(f.node({ filter, opacity: -1, zIndex: 0 }))
  await advance(375)
  expect(style().opacity).toBe(0)
  expect(style().zIndex).toBe(0)
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(f.changed).not.toHaveBeenCalled()
})
