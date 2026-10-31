import { createRef } from "react"
import type { View } from "react-native"

import { NativeFocusView } from "../../../input/NativeFocusView"
import { TableRow } from "../TableRow"
import type { TNativeTableRowRenderState } from "../types"

const item = { name: "Alpha" }
const props = { item, columns: [{ id: "name", name: "Name" }] }
export const privateRowCalls = [
  <TableRow
    {...props}
    ref={createRef<View>()}
    ariaDescribedBy={["note"]}
    data-testid="row"
    render={(host, values: TNativeTableRowRenderState) => (
      <NativeFocusView {...host} style={[host.style, { opacity: values.isSelected ? 1 : 0.5 }]} />
    )}
    onPress={(event) => event.preventDefault()}
    onHoverStart={(event) => event.persist()}
    onKeyDown={(event) => event.nativeEvent.key}
  />,
  // @ts-expect-error Canonical wrapper style is plain, not a raw Row state function.
  <TableRow {...props} style={(values: TNativeTableRowRenderState) => ({ opacity: values.isSelected ? 1 : 0.5 })} />,
  // @ts-expect-error Row has no authored replacement children in the canonical wrapper.
  <TableRow {...props}>Replacement</TableRow>,
  // @ts-expect-error No new public native motion interface is advertised by TableRow.
  <TableRow {...props} animate={{ opacity: 0.5 }} />,
  // @ts-expect-error Native styles use logical dimensions.
  <TableRow {...props} style={{ width: "20px" }} />,
]

export const rejectDefaultChildren = (values: TNativeTableRowRenderState) => {
  // @ts-expect-error Raw row values never include defaultChildren.
  return values.defaultChildren
}
