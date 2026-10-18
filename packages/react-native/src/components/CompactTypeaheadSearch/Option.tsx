import { useState, type ReactNode } from "react"

import { NativePressable } from "../../input/NativePressable"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"

export const NativeCompactOption = ({
  identity,
  text,
  selected,
  active,
  disabled,
  readOnly,
  onSelect,
  children,
}: {
  identity: string
  text: string
  selected: boolean
  active: boolean
  disabled: boolean
  readOnly?: boolean
  onSelect: () => void
  children: ReactNode
}) => {
  const theme = useNativeTheme()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  return (
    <NativePressable
      testID={identity}
      role="radio"
      accessibilityRole="radio"
      accessibilityLabel={text}
      disabled={disabled}
      activationBlocked={readOnly}
      pointerEvents={disabled ? "none" : "auto"}
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        minHeight: 20,
        padding: theme.spacing.unit,
        borderRadius: theme.radius.rounded,
        alignItems: "center",
        flexDirection: "row",
        opacity: disabled ? theme.opacity.disabled : 1,
        backgroundColor: hovered || focused || active || selected ? theme.colors.controlHoverBackground : "transparent",
      }}
    >
      {getNativeButtonContent(children)}
    </NativePressable>
  )
}
