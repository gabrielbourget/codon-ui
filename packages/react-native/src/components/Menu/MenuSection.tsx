/* Copyright 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
import { useCallback, useContext, useId, useState, type ReactNode, type RefAttributes } from "react"
import type { View } from "react-native"

import { createNativeCollectionBranch } from "../../collection/CollectionBuilder"
import { useNativeSlottedContext } from "../../collection/context"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import type { TNativeCollectionSnapshot } from "../../collection/snapshot"
import { useMultipleSelectionState } from "../../collection/state"
import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import {
  NativeMenuActionsContext,
  NativeMenuHeaderContext,
  NativeMenuHeaderBindingContext,
  NativeMenuItemContext,
  NativeMenuSelectionManagerContext,
  NativeMenuStateContext,
} from "./context"
import { NativeMenuGroupSelectionManager } from "./GroupSelectionManager"
import type { TNativeMenuSectionProps } from "./types"

const Section = createNativeCollectionBranch<object, TNativeMenuSectionProps, View>(
  "section",
  (props, ref, section) => {
    const {
      id: _id,
      value: _value,
      items: _items,
      children: _children,
      dependencies: _dependencies,
      selectionMode: _mode,
      selectedKeys: _selected,
      defaultSelectedKeys: _defaults,
      onSelectionChange: _selection,
      disabledKeys: _disabled,
      disallowEmptySelection: _empty,
      shouldCloseOnSelect,
      render,
      style,
      ...native
    } = props
    const state = useContext(NativeMenuStateContext)
    const parent = useContext(NativeMenuSelectionManagerContext)
    const actions = useContext(NativeMenuActionsContext)
    const theme = useNativeTheme()
    if (!state || !parent || !actions) throw new Error("MenuSection requires a native Menu")
    const localSelection = useMultipleSelectionState(props)
    const manager = props.selectionMode != null ? new NativeMenuGroupSelectionManager(parent, localSelection) : parent
    const inherited = useNativeSlottedContext(NativeMenuItemContext)
    const { CollectionBranch } = useContext(NativeCollectionRendererContext)
    const generatedHeaderID = useId()
    const [headerID, setHeaderID] = useState<string | null>(null)
    const headerRef = useCallback((target: View | null, nativeID: string) => setHeaderID(target ? nativeID : null), [])
    const styles = splitNativeTextStyle(resolveNativeStyle(style, "MenuSection", "style"))
    const text = { ...actions.text, ...styles.text }
    const children = (
      <NativeMenuHeaderBindingContext.Provider value={{ nativeID: generatedHeaderID, ref: headerRef }}>
        <NativeMenuHeaderContext.Provider value={{ nativeID: generatedHeaderID }}>
          <NativeMenuSelectionManagerContext.Provider value={manager}>
            <NativeMenuItemContext.Provider
              value={{ shouldCloseOnSelect: shouldCloseOnSelect ?? inherited?.shouldCloseOnSelect }}
            >
              <NativeMenuActionsContext.Provider value={{ ...actions, text }}>
                <NativeContentContext.Provider
                  value={{ foregroundColor: text.color ?? theme.colors.foreground, isButton: false }}
                >
                  <CollectionBranch
                    collection={state.collection as TNativeCollectionSnapshot<object>}
                    parent={section}
                  />
                </NativeContentContext.Provider>
              </NativeMenuActionsContext.Provider>
            </NativeMenuItemContext.Provider>
          </NativeMenuSelectionManagerContext.Provider>
        </NativeMenuHeaderContext.Provider>
      </NativeMenuHeaderBindingContext.Provider>
    )
    const hostProps = {
      ...native,
      ref,
      role: "group" as const,
      accessible: false,
      focusable: false,
      nativeLabelledBy: nativeAccessibilityIDs(headerID ?? undefined),
      style: styles.view,
      children,
    }
    return render ? render(hostProps, undefined) : <NativeFocusHost {...hostProps} />
  },
)

export const MenuSection = Section as <T extends object>(
  props: TNativeMenuSectionProps<T> & RefAttributes<View>,
) => ReactNode
