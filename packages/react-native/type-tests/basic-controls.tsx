import { createRef } from "react"

import { Switch, type SwitchProps, type TNativeSwitchRef } from "../src"

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
