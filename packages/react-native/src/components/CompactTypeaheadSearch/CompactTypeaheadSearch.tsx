import {
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  type RefObject,
} from "react"
import { View, findNodeHandle, type TextInput, type TextStyle } from "react-native"

import { useNativeCollectionRefs, useNativeSlottedContext } from "../../collection/context"
import { focusNativeTarget, getNativeFocusedTarget } from "../../input/focus"
import type { TNativeFocusWithinEvent } from "../../input/focusWithin"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyboardObservation, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeFloatingHost } from "../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { OverlayRegistryContext } from "../../overlays/NativeOverlayProvider"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeCollectionComboBox } from "../ComboBox/CollectionComboBox"
import { NativeComboBoxGroup } from "../ComboBox/CollectionComboBoxGroup"
import { NativeComboBoxInput } from "../ComboBox/CollectionComboBoxInput"
import { NativeComboBoxList } from "../ComboBox/CollectionComboBoxList"
import { NativeComboBoxPopover } from "../ComboBox/CollectionComboBoxPopover"
import { NativeComboBoxButton } from "../ComboBox/CollectionComboBoxTrigger"
import {
  NativeComboBoxContext,
  NativeComboBoxGroupContext,
  NativeComboBoxInputContext,
  NativeComboBoxStateContext,
} from "../ComboBox/collectionContext"
import { NativeComboBoxItem } from "../ComboBox/ComboBoxItem"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "../Tag/motion"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import { NativeCompactLoadingIndicator, NativeCompactSearchIcon } from "./affordances"
import { resolveCompactTypeaheadLabels } from "./labels"
import { getCompactTypeaheadEntries } from "./model"
import { getCompactTypeaheadStyles } from "./styles"
import type { TNativeCompactTypeaheadRef, TNativeCompactTypeaheadSearchProps } from "./types"

