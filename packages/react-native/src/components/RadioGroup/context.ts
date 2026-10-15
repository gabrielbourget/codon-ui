import { createContext } from "react"

export type TNativeRadioGroupContext = Readonly<{
  value: string | null
  isDisabled: boolean
  isReadOnly: boolean
  change: (member: string) => void
}>
export const NativeRadioGroupContext = createContext<TNativeRadioGroupContext | undefined>(undefined)
