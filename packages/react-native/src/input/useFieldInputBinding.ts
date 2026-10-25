import { useInsertionEffect, useMemo, useState, useSyncExternalStore } from "react"

import { NativeFieldInputSession, type TNativeFieldInputPlan } from "./fieldInputBinding"
import { getNativeFieldInputModule } from "./fieldInputModule"
import NativeDocument from "./specs/NativeCUIFormDocument"

export const useNativeFieldInputBinding = (plan: TNativeFieldInputPlan | null) => {
  const [session] = useState(() => {
    if (!NativeDocument) throw new Error("field-input-document-module-unavailable")
    return new NativeFieldInputSession(getNativeFieldInputModule(), NativeDocument)
  })
  useSyncExternalStore(session.subscribe, session.version, session.version)
  useInsertionEffect(() => session.configure(plan), [session, plan])
  useInsertionEffect(() => () => session.retire(), [session])
  const scope = useMemo(() => (plan ? session.scope(plan) : null), [session, plan])
  const metadata = useMemo(() => session.metadataFor(plan), [session, plan])
  return { scope, metadata, status: session.status() }
}
