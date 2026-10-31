import { useContext, useState, type ReactNode, type Ref } from "react"
import { View, type TextInput } from "react-native"

import { createNativeCollectionBranch } from "../../../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../../../collection/renderer"
import { NativeFocusView } from "../../../../input/NativeFocusView"
import { Button } from "../../../Button/Button"
import { Input } from "../../../Input/Input"
import { Text } from "../../../Text/Text"
import { useNativeTable } from "../../context"
import { Table } from "../../Table"
import { TableCell } from "../../TableCell"
import { TableHeader } from "../../TableHeader"
import type { TNativeTableCellProps } from "../../types"

const createPart = (kind: "body" | "item") =>
  createNativeCollectionBranch<object, { id?: string | number; children?: ReactNode }, View>(
    kind,
    (_props, ref, parent) => {
      const table = useNativeTable(),
        renderer = useContext(NativeCollectionRendererContext)
      return (
        <View ref={ref}>
          <renderer.CollectionBranch collection={table.collection} parent={parent} />
        </View>
      )
    },
    (props) => props.children,
  )
export const CellFixtureBody = createPart("body")
export const CellFixtureRow = createPart("item")
const columns = [{ id: "value", name: "Custom cell", isRowHeader: true }]
const renderCell: NonNullable<TNativeTableCellProps["render"]> = (props, state) => (
  <NativeFocusView {...props} style={[props.style, { opacity: state.isHovered ? 0.85 : 1 }]} />
)
export const TableCellFixture = ({ editorRef }: { editorRef?: Ref<TextInput> }) => {
  const [custom, setCustom] = useState(false)
  const [truncate, setTruncate] = useState(false)
  const [maxLines, setMaxLines] = useState<number | undefined>()
  const [requests, setRequests] = useState<string[]>([])
  return (
    <>
      <Button onPress={() => setCustom((value) => !value)}>Toggle cell renderer</Button>
      <Button onPress={() => setTruncate((value) => !value)}>Toggle cell truncation</Button>
      <Button onPress={() => setMaxLines((value) => (value === undefined ? 2 : undefined))}>
        Toggle cell line limit
      </Button>
      <Table testID="table-cell-render-probe" accessibilityLabel="Custom cell rendering">
        <TableHeader columns={columns} />
        <CellFixtureBody>
          <CellFixtureRow id="custom-row">
            <TableCell
              id="custom-value"
              columnID="value"
              testID="table-custom-cell"
              render={custom ? renderCell : undefined}
              truncate={truncate}
              maxLines={maxLines}
            >
              <Text testID="table-custom-cell-text">
                A long cell phrase that can wrap over several lines at narrow widths.
              </Text>
              <Input
                ref={editorRef}
                testID="table-custom-cell-editor"
                accessibilityLabel="Held custom cell draft"
                value=""
                onChangeText={(value) => setRequests((previous) => [...previous, value])}
              />
            </TableCell>
          </CellFixtureRow>
        </CellFixtureBody>
      </Table>
      <Text testID="table-custom-cell-requests">{JSON.stringify(requests)}</Text>
    </>
  )
}
