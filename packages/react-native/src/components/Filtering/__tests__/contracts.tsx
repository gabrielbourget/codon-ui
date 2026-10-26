import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { BooleanFilterArgument } from "../BooleanArgument"
import { ComboBoxFilterArgument } from "../ComboBoxArgument"
import { DynamicFilterArgumentInput } from "../DynamicFilterArgumentInput"
import { ListFilterArgument } from "../ListArgument"
import { NumberFilterArgument } from "../NumberArgument"
import { SelectFilterArgument, MultiSelectFilterArgument, type TSelectFilterArgumentProps } from "../OptionArguments"
import { RangeFilterArgument } from "../RangeArgument"
import {
  renderNonTemporalFilterArgumentInput,
  type TNonTemporalFilterArgumentContext,
} from "../renderNonTemporalArgument"
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

export const nativeDispatchContext: TNonTemporalFilterArgumentContext = {
  dataType: "text",
  filterArgumentType: "Input",
  argument: undefined,
  onArgumentChange: () => {},
  nativeLabels: {
    number: { incrementLabel: "Increase", decrementLabel: "Decrease" },
    range: {
      minimumIncrement: "More min",
      minimumDecrement: "Less min",
      maximumIncrement: "More max",
      maximumDecrement: "Less max",
    },
    options: { inputLabel: "Find", closeLabel: "Close" },
  },
}
export const privateDispatchContract = renderNonTemporalFilterArgumentInput(nativeDispatchContext)
// @ts-expect-error Temporal editor APIs remain outside this named private renderer.
export const temporalDispatch = renderNonTemporalFilterArgumentInput({ ...nativeDispatchContext, dataType: "date" })
// @ts-expect-error Root DOM and generic motion props are not advertised by a renderer function.
export const rootDispatch = renderNonTemporalFilterArgumentInput({ ...nativeDispatchContext, role: "group" })
// @ts-expect-error The dispatcher owns no default-value mirror.
export const defaultDispatch = renderNonTemporalFilterArgumentInput({ ...nativeDispatchContext, defaultValue: "" })
// @ts-expect-error Native editor name contracts are required.
export const unnamedDispatch = renderNonTemporalFilterArgumentInput({ ...nativeDispatchContext, nativeLabels: {} })

export const privateArgumentRootContracts = [
  <DynamicFilterArgumentInput
    {...nativeDispatchContext}
    ref={createRef<View>()}
    role="group"
    ariaLabel="Argument"
    ariaDescribedBy="hint"
  />,
  <DynamicFilterArgumentInput
    {...nativeDispatchContext}
    filterArgumentType="Multi Input"
    argument={["entry", 0, undefined]}
    customStyles={{ width: "80%", height: 0 }}
  />,
  // @ts-expect-error The argument root never owns an uncontrolled argument mirror.
  <DynamicFilterArgumentInput {...nativeDispatchContext} defaultValue="local" />,
  // @ts-expect-error The wrapper owns its argument child.
  <DynamicFilterArgumentInput {...nativeDispatchContext}>Replacement</DynamicFilterArgumentInput>,
  // @ts-expect-error Native root styles reject browser lengths.
  <DynamicFilterArgumentInput {...nativeDispatchContext} customStyles={{ width: "20px" }} />,
]
