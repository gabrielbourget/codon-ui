import { createRef } from "react"
import { Pressable, TextInput, View } from "react-native"

import {
  Checkbox,
  CheckboxGroup,
  Input,
  Switch,
  type SwitchProps,
  type TNativeSwitchRef,
  type TNativeInputRef,
  type TNativeCheckboxGroupRef,
} from "../src"

const switchProps: SwitchProps = {
  isSelected: true,
  onChange: (selected) => selected,
  customTrackStyles: { width: 80 },
  style: ({ defaultStyle, isSelected }) => [defaultStyle, { opacity: isSelected ? 1 : 0.5 }],
}
export const ValidSwitch = <Switch {...switchProps} ref={createRef<TNativeSwitchRef>()} />
// @ts-expect-error native visual dimensions exclude CSS units
export const InvalidSwitchDimension = <Switch width="30px" />
// @ts-expect-error selected state is component-owned
export const InvalidSwitchChecked = <Switch aria-checked={false} />
// @ts-expect-error native controls do not accept DOM classes
export const InvalidSwitchClass = <Switch className="switch" />
// @ts-expect-error children are not a Switch label contract
export const InvalidSwitchChildren = <Switch>Label</Switch>
// @ts-expect-error disabled uses the Codon state prop
export const InvalidSwitchDisabled = <Switch disabled />

export const ValidCheckboxGroup = (
  <CheckboxGroup
    ref={createRef<TNativeCheckboxGroupRef>()}
    value={["one"]}
    onChange={(values) => values.includes("one")}
  >
    <Checkbox value="one" isIndeterminate>
      {({ isSelected }) => <>Selected {isSelected ? 1 : 0}</>}
    </Checkbox>
  </CheckboxGroup>
)
// @ts-expect-error group selection uses string member values
export const InvalidGroupValue = <CheckboxGroup value={[1]} />
// @ts-expect-error the group must keep descendants individually accessible
export const InvalidGroupAccessible = <CheckboxGroup accessible />
// @ts-expect-error The group ref receives the original native View.
export const InvalidGroupRef = <CheckboxGroup ref={createRef<{ tagName: string }>()} />
export const RenderedGroup = (
  <CheckboxGroup render={(props, state) => <View {...props} accessibilityHint={String(state.isReadOnly)} />}>
    {(state) => {
      // @ts-expect-error The approved native group does not expose the React Aria state object.
      void state.state
      return <Checkbox value="one">{state.value.length}</Checkbox>
    }}
  </CheckboxGroup>
)
export const InvalidGroupDOMRenderer = (
  // @ts-expect-error A native root renderer receives View props and its actual native ref.
  <CheckboxGroup render={(_props: { ref: HTMLDivElement }) => <View />} />
)
// @ts-expect-error Checkbox owns checked state
export const InvalidCheckboxState = <Checkbox accessibilityState={{ checked: "mixed" }} />
// @ts-expect-error no DOM form submission contract
export const InvalidCheckboxName = <Checkbox name="selection" />
// @ts-expect-error native visual dimensions are numeric
export const InvalidCheckboxWidth = <Checkbox width="20px" />
// @ts-expect-error no React Aria state object is exposed
export const InvalidCheckboxRenderState = <Checkbox>{(state) => state.state}</Checkbox>

export const ValidInput = (
  <Input
    ref={createRef<TNativeInputRef>()}
    value="value"
    onChangeText={(text) => text.toUpperCase()}
    onChange={(event) => event.nativeEvent.text}
    isReadOnly
    style={({ defaultStyle, isInvalid }) => [defaultStyle, { color: isInvalid ? "red" : "black" }]}
  />
)
// @ts-expect-error Input uses isReadOnly rather than a conflicting native alias
export const InvalidInputReadOnly = <Input readOnly />
// @ts-expect-error Input owns native editing availability
export const InvalidInputEditable = <Input editable />
// @ts-expect-error TextArea is a separate counterpart
export const InvalidInputMultiline = <Input multiline />
// @ts-expect-error no DOM input types
export const InvalidInputType = <Input type="email" />
// @ts-expect-error native events are not DOM targets
export const InvalidInputChange = <Input onChange={(event) => event.target.value} />
// @ts-expect-error TextInput does not promise a native hover style flag
export const InvalidInputHover = <Input style={(state) => ({ opacity: state.isHovered ? 1 : 0.5 })} />

export const RenderedInput = (
  <Input render={(props, state) => <TextInput {...props} accessibilityHint={String(state.isReadOnly)} />} />
)
export const InvalidInputDOMRenderer = (
  // @ts-expect-error Public Input root rendering receives native TextInput props/ref.
  <Input render={(_props: { ref: HTMLInputElement }) => <TextInput />} />
)
// @ts-expect-error The animation switch belongs to the private native editor adapter.
export const InvalidInputAnimationSwitch = <Input nativeAnimate={false} />

export const RenderedCheckbox = (
  <Checkbox render={(props, state) => <Pressable {...props} accessibilityHint={String(state.isIndeterminate)} />} />
)
export const InvalidCheckboxDOMRenderer = (
  // @ts-expect-error Checkbox root rendering receives native Pressable props/ref.
  <Checkbox render={(_props: { ref: HTMLLabelElement }) => <Pressable />} />
)
export const InvalidCheckboxRenderValidation = (
  <Checkbox
    render={(props, state) => {
      // @ts-expect-error The original native checkbox state has no DOM validation state.
      void state.isInvalid
      return <Pressable {...props} />
    }}
  />
)

export const RenderedSwitch = (
  <Switch render={(props, state) => <Pressable {...props} accessibilityHint={String(state.isSelected)} />} />
)
export const InvalidSwitchDOMRenderer = (
  // @ts-expect-error Native Switch rendering receives original Pressable props and a View ref.
  <Switch render={(_props: { ref: HTMLLabelElement }) => <Pressable />} />
)
export const InvalidSwitchRendererFocusVisible = (
  <Switch
    render={(props, state) => {
      // @ts-expect-error The original native switch state has no React Aria focus-visible promise.
      void state.isFocusVisible
      return <Pressable {...props} />
    }}
  />
)

export const CheckboxForeground = (
  <Checkbox customStyles={{ color: "#123456" }} style={({ defaultStyle }) => ({ ...defaultStyle, color: "#abcdef" })}>
    Native foreground
  </Checkbox>
)
