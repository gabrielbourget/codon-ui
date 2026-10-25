import { createContext } from "react"

import type { TNativeComboBoxKeyboardEvent } from "./types"

export const NativeComboBoxEditorKeysContext = createContext<{
  register: () => () => void
  ownedKeyDown: (event: TNativeComboBoxKeyboardEvent) => void
} | null>(null)
