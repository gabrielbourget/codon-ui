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
import { findNodeHandle, View, type TextStyle } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { useNativeContextProps } from "../../collection/context"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  NativeCollectionCellFocusContext,
} from "../../collection/renderer"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeKeyTokens } from "../../input/keyScope"
import { useNativeKeyPolicy } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"

import {
  NativeMenuActionsContext,
  NativeMenuItemContext,
  NativeMenuSelectionManagerContext,
  NativeSubmenuItemContext,
  type TNativeMenuRegistration,
} from "./context"
import { encodeNativeMenuKey, validateNativeMenuKey } from "./model"
import { getNativeMenuItemStyles } from "./styles"
import { NATIVE_MENU_ITEM_VARIANTS, type TNativeMenuItemProps, type TNativeMenuItemRef } from "./types"

const textContent = (value: TNativeMenuItemProps["children"]): string => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value)
  if (Array.isArray(value)) return value.map(textContent).join("")
  return ""
}
const SubmenuKeyBinding = ({
  targetTag,
  direction,
  disabled,
  lifetime,
  onKey,
}: {
  targetTag: number
  direction: "ltr" | "rtl"
  disabled: boolean
  lifetime: string
  onKey: (event: TNativeKeyboardEvent) => void
}) => {
  useNativeKeyPolicy({
    tokens: nativeKeyTokens(direction === "rtl" ? "ArrowLeft" : "ArrowRight").filter((token) =>
      token.startsWith("0000:"),
    ),
    targetTag,
    excludeEditable: true,
    excludeComposing: true,
    isEnabled: !disabled && !!targetTag,
    lifetimeKey: lifetime,
    canAct: () => !disabled,
    onKey,
  })
  return null
}
const MenuItemReceiver = forwardRef<
  TNativeMenuItemRef,
  TNativeMenuItemProps & { collectionNode: TNativeCollectionNode<unknown> }
