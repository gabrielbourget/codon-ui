import {
  forwardRef,
  useContext,
  useInsertionEffect,
  useRef,
  useMemo,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react"
import { View, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from "react-native"

import { useNativeCollectionRefs, useNativeContextProps, type TNativeSlotProps } from "../../collection/context"
import { focusNativeTarget } from "../../input/focus"
import { getNativeButtonContent } from "../Button/content"
import { NativeText, type TNativeTextRender } from "../Text/Text"
import type { TNativeTextProps, TNativeTextRef } from "../Text/types"

import {
  NativeComboBoxFieldErrorContext,
  NativeComboBoxLabelContext,
  NativeComboBoxStateContext,
  NativeComboBoxTextContext,
  NativeComboBoxValueContext,
  NativeComboBoxButtonContext,
  NativeComboBoxInputContext,
  NativeComboBoxGroupContext,
} from "./collectionContext"
import type { ComboBoxState, ValidationResult } from "./state/types"

type TTextProps = TNativeTextProps & TNativeSlotProps & { render?: TNativeTextRender }

export const NativeComboBoxPopoverBoundary = ({ children }: { children: ReactNode }) => (
  <NativeComboBoxLabelContext.Provider value={null}>
    <NativeComboBoxButtonContext.Provider value={null}>
      <NativeComboBoxInputContext.Provider value={null}>
        <NativeComboBoxGroupContext.Provider value={null}>
          <NativeComboBoxTextContext.Provider value={null}>{children}</NativeComboBoxTextContext.Provider>
        </NativeComboBoxGroupContext.Provider>
      </NativeComboBoxInputContext.Provider>
    </NativeComboBoxButtonContext.Provider>
  </NativeComboBoxLabelContext.Provider>
)

export const NativeComboBoxLabel = forwardRef<TNativeTextRef, TTextProps>((authored, forwardedRef) => {
  const [props, inheritedRef] = useNativeContextProps(authored, forwardedRef, NativeComboBoxLabelContext)
  const { labelTarget: _labelTarget, isDisabled: _isDisabled, slot: _slot, onPress: _onPress, render, ...text } = props
  const original = useRef<TNativeTextRef | null>(null)
  const current = useRef(props)
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
  return (
    <NativeText
      {...text}
      ref={ref}
      nativeRender={render}
      elementType={props.elementType ?? "label"}
      onPress={
        props.onPress || props.labelTarget
          ? (event) => {
              const label = original.current,
                target = current.current.labelTarget?.current
              if (!live.current || !label) return
              current.current.onPress?.(event)
              if (
                live.current &&
                !current.current.isDisabled &&
                original.current === label &&
                target &&
                current.current.labelTarget?.current === target &&
                !event.defaultPrevented &&
                !event.isDefaultPrevented?.()
              )
                focusNativeTarget(target)
            }
          : undefined
      }
    />
  )
})
NativeComboBoxLabel.displayName = "NativeComboBoxLabel"

export const NativeComboBoxText = forwardRef<TNativeTextRef, TTextProps>((authored, forwardedRef) => {
  const [props, ref] = useNativeContextProps(authored, forwardedRef, NativeComboBoxTextContext)
  const { slot: _slot, render, ...text } = props
  return <NativeText {...text} ref={ref} nativeRender={render} />
})
NativeComboBoxText.displayName = "NativeComboBoxText"

type TErrorValues = ValidationResult & { defaultChildren: ReactNode }
export type TNativeComboBoxFieldErrorProps = Omit<TTextProps, "children" | "style" | "render"> & {
  children?: ReactNode | ((values: TErrorValues) => ReactNode)
  style?: StyleProp<TextStyle> | ((values: ValidationResult & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
  render?: (props: Parameters<TNativeTextRender>[0], state: ValidationResult) => ReactElement
}
const FieldErrorInner = forwardRef<TNativeTextRef, TNativeComboBoxFieldErrorProps>((props, ref) => {
  const validation = useContext(NativeComboBoxFieldErrorContext)!
  const { children, style, render, ...text } = props
  const defaultChildren = validation.validationErrors.length ? validation.validationErrors.join(" ") : undefined
  const resolved = typeof style === "function" ? style({ ...validation, defaultStyle: {} }) : style
  const evaluated = typeof children === "function" ? children({ ...validation, defaultChildren }) : children
  const content = evaluated ?? defaultChildren
  if (content == null) return null
  return (
    <NativeComboBoxText
      slot="errorMessage"
      {...text}
      ref={ref}
      style={resolved}
      render={render ? (native) => render(native, validation) : undefined}
    >
      {content}
    </NativeComboBoxText>
  )
})
FieldErrorInner.displayName = "NativeComboBoxFieldErrorInner"
export const NativeComboBoxFieldError = forwardRef<TNativeTextRef, TNativeComboBoxFieldErrorProps>((props, ref) => {
  const validation = useContext(NativeComboBoxFieldErrorContext)
  return validation?.isInvalid ? <FieldErrorInner {...props} ref={ref} /> : null
})
NativeComboBoxFieldError.displayName = "NativeComboBoxFieldError"

export type TNativeComboBoxValueState = Readonly<{
  selectedItems: readonly (object | null)[]
  selectedText: string
  isPlaceholder: boolean
  state: ComboBoxState<object>
}>
export type TNativeComboBoxValueProps = Omit<ViewProps, "children" | "style"> &
  TNativeSlotProps & {
    placeholder?: ReactNode
    locale?: string
    children?: ReactNode | ((values: TNativeComboBoxValueState & { defaultChildren: ReactNode }) => ReactNode)
    style?:
      | StyleProp<ViewStyle>
      | ((values: TNativeComboBoxValueState & { defaultStyle: ViewStyle }) => StyleProp<ViewStyle>)
    render?: (props: ViewProps & RefAttributes<View>, state: TNativeComboBoxValueState) => ReactElement
  }
export const NativeComboBoxValue = forwardRef<View, TNativeComboBoxValueProps>((authored, forwardedRef) => {
  const [props, ref] = useNativeContextProps(authored, forwardedRef, NativeComboBoxValueContext)
  const state = useContext(NativeComboBoxStateContext)
  if (!state) throw new Error("ComboBoxValue requires a native ComboBox state context")
  const { children, placeholder, locale, slot: _slot, style, render, ...view } = props
  const formatter = useMemo(() => new Intl.ListFormat(locale, { style: "long", type: "conjunction" }), [locale])
  const selectedText = formatter.format(
    state.selectedItems.map((item) => item?.textValue || "").filter((text) => text !== ""),
  )
  const values: TNativeComboBoxValueState = {
    selectedItems: state.selectedItems.map((item) => item.value ?? null),
    selectedText,
    isPlaceholder: state.selectedItems.length === 0,
    state,
  }
  const defaultChildren = selectedText || placeholder
  const resolved = typeof style === "function" ? style({ ...values, defaultStyle: {} }) : style
  const evaluated = typeof children === "function" ? children({ ...values, defaultChildren }) : children
  const content = evaluated ?? defaultChildren
  const native = { ...view, ref, style: resolved, children: getNativeButtonContent(content) }
  return render ? render(native, values) : <View {...native} />
})
NativeComboBoxValue.displayName = "NativeComboBoxValue"
