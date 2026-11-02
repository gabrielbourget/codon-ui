import {
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type ReactNode,
  type RefAttributes,
} from "react"
import { findNodeHandle, Linking, type TextInput, type View } from "react-native"

import { NativeCollectionActionsContext, type TNativeCollectionActionOutcome } from "../../collection/actions"
import { NativeCollectionBuilder, useNativeCollectionOwnerRef } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs, useNativeContextProps } from "../../collection/context"
import type { TNativeCollectionModelSnapshot } from "../../collection/model"
import {
  NativeCollectionRendererContext,
  type TNativeCollectionRenderer,
  type TNativeCollectionScrollHost,
} from "../../collection/renderer"
import type { TNativeCollectionItem, TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { NativeListStateContext } from "../../collection/state"
import { NativeFormBehaviorContext } from "../../form/context"
import { nativeFieldAccessibilityProps } from "../../form/semantics"
import { useNativeComboBoxField } from "../../form/useComboBoxField"
import { useNativeFieldSemantics, useNativeFieldSemanticRef } from "../../form/useFieldSemantics"
import type { TNativeObservedKeyboardEvent } from "../../input/keyboardObservation"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeWindowPointerEvent } from "../../input/nativeWindowPointers"
import type { TNativePressEvent } from "../../input/types"
import type { TNativeKeyboardEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { validateCollectionKey } from "../collection"
import { NativeContentContext } from "../NativeContentContext"
import type { TNativeTextRef } from "../Text/types"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import { NativeComboBoxGroup } from "./CollectionComboBoxGroup"
import { NativeComboBoxInput, useNativeComboBoxInputProps } from "./CollectionComboBoxInput"
import { NativeComboBoxList, NativeComboBoxListEnvironmentContext } from "./CollectionComboBoxList"
import { NativeComboBoxPopover } from "./CollectionComboBoxPopover"
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
import { createNativeComboBoxFilter } from "./filter"
import { getNativeComboBoxInputRequest, type TNativeComboBoxItemRequest } from "./itemActions"
import { NativeComboBoxKeyBinding } from "./keyboard"
import { createNativeComboBoxListMetrics, getNativeComboBoxPageKey, readNativeComboBoxPageLayout } from "./navigation"
import { useNativeComboBoxPointerSelection } from "./pointerSelection"
import { useComboBoxState } from "./state/useComboBoxState"
import { getNativeComboBoxStyles } from "./styles"
import type { TNativeComboBoxProps, TNativeComboBoxRef } from "./types"

type TCommitEvent =
  | TNativePressEvent
  | TNativeComboBoxSubmitEvent
  | TNativeWindowPointerEvent
  | TNativeObservedKeyboardEvent
export type { TNativeCollectionComboBoxProps } from "./collectionTypes"
const VisibleItem = ({
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
const useComboBoxItems = <T extends object>(props: TNativeCollectionComboBoxProps<T>) => {
  const { items, collectionItems, children, getKey, getTextValue, renderItem, dependencies, getOptionProps } = props
  return useMemo((): readonly TNativeCollectionItem<T>[] => {
    if (collectionItems) return collectionItems
    if (children != null && typeof children !== "function")
      throw new Error("ComboBox membership and sections require explicit collectionItems")
    return Array.from(items, (item) => {
      const key = getKey(item),
        text = getTextValue(item)
      validateCollectionKey(key, "item key", "ComboBox")
      return {
        key,
        type: "item",
        value: item,
        rendered: text,
        textValue: text,
        props: { ...getOptionProps?.(item) },
        render: () => (
          <VisibleItem
            id={key}
            value={item}
            text={text}
            content={children?.(item)}
            renderItem={renderItem as TNativeComboBoxProps<object>["renderItem"]}
          />
        ),
      }
    })
  }, [items, collectionItems, children, getKey, getTextValue, renderItem, dependencies, getOptionProps])
}
let nextEditorBindingRevision = 0

const Receiver = <T extends object>({
  props,
  forwardedRef,
  collection,
  modelSnapshot,
  controlledItems,
}: {
  props: TNativeCollectionComboBoxProps<T>
  forwardedRef: ForwardedRef<TNativeComboBoxRef>
  collection: TNativeCollectionSnapshot<T>
  modelSnapshot: TNativeCollectionModelSnapshot<T>
  controlledItems?: Iterable<T>
}) => {
  const isCollectionPending = false
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
  const [, labelRef] = useNativeFieldSemanticRef<TNativeTextRef>()
  const [, descriptionRef] = useNativeFieldSemanticRef<TNativeTextRef>()
  const [, errorMessageRef] = useNativeFieldSemanticRef<TNativeTextRef>()
  const [, valueRef] = useNativeFieldSemanticRef<View>()
  const [, listRef] = useNativeFieldSemanticRef<View>()
  const collectionRootRef = useNativeCollectionOwnerRef(modelSnapshot, listRef)
  const input = useRef<TextInput>(null)
  const anchor = useRef<View>(null)
  const [outerRoot, setOuterRoot] = useState<View | null>(null)
  const [inputRoot, setInputRoot] = useState<View | null>(null)
  const bindRoot = useNativeCollectionRefs<View>(forwardedRef, setOuterRoot)
  const bindAnchor = useNativeCollectionRefs<View>(anchor, setInputRoot)
  const popup = useRef<View>(null)
  const scroll = useRef<TNativeCollectionScrollHost | null>(null)
  const listMetrics = useRef(createNativeComboBoxListMetrics())
  const scrollContent = useRef<View>(null)
  const navigationSerial = useRef(0)
  const [focused, setFocused] = useState(false)
  const [originalInput, setOriginalInput] = useState<Readonly<{ editor: TextInput; target: number }> | null>(null)
  const actions = useContext(NativeCollectionActionsContext)
  const rows = useRef(new Map<string | number, { node: TNativeCollectionNode<unknown>; target: View }>())
  const [, setSemanticTargetsRevision] = useState(0)
  const inputTarget = originalInput?.target ?? 0
  const editorBindingRevision = useMemo(
    () => `${fieldId}:editor:${++nextEditorBindingRevision}`,
    [fieldId, outerRoot, inputRoot, originalInput, props.isDisabled, props.isReadOnly],
  )
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
    text: {
      label:
        props.nativeAccessibilityText?.label ?? props.accessibilityLabel ?? props["aria-label"] ?? props.inputLabel,
      description: props.nativeAccessibilityText?.description,
      errorMessage: props.nativeAccessibilityText?.errorMessage ?? state.displayValidation.validationErrors.join(". "),
      details: props.nativeAccessibilityText?.details,
    },
    labels: props.nativeAccessibilityLabels,
    flags: {
      disabled: !!props.isDisabled,
      readOnly: !!props.isReadOnly,
      required: !!props.isRequired,
      invalid: state.displayValidation.isInvalid,
      expanded: props.popoverIsOpen ?? state.isOpen,
    },
    activeDescendant:
      (props.popoverIsOpen ?? state.isOpen) && activeTarget && activeBinding
        ? { target: activeTarget, binding: activeBinding }
        : null,
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
      model: TNativeCollectionModelSnapshot<T>
      ownerLifetime: string
      originalRow?: { node: TNativeCollectionNode<unknown>; target: View }
      query: string
      input: TextInput | null
      scope: typeof inputScope
      window: string
      event: TCommitEvent
      mode: "enter" | "tab"
    }[]
  >([])
  const flushCommit = useRef(() => {})
  const inheritedRenderer = useContext(NativeCollectionRendererContext)
  const inheritedRendererRef = useRef(inheritedRenderer)
  const live = useRef(false)
  type TRendererOwner = Readonly<{ renderer: TNativeCollectionRenderer }>
  const rendererOwner = useRef<TRendererOwner | null>(null)
  const [listRenderer, setListRenderer] = useState<TRendererOwner | null>(null)
  useInsertionEffect(() => {
    inheritedRendererRef.current = inheritedRenderer
  })
  const registerListRenderer = useCallback((renderer: TNativeCollectionRenderer) => {
    if (!live.current) return () => {}
    if (rendererOwner.current) throw new Error("ComboBox requires one current list renderer")
    const owner = { renderer }
    rendererOwner.current = owner
    if (renderer !== inheritedRendererRef.current) setListRenderer(owner)
    return () => {
      if (rendererOwner.current !== owner) return
      rendererOwner.current = null
      if (live.current) setListRenderer((current) => (current === owner ? null : current))
    }
  }, [])
  const renderer = listRenderer?.renderer ?? inheritedRenderer
  const current = useRef({ props, state, renderer })
  useInsertionEffect(() => {
    current.current = { props, state, renderer }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      rendererOwner.current = null
      rows.current.clear()
      pendingCommit.current = []
    }
  }, [])
  const register = useCallback((node: TNativeCollectionNode<unknown>, target: View | null) => {
    const previous = rows.current.get(node.key)
    if (target) {
      rows.current.set(node.key, { node, target })
      pendingCommit.current = pendingCommit.current.filter((pending) => {
        if (pending.key !== node.key) return true
        if (pending.originalRow && (pending.originalRow.node !== node || pending.originalRow.target !== target))
          return false
        pending.originalRow = { node, target }
        return true
      })
      if (pendingCommit.current.some((pending) => pending.key === node.key))
        void Promise.resolve().then(() => flushCommit.current())
    } else if (rows.current.get(node.key)?.node === node) {
      rows.current.delete(node.key)
      pendingCommit.current = pendingCommit.current.filter(
        (pending) => pending.key !== node.key || !pending.originalRow,
      )
    }
    if (
      live.current &&
      current.current.state.selectionManager.focusedKey === node.key &&
      (previous?.node !== node || previous?.target !== target)
    )
      setSemanticTargetsRevision((value) => value + 1)
  }, [])
  const press = useCallback(
    (
      node: TNativeCollectionNode<unknown>,
      target: View | null,
      event: TCommitEvent,
      admitted: () => boolean = () => true,
      request: TNativeComboBoxItemRequest = { kind: "select" },
      settled?: (outcome: TNativeCollectionActionOutcome) => void,
    ) => {
      const original = rows.current.get(node.key)
      if (
        !live.current ||
        !target ||
        original?.target !== target ||
        current.current.props.isDisabled ||
        current.current.props.isReadOnly ||
        !admitted()
      ) {
        settled?.("rejected")
        return
      }
      const query = current.current.state.inputValue,
        editor = input.current,
        window = JSON.stringify(inputScope?.acknowledgedSession() ?? null)
      event.persist()
      if (!actions) {
        settled?.("rejected")
        return
      }
      actions.request(
        node,
        findNodeHandle(target) ?? 0,
        () => {
          const owner = current.current
          if (
            !live.current ||
            !(owner.props.popoverIsOpen ?? owner.state.isOpen) ||
            owner.props.isDisabled ||
            owner.props.isReadOnly ||
            !admitted() ||
            owner.state.inputValue !== query ||
            input.current !== editor ||
            inputScope?.isWindowActive() === false ||
            JSON.stringify(inputScope?.acknowledgedSession() ?? null) !== window ||
            rows.current.get(node.key) !== original ||
            event.defaultPrevented ||
            event.isDefaultPrevented?.()
          )
            return
          const itemProps = owner.state.collection.getItem(node.key)?.props
          if (owner.state.selectionManager.isDisabled(node.key) || itemProps?.isReadOnly || itemProps?.isPending) return
          if (request.kind === "select") owner.state.selectionManager.replaceSelection(node.key)
          else if (request.kind === "commit") owner.state.commit()
          else {
            if (request.kind === "action") request.action()
            if (request.kind === "link") {
              const { href, onNavigate, onNavigationError } = request.props
              if (!href) return
              if (onNavigate) onNavigate(href)
              else {
                let navigation: Promise<unknown>
                try {
                  navigation = Linking.openURL(href)
                } catch (error) {
                  navigation = Promise.reject(error)
                }
                void navigation.catch((error: unknown) => {
                  if (
                    live.current &&
                    admitted() &&
                    rows.current.get(node.key) === original &&
                    current.current.state.inputValue === query &&
                    input.current === editor &&
                    inputScope?.isWindowActive() !== false &&
                    JSON.stringify(inputScope?.acknowledgedSession() ?? null) === window
                  )
                    onNavigationError?.(error, href)
                })
              }
              if (request.resetSelection) {
                if (live.current && admitted()) {
                  const manager = current.current.state.selectionManager
                  manager.setSelectedKeys(manager.selectedKeys)
                }
                return
              }
            }
            if (live.current && admitted() && current.current.state.isOpen) current.current.state.close()
          }
        },
        settled,
      )
    },
    [actions, inputScope],
  )
  const requestCommit = (event: TCommitEvent, mode: "enter" | "tab" = "enter") => {
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
      if (row) press(row.node, row.target, event, undefined, getNativeComboBoxInputRequest(row.node.props, mode))
      else if (owner.state.collection.getItem(key)?.type === "item" && !owner.state.disabledKeys.has(key)) {
        const ownerLifetime = actions?.ownerLifetime()
        if (!ownerLifetime || actions?.model.getSnapshot() !== modelSnapshot) return
        event.persist()
        pendingCommit.current.push({
          key,
          collection: owner.state.collection,
          model: modelSnapshot,
          ownerLifetime,
          query: owner.state.inputValue,
          input: input.current,
          scope: inputScope,
          window: JSON.stringify(inputScope?.acknowledgedSession() ?? null),
          event,
          mode,
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
          actions?.model.getSnapshot() === pending.model &&
          actions?.ownerLifetime() === pending.ownerLifetime &&
          owner.state.inputValue === pending.query &&
          input.current === pending.input &&
          inputScope === pending.scope &&
          inputScope?.isWindowActive() !== false &&
          JSON.stringify(inputScope?.acknowledgedSession() ?? null) === pending.window
        if (!valid) continue
        const row = rows.current.get(pending.key)
        if (
          pending.originalRow &&
          (!row || row.node !== pending.originalRow.node || row.target !== pending.originalRow.target)
        )
          continue
        if (row) pending.originalRow = row
        if (row && actions?.bindingFor(row.node))
          press(
            row.node,
            row.target,
            pending.event,
            undefined,
            getNativeComboBoxInputRequest(row.node.props, pending.mode),
          )
        else pendingCommit.current.push(pending)
      }
    }
  })

  useLayoutEffect(
    () =>
      actions?.admission?.subscribe(() => {
        // Only unsent materialization intents wait here; submitted requests are consumed before native dispatch.
        void Promise.resolve().then(() => flushCommit.current())
      }),
    [actions],
  )

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
  const baseInputProps = useNativeComboBoxInputProps({
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
  const semanticProps = nativeFieldAccessibilityProps(
    semanticBinding,
    baseInputProps.accessibilityLabel,
    baseInputProps.accessibilityHint,
  )
  const inputProps = {
    ...baseInputProps,
    ...semanticProps,
    accessibilityState: { ...baseInputProps.accessibilityState, ...semanticProps.accessibilityState },
  }
  const buttonProps = useNativeComboBoxButtonProps({
    owner: props,
    state,
    input,
    identity,
  })
  const pointerSelection = useNativeComboBoxPointerSelection({
    input,
    enabled: !props.isDisabled && !props.isReadOnly,
    isOpen: props.popoverIsOpen ?? state.isOpen,
    query: state.inputValue,
  })
  const triggerRef = useNativeCollectionRefs(buttonProps.ref, pointerSelection.triggerRef)
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
  const scrollRequest = useRef(0)
  const revealFocusedRow = (key: string | number) => {
    const owner = current.current
    const row = rows.current.get(key)
    const scroller = scroll.current
    const viewport = scroller?.getNativeScrollRef?.()
    const contentTarget = scrollContent.current
    const metrics = listMetrics.current
    const binding = row && actions?.bindingFor(row.node)
    if (!row || !binding || !scroller?.scrollTo || !viewport || !contentTarget || !metrics.content) return false
    const request = ++scrollRequest.current
    const editor = input.current
    const session = JSON.stringify(inputScope?.acknowledgedSession() ?? null)
    const valid = () => {
      const latest = current.current
      return (
        live.current &&
        request === scrollRequest.current &&
        latest.state.isOpen &&
        latest.state.selectionManager.isFocused &&
        latest.state.selectionManager.focusedKey === key &&
        !latest.props.isDisabled &&
        !latest.props.isReadOnly &&
        latest.state.collection === owner.state.collection &&
        latest.state.inputValue === owner.state.inputValue &&
        latest.renderer === owner.renderer &&
        rows.current.get(key) === row &&
        input.current === editor &&
        scroll.current === scroller &&
        scroller.getNativeScrollRef?.() === viewport &&
        scrollContent.current === contentTarget &&
        listMetrics.current === metrics &&
        actions?.bindingFor(row.node) === binding &&
        inputScope?.isWindowActive() !== false &&
        JSON.stringify(inputScope?.acknowledgedSession() ?? null) === session
      )
    }
    readNativeComboBoxPageLayout({
      viewport,
      contentTarget,
      metrics,
      rows: [{ key, target: row.target }],
      current: valid,
      complete: (layout) => {
        const rect = layout.getItemRect?.(key)
        if (!rect || !valid()) return
        const visible = layout.getVisibleRect()
        const content = layout.getContentSize()
        const nearest = (start: number, length: number, offset: number, extent: number) => {
          if (start >= offset && start + length <= offset + extent) return offset
          const first = start - offset
          const last = start + length - offset - extent
          return offset + (Math.abs(first) <= Math.abs(last) ? first : last)
        }
        const x = Math.max(
          0,
          Math.min(Math.max(0, content.width - visible.width), nearest(rect.x, rect.width, visible.x, visible.width)),
        )
        const y = Math.max(
          0,
          Math.min(
            Math.max(0, content.height - visible.height),
            nearest(rect.y, rect.height, visible.y, visible.height),
          ),
        )
        if (x === visible.x && y === visible.y) return
        actions?.request(row.node, findNodeHandle(row.target) ?? 0, () => {
          if (valid()) scroller.scrollTo?.({ x, y, animated: false })
        })
      },
    })
    return true
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
    navigationSerial.current++
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
      index = index < 0 ? (data.key === "ArrowUp" ? keys.length - 1 : 0) : Math.max(0, Math.min(keys.length - 1, next))
      if (keys[index] != null) owner.state.selectionManager.setFocusedKey(keys[index])
    } else if (data.key === "Home" || data.key === "End") {
      if (owner.state.selectionManager.focusedKey == null && data.shiftKey) return
      const key = data.key === "Home" ? keys[0] : keys.at(-1)
      if (key != null) owner.state.selectionManager.setFocusedKey(key)
    } else if (data.key === "PageUp" || data.key === "PageDown") {
      const focused = owner.state.selectionManager.focusedKey
      if (focused == null) return
      const pageKey = data.key
      const navigate = (layout: NonNullable<typeof renderer.layoutDelegate>) => {
        const key = getNativeComboBoxPageKey(keys, focused, pageKey, layout)
        if (key != null) current.current.state.selectionManager.setFocusedKey(key)
      }
      if (owner.renderer.layoutDelegate) navigate(owner.renderer.layoutDelegate)
      else if (!owner.renderer.isVirtualized) {
        const viewport = scroll.current?.getNativeScrollRef?.()
        const contentTarget = scrollContent.current
        const originalRows = keys.map((key) => ({ key, row: rows.current.get(key) }))
        if (!contentTarget || !viewport?.measureInWindow || originalRows.some(({ row }) => !row)) return
        const serial = navigationSerial.current
        const editor = input.current
        const metrics = listMetrics.current
        const session = JSON.stringify(inputScope?.acknowledgedSession() ?? null)
        event.persist()
        readNativeComboBoxPageLayout({
          viewport,
          contentTarget,
          rows: originalRows.map(({ key, row }) => ({ key, target: row!.target })),
          metrics,
          current: () => {
            const latest = current.current
            return (
              live.current &&
              navigationSerial.current === serial &&
              latest.state.isOpen &&
              !latest.props.isDisabled &&
              !latest.props.isReadOnly &&
              latest.renderer === owner.renderer &&
              latest.state.collection === owner.state.collection &&
              latest.state.inputValue === owner.state.inputValue &&
              latest.state.selectionManager.focusedKey === focused &&
              input.current === editor &&
              listMetrics.current === metrics &&
              scrollContent.current === contentTarget &&
              scroll.current?.getNativeScrollRef?.() === viewport &&
              inputScope?.isWindowActive() !== false &&
              JSON.stringify(inputScope?.acknowledgedSession() ?? null) === session &&
              originalRows.every(({ key, row }) => rows.current.get(key) === row)
            )
          },
          complete: navigate,
        })
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
    if (event.nativeEvent.key === "Tab" && owner.state.isOpen) requestCommit(event, "tab")
    if (event.nativeEvent.key === "ArrowLeft" || event.nativeEvent.key === "ArrowRight") {
      navigationSerial.current++
      owner.state.selectionManager.setFocusedKey(null)
    }
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
    bindAnchor,
    NativeComboBoxGroupContext,
  )
  const nativeGroupProps = groupProps
  const [popupProps, popupRef] = useNativeContextProps(
    {
      slot: undefined,
      isOpen: props.popoverIsOpen ?? state.isOpen,
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
      ref: bindRoot,
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
        <NativeComboBoxButtonContext.Provider value={{ ...buttonProps, ref: triggerRef }}>
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
                      value={{
                        ref: groupRef,
                        isDisabled: !!props.isDisabled,
                        isInvalid: state.displayValidation.isInvalid,
                      }}
                    >
                      <NativeComboBoxListEnvironmentContext.Provider
                        value={{
                          scrollRef: scroll,
                          isOpen: props.popoverIsOpen ?? state.isOpen,
                          isCollectionPending,
                          metrics: listMetrics,
                          contentRef: scrollContent,
                          revealFocusedRow,
                          registerRenderer: registerListRenderer,
                        }}
                      >
                        <NativeComboBoxListContext.Provider
                          value={{
                            ref: collectionRootRef,
                            style: props.customOptionsListStyles,
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
                                    registerPointerOption: pointerSelection.registerOption,
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
                                            lifetime={`${editorBindingRevision}:${state.isOpen}`}
                                            onKey={onKey}
                                            observe={observeKey}
                                          />
                                          {props.renderContent ? (
                                            props.renderContent(field)
                                          ) : (
                                            <>
                                              <NativeComboBoxGroup {...nativeGroupProps}>
                                                <NativeComboBoxInput />
                                                {field.placement === "input" && field.metadata}
                                                <NativeCollectionComboBoxTrigger
                                                  owner={props}
                                                  foreground={styles.foreground}
                                                />
                                              </NativeComboBoxGroup>
                                              <NativeComboBoxPopover>
                                                <NativeComboBoxList
                                                  nativeID={fieldIds.list}
                                                  testID={`${identity}-list`}
                                                  renderEmptyState={() => (
                                                    <PlaceholderText align="center" testID={`${identity}-empty`}>
                                                      {props.emptyListMessage ?? "No items remaining to select"}
                                                    </PlaceholderText>
                                                  )}
                                                />
                                              </NativeComboBoxPopover>
                                              {field.placement === "root" && field.metadata}
                                            </>
                                          )}
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
    const items = useComboBoxItems(props)
    return (
      <NativeCollectionBuilder<T> items={items}>
        {(collection, modelSnapshot) => (
          <Receiver
            props={props}
            forwardedRef={ref}
            collection={collection}
            modelSnapshot={modelSnapshot}
            controlledItems={authored.controlledItems ?? inherited.items}
          />
        )}
      </NativeCollectionBuilder>
    )
  },
) as <T extends object>(props: TNativeCollectionComboBoxProps<T> & RefAttributes<TNativeComboBoxRef>) => ReactNode