>((authoredProps, forwardedRef) => {
  const [props, ref] = useNativeContextProps(authoredProps, forwardedRef, NativeMenuItemContext)
  const {
    collectionNode,
    slot: _slot,
    id: authoredId,
    children,
    textValue,
    icon,
    variant = "default",
    customStyles: _custom,
    style: _style,
    onAction: _action,
    shouldCloseOnSelect: _close,
    href,
    onNavigate: _navigate,
    onNavigationError: _error,
    onPress,
    onKeyDown,
    onKeyUp,
    onFocus,
    onLayout,
    onHoverStart,
    onHoverEnd,
    accessibilityState,
    isDisabled: authoredDisabled,
    testID,
    "data-testid": aliasTestID,
    ...native
  } = props
  const nativeCellFocus = useContext(NativeCollectionCellFocusContext)
  const context = useContext(NativeMenuActionsContext)
  const selectionManager = useContext(NativeMenuSelectionManagerContext)
  const submenu = useContext(NativeSubmenuItemContext)
  if (!context || !selectionManager) throw new Error("MenuItem requires a native Menu")
  const generated = useId(),
    id = authoredId ?? generated
  validateNativeMenuKey(id)
  if (!NATIVE_MENU_ITEM_VARIANTS.includes(variant)) throw new TypeError("MenuItem: unsupported variant")
  const theme = useNativeTheme()
  const view = useRef<View>(null)
  const textStyle = useRef<TextStyle>({})
  const current = useRef(props)
  const currentManager = useRef(selectionManager)
  const currentSubmenu = useRef(submenu)
  useInsertionEffect(() => {
    current.current = props
    currentManager.current = selectionManager
    currentSubmenu.current = submenu
  })
  const row = useMemo<TNativeMenuRegistration>(
    () => ({
      id,
      node: collectionNode,
      view,
      props: () => current.current,
      text: () => current.current.textValue ?? textContent(current.current.children),
      selectionManager: () => currentManager.current,
      submenu: () => currentSubmenu.current?.state ?? null,
    }),
    [id, collectionNode],
  )
  const register = context.register,
    refresh = context.refresh
  useLayoutEffect(() => register(row), [register, row])
  const metadata = JSON.stringify([id, href, authoredDisabled, textValue ?? textContent(children)])
  useLayoutEffect(() => refresh(row), [refresh, row, metadata])
  const lifetime = JSON.stringify([encodeNativeMenuKey(id), href])
  useImperativeHandle(ref, () => view.current!, [lifetime])
  const disabled = authoredDisabled ?? selectionManager.isDisabled(id)
  const [targetTag, setTargetTag] = useState(0)
  const openSubmenu = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    if (
      !submenu ||
      disabled ||
      data.phase !== "down" ||
      data.cancelled ||
      data.repeat ||
      !data.nativeDefaultHandled ||
      data.altKey ||
      data.ctrlKey ||
      data.metaKey ||
      event.defaultPrevented ||
      event.isDefaultPrevented?.() ||
      data.key !== (submenu.direction === "rtl" ? "ArrowLeft" : "ArrowRight")
    )
      return false
    context.openSubmenu(row, "first")
    event.preventDefault()
    return true
  }
  const selected = selectionManager.isSelected(id)
  const mode = selectionManager.selectionMode
  const role = submenu ? "menuitem" : mode === "single" ? "radio" : mode === "multiple" ? "checkbox" : "menuitem"
  return (
    <>
      {submenu ? (
        <SubmenuKeyBinding
          targetTag={targetTag}
          direction={submenu.direction}
          disabled={disabled}
          lifetime={lifetime}
          onKey={(event) => {
            onKeyDown?.(event)
            openSubmenu(event)
          }}
        />
      ) : null}
      <NativeButton
        {...native}
        key={lifetime}
        ref={view}
        nativeID={submenu?.triggerID ?? props.nativeID}
        nativeRole={role}
        isDisabled={disabled}
        testID={testID ?? aliasTestID ?? "menu-item"}
        accessibilityLabel={props.accessibilityLabel ?? props["aria-label"] ?? textValue ?? textContent(children)}
        accessibilityState={{
          ...accessibilityState,
          ...(mode === "none" || submenu ? {} : { checked: selected }),
          ...(submenu ? { expanded: submenu.state.isOpen } : {}),
        }}
        aria-checked={undefined}
        aria-selected={undefined}
        aria-expanded={undefined}
        style={(state) => {
          const style = getNativeMenuItemStyles(
            theme,
            props,
            {
              isSelected: selected,
              isDisabled: disabled,
              isHovered: state.isHovered,
              isPressed: state.isPressed,
              isFocused: state.isFocused,
              isFocusVisible: state.isFocused && Number(state.defaultStyle.outlineWidth ?? 0) > 0,
              selectionMode: mode,
              selectionBehavior: selectionManager.selectionBehavior,
              hasSubmenu: !!submenu,
              isOpen: submenu?.state.isOpen ?? false,
            },
            context.text,
          )
          textStyle.current = style.text
          return [style.view, style.text]
        }}
        onLayout={(event) => {
          setTargetTag(findNodeHandle(view.current) ?? 0)
          context.layout(row, event.nativeEvent.layout)
          onLayout?.(event)
        }}
        onFocus={(event) => {
          nativeCellFocus?.(event)
          context.focus(row)
          onFocus?.(event)
        }}
        onHoverStart={(event) => {
          context.requestFocus(row)
          submenu?.hover(true, (isCurrent) => context.openSubmenu(row, undefined, isCurrent))
          onHoverStart?.(event)
        }}
        onHoverEnd={(event) => {
          submenu?.hover(false, (isCurrent) => context.openSubmenu(row, undefined, isCurrent))
          onHoverEnd?.(event)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          const data = event.nativeEvent
          if (event.defaultPrevented || event.isDefaultPrevented?.() || data.cancelled) return
          if (openSubmenu(event)) return
          if (data.key === "Enter" || data.key === " ") {
            if (!data.repeat && data.nativeDefaultHandled) context.activate(row, event)
          } else if (!data.altKey && !data.ctrlKey && !data.metaKey && [...data.key].length === 1)
            context.typeahead(row, data.key, data.timestamp)
        }}
        onKeyUp={onKeyUp}
        onPress={(event) => {
          onPress?.(event)
          if (!("kind" in event.nativeEvent && event.nativeEvent.kind === "keyboard")) context.activate(row, event)
        }}
      >
        {() => (
          <NativeCollectionRendererContext.Provider value={DefaultNativeCollectionRenderer}>
            {icon !== undefined ? (
              <View testID="menu-item-icon" style={{ flexShrink: 0, flexDirection: "row", alignItems: "center" }}>
                {icon}
              </View>
            ) : null}
            {getNativeButtonContent(children, textStyle.current)}
          </NativeCollectionRendererContext.Provider>
        )}
      </NativeButton>
    </>
  )
})
MenuItemReceiver.displayName = "MenuItemReceiver"
export const MenuItem = createNativeCollectionLeaf<unknown, TNativeMenuItemProps, TNativeMenuItemRef>(
  "item",
  (props, ref, node) => {
    const actions = useContext(NativeCollectionActionsContext)
    return (
      <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(node) ?? ""}>
        <MenuItemReceiver {...props} id={node.key} textValue={node.textValue} collectionNode={node} ref={ref} />
      </NativeCollectionItemBindingContext.Provider>
    )
  },
)
MenuItem.displayName = "MenuItem"
