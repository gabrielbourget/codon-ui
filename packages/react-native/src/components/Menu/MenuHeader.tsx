import { useCallback, useContext, useInsertionEffect, useLayoutEffect, useRef } from "react"
import type { View } from "react-native"

import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs, useNativeContextProps } from "../../collection/context"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeMenuActionsContext, NativeMenuHeaderContext, NativeMenuHeaderBindingContext } from "./context"
import type { TNativeMenuHeaderProps } from "./types"

export const MenuHeader = createNativeCollectionLeaf<unknown, TNativeMenuHeaderProps, View>(
  "header",
  (authoredProps, forwardedRef, _node) => {
    const [props, ref] = useNativeContextProps(authoredProps, forwardedRef, NativeMenuHeaderContext)
    const context = useContext(NativeMenuHeaderBindingContext)
    const actions = useContext(NativeMenuActionsContext)
    const nativeID = props.nativeID ?? props.id
    const parentRef = context?.ref
    const currentID = useRef(nativeID)
    const target = useRef<View | null>(null)
    useInsertionEffect(() => {
      currentID.current = nativeID
    })
    const headerRef = useCallback(
      (view: View | null) => {
        target.current = view
        const id = currentID.current
        parentRef?.(id === undefined ? null : view, id ?? "")
      },
      [parentRef],
    )
    useLayoutEffect(() => {
      parentRef?.(nativeID === undefined ? null : target.current, nativeID ?? "")
    }, [parentRef, nativeID])
    const mergedRef = useNativeCollectionRefs(ref, headerRef)
    const { children, style, render, slot: _slot, ...native } = props
    const styles = splitNativeTextStyle(resolveNativeStyle(style, "MenuHeader", "style"))
    const hostProps = {
      ...native,
      ref: mergedRef,
      nativeID,
      accessible: false,
      focusable: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants" as const,
      style: styles.view,
      children: getNativeButtonContent(children, { ...actions?.text, ...styles.text }),
    }
    return render ? render(hostProps, undefined) : <NativeFocusHost {...hostProps} />
  },
)
