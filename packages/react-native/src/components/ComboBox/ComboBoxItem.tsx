/* Native counterpart of pinned RAC ListBoxItem/useOption; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import {
  forwardRef,
  useContext,
  useInsertionEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  useId,
  useSyncExternalStore,
  useState,
  useEffect,
  type ReactElement,
} from "react"
import { findNodeHandle, type View, type TextStyle, type StyleProp } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs, NATIVE_DEFAULT_SLOT, NativeSelectionIndicatorContext } from "../../collection/context"
import { NativeCollectionSemanticsContext, type TNativeCollectionSemantics } from "../../collection/semantics"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { focusNativeTarget } from "../../input/focus"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativePressableRender } from "../../input/NativePressable"
import type { TNativeWindowPointerEvent } from "../../input/nativeWindowPointers"
import type { TNativePressEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import type { TNativeButtonProps, TNativeButtonRenderState } from "../Button/types"
import { useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { getNativeControlRootStyle, nativeControlTarget } from "../selection"
import type { TNativeTextRef } from "../Text/types"

import { NativeComboBoxListBehaviorContext } from "./CollectionComboBoxList"
import {
  NativeComboBoxItemValueContext,
  NativeComboBoxOptionsContext,
  NativeComboBoxStateContext,
  NativeComboBoxTextContext,
  NativeComboBoxItemTextBindingContext,
} from "./collectionContext"
import {
  getNativeComboBoxPressRequest,
  getNativeComboBoxSelectionRequest,
  type TNativeComboBoxItemActionProps,
  type TNativeComboBoxItemRequest,
} from "./itemActions"
import { NativeComboBoxItemPressQueue } from "./itemPressQueue"

export type TNativeComboBoxItemRenderState = TNativeButtonRenderState & {
  isSelected: boolean
  isReadOnly: boolean
  isFocusVisible: boolean
  selectionMode: "none" | "single" | "multiple"
  selectionBehavior: "toggle" | "replace"
  allowsSelection: boolean
  hasAction: boolean
  allowsDragging: boolean
  isDragging: boolean | undefined
  isDropTarget: boolean | undefined
}
export const NATIVE_COMBO_BOX_ITEM_TEXT_SIZES = ["small", "medium", "large"] as const
export type TNativeComboBoxItemTextSize = (typeof NATIVE_COMBO_BOX_ITEM_TEXT_SIZES)[number]
export type TNativeComboBoxItemProps = Omit<TNativeButtonProps, "children" | "id" | "onPressUp" | "render" | "style"> &
  TNativeComboBoxItemActionProps & {
    onPressUp?: (event: TNativePressEvent | TNativeWindowPointerEvent) => void
    id?: string | number
    value?: object
    textValue?: string
    isReadOnly?: boolean
    textSize?: TNativeComboBoxItemTextSize
    style?:
      | StyleProp<TextStyle>
      | ((state: TNativeComboBoxItemRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
    render?: (props: Parameters<TNativePressableRender>[0], state: TNativeComboBoxItemRenderState) => ReactElement
    children?:
      | React.ReactNode
      | ((state: TNativeComboBoxItemRenderState & { defaultChildren: undefined }) => React.ReactNode)
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
    render,
    textSize,
    onPress,
    onPressStart,
    onPressEnd,
    onPressChange,
    onPressUp,
    onPointerDown,
    onHoverStart,
    href: _href,
    onAction: _action,
    onNavigate: _navigate,
    onNavigationError: _navigationError,
    ...native
  } = props
  const state = useContext(NativeComboBoxStateContext)
  const options = useContext(NativeComboBoxOptionsContext)
  const list = useContext(NativeComboBoxListBehaviorContext)
  const actions = useContext(NativeCollectionActionsContext)
  const cycle = useRef<{ binding: string; target: View | null } | null>(null)
  const pointerType = useRef<"touch" | "mouse" | "pen" | null>(null)
  const pointerKey = useId()
  const pointerRegistration = useRef<{ target: View; node: typeof node; release: () => void } | null>(null)
  const pressQueue = useRef<{ target: View; node: typeof node; queue: NativeComboBoxItemPressQueue } | null>(null)
  if (!state || !options) throw new Error("ComboBoxItem requires a native collection ComboBox")
  const theme = useNativeTheme()
  const content = useNativeContentContext()
  const textStyle = useRef<TextStyle>({})
  const textBindingLive = useRef(false)
  const [textBindings, setTextBindings] = useState(
    new Map<object, { slot: "label" | "description"; target: TNativeTextRef; nativeID: string }>(),
  )
  useInsertionEffect(() => {
    textBindingLive.current = true
    return () => {
      textBindingLive.current = false
    }
  }, [])
  const registerText = useCallback(
    (token: object, slot: "label" | "description", target: TNativeTextRef | null, nativeID: string | undefined) => {
      if (!textBindingLive.current) return
      setTextBindings((old) => {
        const previous = old.get(token)
        if (
          target && nativeID
            ? previous?.target === target && previous.nativeID === nativeID && previous.slot === slot
            : !previous
        )
          return old
        const next = new Map(old)
        if (target && nativeID) next.set(token, { slot, target, nativeID })
        else next.delete(token)
        return next
      })
    },
    [],
  )
  const textIDs = (slot: "label" | "description") => [
    ...new Set(
      [...textBindings.values()].filter((binding) => binding.slot === slot).map((binding) => binding.nativeID),
    ),
  ]
  const labelIDs = textIDs("label"),
    descriptionIDs = textIDs("description")
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
  useEffect(() => {
    if (disabled && state.selectionManager.focusedKey === node.key) state.selectionManager.setFocusedKey(null)
  }, [disabled, state.selectionManager, node.key])
  const currentFocus = useRef({ state, disabled, virtual: list.shouldUseVirtualFocus, node, actions })
  const currentPointer = useRef({ disabled, readOnly, list, options, node, props })
  const focusAttempt = useRef<{ target: View; binding: string } | null>(null)
  useInsertionEffect(() => {
    currentFocus.current = { state, disabled, virtual: list.shouldUseVirtualFocus, node, actions }
    currentPointer.current = { disabled, readOnly, list, options, node, props }
  })
  useLayoutEffect(() => {
    const original = target.current
    if (
      pointerRegistration.current &&
      (pointerRegistration.current.target !== original || pointerRegistration.current.node !== node)
    ) {
      pointerRegistration.current.release()
      pointerRegistration.current = null
    }
    if (!original || pointerRegistration.current) return
    const admitted = () => {
      const latest = currentPointer.current
      return (
        target.current === original &&
        latest.node === node &&
        !latest.disabled &&
        !latest.readOnly &&
        !latest.props.isPending &&
        !latest.props.onAction &&
        !latest.list.onAction &&
        latest.list.shouldSelectOnPressUp &&
        latest.list.shouldFocusOnHover
      )
    }
    pointerRegistration.current = {
      target: original,
      node,
      release: options.registerPointerOption(pointerKey, {
        target: original,
        current: admitted,
        release: (event) => {
          submit(event, getNativeComboBoxSelectionRequest(currentPointer.current.props), admitted)
          emit(event, () => currentPointer.current.props.onPressUp?.(event))
        },
      }),
    }
  })
  useLayoutEffect(
    () => () => {
      pointerRegistration.current?.release()
      pointerRegistration.current = null
    },
    [options.registerPointerOption],
  )
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
  useInsertionEffect(() => () => pressQueue.current?.queue.retire(), [])
  const queue = () => {
    const original = target.current
    if (!original) return null
    if (pressQueue.current?.target !== original || pressQueue.current.node !== node) {
      pressQueue.current?.queue.retire()
      pressQueue.current = {
        target: original,
        node,
        queue: new NativeComboBoxItemPressQueue(
          () => target.current === original && currentPointer.current.node === node,
        ),
      }
    }
    return pressQueue.current.queue
  }
  const emit = (event: TNativePressEvent | TNativeWindowPointerEvent, callback: () => void) => {
    event.persist()
    queue()?.emit(callback)
  }
  const submit = (
    event: TNativePressEvent | TNativeWindowPointerEvent,
    operation: TNativeComboBoxItemRequest,
    admitted: () => boolean,
  ) => {
    const original = target.current
    event.persist()
    const pendingQueue = queue()
    pendingQueue?.push((complete) => {
      options.press(node, original, event, admitted, operation, (outcome) => {
        if (outcome === "accepted") complete()
        else if (outcome === "failed") pendingQueue.retire()
        else void Promise.resolve().then(complete)
      })
    })
  }
  const origin = (event: TNativePressEvent) =>
    "kind" in event.nativeEvent
      ? event.nativeEvent.kind === "keyboard"
        ? "keyboard"
        : "virtual"
      : (pointerType.current ?? "touch")
  const request = (event: TNativePressEvent, operation: TNativeComboBoxItemRequest) => {
    const started = cycle.current
    if (!started || started.target !== target.current || started.binding !== actions?.bindingFor(node)) return
    submit(event, operation, () => {
      const latest = currentPointer.current
      return (
        !latest.disabled &&
        !latest.readOnly &&
        !latest.props.isPending &&
        latest.node === node &&
        target.current === started.target
      )
    })
  }
  const hasAction = !!props.onAction || !!list.onAction
  const values = (flags: TNativeButtonRenderState): TNativeComboBoxItemRenderState => ({
    ...flags,
    isSelected: selected,
    isReadOnly: readOnly,
    isFocused: focused,
    isFocusVisible: !!focusVisible,
    selectionMode: state.selectionManager.selectionMode,
    selectionBehavior: state.selectionManager.selectionBehavior,
    allowsSelection:
      !disabled && !readOnly && !props.isPending && !hasAction && state.selectionManager.canSelectItem(node.key),
    hasAction: !disabled && !readOnly && !props.isPending && hasAction,
    allowsDragging: false,
    isDragging: undefined,
    isDropTarget: undefined,
  })
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
          {...{
            nativeLabelledBy: labelIDs.length ? labelIDs : undefined,
            nativeDescribedBy: descriptionIDs.length ? descriptionIDs : undefined,
          }}
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
          accessibilityLabel={props.accessibilityLabel ?? props["aria-label"]}
          accessibilityState={{ ...props.accessibilityState, selected }}
          aria-selected={undefined}
          isDisabled={disabled}
          nativeInteraction={!readOnly}
          nativeMinPressDuration={0}
          nativeRender={render ? (props, flags) => render(props, values(flags)) : undefined}
          nativeStyle={(flags) => {
            const foregroundColor = list.textStyle?.color ?? content?.foregroundColor ?? theme.colors.controlForeground
            const variant = textSize === "small" ? "b11" : textSize === "large" ? "b9" : "b10"
            const computed: TextStyle = {
              ...list.textStyle,
              color: foregroundColor,
              fontSize: theme.typography.fontSizes[variant],
              fontFamily: theme.typography.fontFamilies.body,
              fontWeight: theme.typography.fontWeights.regular,
              lineHeight: theme.typography.lineHeight,
              width: "100%",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              padding: theme.spacing.unit,
              minHeight: nativeControlTarget(),
              borderRadius: theme.radius.rounded,
              backgroundColor:
                selected || focused || flags.isHovered ? theme.colors.controlHoverBackground : "transparent",
              ...(props.href ? { textDecorationLine: flags.isHovered ? "underline" : "none" } : {}),
              opacity: disabled ? theme.opacity.disabled : 1,
            }
            const merged = getNativeControlRootStyle(
              "ComboBoxItem",
              computed,
              customStyles,
              style,
              values({ ...flags, foregroundColor }),
            )
            // Clearing an inline override leaves the item's owned source classes active.
            const resolved = {
              ...merged,
              ...Object.fromEntries(
                Object.entries(computed).filter(([key]) => merged[key as keyof TextStyle] === undefined),
              ),
            }
            const split = splitNativeTextStyle(resolved)
            textStyle.current = split.text
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
          onPointerDown={(event) => {
            const type = event.nativeEvent.pointerType
            pointerType.current = type === "mouse" || type === "pen" ? type : "touch"
            onPointerDown?.(event)
          }}
          onPressUp={(event) => {
            if (origin(event) === "mouse" && list.shouldSelectOnPressUp && list.shouldFocusOnHover && !hasAction)
              request(event, getNativeComboBoxSelectionRequest(props))
            emit(event, () => onPressUp?.(event))
          }}
          onPressEnd={(event) => emit(event, () => onPressEnd?.(event))}
          onPressChange={(pressed) => queue()?.emit(() => onPressChange?.(pressed))}
          onPress={(event) => {
            const type = origin(event)
            if (hasAction)
              request(
                event,
                getNativeComboBoxPressRequest(props, list.onAction ? () => list.onAction!(node.key) : undefined),
              )
            else if (
              type !== "keyboard" &&
              (type !== "mouse" || (list.shouldSelectOnPressUp && !list.shouldFocusOnHover))
            )
              request(event, getNativeComboBoxSelectionRequest(props))
            if (type === "touch" && !disabled && !readOnly) {
              state.selectionManager.setFocused(true)
              state.selectionManager.setFocusedKey(node.key)
            }
            emit(event, () => onPress?.(event))
            cycle.current = null
            pointerType.current = null
          }}
          onPressStart={(event) => {
            cycle.current = { binding: actions?.bindingFor(node) ?? "", target: target.current }
            const type = origin(event)
            if (type !== "touch" && !disabled && !readOnly) {
              state.selectionManager.setFocused(true)
              state.selectionManager.setFocusedKey(node.key)
            }
            if (
              (type === "keyboard" && (!hasAction || ("key" in event.nativeEvent && event.nativeEvent.key === " "))) ||
              (type === "mouse" && !list.shouldSelectOnPressUp && !hasAction)
            )
              request(event, getNativeComboBoxSelectionRequest(props))
            emit(event, () => onPressStart?.(event))
          }}
        >
          {(flags) => (
            <NativeCollectionSemanticsContext.Provider value="">
              <NativeComboBoxItemTextBindingContext.Provider value={registerText}>
                <NativeComboBoxTextContext.Provider
                  value={{
                    slots: {
                      [NATIVE_DEFAULT_SLOT]: {
                        nativeID: `${pointerKey}-label`,
                        accessible: false,
                      },
                      label: { nativeID: `${pointerKey}-label`, accessible: false },
                      description: {
                        nativeID: `${pointerKey}-description`,
                        accessible: false,
                      },
                    },
                  }}
                >
                  <NativeSelectionIndicatorContext.Provider value={{ isSelected: selected }}>
                    {getNativeButtonContent(
                      typeof children === "function"
                        ? children({ ...values(flags), defaultChildren: undefined })
                        : children,
                      textStyle.current,
                    )}
                  </NativeSelectionIndicatorContext.Provider>
                </NativeComboBoxTextContext.Provider>
              </NativeComboBoxItemTextBindingContext.Provider>
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
