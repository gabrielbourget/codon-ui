import { useContext, useState, type ReactNode } from "react"
import { View } from "react-native"

import { Button, Input, NativeFocusView, Text } from "../../../.."
import { createNativeCollectionBranch } from "../../../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../../../collection/renderer"
import { useNativeTable } from "../../context"
import { nativeTableChildren, nativeTableReceiver, createNativeTableRowModel } from "../../model"
import { NativeColumnResizer } from "../../NativeColumnResizer"
import { NativeResizableTableContainer } from "../../NativeResizableTableContainer"
import { Table } from "../../Table"
import { TableColumn } from "../../TableColumn"

import { CellFixtureBody } from "./TableCellFixture"

export const ColumnFixtureHeader = createNativeCollectionBranch<object, { children?: ReactNode }, View>(
  "tableheader",
  (_props, ref, node) => {
    const table = useNativeTable(),
      renderer = useContext(NativeCollectionRendererContext)
    return (
      <View ref={ref} style={{ flexDirection: "row" }}>
        <renderer.CollectionBranch collection={table.collection} parent={node} />
      </View>
    )
  },
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
        <Table
          accessibilityLabel="Raw column resizing"
          items={(modelOptions) =>
            nativeTableChildren(
              nativeTableReceiver<React.ComponentProps<typeof ColumnFixtureHeader>>(
                "__header:1",
                "tableheader",
                {},
                (visibleProps) => <ColumnFixtureHeader {...visibleProps} />,
                nativeTableChildren(
                  nativeTableReceiver<React.ComponentProps<typeof TableColumn>>(
                    "raw",
                    "column",
                    {
                      id: "raw",
                      columnID: "raw",
                      isRowHeader: true,
                      width: width,
                      minWidth: 100,
                      maxWidth: 400,
                      testID: "raw-column",
                      render: custom ? (props) => <NativeFocusView {...props} /> : undefined,
                      children: (values) => (
                        <>
                          <Text>Raw title</Text>
                          <Button onPress={() => values.startResize()}>Start raw column resizing</Button>
                          <NativeColumnResizer
                            testID="raw-column-resizer"
                            style={{ width: 12, height: 20, backgroundColor: "lightgray" }}
                          />
                        </>
                      ),
                    },
                    (visibleProps) => <TableColumn {...visibleProps} />,
                    [],
                  ),
                  nativeTableReceiver<React.ComponentProps<typeof TableColumn>>(
                    "other",
                    "column",
                    { id: "other", columnID: "other", children: <>Other title</> },
                    (visibleProps) => <TableColumn {...visibleProps} />,
                    [],
                  ),
                ),
              ),
              nativeTableReceiver<React.ComponentProps<typeof CellFixtureBody>>(
                "__body:2",
                "tablebody",
                {},
                (visibleProps) => <CellFixtureBody {...visibleProps} />,
                nativeTableChildren(
                  createNativeTableRowModel(
                    {
                      id: "raw-row",
                      item: {},
                      columns: columns,
                      renderCell: ({ column }) =>
                        column.id === "raw" ? (
                          <Input
                            testID="raw-column-editor"
                            accessibilityLabel="Held raw column draft"
                            value=""
                            onChangeText={(value) => setRequests((previous) => [...previous, `draft:${value}`])}
                          />
                        ) : (
                          "Other value"
                        ),
                    },
                    modelOptions,
                  ),
                ),
              ),
            )
          }
        />
      </NativeResizableTableContainer>
      <Text testID="raw-column-width">{width}</Text>
      <Text testID="raw-column-requests">{JSON.stringify(requests)}</Text>
    </>
  )
}
