import {
  forwardRef,
  useContext,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Platform, View, type PointerEvent, type TextStyle } from "react-native"
import Svg, { Path } from "react-native-svg"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  NativeCollectionCellFocusContext,
} from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { NativeFocusView } from "../../input/NativeFocusView"
import type { TNativeFocusEvent, TNativePressEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { NativeButton, Button } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import type { TNativeButtonRenderState } from "../Button/types"
import { encodeCollectionKey, validateCollectionKey } from "../collection"
import { NativeContentContext } from "../NativeContentContext"

import {
  NativeTagGroupActionsContext,
  NativeTagItemValueContext,
  type TNativeTagPressMetadata,
  type TNativeTagRegistration,
} from "./context"
import { NATIVE_TAG_GROUP_POINTER_TYPES } from "./intent"
import { getNativeGroupedTagStyles } from "./styles"
import type { TNativeGroupedTagProps, TNativeGroupedTagRef } from "./types"
import type { TNativeGroupedTagState } from "./visualTypes"

const textContent = (value: TNativeGroupedTagProps["children"]): string =>
  typeof value === "string" || typeof value === "number" || typeof value === "bigint"
    ? String(value)
    : Array.isArray(value)
      ? value.map(textContent).join("")
      : ""
const TagReceiver = forwardRef<
  TNativeGroupedTagRef,
  TNativeGroupedTagProps & { collectionNode: TNativeCollectionNode<unknown> }
>((props, ref) => {
  const {
    collectionNode,
    id: authoredId,
    textValue,
    children,
    closeIcon,
    customStyles: _custom,
    style: _style,
    color: _color,
    order: _order,
    geometry: _geometry,
    width: _width,
    height: _height,
    transparent: _transparent,
    raised: _raised,
    enableFocusStyle: _focusStyle,
    offsetFocusRing: _offset,
    onAction: _action,
    href,
    onNavigate: _navigate,
    onNavigationError: _error,
    isDisabled: _disabled,
    onPress,
    onPressStart,
    onPressEnd,
    onPressChange,
    onPressUp,
    onPressIn,
    onPressOut,
    onLongPress,
    onPointerDown,
    onFocus,
    onBlur,
    onFocusChange,
    onKeyDown,
    onKeyUp,
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    onHoverIn,
    onHoverOut,
    "aria-selected": _selectedAlias,
    "aria-checked": _checkedAlias,
    "aria-expanded": _expandedAlias,
    "aria-disabled": _disabledAlias,
    "aria-busy": _busyAlias,
    accessibilityState,
    testID,
    "data-testid": aliasTestID,
    ...native
  } = props
  const nativeCellFocus = useContext(NativeCollectionCellFocusContext)
  const group = useContext(NativeTagGroupActionsContext),
    value = useContext(NativeTagItemValueContext),
    generated = useId()
  if (!group) throw new Error("TagGroup.Tag requires a native TagGroup")
  const key = authoredId ?? value?.key ?? generated
  validateCollectionKey(key, "id", "TagGroup.Tag")
  const theme = useNativeTheme(),
    view = useRef<View>(null),
    removeView = useRef<View>(null),
    current = useRef(props)
  useInsertionEffect(() => {
    current.current = props
  })
  const row = useMemo<TNativeTagRegistration>(
    () => ({
      key,
      node: collectionNode,
      view,
      removeView,
      order: value?.order,
      props: () => current.current,
      text: () =>
        current.current.textValue ??
        current.current.accessibilityLabel ??
        current.current["aria-label"] ??
        textContent(current.current.children),
    }),
    [key, value?.order, collectionNode],
  )
  const register = group.register,
    refresh = group.refresh
  useLayoutEffect(() => register(row), [register, row])
  const metadata = JSON.stringify([key, href, props.isDisabled, textValue ?? textContent(children)])
  useLayoutEffect(() => refresh(row), [refresh, row, metadata])
  const [focused, setFocused] = useState(false),
    [visible, setVisible] = useState(false)
  const disabled = group.disabled(row, props),
    actions = group.actionState(row, props)
  const interactive = actions.allowsSelection || actions.hasPrimaryAction
  const lifetime = JSON.stringify([encodeCollectionKey(key), href, interactive])
  useImperativeHandle(ref, () => view.current!, [lifetime])
  const pointer = useRef<TNativeTagPressMetadata | null>(null),
    cycle = useRef<{ primary: boolean; long: boolean } | null>(null),
    lastMouse = useRef<number | undefined>(undefined),
    textStyle = useRef<TextStyle>({})
  const stateFor = (flags?: TNativeButtonRenderState): TNativeGroupedTagState => ({
    isSelected: group.selected(row),
    isDisabled: disabled,
    isHovered: flags?.isHovered ?? false,
    isPressed: flags?.isPressed ?? false,
    isFocused: flags?.isFocused ?? focused,
    isFocusVisible: visible,
    allowsSelection: actions.allowsSelection,
    hasAction: actions.hasAction,
    allowsRemoving: group.allowsRemoving,
    selectionMode: group.mode,
    selectionBehavior: group.behavior,
  })
  const eventMetadata = (event: TNativePressEvent): TNativeTagPressMetadata => {
    const data = event.nativeEvent
    if ("kind" in data) {
      if (data.kind === "keyboard")
        return {
          pointerType: "keyboard",
          key: data.key,
          shiftKey: data.shiftKey,
          selectionModifier: Platform.OS === "ios" ? data.metaKey : data.ctrlKey,
          nonContiguousModifier: Platform.OS === "ios" ? data.altKey : data.ctrlKey,
        }
      return { pointerType: "virtual", shiftKey: false, selectionModifier: false, nonContiguousModifier: false }
    }
    return (
      pointer.current ?? {
        pointerType: "identifier" in data ? "touch" : "unknown",
        shiftKey: false,
        selectionModifier: false,
        nonContiguousModifier: false,
      }
    )
  }
  const focus = (next: boolean, event: TNativeFocusEvent) => {
    setFocused(next)
    setVisible(next && event.nativeEvent.isFocusVisible)
    if (next) nativeCellFocus?.(event)
    group.focus(row, next, event.nativeEvent.isFocusVisible)
    if (next) onFocus?.(event)
    else onBlur?.(event)
    onFocusChange?.(next)
  }
  const label = props.accessibilityLabel ?? props["aria-label"] ?? textValue ?? textContent(children)
  const content = (state: TNativeGroupedTagState, foreground: TNativeButtonRenderState["foregroundColor"]) => {
    const rendered = typeof children === "function" ? children(state) : children
    const authoredRemove = group.labels.removeButtonAriaLabel
    const removeLabel =
      typeof authoredRemove === "function" ? authoredRemove(row.text(), key) : (authoredRemove ?? "Remove")
    return (
      <NativeCollectionSemanticsContext.Provider value="">
        <NativeCollectionRendererContext.Provider value={DefaultNativeCollectionRenderer}>
          <NativeContentContext.Provider value={{ foregroundColor: foreground, isButton: false }}>
            <View
              role="cell"
              accessible={false}
              style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.unit }}
            >
              {getNativeButtonContent(rendered, textStyle.current)}
              {group.allowsRemoving ? (
                <Button
                  ref={removeView}
                  testID="tag-remove-button"
                  accessibilityLabel={removeLabel === "" ? "" : `${removeLabel} ${row.text()}`}
                  isDisabled={disabled}
                  geometry="orthogonal"
                  raised={false}
                  customStyles={{ backgroundColor: "transparent", borderWidth: 0, padding: 0, color: foreground }}
                  onFocus={(event) => group.focus(row, true, event.nativeEvent.isFocusVisible)}
                  onBlur={(event) => group.focus(row, false, event.nativeEvent.isFocusVisible)}
                  onPress={(event) => group.remove(row, "button", event)}
                  onKeyDown={(event) => group.keyCapture(row, event)}
                >
                  {closeIcon || (
                    <Svg
                      testID="tag-default-close-icon"
                      width={15}
                      height={15}
                      viewBox="0 0 24 24"
                      fill={foreground}
                      accessible={false}
                      aria-hidden
                    >
                      <Path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </Svg>
                  )}
                </Button>
              ) : null}
            </View>
          </NativeContentContext.Provider>
        </NativeCollectionRendererContext.Provider>
      </NativeCollectionSemanticsContext.Provider>
    )
  }
  const owned = {
    accessibilityLabel: label,
    accessibilityState: {
      ...accessibilityState,
      selected: group.mode === "none" ? undefined : group.selected(row),
      disabled,
    },
    testID: testID ?? aliasTestID ?? "tag",
    onFocus: (event: TNativeFocusEvent) => focus(true, event),
    onBlur: (event: TNativeFocusEvent) => focus(false, event),
  }
  if (!interactive) {
    const state = stateFor(),
      style = getNativeGroupedTagStyles(theme, props, state)
    textStyle.current = style.text
    return (
      <NativeCollectionSemanticsContext.Provider value={group.semantics(row)}>
        <NativeFocusView
          {...native}
          {...owned}
          key={lifetime}
          ref={view}
          role="row"
          accessible={!group.allowsRemoving}
          focusable={!disabled && props.focusable !== false && props.tabIndex !== -1}
          style={style.view}
          onKeyDown={(event) => {
            group.keyCapture(row, event)
            onKeyDown?.(event)
          }}
          onKeyUp={onKeyUp}
        >
          {content(state, style.foregroundColor)}
        </NativeFocusView>
      </NativeCollectionSemanticsContext.Provider>
    )
  }
  return (
    <NativeCollectionSemanticsContext.Provider value={group.semantics(row)}>
      <NativeButton
        {...native}
        {...owned}
        key={lifetime}
        ref={view}
        nativeRole="row"
        isDisabled={disabled}
        aria-selected={undefined}
        aria-checked={undefined}
        aria-expanded={undefined}
        accessibilityHint={
          props.accessibilityHint ??
          (group.allowsRemoving && visible
            ? (group.labels.removeDescription ?? "Press Delete or Backspace to remove.")
            : undefined)
        }
        style={(flags) => {
          const style = getNativeGroupedTagStyles(theme, props, stateFor(flags))
          textStyle.current = style.text
          return [style.view, style.text]
        }}
        onPointerDown={(event: PointerEvent) => {
          onPointerDown?.(event)
          const data = event.nativeEvent
          pointer.current = {
            pointerType: NATIVE_TAG_GROUP_POINTER_TYPES.includes(data.pointerType as never)
              ? (data.pointerType as TNativeTagPressMetadata["pointerType"])
              : "unknown",
            shiftKey: data.shiftKey,
            selectionModifier: Platform.OS === "ios" ? data.metaKey : data.ctrlKey,
            nonContiguousModifier: Platform.OS === "ios" ? data.altKey : data.ctrlKey,
            suppressed: event.defaultPrevented || event.isDefaultPrevented?.(),
          }
        }}
        onPressStart={(event) => {
          cycle.current = { primary: actions.hasPrimaryAction, long: false }
          group.press(row, "start", event, eventMetadata(event))
          onPressStart?.(event)
        }}
        onPress={(event) => {
          const data = eventMetadata(event),
            timestamp = "timestamp" in event.nativeEvent ? event.nativeEvent.timestamp : undefined
          group.press(row, "release", event, {
            ...data,
            primaryAtStart: cycle.current?.primary,
            suppressed: data.suppressed || cycle.current?.long,
          })
          if (data.pointerType === "mouse" && typeof timestamp === "number") {
            if (
              lastMouse.current !== undefined &&
              timestamp >= lastMouse.current &&
              timestamp - lastMouse.current <= 500
            ) {
              group.press(row, "double", event, data)
              lastMouse.current = undefined
            } else lastMouse.current = timestamp
          }
          onPress?.(event)
          cycle.current = null
        }}
        onLongPress={(event) => {
          const data = eventMetadata(event)
          if (cycle.current && data.pointerType === "touch" && actions.longPressEnabled) cycle.current.long = true
          group.press(row, "long", event, data)
          onLongPress?.(event)
        }}
        onPressEnd={onPressEnd}
        onPressChange={onPressChange}
        onPressUp={onPressUp}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onKeyDown={(event) => {
          group.keyCapture(row, event)
          onKeyDown?.(event)
        }}
        onKeyUp={onKeyUp}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
        onHoverChange={onHoverChange}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
      >
        {(flags) => content(stateFor(flags), flags.foregroundColor)}
      </NativeButton>
    </NativeCollectionSemanticsContext.Provider>
  )
})
TagReceiver.displayName = "TagGroup.TagReceiver"
type TCollectionTagProps = TNativeGroupedTagProps & { value?: unknown }
const CollectionTag = createNativeCollectionLeaf<unknown, TCollectionTagProps, TNativeGroupedTagRef>(
  "item",
  (props, ref, node) => {
    const actions = useContext(NativeCollectionActionsContext)
    return (
      <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(node) ?? ""}>
        <TagReceiver {...props} id={node.key} textValue={node.textValue} collectionNode={node} ref={ref} />
      </NativeCollectionItemBindingContext.Provider>
    )
  },
)
export const Tag = forwardRef<TNativeGroupedTagRef, TNativeGroupedTagProps>((props, ref) => {
  const value = useContext(NativeTagItemValueContext)
  return (
    <CollectionTag
      {...props}
      value={(props as TCollectionTagProps).value ?? value?.value}
      id={props.id ?? value?.key}
      textValue={props.textValue ?? props.accessibilityLabel ?? props["aria-label"] ?? textContent(props.children)}
      ref={ref}
    />
  )
})
Tag.displayName = "TagGroup.Tag"
