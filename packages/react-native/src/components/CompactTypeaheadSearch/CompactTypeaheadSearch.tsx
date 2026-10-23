import {
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardedRef,
  type ReactElement,
  type RefAttributes,
  type RefObject,
} from "react"
import type { TextInput } from "react-native"
import { findNodeHandle, ScrollView, View, type TextStyle, type ViewStyle } from "react-native"

import { focusNativeTarget, getNativeFocusedTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyPolicy, useNativeKeyScope, useNativeKeyboardObservation } from "../../input/NativeKeyboardScope"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeFloatingHost } from "../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { OverlayRegistryContext } from "../../overlays/NativeOverlayProvider"
import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { NativeFloatingSurface } from "../ClickPopover/ClickPopover"
import { Input } from "../Input/Input"
import { NativeContentContext } from "../NativeContentContext"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import { NativeCompactLoadingIndicator, NativeCompactSearchIcon } from "./affordances"
import { resolveCompactTypeaheadLabels } from "./labels"
import { useCompactTypeaheadState } from "./model"
import { NativeCompactOption } from "./Option"
import { getCompactTypeaheadStyles } from "./styles"
import type { TNativeCompactTypeaheadRef, TNativeCompactTypeaheadSearchProps } from "./types"

const CLOSED_KEYS = ["ArrowDown", "ArrowUp"].flatMap(nativeKeyTokens)
const OPEN_KEYS = [...CLOSED_KEYS, ...["Home", "End", "Enter", "Escape"].flatMap(nativeKeyTokens)]
const NativeCompactKeys = <T extends object>({
  target,
  enabled,
  canAct,
  modelRef,
}: {
  target: number
  enabled: boolean
  canAct: () => boolean
  modelRef: RefObject<ReturnType<typeof useCompactTypeaheadState<T>> | null>
}) => {
  const scope = useContext(NativeFloatingScopeContext)
  const model = modelRef.current
  useNativeKeyPolicy({
    tokens: model?.open ? OPEN_KEYS : CLOSED_KEYS,
    targetTag: target,
    excludeEditable: false,
    excludeComposing: true,
    isEnabled: enabled && target > 0 && scope?.canAct() !== false,
    lifetimeKey: `${target}:${enabled}:${model?.entries.map((entry) => entry.encodedKey).join("|")}`,
    canAct: () => canAct() && scope?.canAct() !== false,
    onKey: (event) => {
      const data = event.nativeEvent
      const owner = modelRef.current
      if (!owner || data.phase !== "down" || data.cancelled || !data.nativeDefaultHandled) return
      if (data.key === "ArrowDown") owner.highlight(1)
      else if (data.key === "ArrowUp") owner.highlight(-1)
      else if (data.key === "Home" || data.key === "End") owner.focusEdge(data.key, data.shiftKey)
      else if (!data.repeat && data.key === "Enter" && owner.active !== null) owner.select(owner.active, true)
      else if (!data.repeat && data.key === "Escape") owner.revert()
    },
  })
  useNativeKeyboardObservation({
    targetTag: target,
    isEnabled: enabled && target > 0 && scope?.canAct() !== false,
    lifetimeKey: `${target}:${enabled}`,
    canAct: () => canAct() && scope?.canAct() !== false,
    onKeyDown: ({ nativeEvent: data }) => {
      if (data.cancelled || data.isComposing || data.focusedTarget !== target) return
      if (data.key === "ArrowLeft" || data.key === "ArrowRight") modelRef.current?.clearHighlight()
    },
  })
  return null
}
const NativeCompactTypeaheadSearch = <T extends object>(
  props: TNativeCompactTypeaheadSearchProps<T>,
  forwardedRef: ForwardedRef<TNativeCompactTypeaheadRef>,
) => {
  const {
    items,
    inputValue,
    defaultInputValue,
    onInputChange,
    value,
    defaultValue,
    onChange,
    isOpen,
    onOpenChange,
    isLoading,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    disabledKeys,
    menuTrigger,
    allowsCustomValue,
    inputRef: authoredInputRef,
    inputProps,
    autoFocus,
    placeholder,
    minimumInputLength = 0,
    minimumInputLengthMessage,
    loadingMessage,
    emptyListMessage,
    labels: authoredLabels,
    getItemKey,
    getItemTextValue,
    renderItem,
    height,
    width,
    color,
    geometry,
    textSize,
    placement = "bottom start",
    rtl = false,
    shouldFocusWrap: _shouldFocusWrap,
    enableFocusStyle,
    offsetFocusRing,
    errorState,
    warningState,
    successState,
    SearchIcon,
    LoadingIndicator,
    customStyles,
    customInputStyles,
    customButtonStyles,
    customInputButtonGroupStyles,
    customOptionsListStyles,
    style,
    testID,
    "data-testid": aliasID,
    accessibilityLabel,
    "aria-label": aliasLabel,
    ...native
  } = props
  if (!Number.isFinite(minimumInputLength) || minimumInputLength < 0)
    throw new TypeError("CompactTypeaheadSearch: minimumInputLength must be finite and nonnegative")
  const host = useNativeFloatingHost()
  const inputScope = useNativeKeyScope()
  const scope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const overlays = useContext(OverlayRegistryContext)
  const live = useRef(true)
  const input = useRef<TextInput>(null)
  const group = useRef<View>(null)
  const button = useRef<View>(null)
  const [groupWidth, setGroupWidth] = useState(0)
  const [focused, setFocused] = useState(false)
  const [inputTag, setInputTag] = useState(0)
  const retirement = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurFrame = useRef<number | null>(null)
  const releaseInput = useRef<(() => void) | undefined>(undefined)
  const current = useRef({ props, inputScope, scope, windowActive })
  useInsertionEffect(() => {
    current.current = { props, inputScope, scope, windowActive }
  })
  const canAct = () =>
    live.current &&
    host.live.current &&
    !current.current.props.isDisabled &&
    current.current.inputScope?.isWindowActive() !== false &&
    current.current.scope?.canAct() !== false &&
    current.current.windowActive?.() !== false
  const containsFocus = () => {
    const target = getNativeFocusedTarget()
    return target !== null && (target === input.current || target === button.current)
  }
  const windowKey = () => {
    const owner = current.current.inputScope
    const session = owner?.acknowledgedSession()
    return `${owner?.ownerId ?? ""}:${session?.windowId ?? ""}:${session?.epoch ?? 0}`
  }
  const stateRef = useRef<ReturnType<typeof useCompactTypeaheadState<T>> | null>(null)
  const restoreAfterSelection = () => {
    if (retirement.current !== null) clearTimeout(retirement.current)
    const target = input.current
    const window = windowKey()
    retirement.current = setTimeout(() => {
      retirement.current = null
      if (!canAct() || current.current.props.isReadOnly || input.current !== target || windowKey() !== window) return
      stateRef.current?.finishSelection()
      focusNativeTarget(target)
    }, 0)
  }
  const state = useCompactTypeaheadState(props, { canAct, containsFocus, restoreAfterSelection })
  useInsertionEffect(() => {
    stateRef.current = state
  })
  const retireInvalidSelection = useCallback(() => {
    if (!canAct() || current.current.props.isReadOnly) {
      if (retirement.current !== null) clearTimeout(retirement.current)
      retirement.current = null
    }
  }, [host.live])
  useLayoutEffect(() => inputScope?.subscribe(retireInvalidSelection), [inputScope, retireInvalidSelection])
  useLayoutEffect(() => host.layers.subscribe(retireInvalidSelection), [host.layers, retireInvalidSelection])
  useLayoutEffect(() => {
    const release = overlays?.subscribe(retireInvalidSelection)
    return () => {
      release?.()
    }
  }, [overlays, retireInvalidSelection])
  useLayoutEffect(retireInvalidSelection, [isDisabled, isReadOnly, scope, windowActive, retireInvalidSelection])
  useInsertionEffect(
    () => () => {
      live.current = false
      if (retirement.current !== null) clearTimeout(retirement.current)
      if (blurFrame.current !== null) cancelAnimationFrame(blurFrame.current)
    },
    [],
  )
  const setInput = useCallback(
    (target: TextInput | null) => {
      input.current = target
      releaseInput.current?.()
      releaseInput.current = undefined
      if (typeof authoredInputRef === "function") {
        if (target) {
          const release = authoredInputRef(target)
          releaseInput.current = typeof release === "function" ? release : () => authoredInputRef(null)
        }
      } else if (authoredInputRef) authoredInputRef.current = target
    },
    [authoredInputRef],
  )
  useLayoutEffect(() => {
    setInputTag(input.current ? (findNodeHandle(input.current) ?? 0) : 0)
  })
  const blur = () => {
    if (blurFrame.current !== null) cancelAnimationFrame(blurFrame.current)
    blurFrame.current = requestAnimationFrame(() => {
      blurFrame.current = null
      if (!live.current || containsFocus()) return
      setFocused(false)
      stateRef.current?.blur()
    })
  }
  const theme = useNativeTheme()
  const styles = getCompactTypeaheadStyles(
    theme,
    props,
    {
      isOpen: state.triggerOpen,
      isDisabled: !!isDisabled,
      isReadOnly: !!isReadOnly,
      isRequired: !!isRequired,
      isInvalid: !!isInvalid,
    },
    focused,
  )
  const labels = resolveCompactTypeaheadLabels(props)
  const { color: _rootColor, ...rootStyle } = styles.root
  const { color: _groupColor, ...groupStyle } = styles.group
  const { color: _listColor, ...listStyle } = styles.list
  const popupStyle: TextStyle = {
    direction: rtl ? "rtl" : "ltr",
    width: Math.max(0, Math.min(420, (host.layout?.width ?? 450) - 30, Math.max(groupWidth, 280))),
    maxHeight: Math.max(0, Math.min(275, (host.layout?.height ?? 305) - 30)),
    padding: 0,
    backgroundColor: theme.colors.background,
  }
  const statusBlock = (kind: string, content: ReactElement | null, text: string) => (
    <View
      testID={`type-ahead-search-${kind}-state`}
      accessibilityLiveRegion="polite"
      style={styles.status as ViewStyle}
    >
      {content}
      <PlaceholderText align="center">{text}</PlaceholderText>
    </View>
  )
  return (
    <NativeContentContext.Provider value={{ foregroundColor: styles.foreground, isButton: false }}>
      <View
        {...nativeViewProps(native)}
        ref={forwardedRef}
        testID={testID ?? aliasID ?? "type-ahead-search"}
        accessible={false}
        style={rootStyle}
      >
        <NativeCompactKeys
          target={inputTag}
          enabled={!state.open && !isDisabled && !isReadOnly}
          canAct={canAct}
          modelRef={stateRef}
        />
        <NativeFocusHost
          ref={group}
          testID="type-ahead-search-group"
          accessibilityLabel={labels.inputButtonGroupAriaLabel}
          focusable={false}
          accessible={false}
          role="group"
          style={groupStyle}
          onLayout={(event) => {
            if (live.current && Number.isFinite(event.nativeEvent.layout.width))
              setGroupWidth(event.nativeEvent.layout.width)
          }}
        >
          <Input
            {...inputProps}
            ref={setInput}
            testID="type-ahead-search-input"
            accessibilityLabel={accessibilityLabel ?? aliasLabel}
            value={state.query}
            isDisabled={isDisabled}
            isReadOnly={isReadOnly}
            autoFocus={autoFocus}
            placeholder={placeholder}
            textSize={textSize}
            customStyles={styles.input}
            enableFocusStyle={false}
            onChangeText={state.changeQuery}
            onFocus={(event) => {
              if (!canAct()) return
              setFocused(true)
              stateRef.current?.focus()
              current.current.props.inputProps?.onFocus?.(event)
            }}
            onBlur={(event) => {
              if (!live.current) return
              blur()
              current.current.props.inputProps?.onBlur?.(event)
            }}
          />
          <Button
            ref={button}
            testID="type-ahead-search-button"
            accessibilityLabel={labels.searchButtonAriaLabel}
            accessibilityState={{ expanded: state.open }}
            geometry="rounded"
            raised={false}
            customStyles={styles.button}
            isDisabled={isDisabled || isReadOnly}
            onPress={() => {
              if (canAct()) {
                stateRef.current?.toggle()
                focusNativeTarget(input.current)
              }
            }}
            onFocus={() => {
              if (canAct()) setFocused(true)
            }}
            onBlur={blur}
          >
            {SearchIcon !== undefined ? SearchIcon : <NativeCompactSearchIcon />}
          </Button>
        </NativeFocusHost>
        <NativeFloatingSurface
          triggerRef={group}
          isOpen={state.open}
          onOpenChange={(next) => stateRef.current?.requestOpen(next)}
          placement={placement}
          direction={rtl ? "rtl" : "ltr"}
          offset={5}
          isNonModal
          childIsDialog={false}
          nativeRootRole={null}
          focusable={false}
          testID="type-ahead-search-popover"
          style={[popupStyle, customOptionsListStyles]}
        >
          <NativeCompactKeys
            target={inputTag}
            enabled={state.open && !isDisabled && !isReadOnly}
            canAct={canAct}
            modelRef={stateRef}
          />
          <NativeContentContext.Provider
            value={{ foregroundColor: styles.list.color ?? styles.foreground, isButton: false }}
          >
            <ScrollView
              testID="type-ahead-search-options"
              accessibilityLabel={labels.suggestionsListAriaLabel}
              role="radiogroup"
              keyboardShouldPersistTaps="handled"
              style={listStyle}
            >
              {state.minimum
                ? statusBlock("minimum-query", null, labels.status.minimumInputLengthMessage({ minimumInputLength }))
                : null}
              {isLoading
                ? statusBlock(
                    "loading",
                    <>
                      {getNativeButtonContent(
                        LoadingIndicator !== undefined ? LoadingIndicator : <NativeCompactLoadingIndicator />,
                      )}
                    </>,
                    labels.status.loadingMessage,
                  )
                : null}
              {!state.status && !state.entries.length
                ? statusBlock("empty", null, labels.status.emptyListMessage)
                : null}
              {!state.status
                ? state.entries.map((entry) => (
                    <NativeCompactOption
                      key={entry.encodedKey}
                      identity={`type-ahead-search-option-${entry.encodedKey}`}
                      text={entry.text}
                      selected={state.value === entry.key}
                      active={state.active === entry.key}
                      disabled={!!isDisabled || state.disabled.has(entry.encodedKey)}
                      readOnly={isReadOnly}
                      onSelect={() => stateRef.current?.select(entry.key)}
                    >
                      {renderItem
                        ? renderItem(entry.item, { query: state.query, textValue: entry.text, itemKey: entry.key })
                        : entry.text}
                    </NativeCompactOption>
                  ))
                : null}
            </ScrollView>
          </NativeContentContext.Provider>
        </NativeFloatingSurface>
      </View>
    </NativeContentContext.Provider>
  )
}
export const CompactTypeaheadSearch = forwardRef(NativeCompactTypeaheadSearch) as <T extends object = object>(
  props: TNativeCompactTypeaheadSearchProps<T> & RefAttributes<TNativeCompactTypeaheadRef>,
) => ReactElement | null
