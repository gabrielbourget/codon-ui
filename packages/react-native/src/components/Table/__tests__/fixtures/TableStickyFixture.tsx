import { useCallback, useRef, useState } from "react"
import { ScrollView, View, type TextInput } from "react-native"

import { Button, Input, NativeFocusView, Text } from "../../../.."
import { Table } from "../../Table"
import { TableColumn } from "../../TableColumn"
import { TableRow } from "../../TableRow"
import type { TNativeTableColumnProps } from "../../types"

import { CellFixtureBody } from "./TableCellFixture"
import { ColumnFixtureHeader } from "./TableColumnFixture"

const columns = [{ id: "value", name: "Sticky value", isRowHeader: true }]
const rows = Array.from({ length: 12 }, (_, index) => ({ id: `sticky-${index}` }))

export const TableStickyFixture = () => {
  const [enabled, setEnabled] = useState(false)
  const [offset, setOffset] = useState(false)
  const [paint, setPaint] = useState(false)
  const [relative, setRelative] = useState(false)
  const [transformed, setTransformed] = useState(false)
  const [rightToLeft, setRightToLeft] = useState(false)
  const [scrollEnabled, setScrollEnabled] = useState(true)
  const [snapshot, setSnapshot] = useState("")
  const [draft, setDraft] = useState("Held sticky draft")
  const column = useRef<View | null>(null)
  const table = useRef<View | null>(null)
  const editor = useRef<TextInput | null>(null)
  const original = useRef<{ column: View | null; table: View | null; editor: TextInput | null } | null>(null)
  const renderColumn = useCallback<NonNullable<TNativeTableColumnProps["render"]>>(
    (props) => (
      <NativeFocusView
        {...props}
        style={[
          props.style,
          {
            position: relative ? "relative" : undefined,
            top: relative ? 8 : undefined,
            transform: transformed ? [{ translateX: "5%" }, { rotate: "3deg" }] : undefined,
          },
        ]}
      />
    ),
    [relative, transformed],
  )
  const inspect = () => {
    const current = { column: column.current, table: table.current, editor: editor.current }
    original.current ??= current
    setSnapshot(
      JSON.stringify({
        columnRetained: current.column === original.current.column,
        tableRetained: current.table === original.current.table,
        editorRetained: current.editor === original.current.editor,
        draft,
      }),
    )
  }
  return (
    <>
      <Text elementType="h2">Sticky header source scene</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        <Button onPress={() => setEnabled((value) => !value)}>Toggle real sticky header</Button>
        <Button onPress={() => setOffset((value) => !value)}>Toggle sticky percentage offset</Button>
        <Button onPress={() => setPaint((value) => !value)}>Toggle sticky paint</Button>
        <Button onPress={() => setRelative((value) => !value)}>Toggle final relative override</Button>
        <Button onPress={() => setTransformed((value) => !value)}>Toggle authored header transform</Button>
        <Button onPress={() => setRightToLeft((value) => !value)}>Toggle sticky RTL</Button>
        <Button onPress={() => setScrollEnabled((value) => !value)}>Toggle nearest scroll enabled</Button>
        <Button onPress={inspect}>Inspect sticky original refs</Button>
      </View>
      <ScrollView
        testID="table-sticky-nearest-scroll"
        style={{ height: 220, direction: rightToLeft ? "rtl" : "ltr" }}
        nestedScrollEnabled
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        <View style={{ height: 35 }} />
        <Table
          ref={table}
          testID="table-sticky-root"
          accessibilityLabel="Sticky original hosts"
          stickyHeader={enabled}
          stickyHeaderOffset={offset ? "10%" : 0}
          stickyHeaderBackgroundColor={paint ? "#b8d9ed" : undefined}
        >
          <ColumnFixtureHeader>
            <TableColumn
              ref={column}
              id="value"
              columnID="value"
              isRowHeader
              testID="table-sticky-original-column"
              render={renderColumn}
            >
              Sticky original column
            </TableColumn>
          </ColumnFixtureHeader>
          <CellFixtureBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.id}
                id={row.id}
                item={row}
                columns={columns}
                style={{ minHeight: 45 }}
                renderCell={() =>
                  index === 0 ? (
                    <Input
                      ref={editor}
                      testID="table-sticky-held-editor"
                      accessibilityLabel="Sticky held draft"
                      value={draft}
                      onChangeText={setDraft}
                    />
                  ) : (
                    `Sticky row ${index + 1}`
                  )
                }
              />
            ))}
          </CellFixtureBody>
        </Table>
        <View style={{ height: 100 }} />
      </ScrollView>
      <Text testID="table-sticky-ref-snapshot">{snapshot}</Text>
    </>
  )
}
