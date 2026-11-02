import { forwardRef, useRef } from "react"
import { View, type ViewStyle } from "react-native"

import { useNativeCollectionRefs, useNativeContextProps } from "../../collection/context"
import { useNativeToggleGroupNavigation } from "../../input/NativeKeyboardScope"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { SharedElementTransition } from "../SharedElementTransition/SharedElementTransition"

import { NativeToggleButtonGroupContext, NativeToggleButtonGroupStateContext } from "./context"
import { useNativeToggleGroupState } from "./state"
import {
  NATIVE_TOGGLE_GROUP_ORIENTATIONS,
  type TNativeToggleButtonGroupProps,
  type TNativeToggleButtonGroupRef,
} from "./types"

export const ToggleButtonGroup = forwardRef<TNativeToggleButtonGroupRef, TNativeToggleButtonGroupProps>(
  (ownProps, forwardedRef) => {
    const [props, ref] = useNativeContextProps(ownProps, forwardedRef, NativeToggleButtonGroupContext)
    const {
      children,
      render,
      slot: _slot,
      orientation = "horizontal",
      selectionMode,
      selectedKeys,
      defaultSelectedKeys,
      onSelectionChange,
      disallowEmptySelection,
      isDisabled,
      customStyles,
      style,
      testID,
      "data-testid": aliasID,
      accessibilityLabel,
      "aria-label": aliasLabel,
      ...rest
    } = props
    if (!NATIVE_TOGGLE_GROUP_ORIENTATIONS.includes(orientation))
      throw new TypeError("ToggleButtonGroup: unsupported orientation")
    const state = useNativeToggleGroupState({
      selectionMode,
      selectedKeys,
      defaultSelectedKeys,
      onSelectionChange,
      disallowEmptySelection,
      isDisabled,
    })
    const root = useRef<TNativeToggleButtonGroupRef>(null)
    const rootRef = useNativeCollectionRefs(ref, root)
    const navigation = useNativeToggleGroupNavigation({ rootRef: root, orientation })
    if (navigation.error) throw new Error(`ToggleButtonGroup: ${navigation.error}`)
    const values = { orientation, isDisabled: state.isDisabled, state }
    const baseline: ViewStyle = {
      flexDirection: "row",
      flexWrap: "wrap",
      ...resolveNativeStyle(customStyles, "ToggleButtonGroup", "customStyles"),
    }
    const resolved = resolveNativeStyle(
      [baseline, typeof style === "function" ? style({ ...values, defaultStyle: baseline }) : style],
      "ToggleButtonGroup",
      "style",
    )
    const content = typeof children === "function" ? children({ ...values, defaultChildren: undefined }) : children
    const element = (
      <View
        {...rest}
        {...navigation.listenerProps}
        ref={rootRef}
        accessible={false}
        role={navigation.nestedToolbar ? "group" : "toolbar"}
        aria-orientation={orientation}
        aria-disabled={state.isDisabled}
        accessibilityLabel={accessibilityLabel ?? aliasLabel}
        testID={testID ?? aliasID ?? "toggle-button-group"}
        style={resolved}
      >
        {getNativeButtonContent(content)}
      </View>
    )
    return (
      <NativeToggleButtonGroupStateContext.Provider value={state}>
        <SharedElementTransition>{render ? render(element.props, values) : element}</SharedElementTransition>
      </NativeToggleButtonGroupStateContext.Provider>
    )
  },
)
ToggleButtonGroup.displayName = "ToggleButtonGroup"
