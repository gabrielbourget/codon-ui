import type { RefObject } from "react"
import type { View } from "react-native"

import { nativeKeyTokens } from "../../input/keyScope"
import { useNativeKeyboardObservation, useNativeKeyScope } from "../../input/NativeKeyboardScope"

import { useNativeTable } from "./context"
import { TableKeyPolicy } from "./TableCellKeys"
import type { useNativeCollectionKeyboard } from "./useTableKeyboard"

type TProps = { target: RefObject<View | null>; tag: number }
type TKeyboard = ReturnType<typeof useNativeCollectionKeyboard>
const Observation = ({ target, tag, keyboard }: TProps & { keyboard: TKeyboard }) => {
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
export const NativeCollectionTypeahead = (props: TProps & { keyboard: TKeyboard }) =>
  useNativeKeyScope() ? <Observation {...props} /> : null
export const TableTypeahead = (props: TProps) => {
  const { keyboard } = useNativeTable()
  return <NativeCollectionTypeahead {...props} keyboard={keyboard} />
}
