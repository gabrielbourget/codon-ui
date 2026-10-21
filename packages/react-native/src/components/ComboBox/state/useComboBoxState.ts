/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { FocusStrategy, Key, Selection } from "../../../collection/state/types"
import { useControlledState } from "../../../collection/state/useControlledState"
import { useListState } from "../../../collection/state/useListState"

import { ListCollection, filterComboBoxNodes } from "./ListCollection"
import type {
  ChangeValueType,
  Collection,
  ComboBoxState,
  ComboBoxStateOptions,
  MenuTriggerAction,
  SelectionMode,
  ValueType,
} from "./types"
import { useFormValidationState } from "./useFormValidationState"
import { useOverlayTriggerState } from "./useOverlayTriggerState"

type FilterFn = (textValue: string, inputValue: string) => boolean

const EMPTY_VALUE: Key[] = []

/**
 * Provides state management for a combo box component. Handles building a collection
 * of items from props and manages the option selection state of the combo box. In addition, it tracks the input value,
 * focus state, and other properties of the combo box.
 */
export function useComboBoxState<T extends object, M extends SelectionMode = "single">(
  props: ComboBoxStateOptions<T, M>,
): ComboBoxState<T, M> {
  const {
    defaultFilter,
    menuTrigger = "input",
    allowsEmptyCollection = false,
    allowsCustomValue,
    shouldCloseOnBlur = true,
    selectionMode = "single" as SelectionMode,
  } = props

  const [showAllItems, setShowAllItems] = useState(false)
  const [isFocused, setFocusedState] = useState(false)
  const [focusStrategy, setFocusStrategy] = useState<FocusStrategy | null>(null)

  const defaultValue = useMemo(() => {
    return props.defaultValue !== undefined
      ? props.defaultValue
      : ((selectionMode === "single" ? (props.defaultSelectedKey ?? null) : []) as ValueType<M>)
  }, [props.defaultValue, props.defaultSelectedKey, selectionMode])
  const value = useMemo(() => {
    return props.value !== undefined
      ? props.value
      : ((selectionMode === "single" ? props.selectedKey : undefined) as ValueType<M>)
  }, [props.value, props.selectedKey, selectionMode])
  const [controlledValue, setControlledValue] = useControlledState<Key | readonly Key[] | null>(
    value,
    defaultValue,
    props.onChange as ((value: Key | readonly Key[] | null) => void) | undefined,
  )
  // Only display the first selected item if in single selection mode but the value is an array.
  const displayValue = (
    selectionMode === "single" && Array.isArray(controlledValue) ? controlledValue[0] : controlledValue
  ) as ValueType<M>

  const setValue = (value: Key | Key[] | null) => {
    if (selectionMode === "single") {
      const key = Array.isArray(value) ? (value[0] ?? null) : value
      setControlledValue(key)
      if (key !== displayValue) {
        props.onSelectionChange?.(key)
      }
    } else {
      let keys: Key[] = []
      if (Array.isArray(value)) {
        keys = value
      } else if (value != null) {
        keys = [value]
      }

      setControlledValue(keys)
    }
  }

  const { selectionManager, disabledKeys } = useListState({
    ...props,
    items: props.items ?? props.defaultItems,
    selectionMode,
    disallowEmptySelection: selectionMode === "single",
    allowDuplicateSelectionEvents: true,
    selectedKeys: useMemo(() => convertValue(displayValue), [displayValue]),
    onSelectionChange: (keys: Selection) => {
      // impossible, but TS doesn't know that
      if (keys === "all") {
        return
      }

      if (selectionMode === "single") {
        const key = keys.values().next().value ?? null
        if (key === displayValue) {
          props.onSelectionChange?.(key)
          // If key is the same, reset the inputValue and close the menu
          // (scenario: user clicks on already selected option)
          resetInputValue()
          closeMenu()
        } else {
          setValue(key)
        }
      } else {
        setValue([...keys])
      }
    },
  })

  const collection = props.collection

  const selectedKey = selectionMode === "single" ? selectionManager.firstSelectedKey : null
  const selectedItems = useMemo(() => {
    return [...selectionManager.selectedKeys].map((key) => collection.getItem(key)).filter((item) => item != null)
  }, [selectionManager.selectedKeys, collection])

  const [inputValue, setInputValue] = useControlledState(
    props.inputValue,
    getDefaultInputValue(props.defaultInputValue, selectedKey, collection) || "",
    props.onInputChange,
  )
  const [initialValue] = useState(displayValue)
  const [initialInputValue] = useState(inputValue)

  // Preserve original collection so we can show all items on demand
  const originalCollection = collection
  const filteredCollection = useMemo(
    () =>
      // No default filter if items are controlled.
      props.items != null || !defaultFilter ? collection : filterCollection(collection, inputValue, defaultFilter),
    [collection, inputValue, defaultFilter, props.items],
  )
  const [lastCollection, setLastCollection] = useState(filteredCollection)

  // Track what action is attempting to open the menu
  const menuOpenTrigger = useRef<MenuTriggerAction | undefined>("focus")
  const onOpenChange = (open: boolean) => {
    if (props.onOpenChange) {
      props.onOpenChange(open, open ? menuOpenTrigger.current : undefined)
    }

    selectionManager.setFocused(open)
    if (!open) {
      selectionManager.setFocusedKey(null)
    }
  }

  const triggerState = useOverlayTriggerState({ ...props, onOpenChange })
  const open = (focusStrategy: FocusStrategy | null = null, trigger?: MenuTriggerAction) => {
    const displayAllItems = trigger === "manual" || (trigger === "focus" && menuTrigger === "focus")
    // Prevent open operations from triggering if there is nothing to display
    // Also prevent open operations from triggering if items are uncontrolled but defaultItems is empty, even if displayAllItems is true.
    // This is to prevent comboboxes with empty defaultItems from opening but allow controlled items comboboxes to open even if the inital list is empty (assumption is user will provide swap the empty list with a base list via onOpenChange returning `menuTrigger` manual)
    if (
      allowsEmptyCollection ||
      filteredCollection.size > 0 ||
      (displayAllItems && originalCollection.size > 0) ||
      props.items
    ) {
      if (displayAllItems && !triggerState.isOpen && props.items === undefined) {
        // Show all items if menu is manually opened. Only care about this if items are undefined
        setShowAllItems(true)
      }

      menuOpenTrigger.current = trigger
      setFocusStrategy(focusStrategy)
      triggerState.open()
    }
  }

  const toggle = (focusStrategy: FocusStrategy | null = null, trigger?: MenuTriggerAction) => {
    const displayAllItems = trigger === "manual" || (trigger === "focus" && menuTrigger === "focus")
    // If the menu is closed and there is nothing to display, early return so toggle isn't called to prevent extraneous onOpenChange
    if (
      !(
        allowsEmptyCollection ||
        filteredCollection.size > 0 ||
        (displayAllItems && originalCollection.size > 0) ||
        props.items
      ) &&
      !triggerState.isOpen
    ) {
      return
    }

    if (displayAllItems && !triggerState.isOpen && props.items === undefined) {
      // Show all items if menu is toggled open. Only care about this if items are undefined
      setShowAllItems(true)
    }

    // Only update the menuOpenTrigger if menu is currently closed
    if (!triggerState.isOpen) {
      menuOpenTrigger.current = trigger
    }

    toggleMenu(focusStrategy)
  }

  const updateLastCollection = useCallback(() => {
    setLastCollection(showAllItems ? originalCollection : filteredCollection)
  }, [showAllItems, originalCollection, filteredCollection])

  // If menu is going to close, save the current collection so we can freeze the displayed collection when the
  // user clicks outside the popover to close the menu. Prevents the menu contents from updating as the menu closes.
  const toggleMenu = useCallback(
    (focusStrategy: FocusStrategy | null = null) => {
      if (triggerState.isOpen) {
        updateLastCollection()
      }

      setFocusStrategy(focusStrategy)
      triggerState.toggle()
    },
    [triggerState, updateLastCollection],
  )

  const closeMenu = useCallback(() => {
    if (triggerState.isOpen) {
      updateLastCollection()
      triggerState.close()
    }
  }, [triggerState, updateLastCollection])

  const [lastValue, setLastValue] = useState(inputValue)
  const resetInputValue = () => {
    const itemText = selectedKey != null ? (collection.getItem(selectedKey)?.textValue ?? "") : ""
    setLastValue(itemText)
    setInputValue(itemText)
  }

  const lastValueRef = useRef(displayValue)
  const lastSelectedKeyText = useRef(selectedKey != null ? (collection.getItem(selectedKey)?.textValue ?? "") : "")
  // intentional omit dependency array, want this to happen on every render
  useEffect(() => {
    // Open and close menu automatically when the input value changes if the input is focused,
    // and there are items in the collection or allowEmptyCollection is true.
    if (
      isFocused &&
      (filteredCollection.size > 0 || allowsEmptyCollection) &&
      !triggerState.isOpen &&
      inputValue !== lastValue &&
      menuTrigger !== "manual"
    ) {
      open(null, "input")
    }

    // Close the menu if the collection is empty. Don't close menu if filtered collection size is 0
    // but we are currently showing all items via button press
    if (!showAllItems && !allowsEmptyCollection && triggerState.isOpen && filteredCollection.size === 0) {
      closeMenu()
    }

    // Close when an item is selected.
    if (displayValue != null && displayValue !== lastValueRef.current && selectionMode === "single") {
      closeMenu()
    }

    // Clear focused key when input value changes and display filtered collection again.
    if (inputValue !== lastValue) {
      selectionManager.setFocusedKey(null)
      setShowAllItems(false)

      // Set value to null when the user clears the input.
      // If controlled, this is the application developer's responsibility.
      if (selectionMode === "single" && inputValue === "" && (props.inputValue === undefined || value === undefined)) {
        setValue(null)
      }
    }

    // If the value changed, update the input value.
    // Do nothing if both inputValue and value are controlled.
    // In this case, it's the user's responsibility to update inputValue in onSelectionChange.
    if (displayValue !== lastValueRef.current && (props.inputValue === undefined || value === undefined)) {
      resetInputValue()
    } else if (lastValue !== inputValue) {
      setLastValue(inputValue)
    }

    // Update the inputValue if the selected item's text changes from its last tracked value.
    // This is to handle cases where a selectedKey is specified but the items aren't available (async loading) or the selected item's text value updates.
    // Only reset if the user isn't currently within the field so we don't erroneously modify user input.
    // If inputValue is controlled, it is the user's responsibility to update the inputValue when items change.
    const selectedItemText = selectedKey != null ? (collection.getItem(selectedKey)?.textValue ?? "") : ""
    if (!isFocused && selectedKey != null && props.inputValue === undefined && selectedKey === lastValueRef.current) {
      if (lastSelectedKeyText.current !== selectedItemText) {
        setLastValue(selectedItemText)
        setInputValue(selectedItemText)
      }
    }

    lastValueRef.current = displayValue
    lastSelectedKeyText.current = selectedItemText
  })

  const validation = useFormValidationState({
    ...props,
    value: useMemo(
      () =>
        Array.isArray(displayValue) && displayValue.length === 0
          ? null
          : { inputValue, value: displayValue as ValueType<M>, selectedKey },
      [inputValue, selectedKey, displayValue],
    ),
  })

  // Revert input value and close menu
  const revert = () => {
    if (allowsCustomValue && selectedKey == null) {
      commitCustomValue()
    } else {
      commitSelection()
    }
  }

  const commitCustomValue = () => {
    const value = selectionMode === "multiple" ? EMPTY_VALUE : null
    lastValueRef.current = value as ValueType<M>
    setValue(value)
    closeMenu()
  }

  const commitSelection = (shouldForceSelectionChange = false) => {
    // If multiple things are controlled, call onSelectionChange only when selecting the focused item,
    // or when inputValue needs to be synced back to the selected item on commit/blur.
    if (value !== undefined && props.inputValue !== undefined) {
      const itemText = selectedKey != null ? (collection.getItem(selectedKey)?.textValue ?? "") : ""
      if (shouldForceSelectionChange || selectionMode === "multiple" || inputValue !== itemText) {
        props.onSelectionChange?.(selectedKey)
        props.onChange?.(displayValue as ChangeValueType<M>)
      }

      // Stop menu from reopening from useEffect
      setLastValue(itemText)
      closeMenu()
    } else {
      // If only a single aspect of combobox is controlled, reset input value and close menu for the user
      resetInputValue()
      closeMenu()
    }
  }

  const commitValue = () => {
    if (allowsCustomValue) {
      const itemText = selectedKey != null ? (collection.getItem(selectedKey)?.textValue ?? "") : ""
      if (inputValue === itemText) commitSelection()
      else commitCustomValue()
    } else {
      // Reset inputValue and close menu
      commitSelection()
    }
  }

  const commit = () => {
    if (triggerState.isOpen && selectionManager.focusedKey != null) {
      // Reset inputValue and close menu here if the selected key is already the focused key. Otherwise
      // fire onSelectionChange to allow the application to control the closing.
      if (selectionManager.isSelected(selectionManager.focusedKey) && selectionMode === "single") {
        commitSelection(true)
      } else {
        selectionManager.select(selectionManager.focusedKey)
      }
    } else {
      commitValue()
    }
  }

  const valueOnFocus = useRef([inputValue, displayValue])
  const setFocused = (isFocused: boolean) => {
    if (isFocused) {
      valueOnFocus.current = [inputValue, displayValue]
      if (menuTrigger === "focus" && !props.isReadOnly) {
        open(null, "focus")
      }
    } else {
      if (shouldCloseOnBlur) {
        commitValue()
      }

      // Commit validation if the input value or selected items changed.
      if (inputValue !== valueOnFocus.current[0] || displayValue !== valueOnFocus.current[1]) {
        validation.commitValidation()
      }
    }

    setFocusedState(isFocused)
  }

  const displayedCollection = useMemo(() => {
    if (triggerState.isOpen) {
      if (showAllItems) {
        return originalCollection
      } else {
        return filteredCollection
      }
    } else {
      return lastCollection
    }
  }, [triggerState.isOpen, originalCollection, filteredCollection, showAllItems, lastCollection])

  const defaultSelectedKey = props.defaultSelectedKey ?? (selectionMode === "single" ? (initialValue as Key) : null)

  return {
    ...validation,
    ...triggerState,
    focusStrategy,
    toggle,
    open,
    close: commitValue,
    selectionManager,
    value: displayValue as ValueType<M>,
    defaultValue: defaultValue ?? (initialValue as ValueType<M>),
    setValue,
    selectedKey,
    selectedItems,
    defaultSelectedKey,
    setSelectedKey: setValue,
    disabledKeys,
    isFocused,
    setFocused,
    selectedItem: selectedItems[0] ?? null,
    collection: displayedCollection,
    inputValue,
    defaultInputValue:
      getDefaultInputValue(props.defaultInputValue, defaultSelectedKey, collection) ?? initialInputValue,
    setInputValue,
    commit,
    revert,
  }
}

function filterCollection<T extends object>(
  collection: Collection<T>,
  inputValue: string,
  filter: FilterFn,
): Collection<T> {
  return new ListCollection(filterComboBoxNodes(collection, collection, (text) => filter(text, inputValue)))
}

function getDefaultInputValue(
  defaultInputValue: string | null | undefined,
  selectedKey: Key | null,
  collection: Collection<unknown>,
) {
  if (defaultInputValue == null) {
    if (selectedKey != null) {
      return collection.getItem(selectedKey)?.textValue ?? ""
    }
  }

  return defaultInputValue
}

function convertValue(value: Key | readonly Key[] | null | undefined) {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}
