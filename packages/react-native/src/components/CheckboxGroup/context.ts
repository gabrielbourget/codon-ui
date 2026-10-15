import { createContext } from "react"

export type TNativeCheckboxGroupContext = Readonly<{
  value: readonly string[]
  isDisabled: boolean
  isReadOnly: boolean
  change: (member: string, selected: boolean) => void
}>
export const NativeCheckboxGroupContext = createContext<TNativeCheckboxGroupContext | undefined>(undefined)
