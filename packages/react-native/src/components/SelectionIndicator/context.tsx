import { createContext, type ReactNode } from "react"
import type { View } from "react-native"

import { NativeSelectionIndicatorContext, type TNativeContextValue } from "../../collection/context"

import type { TNativeSelectionIndicatorProps } from "./types"

export const NativeSelectionIndicatorPropsContext =
  createContext<TNativeContextValue<TNativeSelectionIndicatorProps, View>>(null)

export const NativeSelectionIndicatorProvider = ({
  isSelected,
  children,
}: {
  isSelected: boolean
  children?: ReactNode
}) => (
  <NativeSelectionIndicatorContext.Provider value={{ isSelected }}>
    <NativeSelectionIndicatorPropsContext.Provider value={{ isSelected }}>
      {children}
    </NativeSelectionIndicatorPropsContext.Provider>
  </NativeSelectionIndicatorContext.Provider>
)
