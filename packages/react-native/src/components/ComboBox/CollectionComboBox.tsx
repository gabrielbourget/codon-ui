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
import type { TNativeObservedKeyboardEvent } from "../../input/keyboardObservation"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativePressEvent } from "../../input/types"
import type { TNativeKeyboardEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { NativeFloatingSurface } from "../ClickPopover/ClickPopover"
import { encodeCollectionKey, validateCollectionKey } from "../collection"
import { NativeContentContext } from "../NativeContentContext"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import { NativeCollectionComboBoxInput } from "./CollectionComboBoxInput"
import { NativeCollectionComboBoxTrigger } from "./CollectionComboBoxTrigger"
import {
  NativeComboBoxContext,
  NativeComboBoxGroupContext,
  NativeComboBoxPopoverContext,
  NativeComboBoxItemValueContext,
  NativeComboBoxOptionsContext,
  NativeComboBoxStateContext,
} from "./collectionContext"
import type {
  TNativeCollectionComboBoxProps,
  TNativeCollectionComboBoxParentProps,
  TNativeComboBoxSubmitEvent,
} from "./collectionTypes"
import { NativeComboBoxItem } from "./ComboBoxItem"
import { createNativeComboBoxFilter } from "./filter"
import { NativeComboBoxKeyBinding } from "./keyboard"
import { useComboBoxState } from "./state/useComboBoxState"
import { getNativeComboBoxStyles } from "./styles"
import type { TNativeComboBoxProps, TNativeComboBoxRef } from "./types"

type TCommitEvent = TNativePressEvent | TNativeComboBoxSubmitEvent
export type { TNativeCollectionComboBoxProps } from "./collectionTypes"
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
  isCollectionPending,
  controlledItems,
}: {
  props: TNativeCollectionComboBoxProps<T>
  forwardedRef: ForwardedRef<TNativeComboBoxRef>
  collection: TNativeCollectionSnapshot<T>
  isCollectionPending: boolean
  controlledItems?: Iterable<T>
}) => {
  const filter = useMemo(
    () => props.defaultFilter ?? createNativeComboBoxFilter(props.locale),
    [props.defaultFilter, props.locale],
  )
  const state = useComboBoxState({
    collection,
    isCollectionPending,
    items: controlledItems,
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
    name: props.name,
    allowsCustomValue: props.allowsCustomValue,
    allowsEmptyCollection: props.allowsEmptyCollection,
    menuTrigger: props.menuTrigger,
    isRequired: props.isRequired,
    isInvalid: props.isInvalid,
    validate: props.validate,
    shouldCloseOnBlur: props.shouldCloseOnBlur,
    validationBehavior: props.validationBehavior ?? "native",
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
    if (!target) setFocused(false)
  }, [])
  const inputScope = useNativeKeyScope()
  const pendingCommit = useRef<
    {
      key: string | number
      collection: TNativeCollectionSnapshot<T>
      query: string
      input: TextInput | null
      scope: typeof inputScope
      window: string
      event: TCommitEvent
    }[]
  >([])
  const flushCommit = useRef(() => {})
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
      pendingCommit.current = []
    }
  }, [])
  const register = useCallback((node: TNativeCollectionNode<unknown>, target: View | null) => {
    if (target) {
      rows.current.set(node.key, { node, target })
      if (pendingCommit.current.some((pending) => pending.key === node.key))
        void Promise.resolve().then(() => flushCommit.current())
    } else if (rows.current.get(node.key)?.node === node) rows.current.delete(node.key)
  }, [])
  const press = useCallback(
    (node: TNativeCollectionNode<unknown>, target: View | null, event: TCommitEvent) => {
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
  const requestCommit = (event: TCommitEvent) => {
    const owner = current.current
    if (
      !live.current ||
      owner.props.isDisabled ||
      owner.props.isReadOnly ||
      event.defaultPrevented ||
      event.isDefaultPrevented?.()
    )
      return
    const key = owner.state.selectionManager.focusedKey
    if (owner.state.isOpen && key != null) {
      const row = rows.current.get(key)
      if (row) press(row.node, row.target, event)
      else if (owner.state.collection.getItem(key)?.type === "item" && !owner.state.disabledKeys.has(key)) {
        event.persist()
        pendingCommit.current.push({
          key,
          collection: owner.state.collection,
          query: owner.state.inputValue,
          input: input.current,
          scope: inputScope,
          window: JSON.stringify(inputScope?.acknowledgedSession() ?? null),
          event,
        })
        renderer.layoutDelegate?.requestRendering?.(key)
        renderer.layoutDelegate?.scrollToKey?.(key)
      }
    } else owner.state.commit()
  }
  useInsertionEffect(() => {
    flushCommit.current = () => {
      const requests = pendingCommit.current
      pendingCommit.current = []
      for (const pending of requests) {
        const owner = current.current
        const valid =
          live.current &&
          !owner.props.isDisabled &&
          !owner.props.isReadOnly &&
          owner.state.isOpen &&
          owner.state.selectionManager.focusedKey === pending.key &&
          owner.state.collection === pending.collection &&
          owner.state.inputValue === pending.query &&
          input.current === pending.input &&
          inputScope === pending.scope &&
          inputScope?.isWindowActive() !== false &&
          JSON.stringify(inputScope?.acknowledgedSession() ?? null) === pending.window
        if (!valid) continue
        const row = rows.current.get(pending.key)
        if (row) press(row.node, row.target, pending.event)
        else pendingCommit.current.push(pending)
      }
    }
  })

  const inputRef = useNativeCollectionRefs(props.inputRef, bindInput)
  const identity = props.testID ?? props["data-testid"] ?? "combo-box"
  const authoredStyle = props.style
  const inheritedStyle: TNativeComboBoxProps<T>["style"] =
    typeof authoredStyle === "function"
      ? (values) => authoredStyle({ ...values, isRequired: !!props.isRequired })
      : authoredStyle
  const styles = getNativeComboBoxStyles(
    theme,
    {
      ...props,
      accessibilityLabel: props.accessibilityLabel ?? props["aria-label"] ?? props.inputLabel,
      style: inheritedStyle,
    },
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
  const enabledKeys = () => {
    const { collection, selectionManager } = current.current.state
    const keys: (string | number)[] = []
    let key = collection.getFirstKey()
    while (key != null) {
      const node = collection.getItem(key)
      if (node?.type === "item" && !selectionManager.isDisabled(key)) keys.push(key)
      key = collection.getKeyAfter(key)
    }
    return keys
  }
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
      requestCommit(event)
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
      accessibilityLabel: props.groupLabel ?? "ComboBox Input Button Group",
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
  const renderRoot = ({ children }: { children: ReactNode }) => {
    const hostProps = {
      ref: forwardedRef,
      nativeID: props.nativeID,
      onLayout: props.onLayout,
      pointerEvents: props.pointerEvents,
      collapsable: props.collapsable,
      testID: identity,
      role: "group" as const,
      accessible: false,
      focusable: false,
      style: styles.root,
      children,
    }
    const flags = {
      isOpen: state.isOpen,
      isDisabled: !!props.isDisabled,
      isReadOnly: !!props.isReadOnly,
      isRequired: !!props.isRequired,
      isInvalid: state.displayValidation.isInvalid,
    }
    return props.render ? props.render(hostProps, flags) : <NativeFocusHost {...hostProps} />
  }
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
          <NativeContentContext.Provider value={{ foregroundColor: styles.foreground, isButton: false }}>
            {renderRoot({
              children: (
                <>
                  <NativeComboBoxKeyBinding
                    target={inputTarget}
                    open={state.isOpen}
                    enabled={!props.isDisabled && !props.isReadOnly}
                    lifetime={`${inputTarget}:${state.isOpen}`}
                    onKey={onKey}
                    observe={observeKey}
                  />
                  <NativeFocusHost {...groupProps} ref={groupRef}>
                    <NativeCollectionComboBoxInput
                      owner={props}
                      state={state}
                      inputRef={inputRef}
                      identity={identity}
                      style={styles.input}
                      onFocusWithin={(focused) => {
                        setFocused(focused)
                        if (!focused) pendingCommit.current = []
                      }}
                      onCommit={requestCommit}
                    />
                    <NativeCollectionComboBoxTrigger
                      owner={props}
                      state={state}
                      input={input}
                      identity={identity}
                      foreground={styles.foreground}
                    />
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
                </>
              ),
            })}
          </NativeContentContext.Provider>
        </NativeComboBoxOptionsContext.Provider>
      </NativeListStateContext.Provider>
    </NativeComboBoxStateContext.Provider>
  )
}
export const NativeCollectionComboBox = forwardRef(
  <T extends object>(authored: TNativeCollectionComboBoxProps<T>, forwardedRef: ForwardedRef<TNativeComboBoxRef>) => {
    const parentProps: TNativeCollectionComboBoxParentProps<T> = { ...authored, items: undefined }
    const [inherited, ref] = useNativeContextProps(parentProps, forwardedRef, NativeComboBoxContext)
    const props = {
      ...inherited,
      items: authored.items,
      children: authored.children,
      getKey: authored.getKey,
      getTextValue: authored.getTextValue,
    }
    return (
      <NativeCollectionBuilder<T> content={<Authoring props={props} />}>
        {(collection, receipt) => (
          <Receiver
            props={props}
            forwardedRef={ref}
            collection={collection}
            isCollectionPending={receipt.status !== "confirmed"}
            controlledItems={inherited.items}
          />
        )}
      </NativeCollectionBuilder>
    )
  },
) as <T extends object>(props: TNativeCollectionComboBoxProps<T> & RefAttributes<TNativeComboBoxRef>) => ReactNode
