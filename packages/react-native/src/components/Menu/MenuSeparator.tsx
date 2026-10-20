import { forwardRef } from "react"
import { View } from "react-native"

import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { useNativeTheme } from "../../theme"

import { getNativeMenuSeparatorStyle } from "./styles"
import type { TNativeMenuSeparatorProps } from "./types"

const MenuSeparatorReceiver = forwardRef<View, TNativeMenuSeparatorProps>((props, ref) => {
  const { customStyles: _custom, style: _style, testID, "data-testid": aliasTestID, ...native } = props
  const theme = useNativeTheme()
  return (
    <View
      {...native}
      ref={ref}
      testID={testID ?? aliasTestID ?? "menu-separator"}
      role="separator"
      accessible={false}
      focusable={false}
      style={getNativeMenuSeparatorStyle(theme, props)}
    />
  )
})

export const MenuSeparator = createNativeCollectionLeaf<unknown, TNativeMenuSeparatorProps, View>(
  "separator",
  (props, ref, _node) => <MenuSeparatorReceiver {...props} ref={ref} />,
)
