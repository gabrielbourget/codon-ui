import {
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type ReactNode,
  type RefAttributes,
} from "react"
import { findNodeHandle, type TextInput, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { useNativeCachedChildren } from "../../collection/cachedChildren"
import { NativeCollectionBuilder } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs, useNativeContextProps } from "../../collection/context"
import { NativeCollectionRendererContext, type TNativeCollectionScrollHost } from "../../collection/renderer"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { NativeListStateContext } from "../../collection/state"
import { NativeFormBehaviorContext } from "../../form/context"
import { useNativeComboBoxField } from "../../form/useComboBoxField"
import { useNativeFieldSemantics, useNativeFieldSemanticRef } from "../../form/useFieldSemantics"
import type { TNativeObservedKeyboardEvent } from "../../input/keyboardObservation"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativePressEvent } from "../../input/types"
import type { TNativeKeyboardEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { NativeFloatingSurface } from "../ClickPopover/ClickPopover"
import { encodeCollectionKey, validateCollectionKey } from "../collection"
import { NativeContentContext } from "../NativeContentContext"
import type { TNativeTextRef } from "../Text/types"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import { NativeComboBoxInput, useNativeComboBoxInputProps } from "./CollectionComboBoxInput"
import { NativeComboBoxList, NativeComboBoxListEnvironmentContext } from "./CollectionComboBoxList"
import { NativeCollectionComboBoxTrigger, useNativeComboBoxButtonProps } from "./CollectionComboBoxTrigger"
import {
  NativeComboBoxContext,
  NativeComboBoxGroupContext,
  NativeComboBoxPopoverContext,
  NativeComboBoxItemValueContext,
  NativeComboBoxOptionsContext,
  NativeComboBoxStateContext,
  NativeComboBoxInputContext,
  NativeComboBoxButtonContext,
  NativeComboBoxLabelContext,
  NativeComboBoxTextContext,
  NativeComboBoxFieldErrorContext,
  NativeComboBoxValueContext,
  NativeComboBoxOverlayTriggerStateContext,
  NativeComboBoxFieldIdsContext,
  NativeComboBoxListContext,
  NATIVE_COMBO_BOX_POPOVER_CONTEXTS,
} from "./collectionContext"
import type {
  TNativeCollectionComboBoxProps,
  TNativeCollectionComboBoxParentProps,
  TNativeComboBoxSubmitEvent,
} from "./collectionTypes"
import { NativeComboBoxItem } from "./ComboBoxItem"
import { NativeComboBoxPopoverBoundary } from "./fieldParts"
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
  const formBehavior = useContext(NativeFormBehaviorContext)
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
    validationBehavior: props.validationBehavior ?? formBehavior,
    defaultFilter: filter,
  })
  const theme = useNativeTheme()
  const fieldId = useId()
  const fieldIds = useMemo(
    () => ({
      input: `${fieldId}:input`,
      label: `${fieldId}:label`,
      description: `${fieldId}:description`,
      errorMessage: `${fieldId}:error`,
      value: `${fieldId}:value`,
      list: `${fieldId}:list`,
    }),
    [fieldId],
  )
  const [label, labelRef] = useNativeFieldSemanticRef<TNativeTextRef>()
  const [description, descriptionRef] = useNativeFieldSemanticRef<TNativeTextRef>()
  const [errorMessage, errorMessageRef] = useNativeFieldSemanticRef<TNativeTextRef>()
  const [value, valueRef] = useNativeFieldSemanticRef<View>()
  const [list, listRef] = useNativeFieldSemanticRef<View>()
  const input = useRef<TextInput>(null)
  const anchor = useRef<View>(null)
  const popup = useRef<View>(null)
  const scroll = useRef<TNativeCollectionScrollHost | null>(null)
  const [focused, setFocused] = useState(false)
  const [originalInput, setOriginalInput] = useState<Readonly<{ editor: TextInput; target: number }> | null>(null)
  const actions = useContext(NativeCollectionActionsContext)
  const rows = useRef(new Map<string | number, { node: TNativeCollectionNode<unknown>; target: View }>())
  const [, setSemanticTargetsRevision] = useState(0)
  const inputTarget = originalInput?.target ?? 0
  const bindInput = useCallback((target: TextInput | null) => {
    input.current = target
    if (target) {
      const nativeTarget = findNodeHandle(target) ?? 0
      setOriginalInput((previous) =>
        previous?.editor === target && previous.target === nativeTarget
          ? previous
          : { editor: target, target: nativeTarget },
      )
    }
    if (!target) setFocused(false)
  }, [])
  const focusedKey = state.selectionManager.focusedKey
  const activeRow = focusedKey == null ? undefined : rows.current.get(focusedKey)
  const activeNode = activeRow && state.collection.getItem(activeRow.node.key)
  const activeBinding =
    activeRow && activeNode && actions?.bindingFor(activeNode) === actions?.bindingFor(activeRow.node)
      ? actions?.bindingFor(activeRow.node)
      : ""
  const activeTarget = activeBinding && activeRow ? findNodeHandle(activeRow.target) : 0
  const semanticBinding = useNativeFieldSemantics({
    ids: fieldIds,
    refs: { input, label, description, errorMessage, value, list },
    inputAliases: props.id ? [props.id] : [],
    labelledBy: props.nativeLabelledBy,
    describedBy: props.nativeDescribedBy,
    errorMessageBy: props.nativeErrorMessageBy,
    detailsBy: props.nativeDetailsBy,
    labels: props.nativeAccessibilityLabels,
    flags: {
      disabled: !!props.isDisabled,
      readOnly: !!props.isReadOnly,
      required: !!props.isRequired,
      invalid: state.displayValidation.isInvalid,
      expanded: state.isOpen,
    },
    activeDescendant: activeTarget && activeBinding ? { target: activeTarget, binding: activeBinding } : null,
  })
  const field = useNativeComboBoxField(
    {
      ...props,
      validationBehavior: props.validationBehavior ?? formBehavior,
      requiredErrorMessage: props.nativeAccessibilityLabels?.required,
    },
    state,
    originalInput,
    () => input.current,
    () => focused,
    semanticBinding,
  )
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
  const renderer = useContext(NativeCollectionRendererContext)
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
    const previous = rows.current.get(node.key)
    if (target) {
      rows.current.set(node.key, { node, target })
      if (pendingCommit.current.some((pending) => pending.key === node.key))
        void Promise.resolve().then(() => flushCommit.current())
    } else if (rows.current.get(node.key)?.node === node) rows.current.delete(node.key)
    if (
      live.current &&
      current.current.state.selectionManager.focusedKey === node.key &&
      (previous?.node !== node || previous?.target !== target)
    )
      setSemanticTargetsRevision((value) => value + 1)
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
  const inputProps = useNativeComboBoxInputProps({
    owner: { ...props, id: props.id ?? fieldIds.input },
    state,
    inputRef,
    currentInput: () => input.current,
    identity,
    style: styles.input,
    onFocusWithin: (value) => {
      setFocused(value)
      if (!value) pendingCommit.current = []
    },
    onCommit: requestCommit,
  })
  const buttonProps = useNativeComboBoxButtonProps({
    owner: props,
    state,
    input,
    identity,
  })
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
        owner.state.open(data.key === "ArrowUp" ? "last" : "first", "manual")
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
      accessibilityState: { disabled: !!props.isDisabled },
    },
    anchor,
    NativeComboBoxGroupContext,
  )
  const { isDisabled: _groupDisabled, isInvalid: _groupInvalid, ...nativeGroupProps } = groupProps
  const [popupProps, popupRef] = useNativeContextProps(
    {
      slot: undefined,
      isOpen: state.isOpen,
      onOpenChange: (open: boolean) => {
        if (!open) state.close()
      },
      triggerRef: anchor,
      scrollRef: scroll,
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
  const { clearContexts: _clearContexts, ...nativePopupProps } = popupProps
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
    <NativeComboBoxFieldIdsContext.Provider value={fieldIds}>
      <NativeComboBoxInputContext.Provider value={inputProps}>
        <NativeComboBoxButtonContext.Provider value={buttonProps}>
          <NativeComboBoxLabelContext.Provider
            value={{ nativeID: fieldIds.label, ref: labelRef, labelTarget: input, isDisabled: !!props.isDisabled }}
          >
            <NativeComboBoxTextContext.Provider
              value={{
                slots: {
                  description: { nativeID: fieldIds.description, ref: descriptionRef },
                  errorMessage: { nativeID: fieldIds.errorMessage, ref: errorMessageRef },
                },
              }}
            >
              <NativeComboBoxFieldErrorContext.Provider value={state.displayValidation}>
                <NativeComboBoxValueContext.Provider
                  value={{ nativeID: fieldIds.value, locale: props.locale, ref: valueRef }}
                >
                  <NativeComboBoxOverlayTriggerStateContext.Provider value={state}>
                    <NativeComboBoxGroupContext.Provider
                      value={{ isDisabled: !!props.isDisabled, isInvalid: state.displayValidation.isInvalid }}
                    >
                      <NativeComboBoxListEnvironmentContext.Provider
                        value={{ scrollRef: scroll, isOpen: state.isOpen, isCollectionPending }}
                      >
                        <NativeComboBoxListContext.Provider
                          value={{
                            ref: listRef,
                            role: "list",
                            accessible: false,
                            autoFocus: state.focusStrategy || true,
                            shouldUseVirtualFocus: true,
                            shouldSelectOnPressUp: true,
                            shouldFocusOnHover: true,
                            linkBehavior: "selection",
                            itemBehavior: "action",
                            shouldFocusWrap: props.shouldFocusWrap ?? true,
                          }}
                        >
                          <NativeComboBoxPopoverContext.Provider
                            value={{
                              ...nativePopupProps,
                              ref: popupRef,
                              trigger: "ComboBox",
                              clearContexts: NATIVE_COMBO_BOX_POPOVER_CONTEXTS,
                            }}
                          >
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
                                  <NativeContentContext.Provider
                                    value={{ foregroundColor: styles.foreground, isButton: false }}
                                  >
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
                                          <NativeFocusHost {...nativeGroupProps} ref={groupRef}>
                                            <NativeComboBoxInput />
                                            {field.placement === "input" && field.metadata}
                                            <NativeCollectionComboBoxTrigger
                                              owner={props}
                                              foreground={styles.foreground}
                                            />
                                          </NativeFocusHost>
                                          <NativeFloatingSurface
                                            {...nativePopupProps}
                                            ref={popupRef}
                                            nativeRootRole={null}
                                          >
                                            <NativeComboBoxPopoverBoundary>
                                              <NativeComboBoxList
                                                nativeID={fieldIds.list}
                                                testID={`${identity}-list`}
                                                renderEmptyState={() => (
                                                  <PlaceholderText align="center" testID={`${identity}-empty`}>
                                                    {props.emptyListMessage ?? "No items remaining to select"}
                                                  </PlaceholderText>
                                                )}
                                              />
                                            </NativeComboBoxPopoverBoundary>
                                          </NativeFloatingSurface>
                                          {field.placement === "root" && field.metadata}
                                        </>
                                      ),
                                    })}
                                  </NativeContentContext.Provider>
                                </NativeComboBoxOptionsContext.Provider>
                              </NativeListStateContext.Provider>
                            </NativeComboBoxStateContext.Provider>
                          </NativeComboBoxPopoverContext.Provider>
                        </NativeComboBoxListContext.Provider>
                      </NativeComboBoxListEnvironmentContext.Provider>
                    </NativeComboBoxGroupContext.Provider>
                  </NativeComboBoxOverlayTriggerStateContext.Provider>
                </NativeComboBoxValueContext.Provider>
              </NativeComboBoxFieldErrorContext.Provider>
            </NativeComboBoxTextContext.Provider>
          </NativeComboBoxLabelContext.Provider>
        </NativeComboBoxButtonContext.Provider>
      </NativeComboBoxInputContext.Provider>
    </NativeComboBoxFieldIdsContext.Provider>
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
