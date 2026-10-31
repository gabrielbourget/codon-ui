/* Native counterpart of pinned RAC Popover; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import { forwardRef, type ReactNode } from "react"
import type { StyleProp, View } from "react-native"

import { useNativeContextProps } from "../../collection/context"
import {
  NativeFloatingSurface,
  type TNativeFloatingHostRender,
  type TNativeFloatingRenderState,
} from "../ClickPopover/ClickPopover"
import type { TNativeClickPopoverProps, TNativeClickPopoverRootStyle } from "../ClickPopover/types"

import { NativeComboBoxPopoverContext, type NATIVE_COMBO_BOX_POPOVER_CONTEXTS } from "./collectionContext"
import { NativeComboBoxPopoverBoundary } from "./fieldParts"

export type TNativeComboBoxPopoverProps = Omit<TNativeClickPopoverProps, "children" | "style"> & {
  children?: ReactNode | ((state: TNativeFloatingRenderState & { defaultChildren: undefined }) => ReactNode)
  style?:
    | StyleProp<TNativeClickPopoverRootStyle>
    | ((
        state: TNativeFloatingRenderState & { defaultStyle: TNativeClickPopoverRootStyle },
      ) => StyleProp<TNativeClickPopoverRootStyle>)
  render?: TNativeFloatingHostRender
  clearContexts?: typeof NATIVE_COMBO_BOX_POPOVER_CONTEXTS
}

export const NativeComboBoxPopover = forwardRef<View, TNativeComboBoxPopoverProps>((authored, forwardedRef) => {
  const [props, ref] = useNativeContextProps(authored, forwardedRef, NativeComboBoxPopoverContext)
  const { children, style, render, clearContexts, ...surface } = props
  const wrap = (content: ReactNode) =>
    clearContexts ? <NativeComboBoxPopoverBoundary>{content}</NativeComboBoxPopoverBoundary> : content
  return (
    <NativeFloatingSurface
      {...surface}
      ref={ref}
      childIsDialog={surface.childIsDialog ?? false}
      style={typeof style === "function" ? undefined : style}
      nativeStyle={typeof style === "function" ? style : undefined}
      nativeRender={render}
      nativeChildren={typeof children === "function" ? (state) => wrap(children(state)) : undefined}
    >
      {typeof children === "function" ? undefined : wrap(children)}
    </NativeFloatingSurface>
  )
})
NativeComboBoxPopover.displayName = "NativeComboBoxPopover"
