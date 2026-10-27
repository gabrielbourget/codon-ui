import { useRef, useSyncExternalStore, type ComponentProps } from "react"
import { StyleSheet, type StyleProp, type TextStyle, type View, type ViewStyle } from "react-native"

import { getNativeFocusedTarget, subscribeNativeFocus } from "../../input/focus"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeTheme, type TNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { splitNativeTextStyle } from "../nativeTextStyle"

const definedStyle = <T extends TextStyle | ViewStyle>(style: StyleProp<T>) =>
  Object.fromEntries(Object.entries(StyleSheet.flatten(style) ?? {}).filter(([, value]) => value !== undefined)) as T

export const resolveQueryDialogStyle = (style: StyleProp<TextStyle>, theme: TNativeTheme) =>
  splitNativeTextStyle(
    resolveNativeStyle(
      [
        {
          height: "100%",
          width: "100%",
          flexDirection: "column",
          alignItems: "center",
          gap: theme.spacing.unit * 2,
          padding: theme.spacing.unit * 2,
        },
        definedStyle(style),
      ],
      "SortAndFilterPanel",
      "customDialogStyles",
    ),
  )

// Keep focus paint on the original dialog. Descendant focus and focus requests are not :focus acknowledgements.
export const QueryPanelDialog = ({ style, ...props }: Omit<ComponentProps<typeof NativeFocusHost>, "ref">) => {
  const target = useRef<View>(null)
  const focused = useSyncExternalStore(subscribeNativeFocus, getNativeFocusedTarget, () => null)
  const theme = useNativeTheme()
  return (
    <NativeFocusHost
      {...props}
      ref={target}
      style={[
        target.current !== null && focused === target.current
          ? { outlineWidth: 1.5, outlineStyle: "solid", outlineColor: theme.colors.focusRing }
          : undefined,
        definedStyle(style),
      ]}
    />
  )
}
