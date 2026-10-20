import { useCallback, useContext } from "react"
import type { View } from "react-native"

import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs } from "../../collection/context"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeMenuActionsContext, NativeMenuHeaderContext } from "./context"
import type { TNativeMenuHeaderProps } from "./types"

export const MenuHeader = createNativeCollectionLeaf<unknown, TNativeMenuHeaderProps, View>(
  "header",
  (props, ref, _node) => {
    const context = useContext(NativeMenuHeaderContext)
    const actions = useContext(NativeMenuActionsContext)
    const nativeID = props.nativeID ?? props.id ?? context?.nativeID
    const parentRef = context?.ref
    const headerRef = useCallback((target: View | null) => parentRef?.(target, nativeID!), [parentRef, nativeID])
    const mergedRef = useNativeCollectionRefs(ref, headerRef)
    const { children, style, ...native } = props
    const styles = splitNativeTextStyle(resolveNativeStyle(style, "MenuHeader", "style"))
    return (
      <NativeFocusHost
        {...native}
        ref={mergedRef}
        nativeID={nativeID}
        accessible={false}
        focusable={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.view}
      >
        {getNativeButtonContent(children, { ...actions?.text, ...styles.text })}
      </NativeFocusHost>
    )
  },
)
