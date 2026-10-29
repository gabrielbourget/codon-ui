import {
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type Ref,
} from "react"
import { View, VirtualizedList, useWindowDimensions, type TextInput, type VirtualizedListProps } from "react-native"

import {
  Button,
  Input,
  Text,
  DefaultNativeCollectionRenderer,
  NativeCollectionCellFocusContext,
  NativeCollectionRendererContext,
  type TNativeCollectionBranchProps,
  type TNativeCollectionRect,
  type TNativeCollectionRenderer,
  type TNativeCollectionRootProps,
  type TNativeCollectionKey,
  type TNativeCollectionNode,
} from "@codon-ui/react-native"
import {
  NativeTableStateContext,
  NativeResizableTableContainer,
  Table,
  TableBody,
  TableHeader,
  type TNativeTableState,
} from "@codon-ui/react-native"

const useSceneTableState = () => {
  const state = useContext(NativeTableStateContext)
  if (!state) throw new Error("The virtualized Table scene requires its original Table state")
  return state
}

type TNode = TNativeCollectionNode<unknown>
type TCellProps = ComponentProps<NonNullable<VirtualizedListProps<TNode>["CellRendererComponent"]>>
type TCellFocusCaptureEvent = Parameters<NonNullable<TCellProps["onFocusCapture"]>>[0]
type TBridge = {
  root: TNativeCollectionRootProps | null
  collection: TNativeTableState<object>["collection"] | null
  data: TNode[]
  view: VirtualizedList<TNode> | null
  rectangles: Map<TNativeCollectionKey, TNativeCollectionRect>
  viewport: TNativeCollectionRect
  content: { width: number; height: number }
  requestRendering: (key: TNativeCollectionKey) => void
}
const rowKeyFor = (bridge: TBridge, key: TNativeCollectionKey) => {
  let node = bridge.collection?.getItem(key)
  while (node && node.type !== "item") node = node.parentKey == null ? null : bridge.collection!.getItem(node.parentKey)
  return node?.key
}
const scrollTo = (bridge: TBridge, key: TNativeCollectionKey) => {
  const rowKey = rowKeyFor(bridge, key)
  const index = bridge.data.findIndex((row) => row.key === rowKey)
  if (index >= 0) bridge.view?.scrollToIndex({ index, animated: false })
}
const VirtualBody = ({ collection, parent, bridge }: TNativeCollectionBranchProps & { bridge: TBridge }) => {
  const { fontScale } = useWindowDimensions()
  const data = useMemo(
    () => [...collection.getChildren(parent.key)].filter((node) => node.type === "item"),
    [collection, parent.key],
  )
  const [requested, setRequested] = useState<TNativeCollectionKey | null>(null)
  const request = useRef<TNativeCollectionKey | null>(null)
  useLayoutEffect(() => {
    bridge.data = data
    bridge.requestRendering = (key) => {
      request.current = key
      setRequested(key)
    }
    for (const key of bridge.rectangles.keys()) if (!collection.getItem(key)) bridge.rectangles.delete(key)
  }, [bridge, data, collection])
  const capture = useCallback(
    (view: VirtualizedList<TNode> | null) => {
      const previous = bridge.view
      bridge.view = view
      const ref = bridge.root?.scrollRef
      if (ref && (view || ref.current === previous)) ref.current = view
    },
    [bridge],
  )
  const Cell = useMemo(() => {
    // RN's own CellRenderer uses this capture prop, which public View typings omit.
    const NativeCell = ({ item, children, style, onLayout, onFocusCapture }: TCellProps) => (
      <View
        style={style}
        {...{ onFocusCapture }}
        onLayout={(event) => {
          bridge.rectangles.set(item.key, { ...event.nativeEvent.layout })
          onLayout?.(event)
        }}
      >
        <NativeCollectionCellFocusContext.Provider
          value={(event) => {
            onFocusCapture?.(event as unknown as TCellFocusCaptureEvent)
            if (request.current != null && rowKeyFor(bridge, request.current) === item.key) {
              request.current = null
              setRequested(null)
            }
          }}
        >
          {children}
        </NativeCollectionCellFocusContext.Provider>
      </View>
    )
    return NativeCell
  }, [bridge])
  return (
    <VirtualizedList<TNode>
      ref={capture}
      testID="table-virtual-list"
      data={data}
      getItem={(items: TNode[], index) => items[index]}
      getItemCount={(items: TNode[]) => items.length}
      keyExtractor={(node) => JSON.stringify([typeof node.key, node.key])}
      renderItem={({ item }) => item.render?.(item) ?? null}
      CellRendererComponent={Cell}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={3}
      extraData={[requested, bridge.root?.persistedKeys, fontScale]}
      keyboardShouldPersistTaps="always"
      onLayout={(event) => {
        bridge.viewport = {
          ...bridge.viewport,
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        }
        bridge.root?.onLayout?.(event)
      }}
      onContentSizeChange={(width, height) => {
        bridge.content = { width, height }
      }}
      onScroll={(event) => {
        bridge.viewport = {
          ...bridge.viewport,
          x: event.nativeEvent.contentOffset.x,
          y: event.nativeEvent.contentOffset.y,
        }
        bridge.root?.onScroll?.(event)
      }}
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        if (averageItemLength > 0) bridge.view?.scrollToOffset({ offset: index * averageItemLength, animated: false })
      }}
      scrollEventThrottle={16}
      style={{ height: 320 * fontScale, width: "100%" }}
    />
  )
}
const VirtualRoot = ({ props, bridge }: { props: TNativeCollectionRootProps; bridge: TBridge }) => {
  const table = useSceneTableState()
  useInsertionEffect(() => {
    bridge.root = props
    bridge.collection = table.collection
  })
  useInsertionEffect(
    () => () => {
      if (bridge.root?.scrollRef?.current === bridge.view) bridge.root.scrollRef.current = null
      bridge.root = null
      bridge.collection = null
      bridge.view = null
      bridge.rectangles.clear()
      bridge.requestRendering = () => {}
    },
    [bridge],
  )
  return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
}
export const useTableFixtureVirtualRenderer = () => {
  const bridge = useMemo<TBridge>(
    () => ({
      root: null,
      collection: null,
      data: [],
      view: null,
      rectangles: new Map(),
      viewport: { x: 0, y: 0, width: 0, height: 0 },
      content: { width: 0, height: 0 },
      requestRendering: () => {},
    }),
    [],
  )
  const renderer = useMemo<TNativeCollectionRenderer>(
    () => ({
      ...DefaultNativeCollectionRenderer,
      isVirtualized: true,
      CollectionRoot: (props) => <VirtualRoot props={props} bridge={bridge} />,
      CollectionBranch: (props) =>
        props.parent.type === "body" || props.parent.type === "tablebody" ? (
          <VirtualBody {...props} bridge={bridge} />
        ) : (
          <DefaultNativeCollectionRenderer.CollectionBranch {...props} />
        ),
      layoutDelegate: {
        getContentSize: () => bridge.content,
        getVisibleRect: () => bridge.viewport,
        getItemRect: (key) => {
          const row = rowKeyFor(bridge, key)
          return row == null ? null : (bridge.rectangles.get(row) ?? null)
        },
        requestRendering: (key) => bridge.requestRendering(key),
        scrollToKey: (key) => scrollTo(bridge, key),
      },
    }),
    [bridge],
  )
  return { renderer, bridge }
}
type TRow = { id: string; name: string }
const rows: TRow[] = Array.from({ length: 48 }, (_, index) => ({
  id: `virtual-row-${index}`,
  name: `Virtual row ${index}`,
}))
const columns = [
  { id: "name", name: "Name", isRowHeader: true, width: 200 },
  { id: "draft", name: "Draft", maxLines: 2 },
]
const LogicalCount = () => <Text testID="table-virtual-count">{useSceneTableState().collection.size}</Text>
export const TableVirtualizedScene = ({ editorRef }: { editorRef?: Ref<TextInput> }) => {
  const { renderer, bridge } = useTableFixtureVirtualRenderer()
  const [drafts, setDrafts] = useState<string[]>([])
  const [scrolls, setScrolls] = useState(0)
  const { fontScale } = useWindowDimensions()
  return (
    <>
      <Text>
        Owner-defined virtual row layout with a fixed header. Use the original keyboard to navigate offscreen rows.
      </Text>
      <Button onPress={() => scrollTo(bridge, rows.at(-1)!.id)}>Scroll to last virtual row</Button>
      <Button onPress={() => scrollTo(bridge, rows[0]!.id)}>Scroll to first virtual row</Button>
      <NativeCollectionRendererContext.Provider value={renderer}>
        <NativeResizableTableContainer testID="table-virtual-container">
          <Table
            testID="table-virtual-root"
            accessibilityLabel="Virtualized rows"
            onScroll={() => setScrolls((value) => value + 1)}
          >
            <TableHeader columns={columns} />
            <TableBody<TRow>
              columns={columns}
              items={rows}
              customRowStyles={{ height: 72 * fontScale }}
              renderCell={({ row, column }) =>
                column.id === "name" ? (
                  <>
                    <Text>{row.name}</Text>
                    {row.id === rows[0]!.id && <LogicalCount />}
                  </>
                ) : row.id === rows[0]!.id ? (
                  <Input
                    ref={editorRef}
                    testID="table-virtual-editor"
                    accessibilityLabel="Held virtual draft"
                    value=""
                    onChangeText={(value) => setDrafts((previous) => [...previous, value])}
                  />
                ) : (
                  ""
                )
              }
            />
          </Table>
        </NativeResizableTableContainer>
      </NativeCollectionRendererContext.Provider>
      <Text testID="table-virtual-requests">{JSON.stringify({ drafts, scrolls })}</Text>
    </>
  )
}
