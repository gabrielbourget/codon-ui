import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import { View, VirtualizedList, useWindowDimensions, type VirtualizedListProps } from "react-native"

import {
  DefaultNativeCollectionRenderer,
  NativeCollectionCellFocusContext,
  type TNativeCollectionRect,
  type TNativeCollectionRenderer,
  type TNativeCollectionRootProps,
  type TNativeCollectionKey,
  type TNativeCollectionNode,
} from "../../../../packages/react-native/src"

type TNode = TNativeCollectionNode<unknown>
type TCellProps = ComponentProps<NonNullable<VirtualizedListProps<TNode>["CellRendererComponent"]>>
type TCellFocusEvent = Parameters<NonNullable<TCellProps["onFocusCapture"]>>[0]
type TBridge = {
  data: TNode[]
  view: VirtualizedList<TNode> | null
  rectangles: Map<TNativeCollectionKey, TNativeCollectionRect>
  viewport: TNativeCollectionRect
  content: { width: number; height: number }
  requestRendering: (key: TNativeCollectionKey) => void
}

const VirtualTagComboRoot = ({
  collection,
  scrollRef,
  persistedKeys,
  bridge,
  onScroll,
}: TNativeCollectionRootProps & { bridge: TBridge }) => {
  const { fontScale } = useWindowDimensions()
  const data = useMemo(() => [...collection].filter((node) => node.type === "item"), [collection])
  const [requestedKey, setRequestedKey] = useState<TNativeCollectionKey | null>(null)
  const [laidOut, setLaidOut] = useState(false)
  const request = useRef<TNativeCollectionKey | null>(null)
  const capture = useCallback(
    (view: VirtualizedList<TNode> | null) => {
      bridge.view = view
      if (scrollRef) scrollRef.current = view
    },
    [bridge, scrollRef],
  )
  useLayoutEffect(() => {
    bridge.data = data
    bridge.requestRendering = (key) => {
      request.current = key
      setRequestedKey(key)
    }
    for (const key of bridge.rectangles.keys()) if (!collection.getItem(key)) bridge.rectangles.delete(key)
  }, [bridge, collection, data])
  useLayoutEffect(
    () => () => {
      bridge.view = null
      bridge.requestRendering = () => {}
      bridge.rectangles.clear()
    },
    [bridge],
  )
  useLayoutEffect(() => {
    if (requestedKey === null || !laidOut) return
    const index = data.findIndex((node) => node.key === requestedKey)
    if (index >= 0) bridge.view?.scrollToIndex({ index, animated: false })
  }, [bridge, data, laidOut, requestedKey])
  const Cell = useMemo(() => {
    const NativeCell = ({ item, children, onLayout, onFocusCapture, style }: TCellProps) => {
      return (
        <View
          style={style}
          onLayout={(event) => {
            const rect = event.nativeEvent.layout
            bridge.rectangles.set(item.key, { ...rect })
            onLayout?.(event)
          }}
        >
          <NativeCollectionCellFocusContext.Provider
            value={(event) => {
              // The pinned CellRenderer only reads its key; forward the original native focus event unchanged.
              onFocusCapture?.(event as unknown as TCellFocusEvent)
              if (request.current === item.key) {
                request.current = null
                setRequestedKey(null)
              }
            }}
          >
            {children}
          </NativeCollectionCellFocusContext.Provider>
        </View>
      )
    }
    return NativeCell
  }, [bridge])
  return (
    <VirtualizedList<TNode>
      ref={capture}
      testID="tag-combo-owner-virtual-list"
      data={data}
      getItem={(items: TNode[], index) => items[index]}
      getItemCount={(items: TNode[]) => items.length}
      keyExtractor={(node) => JSON.stringify([typeof node.key, node.key])}
      renderItem={({ item }) => item.render?.(item) ?? null}
      CellRendererComponent={Cell}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={3}
      extraData={[persistedKeys, requestedKey, fontScale]}
      keyboardShouldPersistTaps="always"
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        if (averageItemLength > 0) bridge.view?.scrollToOffset({ offset: index * averageItemLength, animated: false })
      }}
      onLayout={({ nativeEvent }) => {
        bridge.viewport = { ...bridge.viewport, width: nativeEvent.layout.width, height: nativeEvent.layout.height }
        setLaidOut(nativeEvent.layout.height > 0)
      }}
      onContentSizeChange={(width, height) => {
        bridge.content = { width, height }
      }}
      onScroll={(event) => {
        const { nativeEvent } = event
        bridge.viewport = { ...bridge.viewport, x: nativeEvent.contentOffset.x, y: nativeEvent.contentOffset.y }
        onScroll?.(event)
      }}
      scrollEventThrottle={16}
      style={{ maxHeight: 280, width: "100%" }}
    />
  )
}

export const useTagComboVirtualRenderer = (enabled: boolean): TNativeCollectionRenderer => {
  const renderer = useMemo(() => {
    const bridge: TBridge = {
      data: [],
      view: null,
      rectangles: new Map(),
      viewport: { x: 0, y: 0, width: 0, height: 0 },
      content: { width: 0, height: 0 },
      requestRendering: () => {},
    }
    return {
      ...DefaultNativeCollectionRenderer,
      isVirtualized: true,
      CollectionRoot: (props: TNativeCollectionRootProps) => <VirtualTagComboRoot {...props} bridge={bridge} />,
      layoutDelegate: {
        getItemRect: (key: TNativeCollectionKey) => bridge.rectangles.get(key) ?? null,
        getVisibleRect: () => bridge.viewport,
        getContentSize: () => bridge.content,
        requestRendering: (key: TNativeCollectionKey) => bridge.requestRendering(key),
        scrollToKey: (key: TNativeCollectionKey) => {
          const index = bridge.data.findIndex((node) => node.key === key)
          if (index >= 0) bridge.view?.scrollToIndex({ index, animated: false })
        },
      },
    }
  }, [])
  return enabled ? renderer : DefaultNativeCollectionRenderer
}
