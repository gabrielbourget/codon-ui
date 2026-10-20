import {
  forwardRef,
  useContext,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import { View, type TextStyle } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  NativeCollectionCellFocusContext,
} from "../../collection/renderer"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"

import { NativeMenuActionsContext, type TNativeMenuRegistration } from "./context"
import { encodeNativeMenuKey, validateNativeMenuKey } from "./model"
import { getNativeMenuItemStyles } from "./styles"
import { NATIVE_MENU_ITEM_VARIANTS, type TNativeMenuItemProps, type TNativeMenuItemRef } from "./types"

const textContent = (value: TNativeMenuItemProps["children"]): string => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value)
  if (Array.isArray(value)) return value.map(textContent).join("")
  return ""
}
const MenuItemReceiver = forwardRef<
  TNativeMenuItemRef,
  TNativeMenuItemProps & { collectionNode: TNativeCollectionNode<unknown> }
>((props, ref) => {
  const {
    collectionNode,
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
    accessibilityState,
    isDisabled: authoredDisabled,
    testID,
    "data-testid": aliasTestID,
    ...native
  } = props
  const nativeCellFocus = useContext(NativeCollectionCellFocusContext)
  const context = useContext(NativeMenuActionsContext)
  if (!context) throw new Error("MenuItem requires a native Menu")
  const generated = useId(),
    id = authoredId ?? generated
  validateNativeMenuKey(id)
  if (!NATIVE_MENU_ITEM_VARIANTS.includes(variant)) throw new TypeError("MenuItem: unsupported variant")
  const theme = useNativeTheme()
  const view = useRef<View>(null)
  const textStyle = useRef<TextStyle>({})
  const current = useRef(props)
  useInsertionEffect(() => {
    current.current = props
  })
  const row = useMemo<TNativeMenuRegistration>(
    () => ({
      id,
      node: collectionNode,
      view,
      props: () => current.current,
      text: () => current.current.textValue ?? textContent(current.current.children),
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
  const disabled = authoredDisabled ?? context.disabled(row)
  const selected = context.selected(row)
  const role = context.mode === "single" ? "radio" : context.mode === "multiple" ? "checkbox" : "menuitem"
  return (
    <NativeButton
      {...native}
      key={lifetime}
      ref={view}
      nativeRole={role}
      isDisabled={disabled}
      testID={testID ?? aliasTestID ?? "menu-item"}
      accessibilityLabel={props.accessibilityLabel ?? props["aria-label"] ?? textValue ?? textContent(children)}
      accessibilityState={{ ...accessibilityState, ...(context.mode === "none" ? {} : { checked: selected }) }}
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
            selectionMode: context.mode,
            selectionBehavior: "toggle",
            hasSubmenu: false,
            isOpen: false,
          },
          context.text,
        )
        textStyle.current = style.text
        return [style.view, style.text]
      }}
      onLayout={(event) => {
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
        onHoverStart?.(event)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        const data = event.nativeEvent
        if (event.defaultPrevented || event.isDefaultPrevented?.() || data.cancelled) return
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
  )
})
MenuItemReceiver.displayName = "MenuItemReceiver"
export const MenuItem = createNativeCollectionLeaf<unknown, TNativeMenuItemProps, TNativeMenuItemRef>(
  "item",
  (props, ref, node) => {
    const actions = useContext(NativeCollectionActionsContext)
    return (
      <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(node) ?? ""}>
        <MenuItemReceiver {...props} id={node.key} collectionNode={node} ref={ref} />
      </NativeCollectionItemBindingContext.Provider>
    )
  },
)
MenuItem.displayName = "MenuItem"
