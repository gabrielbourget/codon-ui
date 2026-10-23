import type { RefObject } from "react"
import type { View } from "react-native"

import { nativeKeyTokens } from "../../input/keyScope"
import { useNativeKeyboardObservation, useNativeKeyScope } from "../../input/NativeKeyboardScope"

import { useNativeTable } from "./context"
import { TableKeyPolicy } from "./TableCellKeys"

type TProps = { target: RefObject<View | null>; tag: number }
const Observation = ({ target, tag }: TProps) => {
  const { keyboard } = useNativeTable()
  useNativeKeyboardObservation({
    targetTag: tag,
    isEnabled: tag > 0 && keyboard.typeaheadEnabled,
    lifetimeKey: String(tag),
    canAct: keyboard.canAct,
    onKeyDown: (event) => {
      if (event.nativeEvent.key !== " " || !event.nativeEvent.defaultCaptured) keyboard.typeahead(event)
    },
  })
  return (
    <TableKeyPolicy
      target={target}
      tokens={nativeKeyTokens(" ").filter((token) => token[2] === "0" && token[3] === "0")}
      lifetimeKey={String(tag)}
      isEnabled={keyboard.typeaheadEnabled && keyboard.hasSearch}
      excludeEditable={false}
      excludeComposing
      canAct={keyboard.canAct}
      onKey={keyboard.typeahead}
    />
  )
}
export const TableTypeahead = (props: TProps) => (useNativeKeyScope() ? <Observation {...props} /> : null)
