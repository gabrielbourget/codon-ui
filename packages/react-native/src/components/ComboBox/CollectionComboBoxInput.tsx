import { forwardRef, useInsertionEffect, useRef, type Ref } from "react"
import type { StyleProp, TextInput, TextStyle } from "react-native"

import { useNativeCollectionRefs, useNativeContextProps, type TNativeSlotProps } from "../../collection/context"
import { Input } from "../Input/Input"
import type { TNativeInputProps } from "../Input/types"

import { NativeComboBoxInputContext } from "./collectionContext"
import type { TNativeCollectionComboBoxProps, TNativeComboBoxSubmitEvent } from "./collectionTypes"
import type { ComboBoxState } from "./state/types"

export const useNativeComboBoxInputProps = <T extends object>({
  owner,
  state,
  inputRef,
  currentInput,
  identity,
  style,
  onFocusWithin,
  onCommit,
}: {
  owner: TNativeCollectionComboBoxProps<T>
  state: ComboBoxState<T>
  inputRef: Ref<TextInput>
  currentInput: () => TextInput | null
  identity: string
  style: StyleProp<TextStyle>
  onFocusWithin: (focused: boolean) => void
  onCommit: (event: TNativeComboBoxSubmitEvent) => void
}): TNativeInputProps & { ref: Ref<TextInput> } => {
  const current = useRef({ owner, state, onFocusWithin, onCommit, currentInput })
  const live = useRef(false)
  const observedFocus = useRef(new WeakSet<TextInput>())
  useInsertionEffect(() => {
    current.current = { owner, state, onFocusWithin, onCommit, currentInput }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  return {
    ...owner.inputProps,
    ref: inputRef,
    testID: `${identity}-input`,
    role: "combobox",
    nativeID: owner.id,
    accessibilityLabel: owner.accessibilityLabel ?? owner["aria-label"] ?? owner.inputLabel,
    value: state.inputValue,
    placeholder: owner.placeholder,
    isDisabled: owner.isDisabled,
    isReadOnly: owner.isReadOnly,
    textSize: owner.textSize,
    geometry: owner.geometry,
    enableFocusStyle: false,
    customStyles: [{ flex: 1, minWidth: 0 }, style],
    onChangeText: (value) => {
      const { owner, state } = current.current
      if (live.current && !owner.isDisabled && !owner.isReadOnly) state.setInputValue(value)
    },
    onFocus: (event) => {
      if (!live.current || current.current.owner.isDisabled) return
      current.current.onFocusWithin(true)
      const editor = current.current.currentInput()
      if (editor && !observedFocus.current.has(editor)) {
        observedFocus.current.add(editor)
        if (!current.current.state.isFocused) {
          current.current.owner.onFocus?.(event)
          if (!live.current) return
          current.current.state.setFocused(true)
        }
        if (!live.current) return
        current.current.owner.onFocusChange?.(true)
      }
      if (live.current) current.current.owner.inputProps?.onFocus?.(event)
    },
    onBlur: (event) => {
      if (!live.current) return
      current.current.onFocusWithin(false)
      const editor = current.current.currentInput()
      if (editor && observedFocus.current.has(editor)) {
        observedFocus.current.delete(editor)
        current.current.owner.onBlur?.(event)
        if (!live.current) return
        current.current.state.setFocused(false)
        if (!live.current) return
        current.current.owner.onFocusChange?.(false)
      }
      if (live.current) current.current.owner.inputProps?.onBlur?.(event)
    },
    onChange: (event) => {
      if (live.current) current.current.owner.inputProps?.onChange?.(event)
    },
    onEndEditing: (event) => {
      if (live.current) current.current.owner.inputProps?.onEndEditing?.(event)
    },
    onSubmitEditing: (event) => {
      if (!live.current) return
      if (!current.current.owner.isDisabled && !current.current.owner.isReadOnly) current.current.onCommit(event)
      if (live.current) current.current.owner.inputProps?.onSubmitEditing?.(event)
    },
    onSelectionChange: (event) => {
      if (live.current) current.current.owner.inputProps?.onSelectionChange?.(event)
    },
  }
}

export const NativeComboBoxInput = forwardRef<TextInput, TNativeInputProps & TNativeSlotProps>(
  (authored, forwardedRef) => {
    const [props, inheritedRef] = useNativeContextProps(authored, forwardedRef, NativeComboBoxInputContext)
    const { slot: _slot, ...input } = props
    const current = useRef(props)
    const original = useRef<TextInput | null>(null)
    const live = useRef(false)
    useInsertionEffect(() => {
      current.current = props
    })
    useInsertionEffect(() => {
      live.current = true
      return () => {
        live.current = false
      }
    }, [])
    const ref = useNativeCollectionRefs(inheritedRef, original)
    const active = () => live.current && original.current !== null
    return (
      <Input
        {...input}
        ref={ref}
        onChangeText={(value) => {
          if (active() && !current.current.isDisabled && !current.current.isReadOnly)
            current.current.onChangeText?.(value)
        }}
        onChange={(event) => {
          if (active() && !current.current.isDisabled && !current.current.isReadOnly) current.current.onChange?.(event)
        }}
        onFocus={(event) => {
          if (active() && !current.current.isDisabled) current.current.onFocus?.(event)
        }}
        onBlur={(event) => {
          if (active()) current.current.onBlur?.(event)
        }}
        onEndEditing={(event) => {
          if (active()) current.current.onEndEditing?.(event)
        }}
        onSubmitEditing={(event) => {
          if (active()) current.current.onSubmitEditing?.(event)
        }}
        onSelectionChange={(event) => {
          if (active()) current.current.onSelectionChange?.(event)
        }}
      />
    )
  },
)
NativeComboBoxInput.displayName = "NativeComboBoxInput"
