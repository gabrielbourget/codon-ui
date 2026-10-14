import { Children, Fragment, isValidElement, type ReactNode } from "react"
import type { StyleProp, TextStyle } from "react-native"

import { Text } from "../Text/Text"

export const getNativeButtonContent = (children: ReactNode, ownedStyles?: StyleProp<TextStyle>) => {
  const content: ReactNode[] = []
  let phrase: (string | number)[] = []
  let phraseKey: string
  const finishPhrase = () => {
    if (!phrase.length) return
    content.push(
      <Text key={phraseKey} customStyles={ownedStyles}>
        {phrase}
      </Text>,
    )
    phrase = []
  }
  const visit = (nodes: ReactNode, scope: (string | number)[]) => {
    const visitChild = (child: ReactNode, index: number) => {
      const element = isValidElement<{ children?: ReactNode }>(child) ? child : undefined
      const key = [...scope, element?.key ?? index]
      if (Array.isArray(child)) {
        visit(child, key)
      } else if (typeof child === "string" || typeof child === "number") {
        if (!phrase.length) phraseKey = JSON.stringify(key)
        phrase.push(child)
      } else if (element?.type === Fragment) {
        visit(element.props.children, key)
      } else if (child !== null && child !== undefined && typeof child !== "boolean") {
        finishPhrase()
        content.push(<Fragment key={JSON.stringify(key)}>{child}</Fragment>)
      }
    }
    if (Array.isArray(nodes)) nodes.forEach(visitChild)
    else Children.forEach(nodes, visitChild)
  }
  visit(children, [])
  finishPhrase()
  return content
}
