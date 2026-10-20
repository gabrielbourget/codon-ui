/* Copyright 2020, 2023 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
import { useCallback, useMemo, useState } from "react"

import type { FocusStrategy, Key } from "../../collection/state/types"
import { useControlledState } from "../../collection/state/useControlledState"

type TOverlayProps = { isOpen?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void }
export type TNativeRootMenuTriggerState = {
  isOpen: boolean
  setOpen: (open: boolean) => void
  focusStrategy: FocusStrategy | null
  open: (strategy?: FocusStrategy | null) => void
  toggle: (strategy?: FocusStrategy | null) => void
  close: () => void
  expandedKeysStack: Key[]
  openSubmenu: (triggerKey: Key, level: number) => void
  closeSubmenu: (triggerKey: Key, level: number) => void
}
export type TNativeSubmenuTriggerState = {
  isOpen: boolean
  focusStrategy: FocusStrategy | null
  open: (strategy?: FocusStrategy | null) => void
  toggle: (strategy?: FocusStrategy | null) => void
  close: () => void
  closeAll: () => void
  submenuLevel: number
  setOpen: () => void
}
export const useNativeMenuTriggerState = (props: TOverlayProps): TNativeRootMenuTriggerState => {
  const [isOpen, setOpen] = useControlledState(props.isOpen, props.defaultOpen || false, props.onOpenChange)
  const open = useCallback(() => setOpen(true), [setOpen])
  const close = useCallback(() => setOpen(false), [setOpen])
  const toggle = useCallback(() => setOpen(!isOpen), [setOpen, isOpen])
  const [focusStrategy, setFocusStrategy] = useState<FocusStrategy | null>(null)
  const [expandedKeysStack, setExpandedKeysStack] = useState<Key[]>([])
  const closeAll = () => {
    setExpandedKeysStack([])
    close()
  }
  const openSubmenu = (triggerKey: Key, level: number) => {
    setExpandedKeysStack((old) => (level > old.length ? old : [...old.slice(0, level), triggerKey]))
  }
  const closeSubmenu = (triggerKey: Key, level: number) => {
    setExpandedKeysStack((old) => (old[level] === triggerKey ? old.slice(0, level) : old))
  }
  return {
    isOpen,
    setOpen,
    focusStrategy,
    open: (strategy: FocusStrategy | null = null) => {
      setFocusStrategy(strategy)
      open()
    },
    toggle: (strategy: FocusStrategy | null = null) => {
      setFocusStrategy(strategy)
      toggle()
    },
    close: closeAll,
    expandedKeysStack,
    openSubmenu,
    closeSubmenu,
  }
}
export const useNativeSubmenuTriggerState = (
  triggerKey: Key,
  state: TNativeRootMenuTriggerState,
): TNativeSubmenuTriggerState => {
  const { expandedKeysStack, openSubmenu, closeSubmenu, close: closeAll } = state
  const [submenuLevel] = useState(expandedKeysStack.length)
  const isOpen = useMemo(
    () => expandedKeysStack[submenuLevel] === triggerKey,
    [expandedKeysStack, triggerKey, submenuLevel],
  )
  const [focusStrategy, setFocusStrategy] = useState<FocusStrategy | null>(null)
  const open = useCallback(
    (strategy?: FocusStrategy | null) => {
      setFocusStrategy(strategy ?? null)
      openSubmenu(triggerKey, submenuLevel)
    },
    [openSubmenu, submenuLevel, triggerKey],
  )
  const close = useCallback(() => {
    setFocusStrategy(null)
    closeSubmenu(triggerKey, submenuLevel)
  }, [closeSubmenu, submenuLevel, triggerKey])
  const toggle = useCallback(
    (strategy?: FocusStrategy | null) => {
      setFocusStrategy(strategy ?? null)
      if (isOpen) close()
      else open(strategy)
    },
    [close, open, isOpen],
  )
  return useMemo(
    () => ({
      focusStrategy,
      isOpen,
      open,
      close,
      closeAll,
      submenuLevel,
      // Kept for complete parity with the pinned overlay state contract.
      setOpen: () => {},
      toggle,
    }),
    [isOpen, open, close, closeAll, focusStrategy, toggle, submenuLevel],
  )
}
