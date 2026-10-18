import { useContext, type PropsWithChildren } from "react"

import { NativeBackdropAdapterContext } from "./context"
import { NativeBackdropHost } from "./NativeBackdropHost"

export const NativeBackdropWindow = ({ children, testID }: PropsWithChildren<{ testID: string }>) => {
  const adapter = useContext(NativeBackdropAdapterContext)
  return adapter ? (
    <NativeBackdropHost testID={testID} style={{ flex: 1 }}>
      {children}
    </NativeBackdropHost>
  ) : (
    children
  )
}
