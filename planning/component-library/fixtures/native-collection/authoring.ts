import type { TNativeCollectionKey } from "../../../../packages/react-native/src/collection/snapshot"

export const AUTHORING_PROBE = "codon-native-collection-authoring-v1"
export const AUTHORING_PHASES = [
  "initial",
  "parent-reorder",
  "local-reorder",
  "hidden-child",
  "restored-child",
  "context",
  "one-row",
  "zero-rows",
  "all-rows",
  "root-hidden",
  "root-restored",
  "empty",
  "reinserted",
  "remounted",
  "modal",
] as const
export type TAuthoringPhase = (typeof AUTHORING_PHASES)[number]
export type TAuthoringValue = Readonly<{ role: string }>
export type TObservedNode = {
  key: TNativeCollectionKey
  role: string
  type: string
  parentKey: TNativeCollectionKey | null
  prevKey: TNativeCollectionKey | null
  nextKey: TNativeCollectionKey | null
  index: number
  textValue: string
  originalValue: boolean
  originalRef: boolean
  descriptorId?: string
  descriptorRevision?: string
  metadataTarget?: number
}

const INITIAL = ["generated", "a", "nested", "b", "c"] as const
const LOCAL = ["c", "a", "nested", "b", "generated"] as const
export const AUTHORING_ORDERS: Record<TAuthoringPhase, readonly string[]> = {
  initial: INITIAL,
  "parent-reorder": ["b", "generated", "c", "a", "nested"],
  "local-reorder": LOCAL,
  "hidden-child": ["c", "a", "nested", "generated"],
  "restored-child": LOCAL,
  context: LOCAL,
  "one-row": LOCAL,
  "zero-rows": LOCAL,
  "all-rows": LOCAL,
  "root-hidden": LOCAL,
  "root-restored": LOCAL,
  empty: [],
  reinserted: INITIAL,
  remounted: INITIAL,
  modal: INITIAL,
}
