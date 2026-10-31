import {
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type RefAttributes,
  type RefObject,
} from "react"
import type { View } from "react-native"

import { NativeFocusView } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"

import { useNativeTable } from "./context"
import { createNativeTableStickyBinding } from "./stickyBinding"
import type { TNativeTableStickyInsets } from "./stickyStyles"
import type { TNativeTableColumnRenderState } from "./types"

export const StickyColumnHost = ({
  host,
  target,
  enabled,
  insets,
  canAct,
  render,
  values,
}: {
  host: TNativeFocusViewProps & RefAttributes<View>
  target: RefObject<View | null>
  enabled: boolean
  insets: TNativeTableStickyInsets
  canAct: () => boolean
  render?: (host: TNativeFocusViewProps & RefAttributes<View>, values: TNativeTableColumnRenderState) => ReactElement
  values: TNativeTableColumnRenderState
}) => {
  const table = useNativeTable()
  const current = useRef({ target, root: table.root, enabled, canAct, insets, custom: !!render, table })
  useInsertionEffect(() => {
    current.current = { target, root: table.root, enabled, canAct, insets, custom: !!render, table }
  })
  const binding = useRef<ReturnType<typeof createNativeTableStickyBinding> | null>(null)
  useLayoutEffect(() => {
    const owned = createNativeTableStickyBinding(
      () => current.current.target.current,
      () => current.current.root.current,
      () => current.current.enabled && current.current.canAct(),
      () => ({
        backgroundColor: current.current.table.sticky.backgroundColor,
        session: current.current.table.stickySession(),
      }),
    )
    binding.current = owned
    const unsubscribe = table.subscribeStickyLifetime(() => {
      const latest = current.current
      owned.synchronize(latest.enabled, latest.insets, latest.custom)
    })
    return () => {
      if (binding.current === owned) binding.current = null
      unsubscribe()
      owned.dispose()
    }
  }, [table.subscribeStickyLifetime])
  useLayoutEffect(() => {
    binding.current?.synchronize(enabled, insets, !!render)
  })
  return render ? render(host, values) : <NativeFocusView {...host} />
}
