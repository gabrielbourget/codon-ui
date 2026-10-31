import { forwardRef } from "react"
import { Pressable, type PressableProps, type View } from "react-native"

import { useNativeTheme } from "../../theme"
import { nativeControlTarget, useNativeSelectionInteraction } from "../selection"

import type { TNativeCarouselDotVariant } from "./dotsModel"
import { NativeCarouselDotVisual } from "./NativeCarouselDotVisual"

type TNativeCarouselDotTargetProps = Readonly<{
  index: number
  isSelected: boolean
  isFocusable: boolean
  accessibilityLabel: string
  variant: TNativeCarouselDotVariant
  onActivate: (index: number) => void
  raised?: boolean
  focusVisible?: boolean
  onFocus?: PressableProps["onFocus"]
  onBlur?: PressableProps["onBlur"]
  onLayout?: PressableProps["onLayout"]
  testID?: string
}>

export const NativeCarouselDotTarget = forwardRef<View, TNativeCarouselDotTargetProps>(
  (
    {
      index,
      isSelected,
      isFocusable,
      accessibilityLabel,
      variant,
      onActivate,
      raised = false,
      focusVisible = false,
      onFocus,
      onBlur,
      onLayout,
      testID,
    },
    ref,
  ) => {
    const theme = useNativeTheme()
    const size = nativeControlTarget()
    const interaction = useNativeSelectionInteraction({ onFocus, onBlur }, false, false, () => {
      onActivate(index)
    })
    return (
      <Pressable
        {...interaction.handlers}
        ref={ref}
        testID={testID}
        accessible
        role="radio"
        accessibilityRole="radio"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: isSelected }}
        aria-checked={isSelected}
        focusable={isFocusable}
        onLayout={onLayout}
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.round,
          backgroundColor: "transparent",
          cursor: "pointer",
        }}
      >
        <NativeCarouselDotVisual
          variant={variant}
          raised={raised}
          focusVisible={focusVisible}
          testID={testID ? `${testID}-graphic` : undefined}
        />
      </Pressable>
    )
  },
)
NativeCarouselDotTarget.displayName = "NativeCarouselDotTarget"
