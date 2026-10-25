import {
  forwardRef,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type ReactNode,
  type RefAttributes,
} from "react"

import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"
import { useNativeBorderTransition } from "../borderMotion"
import { NativeCollectionComboBox } from "../ComboBox/CollectionComboBox"
import { NativeContentContext } from "../NativeContentContext"
import { Tag } from "../TagGroup/Tag"
import { TagGroup } from "../TagGroup/TagGroup"
import { Text } from "../Text/Text"

import {
  getNativeTagComboBoxAddRequest,
  getNativeTagComboBoxRemoveRequest,
  getNativeTagComboBoxLabels,
  nativeTagComboBoxKey,
} from "./model"
import { getNativeTagComboBoxStyles } from "./styles"
import type { TNativeTagComboBoxProps, TNativeTagComboBoxRef } from "./types"

const TagComboBoxInner = <T extends object>(
  props: TNativeTagComboBoxProps<T>,
  ref: ForwardedRef<TNativeTagComboBoxRef>,
) => {
  const {
    items,
    selectedItems,
    getItemKey,
    getItemTextValue,
    children,
    renderTagContent,
    onSelectedItemsChange: _selected,
    inputValue,
    defaultInputValue,
    onInputChange: _input,
    customStyles: _custom,
    style: _style,
    customTagGroupProps,
    customTagGroupStyles,
    customTagProps,
    customTagStyles,
    customComboBoxProps,
    customComboBoxStyles,
    labels: _labels,
    width: _width,
    height: _height,
    minWidth: _min,
    maxWidth: _max,
    order,
    color,
    geometry,
    textSize,
    enableFocusStyle: _focus,
    offsetFocusRing: _offset,
    errorState,
    warningState,
    successState,
    inputLabel: _inputLabel,
    closeLabel: _closeLabel,
    testID,
    "data-testid": aliasID,
    nativeID,
    onLayout,
    pointerEvents,
    collapsable,
    ...comboProps
  } = props
  const allItems = useMemo(() => Array.from(items ?? []), [items])
  const currentItems = useRef(allItems)
  const selected = useMemo(
    () => new Set(selectedItems.map((item) => nativeTagComboBoxKey(getItemKey(item)))),
    [selectedItems, getItemKey],
  )
  const available = useMemo(
    () => allItems.filter((item) => !selected.has(nativeTagComboBoxKey(getItemKey(item)))),
    [allItems, selected, getItemKey],
  )
  const [localQuery, setLocalQuery] = useState(defaultInputValue ?? ""),
    [focused, setFocused] = useState(false)
  const current = useRef(props),
    live = useRef(false),
    observedWithin = useRef(false),
    focusEpoch = useRef(0),
    frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  useInsertionEffect(() => {
    current.current = props
    currentItems.current = allItems
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      focusEpoch.current++
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])
  const observedFocus = (value: boolean) => {
    if (observedWithin.current) return
    const generation = ++focusEpoch.current
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    if (value) {
      frame.current = null
      setFocused(true)
    } else
      frame.current = requestAnimationFrame(() => {
        if (live.current && focusEpoch.current === generation) {
          frame.current = null
          setFocused(false)
        }
      })
  }
  const observeWithin = (value: boolean) => {
    observedWithin.current = true
    focusEpoch.current++
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    setFocused(value)
  }
  const changeInput = (value: string) => {
    if (!live.current) return
    if (current.current.inputValue === undefined) setLocalQuery(value)
    current.current.onInputChange?.(value)
    if (live.current) current.current.customComboBoxProps?.onInputChange?.(value)
  }
  const changeSelection = (key: string | number | null) => {
    if (!live.current) return
    const owner = current.current
    const request = getNativeTagComboBoxAddRequest(currentItems.current, owner.selectedItems, key, owner.getItemKey)
    if (!request) return
    owner.onSelectedItemsChange(request.items, request.details)
    if (live.current) changeInput("")
  }
  const remove = (keys: Set<string | number>) => {
    if (!live.current) return
    const owner = current.current,
      request = getNativeTagComboBoxRemoveRequest(owner.selectedItems, keys, owner.getItemKey)
    if (request) owner.onSelectedItemsChange(request.items, request.details)
  }
  const resolved = getNativeTagComboBoxLabels(props),
    theme = useNativeTheme(),
    styles = getNativeTagComboBoxStyles(theme, props, focused)
  const border = useNativeBorderTransition(styles.view, theme.colors.controlBorder)
  const {
    customStyles: nestedComboStyles,
    customInputButtonGroupStyles: nestedGroupStyles,
    labels: _nestedLabels,
    onInputChange: _nestedInput,
    ...innerCombo
  } = customComboBoxProps ?? {}
  const { customStyles: nestedTagsStyles, ...innerTags } = customTagGroupProps ?? {}
  const { customStyles: nestedTagStyles, ...innerTag } = customTagProps ?? {}
  return (
    <NativeContentContext.Provider value={{ foregroundColor: styles.foreground, isButton: false }}>
      <NativeFocusHost
        ref={ref}
        role="group"
        accessible={false}
        focusable={false}
        accessibilityLabel={resolved.groupAriaLabel}
        accessibilityState={{ disabled: !!props.isDisabled }}
        nativeID={nativeID}
        onLayout={onLayout}
        pointerEvents={pointerEvents}
        collapsable={collapsable}
        onBubbledFocus={() => observedFocus(true)}
        onBubbledBlur={() => observedFocus(false)}
        nativeFocusWithinObservation
        nativeOnFocusWithin={(event) => observeWithin(event.nativeEvent.within)}
        nativeOnFocusWithinRetired={() => observeWithin(false)}
        testID={testID ?? aliasID ?? "tag-combobox"}
        style={[styles.view, border]}
      >
        <TagGroup
          {...innerTags}
          items={selectedItems}
          getKey={getItemKey}
          selectionMode="none"
          onRemove={remove}
          accessibilityLabel={innerTags.accessibilityLabel ?? innerTags["aria-label"] ?? resolved.tagGroupAriaLabel}
          disabledKeys={props.isDisabled ? selectedItems.map(getItemKey) : innerTags.disabledKeys}
          customStyles={[customTagGroupStyles, nestedTagsStyles]}
        >
          {(item) => (
            <Tag
              color={color}
              geometry={geometry}
              order={order}
              raised
              {...innerTag}
              id={getItemKey(item)}
              textValue={getItemTextValue(item)}
              isDisabled={props.isDisabled || innerTag.isDisabled}
              customStyles={[customTagStyles, nestedTagStyles]}
              onFocus={(event) => {
                observedFocus(true)
                innerTag.onFocus?.(event)
              }}
              onBlur={(event) => {
                observedFocus(false)
                innerTag.onBlur?.(event)
              }}
            >
              {renderTagContent?.(item) ?? <Text variant={styles.textVariant}>{getItemTextValue(item)}</Text>}
            </Tag>
          )}
        </TagGroup>
        <NativeCollectionComboBox
          {...innerCombo}
          {...comboProps}
          items={available}
          controlledItems={available}
          getKey={getItemKey}
          getTextValue={getItemTextValue}
          value={null}
          onChange={changeSelection}
          inputValue={inputValue !== undefined ? inputValue : localQuery}
          onInputChange={changeInput}
          inputLabel={resolved.comboBox.inputLabel}
          triggerLabel={resolved.comboBox.triggerButtonAriaLabel}
          groupLabel={resolved.comboBox.inputButtonGroupAriaLabel}
          closeLabel={resolved.comboBox.closeLabel}
          color={color}
          geometry={geometry}
          textSize={textSize}
          isDisabled={props.isDisabled}
          isOpen={props.isOpen}
          errorState={errorState}
          warningState={warningState}
          successState={successState}
          width="100%"
          enableFocusStyle={false}
          emptyListMessage={resolved.comboBox.emptyListMessage}
          customStyles={[{ height: "100%" }, nestedComboStyles, customComboBoxStyles]}
          customInputButtonGroupStyles={[
            nestedGroupStyles,
            { borderWidth: 0, borderTopWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 },
          ]}
        >
          {children}
        </NativeCollectionComboBox>
      </NativeFocusHost>
    </NativeContentContext.Provider>
  )
}
export const TagComboBox = forwardRef(TagComboBoxInner) as <T extends object>(
  props: TNativeTagComboBoxProps<T> & RefAttributes<TNativeTagComboBoxRef>,
) => ReactNode
