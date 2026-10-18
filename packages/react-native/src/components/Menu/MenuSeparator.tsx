import { View } from "react-native"

import { useNativeTheme } from "../../theme"

import { getNativeMenuSeparatorStyle } from "./styles"
import type { TNativeMenuSeparatorProps } from "./types"

export const MenuSeparator = (props: TNativeMenuSeparatorProps) => {
  const { customStyles: _custom, style: _style, testID, "data-testid": aliasTestID, ...native } = props
  const theme = useNativeTheme()
  return (
    <View
      {...native}
      testID={testID ?? aliasTestID ?? "menu-separator"}
      role="separator"
      accessible={false}
      focusable={false}
      style={getNativeMenuSeparatorStyle(theme, props)}
    />
  )
}
