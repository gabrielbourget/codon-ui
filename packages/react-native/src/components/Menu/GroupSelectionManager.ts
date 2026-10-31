/* Copyright 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
import type { MultipleSelectionState } from "react-stately/useMultipleSelectionState"

import { SelectionManager } from "../../collection/state/SelectionManager"
import type { FocusStrategy, Key } from "../../collection/state/types"

// Pinned RAC Menu 1.17.0: section selection is local; focus belongs to the parent menu.
export class NativeMenuGroupSelectionManager extends SelectionManager {
  constructor(
    private parent: SelectionManager,
    state: MultipleSelectionState,
  ) {
    super(parent.collection, state)
  }

  override get focusedKey(): Key | null {
    return this.parent.focusedKey
  }
  override get isFocused(): boolean {
    return this.parent.isFocused
  }
  override setFocusedKey(key: Key | null, childFocusStrategy?: FocusStrategy): void {
    return this.parent.setFocusedKey(key, childFocusStrategy)
  }
  override setFocused(isFocused: boolean): void {
    this.parent.setFocused(isFocused)
  }
  override get childFocusStrategy(): FocusStrategy | null {
    return this.parent.childFocusStrategy
  }
}
