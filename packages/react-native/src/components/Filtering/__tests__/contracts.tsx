import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { BooleanFilterArgument } from "../BooleanArgument"
import { ComboBoxFilterArgument } from "../ComboBoxArgument"
import { ListFilterArgument } from "../ListArgument"
import { NumberFilterArgument } from "../NumberArgument"
import { SelectFilterArgument, MultiSelectFilterArgument, type TSelectFilterArgumentProps } from "../OptionArguments"
import { RangeFilterArgument } from "../RangeArgument"
import { TextFilterArgument } from "../TextArgument"

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

export const privateFilterEditorContracts = [
  <TextFilterArgument ref={createRef<TextInput>()} argument={undefined} onArgumentChange={() => {}} />,
  <NumberFilterArgument
    ref={createRef<TextInput>()}
    incrementLabel="Increase"
    decrementLabel="Decrease"
    onArgumentChange={() => {}}
  />,
  <BooleanFilterArgument ref={createRef<View>()} booleanArgumentComponent="Checkbox" onArgumentChange={() => {}} />,
  <ListFilterArgument argument={["edited", 0, undefined, null]} onArgumentChange={() => {}} />,
  <RangeFilterArgument
    dataType="text"
    argument={[undefined, "upper"]}
    numberLabels={{
      minimumIncrement: "More min",
      minimumDecrement: "Less min",
      maximumIncrement: "More max",
      maximumDecrement: "Less max",
    }}
    onArgumentChange={() => {}}
  />,
  <ComboBoxFilterArgument inputLabel="Find" closeLabel="Close" onArgumentChange={() => {}} />,
  // @ts-expect-error Argument wrappers have no default-value state.
  <TextFilterArgument defaultValue="" onArgumentChange={() => {}} />,
  // @ts-expect-error Boolean array entries are outside the draft contract.
  <ListFilterArgument argument={[false]} onArgumentChange={() => {}} />,
  // @ts-expect-error Numeric steppers require explicit native accessible names.
  <NumberFilterArgument onArgumentChange={() => {}} />,
  // @ts-expect-error Temporal range policy is not received by this private renderer.
  <RangeFilterArgument dataType="date" onArgumentChange={() => {}} />,
]
