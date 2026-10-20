import { createRef, useContext } from "react"
import type { View } from "react-native"

import { NativeCollection } from "../src/collection/CollectionBuilder"
import { NATIVE_DEFAULT_SLOT } from "../src/collection/context"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRenderer,
} from "../src/collection/renderer"
import type { TNativeCollectionSnapshot } from "../src/collection/snapshot"
import { NativeListStateContext } from "../src/collection/state"
import { NativeTagGroupContext, NativeTagListContext } from "../src/components/TagGroup/context"
import { Tag } from "../src/components/TagGroup/Tag"
import { TagGroup } from "../src/components/TagGroup/TagGroup"
import { NativeFocusView } from "../src/input/NativeFocusView"

const values = [
  { id: 0, label: "Zero" },
  { id: "0", label: "String" },
]
export const NativeCollectionContract = (
  <NativeCollection items={values} dependencies={["revision"]} idScope="scope">
    {(item) => <Tag>{item.label}</Tag>}
  </NativeCollection>
)
export const NativeTagGroupContract = (
  <TagGroup
    ref={createRef<View>()}
    selectionMode="multiple"
    selectedKeys="all"
    items={values}
    render={(props, state) => {
      const expected: undefined = state
      void expected
      return <NativeFocusView {...props} />
    }}
    renderEmptyState={({ state }) => {
      state.selectionManager.setFocusedKey(0)
      state.selectionManager.selectAll()
      return null
    }}
  >
    {(item) => (
      <Tag ref={createRef<View>()} textValue={item.label}>
        {(state) => String(state.isSelected)}
      </Tag>
    )}
  </TagGroup>
)
export const NativeSlotContract = (
  <NativeTagGroupContext.Provider
    value={{
      slots: {
        [NATIVE_DEFAULT_SLOT]: { selectionMode: "single", ref: createRef<View>() },
        filters: { style: { opacity: 0.7 }, "aria-label": "Filters" },
      },
    }}
  >
    <TagGroup slot="filters" />
    <TagGroup slot={null} />
  </NativeTagGroupContext.Provider>
)
export const NativeListSlotContract = (
  <NativeTagListContext.Provider value={{ ref: createRef<View>(), role: "grid", style: { gap: 0 } }} />
)
export const NativeRendererContract: TNativeCollectionRenderer = {
  ...DefaultNativeCollectionRenderer,
  isVirtualized: true,
  layoutDelegate: {
    getItemRect: () => null,
    getVisibleRect: () => ({ x: 0, y: 0, width: 300, height: 100 }),
    getContentSize: () => ({ width: 300, height: 900 }),
    getKeyRange: (from, to) => [from, to],
    requestRendering: (key) => void key,
    scrollToKey: async (key) => void key,
  },
  dropTargetDelegate: {
    getDropTargetFromPoint: (_x, _y, isValid) => {
      const target = { type: "item", key: 0, dropPosition: "before" } as const
      return !isValid || isValid(target) ? target : null
    },
  },
  CollectionRoot: ({ collection, persistedKeys, scrollRef, renderDropIndicator }) => {
    void collection.getItem(0)?.rendered
    persistedKeys?.has(0)
    scrollRef?.current?.getNativeScrollRef()
    return renderDropIndicator?.({ type: "item", key: "0", dropPosition: "after" })
  },
}
export const NativeRendererProvider = <NativeCollectionRendererContext.Provider value={NativeRendererContract} />
export const NativeActualState = () => {
  const state = useContext(NativeListStateContext)
  return String(state?.selectionManager.isSelectAll)
}

export const immutableNativeCollection = (collection: TNativeCollectionSnapshot<object>) => {
  // @ts-expect-error Collection membership is immutable.
  collection.set("invented", {})
  // @ts-expect-error Collection nodes are immutable.
  collection.getItem(0)!.key = "changed"
  // @ts-expect-error Private native descriptor identities never enter renderer-facing nodes.
  void collection.getItem(0)!.descriptorId
}
export const invalidStateMutation = (
  <TagGroup
    renderEmptyState={({ state }) => {
      // @ts-expect-error The source full manager is exposed, not a callback snapshot with invented setters.
      state.setSelectedKeys([])
      return null
    }}
  />
)
// @ts-expect-error Native styles replace browser classes.
export const invalidCollectionClass = <TagGroup className="tags" />
// @ts-expect-error Native render refs cannot be replaced with string refs.
export const invalidCollectionRef = <TagGroup ref="tags" />
// @ts-expect-error Native geometry uses numeric coordinates, not DOM client rectangles.
export const invalidNativeRect: NonNullable<TNativeCollectionRenderer["layoutDelegate"]> = { getItemRect: () => "0px" }
// @ts-expect-error Only typed business keys are accepted.
export const invalidNativeKeys = <TagGroup selectedKeys={[{}]} />
