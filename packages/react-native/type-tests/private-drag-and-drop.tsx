import { createRef } from "react"
import type { View } from "react-native"

import type { DragAndDropHooks } from "../../react/node_modules/react-aria-components"
import { NativeDragPreview, NativeDropIndicator, useNativeDragAndDrop } from "../src/collection/dragAndDrop/hooks"
import type { TNativeDragAndDropHooks } from "../src/collection/dragAndDrop/hooks"
import { Table } from "../src/components/Table/Table"

type TRow = { name: string }
export const dragContracts = () => {
  const { dragAndDropHooks } = useNativeDragAndDrop<TRow>({
    getItems: (keys, originalRows) => [...keys].map((key) => ({ "text/plain": `${key}:${originalRows[0].name}` })),
    getAllowedDropOperations: () => ["move", "copy", "link"],
    renderDragPreview: (items) => ({
      element: <NativeDropIndicator target={{ type: "root" }} />,
      x: items.length,
      y: -3,
    }),
    onDragEnd: (event) => event.keys.has(0) && event.isInternal,
    onInsert: async (event) => {
      for (const item of event.items) if (item.kind === "text") await item.getText("text/plain")
    },
    onReorder: (event) => {
      String(event.target.key)
    },
    onItemDrop: async (event) => {
      for (const item of event.items)
        if (item.kind === "file") {
          const file: Blob = await item.getFile()
          file.slice()
        }
    },
  })
  return <Table<TRow> dragAndDropHooks={dragAndDropHooks} ref={createRef<View>()} />
}
export const rejectBrowserHooks = (hooks: DragAndDropHooks) => {
  // @ts-expect-error DOM hook refs/events cannot own a native collection.
  const native: TNativeDragAndDropHooks = hooks
  return native
}
export const rejectMissingRepresentations = () => {
  // @ts-expect-error Public drag values remain complete string MIME maps.
  useNativeDragAndDrop({ getItems: () => [{ "text/plain": { name: "invalid" } }] })
}
export const retainedPreviewType = NativeDragPreview
