import type { ReactElement, RefAttributes } from "react"
import type { View } from "react-native"

import type { TNativeCollectionItem, TNativeCollectionKey } from "../../collection/snapshot"
import { Button } from "../Button/Button"
import { encodeCollectionKey } from "../collection"
import { resolveNativeStyle } from "../colors"

import { getNativeTableColumns, renderNativeTableValue } from "./rendering"
import { TableSelectionCheckbox } from "./SelectionCheckbox"
import { TableBody } from "./TableBody"
import { TableCell } from "./TableCell"
import { TableColumn } from "./TableColumn"
import { TableColumnResizer } from "./TableColumnResizer"
import { TableHeader, NativeTableHeaderContent } from "./TableHeader"
import { TableRow, NativeTableDragIcon } from "./TableRow"
import type {
  TNativeTableBodyProps,
  TNativeTableColumnMetadata,
  TNativeTableHeaderProps,
  TNativeTableRowProps,
} from "./types"

export type TNativeTableModelOptions = Readonly<{
  mode: "none" | "single" | "multiple"
  behavior: "toggle" | "replace" | null
  draggingEnabled: boolean
  sortingEnabled: boolean
  resizingEnabled: boolean
  roundedRadius: number
}>
export type TNativeTableModelInput =
  | readonly TNativeCollectionItem<object>[]
  | ((options: TNativeTableModelOptions) => readonly TNativeCollectionItem<object>[])

// Explicit descriptor construction only. Visible elements and content callbacks
// run in the renderer; no authored JSX is inspected or mounted to find children.
export const nativeTableItem = (
  key: TNativeCollectionKey,
  type: string,
  props: object,
  render: () => ReactElement,
  children: readonly TNativeCollectionItem<object>[] = [],
  value: object | null = null,
): TNativeCollectionItem<object> => ({
  key,
  type,
  props,
  render,
  children,
  value,
  rendered: null,
  colSpan: (props as { colSpan?: number }).colSpan,
  textValue:
    typeof (props as { textValue?: string }).textValue === "string" ? (props as { textValue: string }).textValue : "",
  "aria-label":
    typeof (props as { "aria-label"?: string })["aria-label"] === "string"
      ? (props as { "aria-label": string })["aria-label"]
      : undefined,
})

export const createNativeTableHeaderModel = <T extends object>(
  props: TNativeTableHeaderProps<T> & RefAttributes<View>,
  options: TNativeTableModelOptions,
): TNativeCollectionItem<object> => {
  const children: TNativeCollectionItem<object>[] = []
  if (options.draggingEnabled) {
    const column = { id: "__drag", columnID: "__drag", style: { width: 30, padding: 0 } }
    children.push(nativeTableItem(column.id, "column", column, () => <TableColumn {...column} />))
  }
  if (options.behavior === "toggle") {
    const column = {
      id: "__selection",
      testID: "table-column-header:__selection",
      columnID: "__selection",
      style: { width: 30, padding: 0 },
    }
    children.push(
      nativeTableItem(column.id, "column", column, () => (
        <TableColumn {...column}>{options.mode === "multiple" && <TableSelectionCheckbox all />}</TableColumn>
      )),
    )
  }
  for (const column of getNativeTableColumns(props.columns)) {
    const custom = resolveNativeStyle(column.customHeaderColumnStyles, "TableHeader", "customHeaderColumnStyles")
    const reserveEnd =
      options.resizingEnabled &&
      !column.headerVisuallyHidden &&
      custom.padding === undefined &&
      custom.paddingHorizontal === undefined
    const visible = {
      id: column.id,
      columnID: column.id,
      testID: `table-column-header:${column.id}`,
      textValue: column.headerAriaLabel,
      isRowHeader: column.isRowHeader,
      allowsSorting: options.sortingEnabled && !!column.sort?.enabled,
      accessibilityLabel: column.headerAriaLabel ?? column.name,
      alignment: column.headerAlignment ?? column.alignment,
      customStyles: [
        reserveEnd ? { paddingEnd: 11 } : undefined,
        { width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth },
        custom,
      ],
    }
    children.push(
      nativeTableItem(column.id, "column", visible, () => (
        <TableColumn {...visible}>
          <NativeTableHeaderContent column={column as unknown as TNativeTableColumnMetadata<object>} />
          {options.resizingEnabled && !column.headerVisuallyHidden && (
            <TableColumnResizer column={column as unknown as TNativeTableColumnMetadata<object>} />
          )}
        </TableColumn>
      )),
    )
  }
  return nativeTableItem("__table-header", "tableheader", props, () => <TableHeader {...props} />, children)
}

