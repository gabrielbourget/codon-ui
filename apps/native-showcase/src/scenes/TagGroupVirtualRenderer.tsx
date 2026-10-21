import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import { View, VirtualizedList, useWindowDimensions, type FocusEvent, type VirtualizedListProps } from "react-native"

import {
  DefaultNativeCollectionRenderer,
  NativeCollectionCellFocusContext,
  type TNativeCollectionRect,
  type TNativeCollectionRenderer,
  type TNativeCollectionRootProps,
} from "@codon-ui/react-native"
import type { TNativeCollectionKey, TNativeCollectionNode } from "@codon-ui/react-native"

type TNode = TNativeCollectionNode<unknown>
type TCellProps = ComponentProps<NonNullable<VirtualizedListProps<TNode>["CellRendererComponent"]>>
type TBridge = {
  data: TNode[]
  view: VirtualizedList<TNode> | null
  rectangles: Map<TNativeCollectionKey, TNativeCollectionRect>
  viewport: TNativeCollectionRect
  content: { width: number; height: number }
  requestRendering: (key: TNativeCollectionKey) => void
}

const VirtualRoot = ({
  collection,
  scrollRef,
  persistedKeys,
  bridge,
}: TNativeCollectionRootProps & { bridge: TBridge }) => {
  const { fontScale } = useWindowDimensions()
  const data = useMemo(() => [...collection].filter((node) => node.type === "item"), [collection])
  const [requestedKey, setRequestedKey] = useState<TNativeCollectionKey | null>(null)
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
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
    if (requestedKey === null || measuredWidth === null) return
    const index = data.findIndex((node) => node.key === requestedKey)
    if (index >= 0) bridge.view?.scrollToIndex({ index, animated: false })
  }, [bridge, data, measuredWidth, requestedKey])
  const Cell = useMemo(() => {
    const NativeCell = ({ item, children, onLayout, onFocusCapture, style }: TCellProps) => {
      const { fontScale: cellFontScale } = useWindowDimensions()
      return (
        <View
          style={[
            style,
            { width: 160 * cellFontScale, height: 64 * cellFontScale, padding: 8, justifyContent: "center" },
          ]}
          onLayout={(event) => {
            const rect = event.nativeEvent.layout
            bridge.rectangles.set(item.key, { ...rect })
            setMeasuredWidth((current) => (current === rect.width ? current : rect.width))
            onLayout?.(event)
          }}
        >
          <NativeCollectionCellFocusContext.Provider
            value={(event) => {
              // The pinned CellRenderer only reads its key; forward the original native focus event unchanged.
              onFocusCapture?.(event as unknown as FocusEvent)
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
      testID="tag-group-virtual-list"
      horizontal
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
      getItemLayout={
        measuredWidth === null
          ? undefined
          : (_items, index) => ({ index, length: measuredWidth, offset: measuredWidth * index })
      }
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        if (averageItemLength > 0) bridge.view?.scrollToOffset({ offset: index * averageItemLength, animated: false })
      }}
      onLayout={({ nativeEvent }) => {
        bridge.viewport = { ...bridge.viewport, width: nativeEvent.layout.width, height: nativeEvent.layout.height }
      }}
      onContentSizeChange={(width, height) => {
        bridge.content = { width, height }
      }}
      onScroll={({ nativeEvent }) => {
        bridge.viewport = { ...bridge.viewport, x: nativeEvent.contentOffset.x, y: nativeEvent.contentOffset.y }
      }}
      scrollEventThrottle={16}
      style={{ height: 80 * fontScale, width: "100%" }}
    />
  )
}

export const useTagGroupVirtualRenderer = (enabled: boolean): TNativeCollectionRenderer => {
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
      CollectionRoot: (props: TNativeCollectionRootProps) => <VirtualRoot {...props} bridge={bridge} />,
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
