import { useInsertionEffect, useMemo, useSyncExternalStore } from "react"

import {
  NativeFieldInputSession,
  type TNativeFieldInputPlan,
  type TNativeFieldInputMetadata,
} from "./fieldInputBinding"
import { getNativeFieldInputModule } from "./fieldInputModule"
import NativeDocument from "./specs/NativeCUIFormDocument"

const subscribeNone = () => () => {}
const zero = () => 0
const inactiveMetadata: TNativeFieldInputMetadata = { binding: () => "", commit: () => {}, receive: () => {} }
const inactiveStatus = Object.freeze({ ready: false, pending: false, error: "" })

export const useNativeFieldInputBinding = (plan: TNativeFieldInputPlan | null, enabled = true) => {
  const session = useMemo(() => {
    if (!enabled) return null
    if (!NativeDocument) throw new Error("field-input-document-module-unavailable")
    return new NativeFieldInputSession(getNativeFieldInputModule(), NativeDocument)
  }, [enabled])
  useSyncExternalStore(session?.subscribe ?? subscribeNone, session?.version ?? zero, session?.version ?? zero)
  useInsertionEffect(() => session?.configure(plan), [session, plan])
  useInsertionEffect(() => () => session?.retire(), [session])
  const scope = useMemo(() => (plan && session ? session.scope(plan) : null), [session, plan])
  const metadata = useMemo(() => session?.metadataFor(plan) ?? inactiveMetadata, [session, plan])
  return { scope, metadata, status: session?.status() ?? inactiveStatus }
}
