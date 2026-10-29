import { forwardRef } from "react"
import { View, type ViewStyle } from "react-native"

import { useControlledState } from "../../collection/state/useControlledState"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"

import { NativeRadioGroupContext } from "./context"
import type { TNativeRadioGroupProps, TNativeRadioGroupRef } from "./types"

export const RadioGroup = forwardRef<TNativeRadioGroupRef, TNativeRadioGroupProps>(
  (
    {
      children,
      value,
      defaultValue = null,
      onChange,
      isDisabled = false,
      isReadOnly = false,
      orientation = "vertical",
      customStyles,
      style,
      testID,
      accessibilityLabel,
      accessibilityState,
      "data-testid": aliasTestID,
      "aria-label": aliasLabel,
      ...rest
    },
    ref,
  ) => {
    const label = accessibilityLabel ?? aliasLabel
    if (typeof label !== "string" || !label.trim())
      throw new TypeError("RadioGroup: a nonempty accessibilityLabel or aria-label is required")
    const theme = useNativeTheme()
    const [selected, setSelected] = useControlledState<string | null, string>(value, defaultValue, onChange)
    const custom = resolveNativeStyle(customStyles, "RadioGroup", "customStyles")
    const baseline: ViewStyle = {
      flexDirection: orientation === "horizontal" ? "row" : "column",
      alignItems: "flex-start",
      flexWrap: "wrap",
      gap: theme.spacing.unit * 2,
      ...custom,
    }
    const resolved = resolveNativeStyle(
      [
        baseline,
        typeof style === "function"
          ? style({ value: selected, isDisabled, isReadOnly, defaultStyle: baseline })
          : style,
      ],
      "RadioGroup",
      "style",
    )
    return (
      <NativeRadioGroupContext.Provider
        value={{
          value: selected,
          isDisabled,
          isReadOnly,
          change: (member) => {
            if (isDisabled || isReadOnly || member === selected) return
            setSelected(member)
          },
        }}
      >
        <View
          {...rest}
          ref={ref}
          accessible={false}
          role="radiogroup"
          accessibilityRole="radiogroup"
          accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
          aria-disabled={isDisabled}
          testID={testID ?? aliasTestID ?? "radio-group"}
          accessibilityLabel={label}
          style={resolved}
        >
          {children}
        </View>
      </NativeRadioGroupContext.Provider>
    )
  },
)
RadioGroup.displayName = "RadioGroup"
