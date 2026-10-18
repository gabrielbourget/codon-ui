import { forwardRef } from "react"

import { useNativeTheme } from "../../../../theme"
import { Text } from "../../Text"

import type { TNativePlaceholderTextProps, TNativePlaceholderTextRef } from "./types"

export const PlaceholderText = forwardRef<TNativePlaceholderTextRef, TNativePlaceholderTextProps>(
  ({ align = "left", customStyles, testID, "data-testid": aliasTestID, ...rest }, ref) => {
    const theme = useNativeTheme()
    return (
      <Text
        {...rest}
        ref={ref}
        variant="b11"
        fontStyle="italic"
        color={theme.colors.controlPlaceholder}
        customStyles={[{ textAlign: align }, customStyles]}
        testID={testID ?? aliasTestID ?? "placeholder-text"}
      />
    )
  },
)
PlaceholderText.displayName = "PlaceholderText"
