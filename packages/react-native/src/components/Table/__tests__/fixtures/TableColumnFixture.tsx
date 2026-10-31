import { useContext, useState, type ReactNode } from "react"
import { View } from "react-native"

import { Button, Input, NativeFocusView, Text } from "../../../.."
import { createNativeCollectionBranch } from "../../../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../../../collection/renderer"
import { useNativeTable } from "../../context"
import { NativeColumnResizer } from "../../NativeColumnResizer"
import { NativeResizableTableContainer } from "../../NativeResizableTableContainer"
import { Table } from "../../Table"
import { TableColumn } from "../../TableColumn"
import { TableRow } from "../../TableRow"

import { CellFixtureBody } from "./TableCellFixture"

export const ColumnFixtureHeader = createNativeCollectionBranch<object, { children?: ReactNode }, View>(
  "header",
  (_props, ref, node) => {
    const table = useNativeTable(),
      renderer = useContext(NativeCollectionRendererContext)
    return (
      <View ref={ref} style={{ flexDirection: "row" }}>
        <renderer.CollectionBranch collection={table.collection} parent={node} />
      </View>
    )
  },
  (props) => props.children,
)

const columns = [
  { id: "raw", name: "Raw title", isRowHeader: true },
  { id: "other", name: "Other title" },
]
export const TableColumnFixture = () => {
  const [width, setWidth] = useState(180),
    [hold, setHold] = useState(true),
    [custom, setCustom] = useState(false)
  const [requests, setRequests] = useState<string[]>([])
  return (
    <>
      <Button onPress={() => setHold((value) => !value)}>Toggle raw width owner veto</Button>
      <Button onPress={() => setCustom((value) => !value)}>Toggle column renderer</Button>
      <NativeResizableTableContainer
        testID="raw-resize-container"
        onResize={(widths) => {
          setRequests((previous) => [...previous, `width:${widths.get("raw")}`])
          if (!hold) setWidth(Number(widths.get("raw")))
        }}
      >
        <Table accessibilityLabel="Raw column resizing">
          <ColumnFixtureHeader>
            <TableColumn
              id="raw"
              columnID="raw"
              isRowHeader
              width={width}
              minWidth={100}
              maxWidth={400}
              testID="raw-column"
              render={custom ? (props) => <NativeFocusView {...props} /> : undefined}
            >
              {(values) => (
                <>
                  <Text>Raw title</Text>
                  <Button onPress={() => values.startResize()}>Start raw column resizing</Button>
                  <NativeColumnResizer
                    testID="raw-column-resizer"
                    style={{ width: 12, height: 20, backgroundColor: "lightgray" }}
                  />
                </>
              )}
            </TableColumn>
            <TableColumn id="other" columnID="other">
              Other title
            </TableColumn>
          </ColumnFixtureHeader>
          <CellFixtureBody>
            <TableRow
              id="raw-row"
              item={{}}
              columns={columns}
              renderCell={({ column }) =>
                column.id === "raw" ? (
                  <Input
                    testID="raw-column-editor"
                    accessibilityLabel="Held raw column draft"
                    value=""
                    onChangeText={(value) => setRequests((previous) => [...previous, `draft:${value}`])}
                  />
                ) : (
                  "Other value"
                )
              }
            />
          </CellFixtureBody>
        </Table>
      </NativeResizableTableContainer>
      <Text testID="raw-column-width">{width}</Text>
      <Text testID="raw-column-requests">{JSON.stringify(requests)}</Text>
    </>
  )
}
