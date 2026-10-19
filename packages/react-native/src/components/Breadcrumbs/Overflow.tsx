import type { TextStyle } from "react-native"

import { NativeOptionList } from "../NativeOptionList"

import type { TNativeBreadcrumbItem } from "./model"

type TProps = {
  items: readonly TNativeBreadcrumbItem[]
  label: string
  style: TextStyle
  disabled: boolean
  autoFocus?: boolean
  onAction: (item: TNativeBreadcrumbItem) => void
}
export const NativeBreadcrumbOverflow = (props: TProps) => (
  <NativeOptionList {...props} getItemLifetime={(item) => item.href} />
)
