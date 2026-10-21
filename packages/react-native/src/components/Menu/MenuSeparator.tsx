import { forwardRef } from "react"
import { View } from "react-native"

import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { useNativeContextProps } from "../../collection/context"
import { useNativeTheme } from "../../theme"

import { NativeMenuSeparatorContext } from "./context"
import { getNativeMenuSeparatorStyle } from "./styles"
import type { TNativeMenuSeparatorProps } from "./types"

const MenuSeparatorReceiver = forwardRef<View, TNativeMenuSeparatorProps>((authoredProps, forwardedRef) => {
  const [props, ref] = useNativeContextProps(authoredProps, forwardedRef, NativeMenuSeparatorContext)
  const {
    render,
    slot: _slot,
    customStyles: _custom,
    style: _style,
    testID,
    "data-testid": aliasTestID,
    ...native
  } = props
  const theme = useNativeTheme()
  const hostProps = {
    ...native,
    ref,
    testID: testID ?? aliasTestID ?? "menu-separator",
    role: "separator" as const,
    accessible: false,
    focusable: false,
    style: getNativeMenuSeparatorStyle(theme, props),
  }
  return render ? render(hostProps, undefined) : <View {...hostProps} />
})

export const MenuSeparator = createNativeCollectionLeaf<unknown, TNativeMenuSeparatorProps, View>(
  "separator",
  (props, ref, _node) => <MenuSeparatorReceiver {...props} ref={ref} />,
)
