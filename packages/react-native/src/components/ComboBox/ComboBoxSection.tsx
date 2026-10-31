/* Native counterpart of pinned RAC ListBoxSection/Header; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import { createNativeCollectionBranch, createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import {
  useNativeCollectionRefs,
  useNativeContextProps,
  type TNativeContextValue,
  type TNativeSlotProps,
} from "../../collection/context"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeComboBoxStateContext } from "./collectionContext"

export type TNativeComboBoxSectionProps<T extends object> = Omit<TNativeFocusViewProps, "id" | "children" | "style"> & {
  id?: string | number
  value?: T
  items?: Iterable<T>
  children?: ReactNode | ((item: T) => ReactNode)
  dependencies?: readonly unknown[]
  style?: StyleProp<TextStyle>
  render?: (props: TNativeFocusViewProps & RefAttributes<View>, state: undefined) => ReactElement
}
export type TNativeComboBoxHeaderProps = Omit<TNativeFocusViewProps, "style"> &
  TNativeSlotProps & {
    style?: StyleProp<TextStyle>
    render?: (props: TNativeFocusViewProps & RefAttributes<View>, state: undefined) => ReactElement
  }
export const NativeComboBoxHeaderContext = createContext<
  TNativeContextValue<Partial<TNativeComboBoxHeaderProps>, View>
>({})
const HeaderBindingContext = createContext<((target: View | null, nativeID?: string) => void) | null>(null)

const Section = createNativeCollectionBranch<object, TNativeComboBoxSectionProps<object>, View>(
  "section",
  (props, ref, node) => {
    const state = useContext(NativeComboBoxStateContext)
    const { CollectionBranch } = useContext(NativeCollectionRendererContext)
    const content = useNativeContentContext()
    const theme = useNativeTheme()
    const generatedID = useId()
    const live = useRef(false)
    const [heading, setHeading] = useState<{ target: View; nativeID: string } | null>(null)
    useInsertionEffect(() => {
      live.current = true
      return () => {
        live.current = false
      }
    }, [])
    const register = useCallback(
      (target: View | null, nativeID?: string) => {
        if (!live.current) return
        setHeading((old) => {
          if (!target) return old ? null : old
          const id = nativeID ?? generatedID
          return old?.target === target && old.nativeID === id ? old : { target, nativeID: id }
        })
      },
      [generatedID],
    )
    const headingRef = useCallback(
      (target: View | null) => {
        if (!live.current) return
        setHeading((old) => (target ? (old?.target === target ? old : { target, nativeID: generatedID }) : null))
      },
      [generatedID],
    )
    if (!state) throw new Error("ComboBoxSection requires a native collection ComboBox")
    const {
      id: _id,
      value: _value,
      items: _items,
      children: _children,
      dependencies: _dependencies,
      render,
      style,
      ...native
    } = props
    const styles = splitNativeTextStyle(resolveNativeStyle(style, "ComboBoxSection", "style"))
    const text = { ...content?.textStyle, ...styles.text }
    const host = {
      ...native,
      ref,
      accessible: native.accessible ?? false,
      focusable: native.focusable ?? false,
      role: "group" as const,
      nativeLabelledBy: heading ? [heading.nativeID] : undefined,
      style: styles.view,
      children: (
        <NativeCollectionSemanticsContext.Provider value="">
          <NativeContentContext.Provider
            value={{
              foregroundColor: text.color ?? content?.foregroundColor ?? theme.colors.foreground,
              isButton: false,
              textStyle: text,
            }}
          >
            <HeaderBindingContext.Provider value={register}>
              <NativeComboBoxHeaderContext.Provider
                value={{
                  ref: headingRef,
                  ...(heading ? { nativeID: heading.nativeID, role: "presentation" as const } : {}),
                }}
              >
                <CollectionBranch collection={state.collection} parent={node} />
              </NativeComboBoxHeaderContext.Provider>
            </HeaderBindingContext.Provider>
          </NativeContentContext.Provider>
        </NativeCollectionSemanticsContext.Provider>
      ),
    }
    return render ? render(host, undefined) : <NativeFocusHost {...host} />
  },
)
export const NativeComboBoxSection = Section as <T extends object>(
  props: TNativeComboBoxSectionProps<T> & RefAttributes<View>,
) => ReactNode

export const NativeComboBoxHeader = createNativeCollectionLeaf<unknown, TNativeComboBoxHeaderProps, View>(
  "header",
  (authored, forwardedRef, _node) => {
    const [props, ref] = useNativeContextProps(authored, forwardedRef, NativeComboBoxHeaderContext)
    const register = useContext(HeaderBindingContext)
    const content = useNativeContentContext()
    const theme = useNativeTheme()
    const target = useRef<View | null>(null)
    const nativeID = props.nativeID
    const current = useRef({ nativeID, enabled: authored.slot !== null })
    useInsertionEffect(() => {
      current.current = { nativeID, enabled: authored.slot !== null }
    })
    const bind = useCallback(
      (view: View | null) => {
        target.current = view
        register?.(current.current.enabled ? view : null, current.current.nativeID)
      },
      [register],
    )
    useLayoutEffect(
      () => register?.(authored.slot !== null ? target.current : null, nativeID),
      [register, authored.slot, nativeID],
    )
    const mergedRef = useNativeCollectionRefs(ref, bind)
    const { id: _id, slot: _slot, children, render, style, ...native } = props
    const styles = splitNativeTextStyle(resolveNativeStyle(style, "ComboBoxHeader", "style"))
    const text = { ...content?.textStyle, ...styles.text }
    const host = {
      ...native,
      ref: mergedRef,
      nativeID,
      accessible: native.accessible ?? false,
      focusable: native.focusable ?? false,
      style: styles.view,
      children: (
        <NativeContentContext.Provider
          value={{
            foregroundColor: text.color ?? content?.foregroundColor ?? theme.colors.foreground,
            isButton: false,
            textStyle: text,
          }}
        >
          {getNativeButtonContent(children, text)}
        </NativeContentContext.Provider>
      ),
    }
    return render ? render(host, undefined) : <NativeFocusHost {...host} />
  },
)
