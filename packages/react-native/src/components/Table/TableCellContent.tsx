import { useId, useSyncExternalStore, type ReactNode } from "react"
import { View } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import ClampHost from "../../input/specs/CUIClampHostNativeComponent"

const subscribe = () => () => {}
const snapshot = () => 0

export const TableCellContent = ({
  children,
  maxLines,
  truncate,
  windowId,
}: {
  children: ReactNode
  maxLines: number | undefined
  truncate: boolean | undefined
  windowId: string | null
}) => {
  const ownerId = useId()
  const scope = useNativeKeyScope()
  useSyncExternalStore(scope?.subscribe ?? subscribe, scope?.snapshot ?? snapshot, snapshot)
  const session = scope?.acknowledgedSession()
  const epoch = JSON.stringify([ownerId, windowId, session?.windowId, session?.epoch])
  return (
    <ClampHost
      ownerId={ownerId}
      windowId={windowId ?? ""}
      epoch={epoch}
      hasClamp={!!maxLines}
      maximumLines={Number.isFinite(maxLines) ? maxLines : 0}
      noWrap={!!truncate}
      style={{ minWidth: 0, flexShrink: 1, alignSelf: "stretch", overflow: maxLines ? "hidden" : "visible" }}
    >
      <View collapsable={false} style={{ minWidth: 0, flexShrink: 0, alignSelf: "stretch" }}>
        {children}
      </View>
    </ClampHost>
  )
}
