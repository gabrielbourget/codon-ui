import { createContext, type Context } from "react"

import type { TNativeContextValue } from "../../collection/context"

import type { TNativeButtonProps, TNativeButtonRef } from "./types"

export const NativeButtonContext =
  createContext<TNativeContextValue<Partial<TNativeButtonProps>, TNativeButtonRef>>(null)

export const NATIVE_BUTTON_SELF_LABELLED_BY = Symbol("native-button-self-labelledby")
export type TNativeButtonLabelContextProps = Partial<TNativeButtonProps> & {
  [NATIVE_BUTTON_SELF_LABELLED_BY]?: readonly string[]
}

// The public context retains its existing type; private receivers share the same instance.
export const NativeButtonLabelContext = NativeButtonContext as Context<
  TNativeContextValue<TNativeButtonLabelContextProps, TNativeButtonRef>
>
