/* Adapted from pinned RAC Label/Text/FieldError; Apache-2.0. See ../entry/UPSTREAM.json. */
import {
  forwardRef,
  useContext,
  useInsertionEffect,
  useRef,
  type ContextType,
  type ReactElement,
  type ReactNode,
} from "react"
import type { StyleProp, TextStyle } from "react-native"

import { useNativeContextProps, type TNativeSlotProps } from "../../collection/context"
import { resolveNativeStyle } from "../../components/colors"
import { useNativeContentContext } from "../../components/NativeContentContext"
import { NativeText, type TNativeTextRender } from "../../components/Text/Text"
import type { TNativeTextProps, TNativeTextRef } from "../../components/Text/types"

import { NativeTimeFieldErrorContext, NativeTimeFieldLabelContext, NativeTimeFieldTextContext } from "./descendants"

type TTextProps = TNativeTextProps & TNativeSlotProps & { render?: TNativeTextRender }
export const NativeTimeFieldLabel = forwardRef<TNativeTextRef, TTextProps>((authored, forwardedRef) => {
  const [props, ref] = useNativeContextProps(authored, forwardedRef, NativeTimeFieldLabelContext)
  const { focusField: _focusField, slot: _slot, render, onPress: _press, ...text } = props
  const current = useRef(props),
    live = useRef(false)
  useInsertionEffect(() => {
    current.current = props
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  return (
    <NativeText
      {...text}
      ref={ref}
      nativeRender={render}
      onPress={(event) => {
        if (!live.current) return
        const focus = current.current.focusField
        current.current.onPress?.(event)
        if (
          live.current &&
          current.current.focusField === focus &&
          !event.defaultPrevented &&
          !event.isDefaultPrevented?.()
        )
          focus?.()
      }}
    />
  )
})
NativeTimeFieldLabel.displayName = "NativeTimeFieldLabel"

export const NativeTimeFieldText = forwardRef<TNativeTextRef, TTextProps>((authored, forwardedRef) => {
  const [props, ref] = useNativeContextProps(authored, forwardedRef, NativeTimeFieldTextContext)
  const content = useNativeContentContext()
  const { slot: _slot, render, ...text } = props
  const inherited = { ...content?.textStyle }
  if (text.variant !== undefined) {
    delete inherited.fontFamily
    delete inherited.fontSize
    delete inherited.lineHeight
  }
  if (text.fontWeight !== undefined) delete inherited.fontWeight
  if (text.fontStyle !== undefined) delete inherited.fontStyle
  if (text.color !== undefined) delete inherited.color
  const style = resolveNativeStyle([inherited, text.customStyles, text.style], "TimeFieldText", "style")
  return <NativeText {...text} ref={ref} nativeRender={render} customStyles={undefined} style={style} />
})
NativeTimeFieldText.displayName = "NativeTimeFieldText"

type TValidation = NonNullable<ContextType<typeof NativeTimeFieldErrorContext>>
type TErrorProps = Omit<TTextProps, "children" | "style" | "render"> & {
  children?: ReactNode | ((state: TValidation & { defaultChildren: ReactNode }) => ReactNode)
  style?: StyleProp<TextStyle> | ((state: TValidation & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
  render?: (props: Parameters<TNativeTextRender>[0], state: TValidation) => ReactElement
}
export const NativeTimeFieldError = forwardRef<TNativeTextRef, TErrorProps>((props, ref) => {
  const validation = useContext(NativeTimeFieldErrorContext)
  if (!validation?.isInvalid) return null
  const { children, style, render, ...text } = props
  const defaultChildren = validation.validationErrors.length ? validation.validationErrors.join(" ") : undefined
  const evaluated = typeof children === "function" ? children({ ...validation, defaultChildren }) : children
  const content = evaluated ?? defaultChildren
  if (content == null) return null
  return (
    <NativeTimeFieldText
      slot="errorMessage"
      {...text}
      ref={ref}
      style={typeof style === "function" ? style({ ...validation, defaultStyle: {} }) : style}
      render={render ? (native) => render(native, validation) : undefined}
    >
      {content}
    </NativeTimeFieldText>
  )
})
NativeTimeFieldError.displayName = "NativeTimeFieldError"