type TField = { metadata: ReactNode; placement: "input" | "root" }
const BORDER_TRANSITION = resolveNativeTagTransition()
const componentOptions = new Set([
  "items",
  "inputValue",
  "defaultInputValue",
  "onInputChange",
  "value",
  "defaultValue",
  "onChange",
  "isOpen",
  "defaultOpen",
  "onOpenChange",
  "isLoading",
  "isDisabled",
  "isReadOnly",
  "isRequired",
  "isInvalid",
  "disabledKeys",
  "menuTrigger",
  "allowsCustomValue",
  "allowsEmptyCollection",
  "shouldCloseOnBlur",
  "defaultFilter",
  "inputRef",
  "inputProps",
  "inputMode",
  "autoFocus",
  "placeholder",
  "minimumInputLength",
  "minimumInputLengthMessage",
  "loadingMessage",
  "emptyListMessage",
  "labels",
  "getItemKey",
  "getItemTextValue",
  "renderItem",
  "height",
  "width",
  "color",
  "geometry",
  "textSize",
  "placement",
  "rtl",
  "shouldFocusWrap",
  "enableFocusStyle",
  "offsetFocusRing",
  "errorState",
  "warningState",
  "successState",
  "SearchIcon",
  "LoadingIndicator",
  "customStyles",
  "customInputStyles",
  "customButtonStyles",
  "customInputButtonGroupStyles",
  "customOptionsListStyles",
  "style",
  "render",
  "children",
  "name",
  "form",
  "formValue",
  "validate",
  "validationBehavior",
  "locale",
  "dependencies",
  "slot",
  "nativeLabelledBy",
  "nativeDescribedBy",
  "nativeErrorMessageBy",
  "nativeDetailsBy",
  "nativeAccessibilityLabels",
  "onFocus",
  "onBlur",
  "onFocusChange",
  "data-testid",
])
const CompactContent = <T extends object>({
  props,
  input,
  field,
  open,
  minimum,
  status,
  requestOpen,
  clearSuppression,
  query,
}: {
  props: TNativeCompactTypeaheadSearchProps<T>
  input: RefObject<TextInput | null>
  field: TField
  open: boolean
  minimum: boolean
  status: boolean
  requestOpen: (open: boolean) => void
  clearSuppression: () => void
  query: string
}) => {
  const theme = useNativeTheme()
  const content = useNativeContentContext()
  const host = useNativeFloatingHost()
  const state = useContext(NativeComboBoxStateContext)!
  const inheritedInput = useNativeSlottedContext(NativeComboBoxInputContext, undefined)
  const inheritedGroup = useNativeSlottedContext(NativeComboBoxGroupContext, undefined)
  const button = useRef<View | null>(null)
  const groupWithin = useRef<boolean | null>(null)
  const frame = useRef<number | null>(null)
  const [focused, setFocused] = useState(false)
  const [groupWidth, setGroupWidth] = useState(0)
  const labels = resolveCompactTypeaheadLabels(props)
  const flags = {
    isOpen: state.isOpen,
    isDisabled: !!inheritedInput?.isDisabled,
    isReadOnly: !!inheritedInput?.isReadOnly,
    isRequired: !!props.isRequired,
    isInvalid: state.displayValidation.isInvalid,
  }
  const calibration = {
    ...props,
    style: undefined,
    customStyles: [props.customStyles, { color: content?.foregroundColor }],
    isDisabled: flags.isDisabled,
  }
  const styles = getCompactTypeaheadStyles(theme, calibration, flags, focused)
  const reduced = useNativeTagReducedMotion()
  const border = useNativeTagColor(styles.group.borderColor, BORDER_TRANSITION, reduced, true)
  const current = useRef({ status, requestOpen })
  useInsertionEffect(() => {
    current.current = { status, requestOpen }
  })
  useInsertionEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )
  const blur = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const target = getNativeFocusedTarget()
      if (groupWithin.current ?? (target && (target === input.current || target === button.current))) return
      setFocused(false)
      if (current.current.status) current.current.requestOpen(false)
    })
  }
  const popupStyle: TextStyle = {
    direction: props.rtl ? "rtl" : "ltr",
    width: Math.max(0, Math.min(420, (host.layout?.width ?? 450) - 30, Math.max(groupWidth, 280))),
    maxHeight: Math.max(0, Math.min(275, (host.layout?.height ?? 305) - 30)),
    padding: 0,
    backgroundColor: theme.colors.background,
  }
  const statusBlock = (kind: string, content: ReactNode, text: string) => (
    <View testID={`type-ahead-search-${kind}-state`} accessibilityLiveRegion="polite" style={styles.status}>
      {content}
      <PlaceholderText align="center">{text}</PlaceholderText>
    </View>
  )
  return (
    <>
      <NativeComboBoxGroup
        testID="type-ahead-search-group"
        accessibilityLabel={labels.inputButtonGroupAriaLabel}
        onBlur={blur}
        render={(native, flags) => {
          const observed = {
            ...native,
            nativeOnFocusWithin: (event: TNativeFocusWithinEvent) => {
              groupWithin.current = event.nativeEvent.within
              native.nativeOnFocusWithin?.(event)
            },
            nativeOnFocusWithinRetired: () => {
              groupWithin.current = null
              native.nativeOnFocusWithinRetired?.()
            },
          }
          return inheritedGroup?.render ? inheritedGroup.render(observed, flags) : <NativeFocusHost {...observed} />
        }}
        style={({ isFocusWithin }) => ({
          ...getCompactTypeaheadStyles(theme, calibration, flags, focused || isFocusWithin).group,
          borderColor: border.rendered,
        })}
        onLayout={(event) => {
          if (Number.isFinite(event.nativeEvent.layout.width)) setGroupWidth(event.nativeEvent.layout.width)
        }}
      >
        <NativeComboBoxInput
          testID="type-ahead-search-input"
          customStyles={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={blur}
          onKeyPress={clearSuppression}
        />
        {field.placement === "input" && field.metadata}
        <NativeComboBoxButton
          ref={button}
          testID="type-ahead-search-button"
          accessibilityLabel={labels.searchButtonAriaLabel}
          geometry="rounded"
          raised={false}
          customStyles={styles.button}
          onFocus={() => setFocused(true)}
          onBlur={blur}
        >
          {props.SearchIcon !== undefined ? props.SearchIcon : <NativeCompactSearchIcon />}
        </NativeComboBoxButton>
      </NativeComboBoxGroup>
      <NativeComboBoxPopover
        testID="type-ahead-search-popover"
        isOpen={open}
        placement={props.placement ?? "bottom start"}
        direction={props.rtl ? "rtl" : "ltr"}
        style={[popupStyle, props.customOptionsListStyles]}
      >
        <NativeContentContext.Provider
          value={{ foregroundColor: styles.list.color ?? styles.foreground, isButton: false }}
        >
          {status ? (
            <View
              testID="type-ahead-search-options"
              accessibilityLabel={labels.suggestionsListAriaLabel}
              style={styles.list}
            >
              {minimum
                ? statusBlock(
                    "minimum-query",
                    null,
                    labels.status.minimumInputLengthMessage({ minimumInputLength: props.minimumInputLength ?? 0 }),
                  )
                : null}
              {props.isLoading
                ? statusBlock(
                    "loading",
                    getNativeButtonContent(
                      props.LoadingIndicator !== undefined ? props.LoadingIndicator : <NativeCompactLoadingIndicator />,
                    ),
                    labels.status.loadingMessage,
                  )
                : null}
            </View>
          ) : (
            <NativeComboBoxList
              key={query}
              testID="type-ahead-search-options"
              accessibilityLabel={labels.suggestionsListAriaLabel}
              shouldFocusWrap={props.shouldFocusWrap ?? true}
              style={styles.list}
              renderEmptyState={() => statusBlock("empty", null, labels.status.emptyListMessage)}
            />
          )}
        </NativeContentContext.Provider>
      </NativeComboBoxPopover>
      {field.placement === "root" && field.metadata}
    </>
  )
}
const CompactTypeaheadSearchInner = <T extends object>(
  props: TNativeCompactTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<TNativeCompactTypeaheadRef>,
) => {
  const inherited = useNativeSlottedContext(NativeComboBoxContext, props.slot)
  const isDisabled = props.isDisabled ?? inherited?.isDisabled ?? false
  const isReadOnly = props.isReadOnly ?? inherited?.isReadOnly ?? false
  const minimumLength = props.minimumInputLength ?? 0
  if (!Number.isFinite(minimumLength) || minimumLength < 0)
    throw new TypeError("CompactTypeaheadSearch: minimumInputLength must be finite and nonnegative")
  const [localQuery, setLocalQuery] = useState(() => props.defaultInputValue ?? "")
  const [localOpen, setLocalOpen] = useState(false)
  const [suppressed, setSuppressed] = useState(false)
  const query = props.inputValue !== undefined ? props.inputValue : localQuery
  const open = props.isOpen ?? (localOpen || (props.inputValue !== undefined && query.trim().length > 0))
  const minimum = query.trim().length < minimumLength && !suppressed
  const status = minimum || !!props.isLoading
  const eligible = query.trim().length >= minimumLength
  const resolvedItems = useMemo(() => (eligible ? Array.from(props.items ?? []) : []), [props.items, eligible])
  const entries = useMemo(
    () => getCompactTypeaheadEntries({ ...props, items: resolvedItems }, query),
    [resolvedItems, props.getItemKey, props.getItemTextValue],
  )
  const items = useMemo(() => (status ? [] : entries.map((entry) => entry.item)), [status, entries])
  const disabledKeys = useMemo(() => Array.from(props.disabledKeys ?? []), [props.disabledKeys])
  const input = useRef<TextInput | null>(null)
  const [originalInput, setOriginalInput] = useState<TextInput | null>(null)
  const trackedInputRef = useNativeCollectionRefs(input, setOriginalInput)
  const inputRef = useNativeCollectionRefs(props.inputRef, trackedInputRef)
  const inputTarget = originalInput ? (findNodeHandle(originalInput) ?? 0) : 0
  const scope = useNativeKeyScope()
  const floatingScope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const overlays = useContext(OverlayRegistryContext)
  const host = useNativeFloatingHost()
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const live = useRef(false)
  const rootWithin = useRef<boolean | null>(null)
  const current = useRef({ props, status, scope, floatingScope, windowActive, isDisabled, isReadOnly })
  useInsertionEffect(() => {
    current.current = { props, status, scope, floatingScope, windowActive, isDisabled, isReadOnly }
  })
  const canAct = () =>
    live.current &&
    host.live.current &&
    !current.current.isDisabled &&
    current.current.scope?.isWindowActive() !== false &&
    current.current.floatingScope?.canAct() !== false &&
    current.current.windowActive?.() !== false
  const clearSuppression = () => {
    if (canAct()) setSuppressed(false)
  }
  useNativeKeyboardObservation({
    targetTag: inputTarget,
    isEnabled: inputTarget > 0,
    lifetimeKey: `compact-minimum:${inputTarget}`,
    canAct,
    onKeyDown: (event) => {
      if (!event.nativeEvent.cancelled && event.nativeEvent.focusedTarget === inputTarget) clearSuppression()
    },
  })
  const retire = useCallback(() => {
    if (pending.current !== null) clearTimeout(pending.current)
    pending.current = null
  }, [])
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      retire()
    }
  }, [retire])
  useInsertionEffect(() => {
    const changed = () => {
      if (!canAct() || current.current.isReadOnly) retire()
    }
    const releases = [scope?.subscribe(changed), host.layers.subscribe(changed), overlays?.subscribe(changed)]
    changed()
    return () => {
      for (const release of releases) release?.()
    }
  }, [scope, host.layers, overlays, isDisabled, isReadOnly, floatingScope, windowActive, retire])
  const requestOpen = (next: boolean) => {
    const owner = current.current
    if (!live.current) return
    if (
      owner.status &&
      owner.props.inputValue !== undefined &&
      owner.props.inputValue.trim().length > 0 &&
      !next &&
      (rootWithin.current ?? getNativeFocusedTarget() === input.current)
    )
      return
    if (owner.props.isOpen === undefined) setLocalOpen(next)
    owner.props.onOpenChange?.(next)
  }
  const changeQuery = (value: string) => {
    if (!live.current) return
    if (current.current.props.inputValue === undefined) setLocalQuery(value)
    if (current.current.props.isOpen === undefined) setLocalOpen(true)
    current.current.props.onInputChange?.(value)
  }
  const changeSelection = (key: string | number | null) => {
    if (!live.current) return
    if (key !== null) {
      setSuppressed(true)
      if (current.current.props.isOpen === undefined) setLocalOpen(false)
    }
    current.current.props.onChange?.(key)
    if (key === null || !canAct()) return
    retire()
    const editor = input.current
    const session = JSON.stringify(current.current.scope?.acknowledgedSession() ?? null)
    pending.current = setTimeout(() => {
      pending.current = null
      const owner = current.current
      if (
        !canAct() ||
        owner.isReadOnly ||
        input.current !== editor ||
        JSON.stringify(owner.scope?.acknowledgedSession() ?? null) !== session
      )
        return
      if (owner.props.isOpen === undefined) setLocalOpen(false)
      owner.props.onOpenChange?.(false)
      focusNativeTarget(editor)
    }, 0)
  }
  const theme = useNativeTheme()
  return (
    <NativeCollectionComboBox
      {...props}
      renderItem={undefined}
      onFocus={props.onFocus ?? undefined}
      onBlur={props.onBlur ?? undefined}
      ref={forwardedRef}
      testID={props.testID ?? props["data-testid"] ?? "type-ahead-search"}
      items={items}
      disabledKeys={disabledKeys}
      getKey={(item) => entries.find((entry) => entry.item === item)!.key}
      getTextValue={(item) => entries.find((entry) => entry.item === item)!.text}
      defaultFilter={() => true}
      allowsEmptyCollection
      isOpen={undefined}
      popoverIsOpen={open}
      inputValue={query}
      defaultInputValue={undefined}
      inputRef={inputRef}
      inputLabel={props.accessibilityLabel ?? props["aria-label"] ?? "Search"}
      closeLabel={resolveCompactTypeaheadLabels(props).searchButtonAriaLabel}
      onInputChange={changeQuery}
      onOpenChange={requestOpen}
      onChange={changeSelection}
      shouldFocusWrap={false}
      customStyles={undefined}
      style={(flags) => getCompactTypeaheadStyles(theme, { ...props, isDisabled: flags.isDisabled }, flags, false).root}
      dependencies={[query, ...(props.dependencies ?? [])]}
      render={(native, flags) => {
        const { color, ...style } = native.style as TextStyle
        const nativeProps = Object.fromEntries(Object.entries(props).filter(([key]) => !componentOptions.has(key)))
        const root = {
          ...nativeViewProps(nativeProps),
          ...native,
          nativeFocusWithinObservation: true,
          nativeOnFocusWithin: (event: TNativeFocusWithinEvent) => {
            rootWithin.current = event.nativeEvent.within
          },
          nativeOnFocusWithinRetired: () => {
            rootWithin.current = null
          },
          style,
          children: (
            <NativeContentContext.Provider
              value={{ foregroundColor: color ?? theme.colors.controlForeground, isButton: false }}
            >
              {native.children}
            </NativeContentContext.Provider>
          ),
        }
        const render = props.render ?? inherited?.render
        return render ? render(root, flags) : <NativeFocusHost {...root} />
      }}
      renderContent={(field) => (
        <CompactContent
          props={props}
          input={input}
          field={field}
          open={open}
          minimum={minimum}
          status={status}
          requestOpen={requestOpen}
          clearSuppression={clearSuppression}
          query={query}
        />
      )}
    >
      {(item) => {
        const entry = entries.find((entry) => entry.item === item)!
        return (
          <NativeComboBoxItem
            id={entry.key}
            textValue={entry.text}
            accessibilityLabel={entry.text}
            style={{ minHeight: 20 }}
            testID={`type-ahead-search-option-${entry.encodedKey}`}
          >
            {props.renderItem
              ? props.renderItem(item, { query, textValue: entry.text, itemKey: entry.key })
              : entry.text}
          </NativeComboBoxItem>
        )
      }}
    </NativeCollectionComboBox>
  )
}
export const CompactTypeaheadSearch = forwardRef(CompactTypeaheadSearchInner) as <T extends object = object>(
  props: TNativeCompactTypeaheadSearchProps<T> & RefAttributes<TNativeCompactTypeaheadRef>,
) => ReactElement | null
