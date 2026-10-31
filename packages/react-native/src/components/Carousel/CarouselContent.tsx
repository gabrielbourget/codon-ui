import type { ReactElement, ReactNode } from "react"
import type { TextStyle, ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

// Use the existing native phrase/foreground boundary without inserting another layout host.
export const CarouselContent = ({
  style,
  children,
  render,
}: {
  style: TextStyle
  children: ReactNode
  render: (style: ViewStyle, children: ReactNode) => ReactElement
}) => {
  const parent = useNativeContentContext()
  const theme = useNativeTheme()
  const split = splitNativeTextStyle(style)
  const textStyle = {
    ...parent?.textStyle,
    ...Object.fromEntries(Object.entries(split.text).filter(([, value]) => value !== undefined)),
  }
  return (
    <NativeContentContext.Provider
      value={{
        foregroundColor: textStyle.color ?? parent?.foregroundColor ?? theme.colors.foreground,
        isButton: parent?.isButton ?? false,
        textStyle,
      }}
    >
      {render(split.view, getNativeButtonContent(children, textStyle))}
    </NativeContentContext.Provider>
  )
}
