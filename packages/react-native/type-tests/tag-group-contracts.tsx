import { createRef, useContext } from "react"
import type { View } from "react-native"

import {
  NativeCollection,
  NATIVE_DEFAULT_SLOT,
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  NativeListStateContext,
  NativeTagListStateContext,
  NativeTagGroupContext,
  NativeTagListContext,
  NativeFocusView,
  TagGroup,
  TagGroupItem as Tag,
  TagGroupLabel,
  TagGroupText,
  Button,
  type TNativeCollectionRenderer,
  type TNativeCollectionSnapshot,
} from "../src"

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
    labels={{ selectedItem: (text) => `Selected: ${text}`, selectedCount: (count) => String(count), selectedAll: "" }}
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
    scrollRef?.current?.getNativeScrollRef?.()
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

export const NativeGroupedItemRendering = (
  <TagGroup selectionMode="multiple" onRemove={(keys) => keys.has(0)}>
    <Tag
      id={0}
      autoFocus
      render={(props, state) => <NativeFocusView {...props} accessibilityHint={String(state.isSelected)} />}
      style={({ defaultStyle, isFocusVisible }) => [defaultStyle, { opacity: isFocusVisible ? 1 : 0.8 }]}
    >
      {(state) => (
        <Button slot="remove" isDisabled={state.isDisabled}>
          Remove zero
        </Button>
      )}
    </Tag>
  </TagGroup>
)
export const NativeFieldRenderer: TNativeCollectionRenderer = {
  ...DefaultNativeCollectionRenderer,
  CollectionRoot: (props) => {
    const Root = DefaultNativeCollectionRenderer.CollectionRoot
    return (
      <>
        <TagGroupLabel>Tags</TagGroupLabel>
        <TagGroupText slot="description">Owner instructions</TagGroupText>
        <Root {...props} />
      </>
    )
  },
}
export const NativeSameCompleteListState = () => {
  const list = useContext(NativeListStateContext)
  const tags = useContext(NativeTagListStateContext)
  list?.selectionManager.setSelectedKeys([0, "0"])
  tags?.selectionManager.extendSelection(0)
  return String(list === tags)
}
// @ts-expect-error Private native focus-routing fields are not part of the grouped-item API.
export const invalidGroupedNativePolicy = <Tag nativeTabStop />
// @ts-expect-error Collection metadata identities remain private native construction fields.
export const invalidGroupedNativeIdentity = <Tag descriptorId="invented" />
// @ts-expect-error Paint timing remains an owned implementation detail, not a grouped-item prop.
export const invalidGroupedNativeMotion = <Tag nativeAnimate="colors" />
// @ts-expect-error Canonical grouped item render accepts a function, not an element shorthand.
export const invalidGroupedRender = <Tag render={<NativeFocusView />} />

// @ts-expect-error Localized selection-count callbacks receive a number.
export const invalidAnnouncementCount = <TagGroup labels={{ selectedCount: (count: string) => count }} />
