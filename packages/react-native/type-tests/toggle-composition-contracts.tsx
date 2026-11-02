import { createRef, type ComponentProps } from "react"
import { PlatformColor, View } from "react-native"

import { SelectionIndicator } from "../src/components/SelectionIndicator/SelectionIndicator"
import { SharedElementTransition } from "../src/components/SharedElementTransition/SharedElementTransition"
import { NativeToggleButtonGroupKeyboardScope } from "../src/components/ToggleButtonGroup/NativeToggleButtonGroupKeyboardScope"
import { ToggleButtonGroup } from "../src/components/ToggleButtonGroup/ToggleButtonGroup"
import { NativeFocusHost, NativeFocusView } from "../src/input/NativeFocusView"

export const GroupComposition = (
  <ToggleButtonGroup
    ref={createRef<View>()}
    slot="items"
    selectedKeys={[0, "0", ""]}
    selectionMode="multiple"
    orientation="vertical"
    disallowEmptySelection
    onSelectionChange={(keys) => keys.has(0)}
    style={({ state, defaultStyle }) => [defaultStyle, { opacity: state.isDisabled ? 0.5 : 1 }]}
    render={(props, state) => <NativeFocusHost {...props} testID={state.orientation} />}
  />
)
export const IndicatorComposition = (
  <SharedElementTransition>
    <SelectionIndicator
      ref={createRef<View>()}
      slot={null}
      isSelected
      transitionProperties={["opacity", "translate", "color"]}
      transition={{ duration: 0.2 }}
      customStyles={{ color: PlatformColor("systemBlueColor") }}
      style={({ isEntering, defaultStyle }) => [defaultStyle, { opacity: isEntering ? 0 : 1 }]}
      render={(props, state) => <NativeFocusHost {...props} testID={String(state.isExiting)} />}
    >
      {({ isExiting }) => String(isExiting)}
    </SelectionIndicator>
  </SharedElementTransition>
)
// @ts-expect-error Group selection keys retain only string and numeric identities.
export const InvalidGroupKeys = <ToggleButtonGroup selectedKeys={[true]} />
// @ts-expect-error Group orientation uses the approved finite contract.
export const InvalidGroupOrientation = <ToggleButtonGroup orientation="diagonal" />
// @ts-expect-error Selection mode does not add a none mode.
export const InvalidGroupMode = <ToggleButtonGroup selectionMode="none" />
// @ts-expect-error The group owns its native role.
export const InvalidGroupRole = <ToggleButtonGroup role="button" />
// @ts-expect-error Read-only is not a canonical ToggleButtonGroup axis.
export const InvalidGroupReadOnly = <ToggleButtonGroup isReadOnly />
// @ts-expect-error Native transition properties use native style keys plus explicit translate/all/none.
export const InvalidIndicatorProperty = <SelectionIndicator transitionProperties={["css-custom-property"]} />
// @ts-expect-error Native indicators do not expose DOM refs.
export const InvalidIndicatorRef = <SelectionIndicator ref={createRef<{ tagName: string }>()} />
// @ts-expect-error Native indicator slots are named strings or null.
export const InvalidIndicatorSlot = <SelectionIndicator slot={0} />
// @ts-expect-error Enter/exit flags are observations, not caller-controlled state.
export const InvalidIndicatorEntering = <SelectionIndicator isEntering />
// @ts-expect-error The shared transition scope is headless and has no host style.
export const InvalidScopeHost = <SharedElementTransition style={{ opacity: 0 }} />

const originalContainer = createRef<View>()
export const GroupKeyboardScope = (
  <NativeToggleButtonGroupKeyboardScope
    containerRef={originalContainer}
    onKeyDownCapture={(event) => {
      event.preventDefault()
      event.target.measure(() => {})
    }}
    onKeyUp={(event) => event.currentTarget.measure(() => {})}
  >
    {(listenerProps) => (
      <View {...listenerProps} ref={originalContainer}>
        <ToggleButtonGroup />
      </View>
    )}
  </NativeToggleButtonGroupKeyboardScope>
)
// @ts-expect-error The headless scope forwards props to an original native container, not a DOM node.
export const InvalidKeyboardScopeRef: ComponentProps<typeof NativeToggleButtonGroupKeyboardScope>["containerRef"] =
  createRef<HTMLDivElement>()
// @ts-expect-error The helper's child must explicitly forward its returned listener props.
export const InvalidKeyboardScopeChild: ComponentProps<typeof NativeToggleButtonGroupKeyboardScope>["children"] = (
  <View />
)

// @ts-expect-error Generic public focus primitives do not acquire ancestor key-capture callbacks.
export const InvalidGenericKeyCapture = <NativeFocusView onKeyDownCapture={() => undefined} />
// @ts-expect-error Raw Fabric capture bags remain private outside the approved group helper.
export const InvalidGenericRawCapture = <NativeFocusView onNativeOrdinaryEditorKeyCapture={() => undefined} />
