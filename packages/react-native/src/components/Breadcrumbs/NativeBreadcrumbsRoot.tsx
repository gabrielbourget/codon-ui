import { forwardRef, type ReactNode } from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import { useNativeContextProps } from "../../collection/context"
import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { NativeTextStyleProvider } from "../NativeTextStyleProvider"

import { NativeBreadcrumbsContext, type TNativeBreadcrumbsContextProps } from "./context"
import { splitNativeBreadcrumbStyle } from "./styles"

export const NativeBreadcrumbsRoot = forwardRef<
  View,
  Omit<TNativeBreadcrumbsContextProps, "children"> & {
    children?: ReactNode
    nativeBaselineStyle: StyleProp<TextStyle>
    nativeNavigation: boolean
    nativeNavigationLabel: string
    nativeIsDisabled: boolean
    nativeDescriptionLabel: string
    nativeDetailsLabel: string
  }
>(
  (
    {
      nativeBaselineStyle,
      nativeNavigation,
      nativeNavigationLabel,
      nativeIsDisabled,
      nativeDescriptionLabel,
      nativeDetailsLabel,
      ...authored
    },
    ref,
  ) => {
    const theme = useNativeTheme()
    const [props, mergedRef] = useNativeContextProps(authored, ref, NativeBreadcrumbsContext)
    const {
      children,
      style,
      render,
      slot: _slot,
      items: _items,
      dependencies: _dependencies,
      onAction: _onAction,
      isDisabled: _isDisabled,
      "aria-label": aliasLabel,
      "aria-labelledby": aliasLabelledBy,
      "aria-describedby": describedBy,
      "aria-details": detailsBy,
      ...native
    } = props
    const resolved = splitNativeBreadcrumbStyle(
      resolveNativeStyle([nativeBaselineStyle, style], "Breadcrumbs", "root context"),
    )
    validateNativeColor(resolved.text.color, "Breadcrumbs", "root context color")
    const host = {
      ...native,
      ref: mergedRef,
      id: undefined,
      nativeID: props.id ?? props.nativeID,
      role: "list" as const,
      accessible: props.accessible ?? false,
      focusable: props.focusable ?? false,
      nativeNavigation,
      nativeNavigationLabel,
      accessibilityLabel: props.accessibilityLabel ?? aliasLabel,
      accessibilityLabelledBy: undefined,
      nativeLabelledBy: nativeAccessibilityIDs(props.accessibilityLabelledBy ?? aliasLabelledBy),
      nativeDescribedBy: nativeAccessibilityIDs(describedBy),
      nativeDetailsBy: nativeAccessibilityIDs(detailsBy),
      nativeDescriptionLabel,
      nativeDetailsLabel,
      accessibilityState: { ...props.accessibilityState, disabled: nativeIsDisabled },
      style: resolved.view,
      children: (
        <NativeBreadcrumbsContext.Provider value={props}>
          <NativeTextStyleProvider style={resolved.text}>
            <NativeContentContext.Provider
              value={{ foregroundColor: resolved.text.color ?? theme.colors.foreground, isButton: false }}
            >
              {children}
            </NativeContentContext.Provider>
          </NativeTextStyleProvider>
        </NativeBreadcrumbsContext.Provider>
      ),
    }
    return render ? render(host, undefined) : <NativeFocusView {...host} />
  },
)
