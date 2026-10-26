import { createRef } from "react"
import type { View } from "react-native"
import type { ColumnSize } from "react-stately/useTableState"

import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeColumnResizer } from "../NativeColumnResizer"
import { NativeResizableTableContainer } from "../NativeResizableTableContainer"
import { TableColumn } from "../TableColumn"
import type { TNativeTableColumnRenderState } from "../types"

export const nativeColumnContracts = [
  <TableColumn
    columnID="name"
    ref={createRef<View>()}
    width="1fr"
    defaultWidth="25%"
    minWidth={50}
    render={(host, values) => (
      <NativeFocusView {...host} style={[host.style, { opacity: values.isResizing ? 0.5 : 1 }]} />
    )}
    style={(values) => ({ ...values.defaultStyle, padding: values.isHovered ? 9 : 5 })}
  >
    {(values) => values.defaultChildren}
  </TableColumn>,
  <NativeResizableTableContainer
    ref={createRef<View>()}
    onResize={(widths) => {
      const size: ColumnSize | undefined = widths.get(0)
      void size
    }}
    render={(host, value) => {
      const empty: undefined = value
      void empty
      return <NativeFocusView {...host} />
    }}
  />,
  <NativeColumnResizer
    ref={createRef<View>()}
    style={(values) => ({ ...values.defaultStyle, opacity: values.isResizing ? 1 : 0.5 })}
    render={(host, values) => <NativeFocusView {...host} accessibilityLabel={values.resizableDirection} />}
  >
    {(values) => values.defaultChildren}
  </NativeColumnResizer>,
  // @ts-expect-error Raw widths use source numeric/percentage/fraction sizes, not CSS pixel strings.
  <TableColumn columnID="name" width="20px" />,
  // @ts-expect-error Raw sizing and native view style are separate contracts.
  <TableColumn columnID="name" style={{ width: "1fr" }} />,
  // @ts-expect-error A raw resize handle has no generic motion API.
  <NativeColumnResizer animate={{ opacity: 1 }} />,
]
export const noColumnDefaultChildren = (value: TNativeTableColumnRenderState) => {
  // @ts-expect-error Only the Column children function receives defaultChildren.
  return value.defaultChildren
}
