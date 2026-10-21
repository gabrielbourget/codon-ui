import {
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  type ForwardedRef,
  type ReactNode,
  type RefAttributes,
} from "react"
import { findNodeHandle, ScrollView, type TextInput, type View } from "react-native"
import Svg, { Polyline } from "react-native-svg"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { useNativeCachedChildren } from "../../collection/cachedChildren"
import { NativeCollectionBuilder } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs, useNativeContextProps } from "../../collection/context"
import {
  NativeCollectionRendererContext,
  useNativePersistedKeys,
  type TNativeCollectionScrollHost,
} from "../../collection/renderer"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { NativeListStateContext } from "../../collection/state"
import { focusNativeTarget } from "../../input/focus"
import type { TNativeObservedKeyboardEvent } from "../../input/keyboardObservation"
import { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativePressEvent } from "../../input/types"
import type { TNativeKeyboardEvent } from "../../input/types"
import type { TNativeFloatingPlacement } from "../../overlays/floating/placement"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { NativeFloatingSurface } from "../ClickPopover/ClickPopover"
import { encodeCollectionKey, validateCollectionKey } from "../collection"
import { Input } from "../Input/Input"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import {
  NativeComboBoxContext,
  NativeComboBoxGroupContext,
  NativeComboBoxPopoverContext,
  NativeComboBoxItemValueContext,
  NativeComboBoxOptionsContext,
  NativeComboBoxStateContext,
} from "./collectionContext"
import { NativeComboBoxItem } from "./ComboBoxItem"
import { createNativeComboBoxFilter } from "./filter"
import { NativeComboBoxKeyBinding } from "./keyboard"
import { useComboBoxState } from "./state/useComboBoxState"
import { getNativeComboBoxStyles } from "./styles"
import type { TNativeComboBoxProps, TNativeComboBoxRef } from "./types"

