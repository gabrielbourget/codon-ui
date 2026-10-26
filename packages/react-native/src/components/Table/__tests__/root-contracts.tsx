import { createRef } from "react"
import type { View } from "react-native"

import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeTablePropsContext } from "../context"
import { Table } from "../Table"

const root = createRef<View>()
export const tableRootCalls = [
  <Table ariaDescribedBy={["note"]} ariaDetails="detail" aria-labelledby="label-one label-two" data-testid="table" />,
  <Table
    ref={root}
    slot="people"
    render={(props, values) => {
      values.state.sort(0, "descending")
      return <NativeFocusView {...props} style={[props.style, { opacity: values.isFocused ? 1 : 0.5 }]} />
    }}
  />,
  <NativeTablePropsContext.Provider
    value={{
      ref: root,
      style: (values) => ({ ...values.defaultStyle, opacity: values.isFocusVisible ? 1 : 0.5 }),
      sortDescriptor: { column: 0, direction: "descending" },
      onRowAction: (key) => String(key),
    }}
  />,
  <NativeTablePropsContext.Provider
    value={{ slots: { [NATIVE_DEFAULT_SLOT]: { selectionMode: "multiple" }, people: { id: "people", ref: root } } }}
  />,
  // @ts-expect-error The canonical wrapper owns sorting through query controls.
  <Table sortDescriptor={{ column: "name", direction: "ascending" }} />,
  // @ts-expect-error The canonical wrapper's own style remains an object/array rather than a render callback.
  <Table style={(values) => ({ opacity: values.isFocused ? 1 : 0.5 })} />,
  // @ts-expect-error Wrapper-specific column metadata does not belong to the inherited raw context.
  <NativeTablePropsContext.Provider value={{ columns: [] }} />,
  // @ts-expect-error Root render state contains the full real Table state.
  <Table render={(_props, values) => <NativeFocusView role={values.state.fakeRole} />} />,
]
