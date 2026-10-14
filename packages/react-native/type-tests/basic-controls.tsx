import { createRef } from "react"

import { Checkbox, CheckboxGroup, Switch, type SwitchProps, type TNativeSwitchRef } from "../src"

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
  <CheckboxGroup value={["one"]} onChange={(values) => values.includes("one")}>
    <Checkbox value="one" isIndeterminate>
      {({ isSelected }) => <>Selected {isSelected ? 1 : 0}</>}
    </Checkbox>
  </CheckboxGroup>
)
// @ts-expect-error group selection uses string member values
export const InvalidGroupValue = <CheckboxGroup value={[1]} />
// @ts-expect-error the group must keep descendants individually accessible
export const InvalidGroupAccessible = <CheckboxGroup accessible />
// @ts-expect-error Checkbox owns checked state
export const InvalidCheckboxState = <Checkbox accessibilityState={{ checked: "mixed" }} />
// @ts-expect-error no DOM form submission contract
export const InvalidCheckboxName = <Checkbox name="selection" />
// @ts-expect-error native visual dimensions are numeric
export const InvalidCheckboxWidth = <Checkbox width="20px" />
// @ts-expect-error no React Aria state object is exposed
export const InvalidCheckboxRenderState = <Checkbox>{(state) => state.state}</Checkbox>
