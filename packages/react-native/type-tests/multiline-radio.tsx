import { createRef } from "react"
import { Pressable, TextInput, View } from "react-native"

import {
  Radio,
  RadioGroup,
  type RadioProps,
  type RadioGroupProps,
  type TNativeRadioRef,
  type TNativeRadioGroupRef,
  TextArea,
  type TextAreaProps,
  type TNativeTextAreaRef,
} from "../src"

export const ValidTextAreaProps: TextAreaProps = {
  "aria-label": "Notes",
  defaultValue: "Bonjour\nHello",
  submitBehavior: "newline",
  onContentSizeChange: (event) => event.nativeEvent.contentSize.height,
  onSubmitEditing: (event) => event.nativeEvent.text,
  style: ({ defaultStyle, isFocused }) => [defaultStyle, { opacity: isFocused ? 1 : 0.9 }],
}
export const ValidTextArea = <TextArea {...ValidTextAreaProps} ref={createRef<TNativeTextAreaRef>()} />
// @ts-expect-error an accessible name is required; a placeholder is not a name
export const InvalidTextAreaName = <TextArea placeholder="Notes" />
// @ts-expect-error multiline is component-owned
export const InvalidTextAreaMultiline = <TextArea aria-label="Notes" multiline={false} />
// @ts-expect-error use the explicit submitBehavior contract
export const InvalidTextAreaBlur = <TextArea aria-label="Notes" blurOnSubmit />
// @ts-expect-error single-line clear-button mode is excluded
export const InvalidTextAreaClear = <TextArea aria-label="Notes" clearButtonMode="always" />
// @ts-expect-error secure text is a single-line contract
export const InvalidTextAreaSecure = <TextArea aria-label="Notes" secureTextEntry />
// @ts-expect-error native editing availability is owned
export const InvalidTextAreaEditable = <TextArea aria-label="Notes" editable />
// @ts-expect-error no CSS resize contract
export const InvalidTextAreaResize = <TextArea aria-label="Notes" resize="vertical" />
// @ts-expect-error native events do not expose DOM target values
export const InvalidTextAreaEvent = <TextArea aria-label="Notes" onChange={(event) => event.target.value} />

export const ValidRadioProps: RadioProps = {
  value: "",
  "aria-label": "Empty",
  customShapeStyles: { borderRadius: 0 },
  style: ({ defaultStyle, isSelected }) => [defaultStyle, { opacity: isSelected ? 1 : 0.8 }],
}
export const ValidRadioGroupProps: RadioGroupProps = {
  "aria-label": "Choices",
  value: null,
  onChange: (next) => next.toUpperCase(),
  orientation: "horizontal",
  style: ({ defaultStyle, value }) => [defaultStyle, { padding: value === null ? 1 : 2 }],
}
export const ValidRadios = (
  <RadioGroup {...ValidRadioGroupProps} ref={createRef<TNativeRadioGroupRef>()}>
    <Radio {...ValidRadioProps} ref={createRef<TNativeRadioRef>()} />
  </RadioGroup>
)
// @ts-expect-error Radio requires a stable string value
export const InvalidRadioValue = <Radio aria-label="Choice" />
// @ts-expect-error Radio requires an explicit name
export const InvalidRadioLabel = <Radio value="one">One</Radio>
// @ts-expect-error selection belongs to the group
export const InvalidRadioSelected = <Radio {...ValidRadioProps} isSelected />
// @ts-expect-error selection defaults belong to the group
export const InvalidRadioDefault = <Radio {...ValidRadioProps} defaultSelected />
// @ts-expect-error selection callbacks belong to the group
export const InvalidRadioChange = <Radio {...ValidRadioProps} onChange={() => {}} />
// @ts-expect-error disabled uses isDisabled
export const InvalidRadioDisabled = <Radio {...ValidRadioProps} disabled />
// @ts-expect-error member checked state is owned
export const InvalidRadioChecked = <Radio {...ValidRadioProps} aria-checked />
// @ts-expect-error member accessibility state cannot contradict selection
export const InvalidRadioState = <Radio {...ValidRadioProps} accessibilityState={{ checked: false }} />
// @ts-expect-error the native role is owned
export const InvalidRadioRole = <Radio {...ValidRadioProps} role="checkbox" />
// @ts-expect-error no React Aria state object
export const InvalidRadioChildrenState = <Radio {...ValidRadioProps}>{(state) => state.state}</Radio>
// @ts-expect-error explicit group name is required
export const InvalidRadioGroupName = <RadioGroup />
// @ts-expect-error members remain separate accessible targets
export const InvalidRadioGroupAccessible = <RadioGroup {...ValidRadioGroupProps} accessible />
// @ts-expect-error a radio group owns a single string or null
export const InvalidRadioGroupArray = <RadioGroup {...ValidRadioGroupProps} value={["one"]} />
// @ts-expect-error group role is owned
export const InvalidRadioGroupRole = <RadioGroup {...ValidRadioGroupProps} role="group" />
// @ts-expect-error group children render normally, without a render callback contract
export const InvalidRadioGroupChildren = <RadioGroup {...ValidRadioGroupProps}>{() => null}</RadioGroup>

export const RenderedRadioGroup = (
  <RadioGroup
    {...ValidRadioGroupProps}
    render={(props, state) => <View {...props} accessibilityHint={state.value ?? "empty"} />}
  />
)
export const InvalidRadioGroupDOMRenderer = (
  // @ts-expect-error The inherited renderer receives native View props and its actual View ref.
  <RadioGroup {...ValidRadioGroupProps} render={(_props: { ref: HTMLDivElement }) => <View />} />
)

export const RenderedTextArea = (
  <TextArea
    aria-label="Notes"
    render={(props, state) => <TextInput {...props} accessibilityHint={String(state.isInvalid)} />}
  />
)
export const InvalidTextAreaDOMRenderer = (
  // @ts-expect-error Public TextArea root rendering receives native TextInput props/ref.
  <TextArea aria-label="Notes" render={(_props: { ref: HTMLTextAreaElement }) => <TextInput />} />
)

export const RenderedRadio = (
  <Radio
    {...ValidRadioProps}
    render={(props, state) => <Pressable {...props} accessibilityHint={String(state.isSelected)} />}
  />
)
export const InvalidRadioDOMRenderer = (
  // @ts-expect-error The native radio renderer receives Pressable props and its original View ref.
  <Radio {...ValidRadioProps} render={(_props: { ref: HTMLLabelElement }) => <Pressable />} />
)
export const InvalidRadioRenderFocusVisible = (
  <Radio
    {...ValidRadioProps}
    render={(props, state) => {
      // @ts-expect-error The original approved native radio state has no React Aria focus-visible flag.
      void state.isFocusVisible
      return <Pressable {...props} />
    }}
  />
)
