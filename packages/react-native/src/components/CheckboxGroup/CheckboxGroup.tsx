import { forwardRef } from "react"
import { View, type ViewStyle } from "react-native"

import { useControlledState } from "../../collection/state/useControlledState"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"

import { NativeCheckboxGroupContext } from "./context"
import type { TNativeCheckboxGroupProps, TNativeCheckboxGroupRef } from "./types"

export const CheckboxGroup = forwardRef<TNativeCheckboxGroupRef, TNativeCheckboxGroupProps>(
  (
    {
      children,
      render,
      value,
      defaultValue = [],
      onChange,
      isDisabled = false,
      isReadOnly = false,
      orientation = "vertical",
      customStyles,
      style,
      testID,
      accessibilityLabel,
      "data-testid": aliasTestID,
      "aria-label": aliasLabel,
      ...rest
    },
    ref,
  ) => {
    const theme = useNativeTheme()
    const [selected, setSelected] = useControlledState<readonly string[], string[]>(value, [...defaultValue], onChange)
    const custom = resolveNativeStyle(customStyles, "CheckboxGroup", "customStyles")
    const baseline: ViewStyle = {
      flexDirection: orientation === "horizontal" ? "row" : "column",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.unit * 2,
      ...custom,
    }
    const resolved = resolveNativeStyle(
      [
        baseline,
        resolveNativeStyle(
          typeof style === "function"
            ? style({ value: selected, isDisabled, isReadOnly, defaultStyle: baseline })
            : style,
          "CheckboxGroup",
          "style",
        ),
      ],
      "CheckboxGroup",
      "resolvedStyle",
    )
    const state = { value: selected, isDisabled, isReadOnly }
    const renderedChildren =
      typeof children === "function" ? children({ ...state, defaultChildren: undefined }) : children
    const element = (
      <View
        {...rest}
        ref={ref}
        accessible={false}
        testID={testID ?? aliasTestID ?? "checkbox-group"}
        accessibilityLabel={accessibilityLabel ?? aliasLabel}
        style={resolved}
      >
        {getNativeButtonContent(renderedChildren)}
      </View>
    )
    return (
      <NativeCheckboxGroupContext.Provider
        value={{
          value: selected,
          isDisabled,
          isReadOnly,
          change: (member, nextSelected) => {
            if (isDisabled || isReadOnly) return
            const next = nextSelected
              ? selected.includes(member)
                ? [...selected]
                : [...selected, member]
              : selected.filter((entry) => entry !== member)
            setSelected(next)
          },
        }}
      >
        {render ? render(element.props, state) : element}
      </NativeCheckboxGroupContext.Provider>
    )
  },
)
CheckboxGroup.displayName = "CheckboxGroup"
