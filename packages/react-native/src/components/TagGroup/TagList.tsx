/* Adapted from pinned RAC TagList; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import {
  forwardRef,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardedRef,
  type ReactNode,
  type RefAttributes,
} from "react"
import type { View } from "react-native"

import { NativeCollection } from "../../collection/CollectionBuilder"
import { useNativeContextProps } from "../../collection/context"
import {
  NativeCollectionRendererContext,
  useNativePersistedKeys,
  type TNativeCollectionScrollHost,
} from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionSnapshot } from "../../collection/snapshot"
import { NativeListStateContext } from "../../collection/state"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeTagGroupActionsContext, NativeTagListContext, NativeTagListRenderContext } from "./context"
import type { TNativeTagGroupEmptyState, TNativeTagListProps } from "./types"

const TagListInner = ({ props, forwardedRef }: { props: TNativeTagListProps; forwardedRef: ForwardedRef<View> }) => {
  const state = useContext(NativeListStateContext)!
  const [merged, ref] = useNativeContextProps(props, forwardedRef, NativeTagListContext)
  const {
    children: _children,
    items: _items,
    dependencies: _dependencies,
    idScope: _idScope,
    slot: _slot,
    renderEmptyState,
    render,
    style,
    ...native
  } = merged
  const [focused, setFocused] = useState(false),
    [focusVisible, setFocusVisible] = useState(false)
  const observedFocus = useRef(false)
  const input = useNativeKeyScope()
  useLayoutEffect(
    () =>
      input?.subscribe(() => {
        if (observedFocus.current) setFocusVisible(input.lastInput()?.origin === "keyboard")
      }),
    [input],
  )
  const environment = useContext(NativeTagListRenderContext)
  const fallbackScroll = useRef<TNativeCollectionScrollHost | null>(null)
  const fallbackKeys = useNativePersistedKeys(state.selectionManager.focusedKey)
  const renderState: TNativeTagGroupEmptyState = {
    isEmpty: state.collection.size === 0,
    isFocused: focused,
    isFocusVisible: focusVisible,
    state,
  }
  const defaultStyle = environment?.defaultStyle ?? {}
  const authoredStyle = typeof style === "function" ? style({ ...renderState, defaultStyle }) : style
  const styles = splitNativeTextStyle(resolveNativeStyle([defaultStyle, authoredStyle], "TagList", "style"))
  const group = useContext(NativeTagGroupActionsContext)
  const { CollectionRoot } = useContext(NativeCollectionRendererContext)
  const theme = useNativeTheme()
  const content = (
    <NativeCollectionSemanticsContext.Provider value="">
      {renderState.isEmpty && renderEmptyState ? (
        getNativeButtonContent(renderEmptyState(renderState), {
          color: theme.colors.controlPlaceholder,
          ...styles.text,
        })
      ) : (
        <CollectionRoot
          collection={state.collection as TNativeCollectionSnapshot<unknown>}
          persistedKeys={environment?.persistedKeys ?? fallbackKeys}
          scrollRef={environment?.scrollRef ?? fallbackScroll}
        />
      )}
    </NativeCollectionSemanticsContext.Provider>
  )
  const hostProps = {
    ...native,
    ref,
    style: styles.view,
    onFocus: (event: Parameters<NonNullable<TNativeTagListProps["onFocus"]>>[0]) => {
      observedFocus.current = true
      setFocused(true)
      setFocusVisible(event.nativeEvent.isFocusVisible)
      native.onFocus?.(event)
    },
    onBlur: (event: Parameters<NonNullable<TNativeTagListProps["onBlur"]>>[0]) => {
      observedFocus.current = false
      setFocused(false)
      setFocusVisible(false)
      native.onBlur?.(event)
    },
    children: group ? (
      <NativeTagGroupActionsContext.Provider value={{ ...group, text: { ...group.text, ...styles.text } }}>
        {content}
      </NativeTagGroupActionsContext.Provider>
    ) : (
      content
    ),
  }
  return render ? render(hostProps, renderState) : <NativeFocusView {...hostProps} />
}

export const NativeTagList = forwardRef(<T extends object>(props: TNativeTagListProps<T>, ref: ForwardedRef<View>) => {
  const state = useContext(NativeListStateContext)
  return state ? (
    <TagListInner props={props as TNativeTagListProps} forwardedRef={ref} />
  ) : (
    <NativeCollection {...props} />
  )
}) as <T extends object>(props: TNativeTagListProps<T> & RefAttributes<View>) => ReactNode