export const createNativeTableRowModel = <T extends object>(
  props: TNativeTableRowProps<T> & RefAttributes<View>,
  options: TNativeTableModelOptions,
): TNativeCollectionItem<object> => {
  const { key: renderKey, ...visibleProps } = props
  const itemKey =
    props.id ??
    (props.item as { id?: TNativeCollectionKey; key?: TNativeCollectionKey }).id ??
    (props.item as { key?: TNativeCollectionKey }).key
  if (itemKey === undefined) throw new Error("Table rows require an explicit stable id or rowKey")
  const columns = getNativeTableColumns(props.columns)
  const radius = props.geometry === "orthogonal" ? 0 : props.geometry === "round" ? 10000 : options.roundedRadius
  const children: TNativeCollectionItem<object>[] = []
  const cellKey = (column: string) => `${encodeCollectionKey(itemKey)}:${column}`
  if (options.draggingEnabled) {
    const cell = { id: cellKey("__drag"), columnID: "__drag", style: { width: 30, padding: 0 } }
    children.push(
      nativeTableItem(cell.id, "cell", cell, () => (
        <TableCell {...cell}>
          <Button slot="drag" raised={false} style={{ padding: 4 }}>
            <NativeTableDragIcon color={props.iconColor} />
          </Button>
        </TableCell>
      )),
    )
  }
  if (options.behavior === "toggle") {
    const cell = {
      id: cellKey("__selection"),
      columnID: "__selection",
      style: { width: 30, padding: 0, borderTopLeftRadius: radius, borderBottomLeftRadius: radius },
    }
    children.push(
      nativeTableItem(cell.id, "cell", cell, () => (
        <TableCell {...cell}>
          <TableSelectionCheckbox />
        </TableCell>
      )),
    )
  }
  columns.forEach((column, index) => {
    const cell = {
      id: cellKey(column.id),
      columnID: column.id,
      alignment: column.alignment,
      truncate: column.truncate,
      maxLines: column.maxLines,
      customStyles: [
        {
          width: column.width,
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
          borderTopLeftRadius: index === 0 && options.behavior !== "toggle" ? radius : 0,
          borderBottomLeftRadius: index === 0 && options.behavior !== "toggle" ? radius : 0,
          borderTopRightRadius: index === columns.length - 1 ? radius : 0,
          borderBottomRightRadius: index === columns.length - 1 ? radius : 0,
        },
        column.customBodyCellStyles,
      ],
    }
    children.push(
      nativeTableItem(cell.id, "cell", cell, () => (
        <TableCell {...cell}>
          {column.cellRenderer
            ? column.cellRenderer({ row: props.item, column })
            : (props.renderCell ?? renderNativeTableValue)({ row: props.item, column })}
        </TableCell>
      )),
    )
  })
  return nativeTableItem(
    itemKey,
    "item",
    visibleProps,
    () => <TableRow key={renderKey} {...visibleProps} id={itemKey} />,
    children,
    props.value ?? props.item,
  )
}

export const createNativeTableBodyModel = <T extends object>(
  props: TNativeTableBodyProps<T> & RefAttributes<View>,
  options: TNativeTableModelOptions,
  children?: readonly TNativeCollectionItem<object>[],
): TNativeCollectionItem<object> =>
  nativeTableItem(
    "__table-body",
    "tablebody",
    props,
    () => <TableBody {...props} />,
    children ??
      (props.isLoading && props.renderLoadingState
        ? []
        : (props.items ?? []).map((item) =>
            createNativeTableRowModel(
              {
                id: props.rowKey?.(item),
                item,
                columns: props.columns,
                geometry: props.geometry,
                renderCell: props.renderCell,
                customStyles: props.customRowStyles,
              },
              options,
            ),
          )),
  )

export const nativeTableChildren = (
  ...items: readonly (
    | TNativeCollectionItem<object>
    | readonly TNativeCollectionItem<object>[]
    | false
    | null
    | undefined
  )[]
): readonly TNativeCollectionItem<object>[] =>
  items.flatMap((item) => (!item ? [] : Array.isArray(item) ? item : [item as TNativeCollectionItem<object>]))

export const nativeTableReceiver = <P extends object>(
  key: TNativeCollectionKey,
  type: string,
  props: P,
  render: (props: P) => ReactElement,
  children: readonly TNativeCollectionItem<object>[] = [],
): TNativeCollectionItem<object> =>
  nativeTableItem(
    key,
    type,
    props as Record<string, unknown>,
    () => render(props),
    children,
    (props as { value?: object }).value ?? null,
  )
