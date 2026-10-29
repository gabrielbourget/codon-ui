import "./nativeReceipts"

import { createRef, useEffect, useState } from "react"
import type { TextInput, View } from "react-native"

import {
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  TagComboBox,
  TagGroup,
  TagGroupItem,
} from "../.."

import { actWithNativeCollections as act, renderWithNativeCollections as render, screen } from "./nativeReceipts"

it("receives asynchronous owner tag collections without replacing original group, picker or editor refs or issuing requests", async () => {
  const initial = [
    { id: 0, label: "Zero" },
    { id: "", label: "Empty" },
  ]
  const group = createRef<View>(),
    picker = createRef<View>(),
    editor = createRef<TextInput>()
  const onSelectionChange = jest.fn(),
    onSelectedItemsChange = jest.fn(),
    onInputChange = jest.fn()
  let receive!: (items: typeof initial) => void
  const response = new Promise<typeof initial>((resolve) => {
    receive = resolve
  })
  const Owner = () => {
    const [items, setItems] = useState(initial)
    useEffect(() => {
      let mounted = true
      void response.then((next) => {
        if (mounted) setItems(next)
      })
      return () => {
        mounted = false
      }
    }, [])
    return (
      <NativeThemeProvider>
        <NativeOverlayProvider>
          <NativeFloatingLayerHost>
            <TagGroup ref={group} items={items} selectionMode="multiple" selectedKeys={[0]} {...{ onSelectionChange }}>
              {(item) => <TagGroupItem testID={`async-tag-${item.id}`}>{item.label}</TagGroupItem>}
            </TagGroup>
            <TagComboBox
              ref={picker}
              inputRef={editor}
              items={items}
              selectedItems={[items.find((item) => item.id === 0)!]}
              getItemKey={(item) => item.id}
              getItemTextValue={(item) => item.label}
              inputValue="held query"
              isOpen={false}
              {...{ onSelectedItemsChange, onInputChange }}
            />
          </NativeFloatingLayerHost>
        </NativeOverlayProvider>
      </NativeThemeProvider>
    )
  }
  const view = await render(<Owner />)
  const original = [group.current, picker.current, editor.current]
  original.forEach((ref) => expect(ref).not.toBeNull())
  await act(async () => {
    receive([...initial].reverse().map((item) => ({ ...item, label: `${item.label} resolved` })))
    await response
  })
  expect(group.current).toBe(original[0])
  expect(picker.current).toBe(original[1])
  expect(editor.current).toBe(original[2])
  expect(screen.getByTestId("async-tag-0")).toHaveTextContent("Zero resolved")
  expect(screen.getByTestId("async-tag-0").props.accessibilityState.selected).toBe(true)
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("held query")
  expect(onSelectionChange).not.toHaveBeenCalled()
  expect(onSelectedItemsChange).not.toHaveBeenCalled()
  expect(onInputChange).not.toHaveBeenCalled()
  await view.unmount()
  expect(group.current).toBeNull()
  expect(picker.current).toBeNull()
  expect(editor.current).toBeNull()
})
