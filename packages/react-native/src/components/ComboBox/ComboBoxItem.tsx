import {
  forwardRef,
  useContext,
  useInsertionEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  useSyncExternalStore,
} from "react"
import { findNodeHandle, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs } from "../../collection/context"
import { NativeCollectionSemanticsContext, type TNativeCollectionSemantics } from "../../collection/semantics"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { focusNativeTarget } from "../../input/focus"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import type { TNativeButtonProps, TNativeButtonChildrenState } from "../Button/types"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { getNativeControlRootStyle, nativeControlTarget } from "../selection"

import { NativeComboBoxListBehaviorContext } from "./CollectionComboBoxList"
import {
  NativeComboBoxItemValueContext,
  NativeComboBoxOptionsContext,
  NativeComboBoxStateContext,
} from "./collectionContext"

export type TNativeComboBoxItemRenderState = TNativeButtonChildrenState & {
  isSelected: boolean
  isReadOnly: boolean
  isFocusVisible: boolean
  selectionMode: "none" | "single" | "multiple"
  selectionBehavior: "toggle" | "replace"
}
export type TNativeComboBoxItemProps = Omit<TNativeButtonProps, "children" | "id"> & {
  id?: string | number
  value?: object
  textValue?: string
  isReadOnly?: boolean
  children?: React.ReactNode | ((state: TNativeComboBoxItemRenderState) => React.ReactNode)
}
const Receiver = forwardRef<View, TNativeComboBoxItemProps & { node: TNativeCollectionNode<unknown> }>((props, ref) => {
  const {
    node,
    id: _id,
    value: _value,
    textValue: _text,
    children,
    isDisabled,
    isReadOnly,
    style,
    customStyles,
    onPress,
    onPressStart,
    onHoverStart,
    ...native
  } = props
  const state = useContext(NativeComboBoxStateContext)
  const options = useContext(NativeComboBoxOptionsContext)
  const list = useContext(NativeComboBoxListBehaviorContext)
  const actions = useContext(NativeCollectionActionsContext)
  const cycle = useRef<{ binding: string; target: View | null } | null>(null)
  if (!state || !options) throw new Error("ComboBoxItem requires a native collection ComboBox")
  const theme = useNativeTheme()
  const target = useRef<View>(null)
  const register = options.register
  const bind = useCallback(
    (view: View | null) => {
      target.current = view
      register(node, view)
    },
    [node, register],
  )
  const mergedRef = useNativeCollectionRefs(ref, bind)
  const member = state.collection.getItem(node.key)
  const disabled = !!isDisabled || options.isDisabled || !member || state.selectionManager.isDisabled(node.key)
  const readOnly = !!isReadOnly || options.isReadOnly
  const selected = state.selectionManager.isSelected(node.key)
  const focused = state.selectionManager.isFocused && state.selectionManager.focusedKey === node.key
  const inputScope = useNativeKeyScope()
  useSyncExternalStore(inputScope?.subscribe ?? (() => () => {}), inputScope?.snapshot ?? (() => 0), () => 0)
  const focusVisible = focused && inputScope?.lastInput()?.origin === "keyboard"
  const currentFocus = useRef({ state, disabled, virtual: list.shouldUseVirtualFocus, node, actions })
  const focusAttempt = useRef<{ target: View; binding: string } | null>(null)
  useInsertionEffect(() => {
    currentFocus.current = { state, disabled, virtual: list.shouldUseVirtualFocus, node, actions }
  })
  useLayoutEffect(() => () => register(node, null), [register, node])
  useLayoutEffect(() => {
    if (list.shouldUseVirtualFocus || !focused || disabled || inputScope?.isWindowActive() === false) {
      focusAttempt.current = null
      return
    }
    const original = target.current,
      binding = actions?.bindingFor(node)
    if (
      !original ||
      !binding ||
      (focusAttempt.current?.target === original && focusAttempt.current.binding === binding)
    )
      return
    focusAttempt.current = { target: original, binding }
    actions?.request(node, findNodeHandle(original) ?? 0, () => {
      const owner = currentFocus.current
      if (
        target.current === original &&
        owner.node === node &&
        !owner.disabled &&
        !owner.virtual &&
        owner.state.selectionManager.isFocused &&
        owner.state.selectionManager.focusedKey === node.key &&
        owner.actions?.bindingFor(node) === binding
      )
        focusNativeTarget(original)
    })
  }, [list.shouldUseVirtualFocus, focused, disabled, inputScope, actions, node])
  return (
    <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(node) ?? ""}>
      <NativeCollectionSemanticsContext.Provider
        value={
          member && list.ordinals.has(node.key)
            ? JSON.stringify({
                kind: "list-item",
                parentTarget: list.parentTarget,
                ordinal: list.ordinals.get(node.key)!,
              } satisfies TNativeCollectionSemantics)
            : ""
        }
      >
        <NativeButton
          {...native}
          ref={mergedRef}
          nativeRole="option"
          nativeAccessible={!!member}
          focusable={!list.shouldUseVirtualFocus}
          nativeTabStop={!list.shouldUseVirtualFocus && focused}
          nativeProgrammaticFocusable={!list.shouldUseVirtualFocus}
          nativeOnFocusObserved={(isFocused) => {
            if (!list.shouldUseVirtualFocus) {
              state.selectionManager.setFocused(isFocused)
              if (isFocused) state.selectionManager.setFocusedKey(node.key)
            }
          }}
          accessibilityLabel={props.accessibilityLabel ?? node.textValue}
          accessibilityState={{ selected }}
          isDisabled={disabled}
          nativeInteraction={!readOnly}
          nativeStyle={(flags) => {
            const foregroundColor = selected ? theme.colors.controlSelectedForeground : theme.colors.controlForeground
            const resolved = getNativeControlRootStyle(
              "ComboBoxItem",
              {
                justifyContent: "center",
                padding: theme.spacing.unit * 2,
                borderRadius: theme.radius.rounded,
                backgroundColor: selected
                  ? theme.colors.controlSelectedBackground
                  : flags.isPressed
                    ? theme.colors.controlPressedBackground
                    : flags.isHovered
                      ? theme.colors.controlHoverBackground
                      : theme.colors.controlBackground,
                opacity: disabled ? theme.opacity.disabled : 1,
                ...(focused ? { outlineWidth: 1.5, outlineColor: theme.colors.focusRing, outlineOffset: 1.5 } : {}),
              },
              customStyles,
              style,
              { ...flags, foregroundColor },
            )
            const split = splitNativeTextStyle(resolved)
            return {
              foregroundColor: split.text.color ?? foregroundColor,
              textStyle: split.text,
              viewStyle: split.view,
              target: nativeControlTarget(),
            }
          }}
          onHoverStart={(event) => {
            if (!disabled && !readOnly && list.shouldFocusOnHover && inputScope?.lastInput()?.origin !== "keyboard") {
              state.selectionManager.setFocused(true)
              state.selectionManager.setFocusedKey(node.key)
            }
            onHoverStart?.(event)
          }}
          onPress={(event) => {
            const started = cycle.current
            cycle.current = null
            onPress?.(event)
            if (
              !disabled &&
              !readOnly &&
              started?.target === target.current &&
              started.binding === actions?.bindingFor(node) &&
              findNodeHandle(target.current)
            )
              options.press(node, target.current, event)
          }}
          onPressStart={(event) => {
            cycle.current = { binding: actions?.bindingFor(node) ?? "", target: target.current }
            onPressStart?.(event)
          }}
        >
          {(flags) => (
            <NativeCollectionSemanticsContext.Provider value="">
              {getNativeButtonContent(
                typeof children === "function"
                  ? children({
                      ...flags,
                      isSelected: selected,
                      isReadOnly: readOnly,
                      isFocused: focused,
                      isFocusVisible: !!focusVisible,
                      selectionMode: state.selectionManager.selectionMode,
                      selectionBehavior: state.selectionManager.selectionBehavior,
                    })
                  : (children ?? node.textValue),
                {
                  color: flags.foregroundColor,
                },
              )}
            </NativeCollectionSemanticsContext.Provider>
          )}
        </NativeButton>
      </NativeCollectionSemanticsContext.Provider>
    </NativeCollectionItemBindingContext.Provider>
  )
})
const Leaf = createNativeCollectionLeaf<unknown, TNativeComboBoxItemProps, View>("item", (props, ref, node) => (
  <Receiver {...props} node={node} ref={ref} />
))
export const NativeComboBoxItem = forwardRef<View, TNativeComboBoxItemProps>((props, ref) => {
  const item = useContext(NativeComboBoxItemValueContext)
  return (
    <Leaf
      {...props}
      id={props.id ?? item?.key}
      value={props.value ?? (item?.value as object | undefined)}
      textValue={props.textValue ?? item?.text}
      ref={ref}
    />
  )
})
