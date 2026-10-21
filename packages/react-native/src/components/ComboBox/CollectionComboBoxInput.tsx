import { useInsertionEffect, useRef, type Ref } from "react"
import type { StyleProp, TextInput, TextStyle } from "react-native"

import { Input } from "../Input/Input"

import type { TNativeCollectionComboBoxProps } from "./collectionTypes"
import type { ComboBoxState } from "./state/types"

export const NativeCollectionComboBoxInput = <T extends object>({
  owner,
  state,
  inputRef,
  identity,
  style,
  onFocusWithin,
}: {
  owner: TNativeCollectionComboBoxProps<T>
  state: ComboBoxState<T>
  inputRef: Ref<TextInput>
  identity: string
  style: StyleProp<TextStyle>
  onFocusWithin: (focused: boolean) => void
}) => {
  const current = useRef({ owner, state, onFocusWithin })
  const live = useRef(false)
  const observedFocus = useRef(false)
  useInsertionEffect(() => {
    current.current = { owner, state, onFocusWithin }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  return (
    <Input
      {...owner.inputProps}
      ref={inputRef}
      testID={`${identity}-input`}
      id={owner.id}
      nativeID={owner.id}
      accessibilityLabel={owner.accessibilityLabel ?? owner["aria-label"] ?? owner.inputLabel}
      value={state.inputValue}
      placeholder={owner.placeholder}
      isDisabled={owner.isDisabled}
      isReadOnly={owner.isReadOnly}
      textSize={owner.textSize}
      geometry={owner.geometry}
      enableFocusStyle={false}
      customStyles={[{ flex: 1, minWidth: 0 }, style]}
      onChangeText={(value) => {
        const { owner, state } = current.current
        if (live.current && !owner.isDisabled && !owner.isReadOnly) state.setInputValue(value)
      }}
      onFocus={(event) => {
        if (!live.current || current.current.owner.isDisabled) return
        current.current.onFocusWithin(true)
        if (!observedFocus.current) {
          observedFocus.current = true
          if (!current.current.state.isFocused) {
            current.current.owner.onFocus?.(event)
            if (!live.current) return
            current.current.state.setFocused(true)
          }
          if (!live.current) return
          current.current.owner.onFocusChange?.(true)
        }
        if (live.current) current.current.owner.inputProps?.onFocus?.(event)
      }}
      onBlur={(event) => {
        if (!live.current) return
        current.current.onFocusWithin(false)
        if (observedFocus.current) {
          observedFocus.current = false
          current.current.owner.onBlur?.(event)
          if (!live.current) return
          current.current.state.setFocused(false)
          if (!live.current) return
          current.current.owner.onFocusChange?.(false)
        }
        if (live.current) current.current.owner.inputProps?.onBlur?.(event)
      }}
      onChange={(event) => {
        if (live.current) current.current.owner.inputProps?.onChange?.(event)
      }}
      onEndEditing={(event) => {
        if (live.current) current.current.owner.inputProps?.onEndEditing?.(event)
      }}
      onSubmitEditing={(event) => {
        if (live.current) current.current.owner.inputProps?.onSubmitEditing?.(event)
      }}
      onSelectionChange={(event) => {
        if (live.current) current.current.owner.inputProps?.onSelectionChange?.(event)
      }}
    />
  )
}
