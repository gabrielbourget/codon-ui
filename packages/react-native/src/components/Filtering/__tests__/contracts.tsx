import { createRef } from "react"
import type { View } from "react-native"

import { SelectFilterArgument, MultiSelectFilterArgument, type TSelectFilterArgumentProps } from "../OptionArguments"

const props: TSelectFilterArgumentProps = {
  availableFilterArguments: [{ id: "", name: "Zero", argumentValue: 0 }],
  argument: false,
  filterArgumentSelectedKey: null,
  closeLabel: "Close",
  onArgumentChange: () => {},
}
export const privateFilterOptionContracts = [
  <SelectFilterArgument {...props} ref={createRef<View>()} />,
  <MultiSelectFilterArgument {...props} labels={undefined} argument={[0]} inputLabel="Find" ref={createRef<View>()} />,
  // @ts-expect-error The controlled argument wrapper has no default-selection mirror.
  <SelectFilterArgument {...props} defaultValue="" />,
  // @ts-expect-error Native style slots accept logical dimensions, not CSS pixel lengths.
  <SelectFilterArgument {...props} customInputStyles={{ width: "20px" }} />,
  // @ts-expect-error Current metadata IDs remain strings.
  <SelectFilterArgument {...props} availableFilterArguments={[{ id: 0, name: "Zero" }]} />,
]
