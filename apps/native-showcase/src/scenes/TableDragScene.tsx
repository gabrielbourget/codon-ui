import { useRef, useState } from "react"
import { ScrollView, type TextInput } from "react-native"

import { Button, Input, Text } from "@codon-ui/react-native"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRenderer,
} from "@codon-ui/react-native"
import type {
  TNativeDropEvent,
  TNativeDropItem,
  TNativeReorderDropEvent,
  TNativeInsertDropEvent,
} from "@codon-ui/react-native"

import {
  useNativeDragAndDrop,
  NativeDropIndicator,
} from "../../../../packages/react-native/src/collection/dragAndDrop/hooks"
import { Table } from "../../../../packages/react-native/src/components/Table"
import { TableBody } from "../../../../packages/react-native/src/components/Table"
import { TableHeader } from "../../../../packages/react-native/src/components/Table"
import type { TNativeTableColumnMetadata } from "../../../../packages/react-native/src/components/Table"

type TRow = { id: string | number; name: string }
const initialRows: TRow[] = [
  { id: 0, name: "Zero" },
  { id: "", name: "Empty key" },
  { id: "last", name: "Last" },
]
const renderer: TNativeCollectionRenderer = {
  ...DefaultNativeCollectionRenderer,
  CollectionRoot: (props) => (
    <ScrollView
      ref={(view) => {
        if (props.scrollRef) props.scrollRef.current = view
      }}
      testID="table-drag-scroll"
      style={{ maxHeight: 180 }}
      onScroll={props.onScroll}
      onLayout={props.onLayout}
    >
      <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
    </ScrollView>
  ),
}
const columns: TNativeTableColumnMetadata<TRow>[] = [{ id: "name", name: "Name", isRowHeader: true }]

// Caller-owned business data intentionally survives hiding either original Table.
export const TableDragScene = () => {
  const [left, setLeft] = useState(initialRows),
    [right, setRight] = useState<TRow[]>([]),
    [mounted, setMounted] = useState(true),
    [scrolled, setScrolled] = useState(false),
    [draft, setDraft] = useState(""),
    [events, setEvents] = useState<string[]>([]),
    [payloads, setPayloads] = useState<string[]>([])
  const retained = useRef<TNativeDropItem[]>([]),
    nextKey = useRef(0),
    editor = useRef<TextInput | null>(null)
  const record = (value: string) => setEvents((previous) => [...previous, value])
  const keep = (event: TNativeDropEvent) => {
    retained.current.push(...event.items)
    record(`drop:${event.target.type}:${event.dropOperation}`)
  }
  const reorder = (event: TNativeReorderDropEvent) => {
    if (event.target.dropPosition === "on") return
    setLeft((previous) => {
      const moving = previous.filter((row) => event.keys.has(row.id)),
        remaining = previous.filter((row) => !event.keys.has(row.id))
      const index = remaining.findIndex((row) => row.id === event.target.key)
      if (index < 0) return previous
      remaining.splice(index + (event.target.dropPosition === "after" ? 1 : 0), 0, ...moving)
      return remaining
    })
    record(`reorder:${JSON.stringify([...event.keys])}`)
  }
  const insert = async (event: TNativeInsertDropEvent) => {
    const rows = await Promise.all(
      event.items
        .filter((item) => item.kind === "text")
        .map(async (item) => ({
          id: `received-${++nextKey.current}`,
          name: await item.getText("text/plain"),
        })),
    )
    setRight((previous) => {
      const next = [...previous],
        index = next.findIndex((row) => row.id === event.target.key)
      next.splice(index < 0 ? next.length : index + (event.target.dropPosition === "after" ? 1 : 0), 0, ...rows)
      return next
    })
  }
  const { dragAndDropHooks: source } = useNativeDragAndDrop<TRow>({
    getItems: (_keys, values) =>
      values.map((row) => ({ "text/plain": row.name, "application/x-codon-table-row": JSON.stringify(row) })),
    onDragStart: (event) => record(`start:${JSON.stringify([...event.keys])}`),
    onDragEnd: (event) => record(`end:${event.dropOperation}:${event.isInternal}`),
    onDrop: keep,
    onReorder: reorder,
    onItemDrop: (event) => record(`item:${JSON.stringify(event.target.key)}`),
    renderDragPreview: (items) => ({
      element: <Text testID="table-authored-preview">{items.length} original payloads</Text>,
      x: 8,
      y: 8,
    }),
    renderDropIndicator: (target) => <NativeDropIndicator target={target} testID="table-authored-indicator" />,
  })
  const { dragAndDropHooks: destination } = useNativeDragAndDrop<TRow>({
    acceptedDragTypes: ["text/plain"],
    onDrop: keep,
    onInsert: insert,
    onRootDrop: async (event) => {
      const incoming = await Promise.all(
        event.items
          .filter((item) => item.kind === "text")
          .map(async (item) => ({ id: `received-${++nextKey.current}`, name: await item.getText("text/plain") })),
      )
      setRight((previous) => [...previous, ...incoming])
    },
  })
  const content = (
    <>
      <Text elementType="h2">Original Table drag/drop</Text>
      <Button onPress={() => setMounted((value) => !value)}>Mount or retire drag tables</Button>
      <Button onPress={() => setScrolled((value) => !value)}>Toggle original scroll renderer</Button>
      <Button
        onPress={async () => {
          try {
            const texts = await Promise.all(
              retained.current.filter((item) => item.kind === "text").map((item) => item.getText("text/plain")),
            )
            setPayloads(texts)
          } catch (error) {
            record(`read-error:${String(error)}`)
          }
        }}
      >
        Read retained drop data
      </Button>
      <Button
        onPress={() => {
          for (const item of retained.current) item.release()
          retained.current = []
          setPayloads([])
        }}
      >
        Release retained drop data
      </Button>
      {mounted && (
        <>
          <Table
            accessibilityLabel="Drag source"
            testID="table-drag-source"
            dragAndDropHooks={source}
            selectionMode="multiple"
            selectionBehavior="toggle"
          >
            <TableHeader columns={columns} />
            <TableBody
              items={left}
              columns={columns}
              rowKey={(row) => row.id}
              renderCell={({ row }) =>
                row.id === 0 ? (
                  <Input
                    ref={editor}
                    testID="table-drag-original-editor"
                    accessibilityLabel="Original row draft"
                    value={draft}
                    onChangeText={setDraft}
                  />
                ) : (
                  row.name
                )
              }
            />
          </Table>
          <Table accessibilityLabel="Drop destination" testID="table-drag-destination" dragAndDropHooks={destination}>
            <TableHeader columns={columns} />
            <TableBody
              items={right}
              columns={columns}
              rowKey={(row) => row.id}
              renderEmptyState={() => "Drop original values here"}
            />
          </Table>
        </>
      )}
      <Text testID="table-drag-events">{JSON.stringify(events)}</Text>
      <Text testID="table-drag-retained">{JSON.stringify(payloads)}</Text>
    </>
  )
  return (
    <NativeCollectionRendererContext.Provider value={scrolled ? renderer : DefaultNativeCollectionRenderer}>
      {content}
    </NativeCollectionRendererContext.Provider>
  )
}
