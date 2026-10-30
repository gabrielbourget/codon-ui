import {
  createContext,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import type { TNativeContextValue, TNativeSlotProps } from "../../collection/context"
import type { Key } from "../../collection/state/types"
import type { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"

import type { TNativeBreadcrumbItem } from "./model"
import type { TNativeBreadcrumbTouchCaptureProps } from "./types"

export type TNativeBreadcrumbsContextProps = Omit<
  Partial<TNativeFocusViewProps>,
  "children" | "style" | "role" | "accessibilityRole"
> &
  TNativeSlotProps & {
    style?: StyleProp<TextStyle>
    "aria-describedby"?: string
    "aria-details"?: string
    isDisabled?: boolean
    onAction?: (key: Key) => void
    items?: Iterable<TNativeBreadcrumbItem>
    dependencies?: readonly unknown[]
    children?: ReactNode | ((item: TNativeBreadcrumbItem) => ReactNode)
    render?: (
      props: ComponentPropsWithoutRef<typeof NativeFocusHost> & RefAttributes<View>,
      state: undefined,
    ) => ReactElement
  } & TNativeBreadcrumbTouchCaptureProps

export const NativeBreadcrumbsContext = createContext<TNativeContextValue<TNativeBreadcrumbsContextProps, View>>(null)
