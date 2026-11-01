import { cloneElement, isValidElement, useState, type ReactNode } from "react"
import { View, type AccessibilityActionInfo, type StyleProp, type TextStyle } from "react-native"

import { Button } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { NativeText } from "../Text/Text"

type TTableCellContentOptions = {
  children: ReactNode
  textStyle: StyleProp<TextStyle>
  maxLines: number | undefined
  truncate: boolean | undefined
  canAct: () => boolean
}

export const useTableCellContent = ({ children, textStyle, maxLines, truncate, canAct }: TTableCellContentOptions) => {
  const [expanded, setExpanded] = useState(false)
  const content = getNativeButtonContent(children, textStyle)
  // Only the phrase created by this cell is owned text. Authored components keep their native layout and props.
  const ownedText =
    content.length === 1 &&
    isValidElement<{ children: (string | number | bigint)[] }>(content[0]) &&
    content[0].type === NativeText
      ? content[0]
      : undefined
  const maximumLines = truncate
    ? 1
    : typeof maxLines === "number" && Number.isInteger(maxLines) && maxLines > 0
      ? Math.min(maxLines, 2147483647)
      : undefined
  const hasDisclosure =
    ownedText !== undefined &&
    ownedText.props.children.some((part) => String(part).trim().length > 0) &&
    maximumLines !== undefined
  const action: AccessibilityActionInfo | undefined = hasDisclosure
    ? { name: expanded ? "collapseCellValue" : "expandCellValue", label: expanded ? "Show less" : "Show full value" }
    : undefined
  const toggle = () => {
    if (hasDisclosure && canAct()) setExpanded(!expanded)
  }
  return {
    action,
    toggle,
    content: (
      <View style={{ minWidth: 0, flexShrink: 1, alignSelf: "stretch" }}>
        {content.map((child) =>
          hasDisclosure && isValidElement<{ numberOfLines?: number; ellipsizeMode?: "tail" }>(child)
            ? cloneElement(child, { numberOfLines: expanded ? 0 : maximumLines, ellipsizeMode: "tail" })
            : child,
        )}
        {action && (
          <Button
            raised={false}
            transparent
            accessibilityState={{ expanded }}
            onPress={toggle}
            style={{ alignSelf: "flex-start", maxWidth: "100%", marginTop: 4 }}
          >
            {action.label}
          </Button>
        )}
      </View>
    ),
  }
}
