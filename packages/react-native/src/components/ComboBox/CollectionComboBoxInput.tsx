import { forwardRef, useEffect, useInsertionEffect, useRef, useState, type Ref } from "react"
import { findNodeHandle, type StyleProp, type TextInput, type TextStyle } from "react-native"

import { useNativeCollectionRefs, useNativeContextProps } from "../../collection/context"
import { useNativeKeyboardObservation, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativeInput } from "../Input/Input"
import type { TNativeInputRenderState } from "../Input/types"

import { NativeComboBoxInputContext } from "./collectionContext"
import type { TNativeComboBoxInputProps, TNativeComboBoxInputRenderState } from "./collectionInputTypes"
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
}): TNativeComboBoxInputProps & { ref: Ref<TextInput> } => {
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
    autoFocus: owner.autoFocus,
    inputMode: owner.inputMode,
    testID: `${identity}-input`,
    role: "combobox",
    nativeID: owner.id,
    accessibilityLabel: owner.accessibilityLabel ?? owner["aria-label"] ?? owner.inputLabel,
    value: state.inputValue,
    placeholder: owner.placeholder,
    isDisabled: owner.isDisabled,
    isReadOnly: owner.isReadOnly,
    isInvalid: state.displayValidation.isInvalid,
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

const InputFocusObservation = ({
  target,
  active,
  visible,
}: {
  target: number
  active: () => boolean
  visible: () => void
}) => {
  useNativeKeyboardObservation({
    targetTag: target,
    isEnabled: target > 0,
    lifetimeKey: `combo-input-focus:${target}`,
    canAct: active,
    onKeyDown: (event) => {
      const data = event.nativeEvent
      if (
        !data.cancelled &&
        !data.isComposing &&
        data.focusedTarget === target &&
        (data.key === "Tab" || data.key === "Escape")
      )
        visible()
    },
  })
  return null
}

export const NativeComboBoxInput = forwardRef<TextInput, TNativeComboBoxInputProps>((authored, forwardedRef) => {
  const [props, inheritedRef] = useNativeContextProps(authored, forwardedRef, NativeComboBoxInputContext)
  const {
    slot: _slot,
    isInvalid,
    render,
    style,
    onHoverStart: _hoverStart,
    onHoverEnd: _hoverEnd,
    onHoverChange: _hoverChange,
    ...input
  } = props
  const scope = useNativeKeyScope()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [focusVisible, setFocusVisible] = useState(false)
  const hoverEvent = useRef<Parameters<NonNullable<TNativeComboBoxInputProps["onHoverEnd"]>>[0] | null>(null)
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
  const active = () => live.current && original.current !== null && scope?.isWindowActive() !== false
  const finishHover = () => {
    const event = hoverEvent.current
    if (!event) return
    hoverEvent.current = null
    setHovered(false)
    current.current.onHoverEnd?.(event)
    current.current.onHoverChange?.(false)
  }
  useEffect(() => {
    if (props.isDisabled) {
      finishHover()
      setFocused(false)
      setFocusVisible(false)
    }
  })
  useEffect(
    () =>
      scope?.subscribe(() => {
        if (scope.isWindowActive() === false) {
          finishHover()
          setFocused(false)
          setFocusVisible(false)
        } else if (scope.lastInput()?.origin === "pointer") setFocusVisible(false)
      }),
    [scope],
  )
  const values = (state: TNativeInputRenderState): TNativeComboBoxInputRenderState => ({
    ...state,
    isFocused: focused && !props.isDisabled,
    isHovered: hovered && !props.isDisabled,
    isFocusVisible: focused && focusVisible && !props.isDisabled,
    isInvalid: isInvalid ?? state.isInvalid,
  })
  return (
    <>
      <NativeInput
        {...input}
        ref={ref}
        style={typeof style === "function" ? (state) => style({ ...state, ...values(state) }) : style}
        nativeRender={render ? (native, state) => render(native, values(state)) : undefined}
        onPointerEnter={(event) => {
          if (!active()) return
          current.current.onPointerEnter?.(event)
          if (
            !active() ||
            current.current.isDisabled ||
            event.nativeEvent.pointerType === "touch" ||
            hoverEvent.current
          )
            return
          event.persist?.()
          hoverEvent.current = event
          setHovered(true)
          current.current.onHoverStart?.(event)
          current.current.onHoverChange?.(true)
        }}
        onPointerLeave={(event) => {
          if (!active()) return
          current.current.onPointerLeave?.(event)
          if (hoverEvent.current) {
            hoverEvent.current = event
            finishHover()
          }
        }}
        onPointerDown={(event) => {
          if (!active()) return
          setFocusVisible(false)
          current.current.onPointerDown?.(event)
        }}
        onChangeText={(value) => {
          if (active() && !current.current.isDisabled && !current.current.isReadOnly)
            current.current.onChangeText?.(value)
        }}
        onChange={(event) => {
          if (active() && !current.current.isDisabled && !current.current.isReadOnly) current.current.onChange?.(event)
        }}
        onFocus={(event) => {
          if (active() && !current.current.isDisabled) {
            setFocused(true)
            setFocusVisible(scope?.lastInput()?.origin !== "pointer")
            current.current.onFocus?.(event)
          }
        }}
        onBlur={(event) => {
          if (active()) {
            setFocused(false)
            setFocusVisible(false)
            current.current.onBlur?.(event)
          }
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
      {scope && (
        <InputFocusObservation
          target={original.current ? (findNodeHandle(original.current) ?? 0) : 0}
          active={() => active() && !current.current.isDisabled && focused}
          visible={() => setFocusVisible(true)}
        />
      )}
    </>
  )
})
NativeComboBoxInput.displayName = "NativeComboBoxInput"
