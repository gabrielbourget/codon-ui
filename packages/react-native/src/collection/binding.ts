import { createContext, type Context } from "react"

import type { TNativeCollectionNode } from "./snapshot"

export const NativeCollectionNodeContext: Context<TNativeCollectionNode<unknown> | null> =
  createContext<TNativeCollectionNode<unknown> | null>(null)

export const NativeCollectionItemBindingContext = createContext("")