export type TNativeCollectionComboBoxProps<T extends object> = TNativeComboBoxProps<T> & {
  children?: ReactNode | ((item: T) => ReactNode)
  placement?: TNativeFloatingPlacement
  shouldFocusWrap?: boolean
  slot?: string | null
  locale?: string
  defaultFilter?: (text: string, query: string) => boolean
  dependencies?: readonly unknown[]
}
const AuthoredItem = ({
  id,
  value,
  text,
  content,
  renderItem,
}: {
  id: string | number
  value: object
  text: string
  content: ReactNode
  renderItem?: TNativeComboBoxProps<object>["renderItem"]
}) => (
  <NativeComboBoxItemValueContext.Provider value={{ key: id, value, text }}>
    {isValidElement(content) ? (
      content
    ) : (
      <NativeComboBoxItem id={id} textValue={text}>
        {content ??
          ((flags) =>
            renderItem?.(value, { ...flags, isSelected: flags.isSelected, isReadOnly: flags.isReadOnly }) ?? text)}
      </NativeComboBoxItem>
    )}
  </NativeComboBoxItemValueContext.Provider>
)
const Authoring = <T extends object>({ props }: { props: TNativeCollectionComboBoxProps<T> }) => {
  const values = useMemo(() => Array.from(props.items), [props.items])
  return useNativeCachedChildren({
    items: values,
    dependencies: props.dependencies,
    getReactKey: encodeCollectionKey,
    children:
      props.children != null && typeof props.children !== "function"
        ? props.children
        : (item) => {
            const key = props.getKey(item)
            validateCollectionKey(key, "item key", "ComboBox")
            const content = typeof props.children === "function" ? props.children(item) : undefined
            const authored = isValidElement<{ id?: string | number }>(content) ? content.props.id : undefined
            return (
              <AuthoredItem
                id={authored ?? key}
                value={item}
                text={props.getTextValue(item)}
                content={content}
                renderItem={props.renderItem as TNativeComboBoxProps<object>["renderItem"]}
              />
            )
          },
  })
}
const Receiver = <T extends object>({
  props,
  forwardedRef,
  collection,
}: {
  props: TNativeCollectionComboBoxProps<T>
  forwardedRef: ForwardedRef<TNativeComboBoxRef>
  collection: TNativeCollectionSnapshot<T>
}) => {
  const filter = useMemo(
    () => props.defaultFilter ?? createNativeComboBoxFilter(props.locale),
    [props.defaultFilter, props.locale],
  )
  const state = useComboBoxState({
    collection,
    defaultItems: props.items,
    value: props.value,
    defaultValue: props.defaultValue,
    inputValue: props.inputValue,
    defaultInputValue: props.defaultInputValue,
    onChange: props.onChange,
    onInputChange: props.onInputChange,
    isOpen: props.isOpen,
    defaultOpen: props.defaultOpen,
    onOpenChange: props.onOpenChange,
    disabledKeys: props.disabledKeys,
    isReadOnly: props.isReadOnly,
    isDisabled: props.isDisabled,
    allowsEmptyCollection: true,
    defaultFilter: filter,
  })
  const theme = useNativeTheme()
  const input = useRef<TextInput>(null)
  const anchor = useRef<View>(null)
  const popup = useRef<View>(null)
  const scroll = useRef<TNativeCollectionScrollHost | null>(null)
  const [focused, setFocused] = useState(false)
  const [inputTarget, setInputTarget] = useState(0)
  const bindInput = useCallback((target: TextInput | null) => {
    input.current = target
    setInputTarget(findNodeHandle(target) ?? 0)
  }, [])
  const pendingNavigation = useRef<"first" | "last" | null>(null)
  const renderer = useContext(NativeCollectionRendererContext)
  const { CollectionRoot } = renderer
  const actions = useContext(NativeCollectionActionsContext)
  const rows = useRef(new Map<string | number, { node: TNativeCollectionNode<unknown>; target: View }>())
  const live = useRef(false)
  const current = useRef({ props, state })
  useInsertionEffect(() => {
    current.current = { props, state }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      rows.current.clear()
    }
  }, [])
  const register = useCallback((node: TNativeCollectionNode<unknown>, target: View | null) => {
    if (target) rows.current.set(node.key, { node, target })
    else if (rows.current.get(node.key)?.node === node) rows.current.delete(node.key)
  }, [])
  const press = useCallback(
    (node: TNativeCollectionNode<unknown>, target: View | null, event: TNativePressEvent) => {
      const original = rows.current.get(node.key)
      if (
        !live.current ||
        !target ||
        original?.target !== target ||
        current.current.props.isDisabled ||
        current.current.props.isReadOnly
      )
        return
      event.persist()
      actions?.request(node, findNodeHandle(target) ?? 0, () => {
        const owner = current.current
        if (
          !live.current ||
          !owner.state.isOpen ||
          owner.props.isDisabled ||
          owner.props.isReadOnly ||
          rows.current.get(node.key) !== original ||
          event.defaultPrevented ||
          event.isDefaultPrevented?.()
        )
          return
        if (owner.state.disabledKeys.has(node.key)) return
        owner.state.selectionManager.replaceSelection(node.key)
        if (live.current && current.current.state.isOpen) current.current.state.setOpen(false)
      })
    },
    [actions],
  )
  const inputRef = useNativeCollectionRefs(props.inputRef, bindInput)
  const identity = props.testID ?? props["data-testid"] ?? "combo-box"
  const styles = getNativeComboBoxStyles(
    theme,
    props,
    {
      isOpen: state.isOpen,
      isDisabled: !!props.isDisabled,
      isReadOnly: !!props.isReadOnly,
      isInvalid: state.displayValidation.isInvalid,
    },
    focused,
    false,
    false,
  )
  const persistedKeys = useNativePersistedKeys(state.selectionManager.focusedKey)
  const enabledKeys = () =>
    [...current.current.state.collection.getKeys()].filter((key) => {
      const node = current.current.state.collection.getItem(key)
      return node?.type === "item" && !current.current.state.selectionManager.isDisabled(key)
    })
  useLayoutEffect(() => {
    if (!state.isOpen || !pendingNavigation.current) return
    const keys = enabledKeys()
    const key = pendingNavigation.current === "last" ? keys.at(-1) : keys[0]
    if (key == null) return
    pendingNavigation.current = null
    state.selectionManager.setFocusedKey(key)
  }, [state.isOpen, state.collection])
  useLayoutEffect(() => {
    const key = state.selectionManager.focusedKey
    if (key != null && state.isOpen) {
      renderer.layoutDelegate?.requestRendering?.(key)
      renderer.layoutDelegate?.scrollToKey?.(key)
    }
  }, [state.selectionManager.focusedKey, state.isOpen, renderer.layoutDelegate])
  const onKey = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent,
      owner = current.current
    if (
      !live.current ||
      owner.props.isDisabled ||
      owner.props.isReadOnly ||
      data.cancelled ||
      data.phase !== "down" ||
      !data.nativeDefaultHandled ||
      event.defaultPrevented ||
      event.isDefaultPrevented?.()
    )
      return
    if (!owner.state.isOpen) {
      if (data.key === "ArrowDown" || data.key === "ArrowUp") {
        pendingNavigation.current = data.key === "ArrowUp" ? "last" : "first"
        owner.state.open(pendingNavigation.current, "manual")
      }
      return
    }
    const keys = enabledKeys()
    let index = keys.findIndex((key) => key === owner.state.selectionManager.focusedKey)
    if (data.key === "ArrowDown" || data.key === "ArrowUp") {
      const next = index + (data.key === "ArrowDown" ? 1 : -1)
      index =
        index < 0
          ? data.key === "ArrowUp"
            ? keys.length - 1
            : 0
          : owner.props.shouldFocusWrap === false
            ? Math.max(0, Math.min(keys.length - 1, next))
            : (next + keys.length) % keys.length
      if (keys[index] != null) owner.state.selectionManager.setFocusedKey(keys[index])
    } else if (data.key === "Home" || data.key === "End") {
      const key = data.key === "Home" ? keys[0] : keys.at(-1)
      if (key != null) owner.state.selectionManager.setFocusedKey(key)
    } else if (data.key === "PageUp" || data.key === "PageDown") {
      const layout = renderer.layoutDelegate
      const rect =
        owner.state.selectionManager.focusedKey == null
          ? null
          : layout?.getItemRect?.(owner.state.selectionManager.focusedKey)
      if (rect && layout?.getItemRect) {
        const direction = data.key === "PageUp" ? -1 : 1
        const edge = rect.y + direction * layout.getVisibleRect().height
        let candidate = Math.max(0, index)
        while (candidate + direction >= 0 && candidate + direction < keys.length) {
          const next = layout.getItemRect(keys[candidate + direction])
          candidate += direction
          if (!next || (direction > 0 ? next.y >= edge : next.y <= edge)) break
        }
        if (keys[candidate] != null) owner.state.selectionManager.setFocusedKey(keys[candidate])
      }
    } else if (data.key === "Enter") {
      const key = owner.state.selectionManager.focusedKey
      const row = key == null ? undefined : rows.current.get(key)
      if (row) press(row.node, row.target, event)
      else owner.state.commit()
    } else if (data.key === "Escape") owner.state.revert()
  }
  const observeKey = (event: TNativeObservedKeyboardEvent) => {
    if (event.nativeEvent.cancelled || event.nativeEvent.isComposing || event.nativeEvent.focusedTarget !== inputTarget)
      return
    const owner = current.current
    if (!live.current || owner.props.isDisabled || owner.props.isReadOnly) return
    if (event.nativeEvent.key === "Tab" && owner.state.isOpen) owner.state.commit()
    if (event.nativeEvent.key === "ArrowLeft" || event.nativeEvent.key === "ArrowRight")
      owner.state.selectionManager.setFocusedKey(null)
  }
  const [groupProps, groupRef] = useNativeContextProps(
    {
      slot: undefined,
      role: "group" as const,
      accessible: false,
      focusable: false,
      testID: `${identity}-group`,
      style: [styles.group, { flexDirection: "row" as const, alignItems: "center" as const }],
    },
    anchor,
    NativeComboBoxGroupContext,
  )
  const [popupProps, popupRef] = useNativeContextProps(
    {
      slot: undefined,
      isOpen: state.isOpen,
      onOpenChange: (open: boolean) => {
        if (!open) state.close()
      },
      triggerRef: anchor,
      restoreFocusRef: input,
      placement: props.placement ?? "bottom start",
      offset: 5,
      isNonModal: true,
      childIsDialog: false,
      focusable: false,
      testID: `${identity}-popover`,
      customStyles: props.customOptionsListStyles,
    },
    popup,
    NativeComboBoxPopoverContext,
  )
  const rootProps = { collection: state.collection, scrollRef: scroll, persistedKeys }
  const optionContent = state.collection.size ? (
    <CollectionRoot {...rootProps} />
  ) : (
    <PlaceholderText align="center" testID={`${identity}-empty`}>
      {props.emptyListMessage ?? "No items remaining to select"}
    </PlaceholderText>
  )
  return (
    <NativeComboBoxStateContext.Provider value={state}>
      <NativeListStateContext.Provider value={state}>
        <NativeComboBoxOptionsContext.Provider
          value={{
            input,
            isDisabled: !!props.isDisabled,
            isReadOnly: !!props.isReadOnly,
            isVirtualized: !!renderer.isVirtualized,
            register,
            press,
          }}
        >
          <NativeFocusHost
            ref={forwardedRef}
            nativeID={props.nativeID}
            id={props.id}
            onLayout={props.onLayout}
            pointerEvents={props.pointerEvents}
            collapsable={props.collapsable}
            testID={identity}
            role="group"
            accessible={false}
            focusable={false}
            style={styles.root}
          >
            <NativeComboBoxKeyBinding
              target={inputTarget}
              open={state.isOpen}
              enabled={!props.isDisabled && !props.isReadOnly}
              lifetime={`${inputTarget}:${state.isOpen}`}
              onKey={onKey}
              observe={observeKey}
            />
            <NativeFocusHost {...groupProps} ref={groupRef}>
              <Input
                {...props.inputProps}
                ref={inputRef}
                testID={`${identity}-input`}
                accessibilityLabel={props.inputLabel}
                value={state.inputValue}
                placeholder={props.placeholder}
                isDisabled={props.isDisabled}
                isReadOnly={props.isReadOnly}
                textSize={props.textSize}
                geometry={props.geometry}
                enableFocusStyle={false}
                customStyles={[{ flex: 1, minWidth: 0 }, styles.input]}
                onChangeText={(value) => {
                  if (live.current && !current.current.props.isDisabled && !current.current.props.isReadOnly)
                    current.current.state.setInputValue(value)
                }}
                onFocus={(event) => {
                  setFocused(true)
                  state.setFocused(true)
                  props.inputProps?.onFocus?.(event)
                }}
                onBlur={(event) => {
                  setFocused(false)
                  state.setFocused(false)
                  props.inputProps?.onBlur?.(event)
                }}
              />
              <NativeButton
                testID={`${identity}-trigger`}
                accessibilityLabel={props.accessibilityLabel ?? props["aria-label"]}
                isDisabled={props.isDisabled}
                focusable={false}
                raised={false}
                customStyles={[{ backgroundColor: "transparent" }, props.customButtonStyles]}
                onPress={() => {
                  if (props.isDisabled || props.isReadOnly) return
                  state.toggle(null, "manual")
                  focusNativeTarget(input.current)
                }}
              >
                {props.ComponentIcon ? (
                  getNativeButtonContent(props.ComponentIcon)
                ) : (
                  <Svg
                    width={15}
                    height={15}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={styles.foreground}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Polyline points="6 9 12 15 18 9" />
                  </Svg>
                )}
              </NativeButton>
            </NativeFocusHost>
            <NativeFloatingSurface {...popupProps} ref={popupRef} nativeRootRole={null}>
              <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(null) ?? ""}>
                <NativeFocusHost role="list" focusable={false} accessible={false} testID={`${identity}-list`}>
                  {renderer.isVirtualized ? (
                    optionContent
                  ) : (
                    <ScrollView
                      ref={scroll as React.Ref<ScrollView>}
                      keyboardShouldPersistTaps="always"
                      keyboardDismissMode="none"
                      style={{ maxHeight: 280 }}
                    >
                      {optionContent}
                    </ScrollView>
                  )}
                </NativeFocusHost>
              </NativeCollectionItemBindingContext.Provider>
            </NativeFloatingSurface>
          </NativeFocusHost>
        </NativeComboBoxOptionsContext.Provider>
      </NativeListStateContext.Provider>
    </NativeComboBoxStateContext.Provider>
  )
}
export const NativeCollectionComboBox = forwardRef(
  <T extends object>(authored: TNativeCollectionComboBoxProps<T>, forwardedRef: ForwardedRef<TNativeComboBoxRef>) => {
    const [props, ref] = useNativeContextProps(authored, forwardedRef, NativeComboBoxContext)
    return (
      <NativeCollectionBuilder<T> content={<Authoring props={props} />}>
        {(collection) => <Receiver props={props} forwardedRef={ref} collection={collection} />}
      </NativeCollectionBuilder>
    )
  },
) as <T extends object>(props: TNativeCollectionComboBoxProps<T> & RefAttributes<TNativeComboBoxRef>) => ReactNode
