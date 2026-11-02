import { act, render, screen } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { findNodeHandle, View } from "react-native"

import {
  answerSourceActions,
  deliverSourceReceipt,
  sourcePublication,
  sourceReceipt,
} from "../../../collection/__tests__/visiblePublisher"
import type { TNativeCollectionItem } from "../../../collection/snapshot"
import { nativeCollectionFocusBinding } from "../../../input/nativeVisibleCollectionAdmission"
import { NativeThemeProvider } from "../../../theme"
import { Tag } from "../Tag"
import { TagGroup } from "../TagGroup"

it("registers the original custom core receiver once, keeps remove descendants separate and waits for the real adapter's receipt", async () => {
  const ref = createRef<View>(),
    selected = jest.fn()
  const items: readonly TNativeCollectionItem<object>[] = [
    {
      key: "a",
      type: "item",
      value: {},
      props: {},
      rendered: "Alpha",
      textValue: "Alpha",
      render: () => (
        <Tag ref={ref} render={({ onFocus: _focus, onBlur: _blur, ...props }) => <View {...props} testID="core-tag" />}>
          Alpha
        </Tag>
      ),
    },
  ]
  await render(
    <NativeThemeProvider>
      <TagGroup
        items={items}
        selectionMode="multiple"
        shouldSelectOnPressUp
        onSelectionChange={selected}
        onRemove={() => {}}
      />
    </NativeThemeProvider>,
  )
  const publication = sourcePublication()
  expect(publication.receivers).toHaveLength(1)
  expect(publication.receivers[0].tag).toBe(findNodeHandle(ref.current))
  expect(publication.receivers[0].tag).not.toBe(publication.root.tag)
  expect(nativeCollectionFocusBinding(ref.current!)).toBe("")
  const event = {
    target: findNodeHandle(ref.current),
    currentTarget: findNodeHandle(ref.current),
    persist: jest.fn(),
    preventDefault: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: {
      target: findNodeHandle(ref.current),
      timestamp: 1,
      identifier: 0,
      pageX: 0,
      pageY: 0,
      locationX: 0,
      locationY: 0,
    },
  }
  const press = async () => {
    await act(() => screen.getByTestId("core-tag").props.onResponderGrant(event))
    await act(() => screen.getByTestId("core-tag").props.onResponderRelease(event))
  }
  await press()
  expect(selected).not.toHaveBeenCalled()
  await deliverSourceReceipt(sourceReceipt(1))
  expect(nativeCollectionFocusBinding(ref.current!)).toBe(`source-test-native-lease:${publication.receivers[0].id}`)
  await press()
  expect(selected).not.toHaveBeenCalled()
  await answerSourceActions()
  expect([...selected.mock.calls.at(-1)![0]]).toEqual(["a"])
})

it("retires the original receiver on same-model host replacement and rejects the old acknowledgement", async () => {
  const ref = createRef<View>()
  let replace!: () => void
  const Receiver = () => {
    const [alternate, setAlternate] = useState(false)
    replace = () => setAlternate(true)
    return (
      <Tag
        ref={ref}
        render={({ onFocus: _focus, onBlur: _blur, ...props }) => <View {...props} key={alternate ? "new" : "old"} />}
      >
        Alpha
      </Tag>
    )
  }
  const items: readonly TNativeCollectionItem<object>[] = [
    { key: "a", type: "item", value: {}, props: {}, rendered: "Alpha", textValue: "Alpha", render: () => <Receiver /> },
  ]
  const view = await render(
    <NativeThemeProvider>
      <TagGroup items={items} />
    </NativeThemeProvider>,
  )
  const old = ref.current!,
    before = sourcePublication(),
    oldReceipt = sourceReceipt(1)
  await deliverSourceReceipt(oldReceipt)
  expect(nativeCollectionFocusBinding(old)).not.toBe("")
  await act(replace)
  const current = ref.current!,
    after = sourcePublication()
  expect(current).not.toBe(old)
  expect(after.model).toEqual(before.model)
  expect(after.receivers).toHaveLength(1)
  expect(after.receivers[0].tag).toBe(findNodeHandle(current))
  expect(nativeCollectionFocusBinding(old)).toBeNull()
  expect(nativeCollectionFocusBinding(current)).toBe("")
  await deliverSourceReceipt({ ...oldReceipt, sequence: 2 })
  expect(nativeCollectionFocusBinding(current)).toBe("")
  await deliverSourceReceipt(sourceReceipt(3))
  expect(nativeCollectionFocusBinding(current)).toBe(`source-test-native-lease:${after.receivers[0].id}`)
  await view.unmount()
  expect(nativeCollectionFocusBinding(current)).toBeNull()
})
