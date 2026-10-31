import type { NativeCollectionCommitData } from "../../../../packages/react-native/src/input/specs/CUICollectionRootNativeComponent"

export const PROBE = "codon-native-collection-gate-v1"
export const PHASES = [
  "initial",
  "parent-reorder",
  "local-reorder",
  "hidden",
  "restored",
  "context",
  "duplicate",
  "duplicate-recovered",
  "owner-mismatch",
  "owner-recovered",
  "empty",
  "reinserted",
  "remounted",
  "modal",
] as const
export type TPhase = (typeof PHASES)[number]
export type TNode = {
  descriptorId: string
  descriptorRevision: string
  parentDescriptorId: string
  target: number
  index: number
}

export const nodes = (packet: NativeCollectionCommitData): TNode[] => {
  const value: unknown = JSON.parse(packet.hierarchy)
  if (!Array.isArray(value)) throw new Error("Native hierarchy is not an array")
  return value.map((node: unknown) => {
    if (
      typeof node !== "object" ||
      node === null ||
      !("descriptorId" in node) ||
      typeof node.descriptorId !== "string" ||
      !("descriptorRevision" in node) ||
      typeof node.descriptorRevision !== "string" ||
      !("parentDescriptorId" in node) ||
      typeof node.parentDescriptorId !== "string" ||
      !("target" in node) ||
      typeof node.target !== "number" ||
      !Number.isInteger(node.target) ||
      !("index" in node) ||
      typeof node.index !== "number" ||
      !Number.isInteger(node.index)
    )
      throw new Error("Malformed native descriptor record")
    return node as TNode
  })
}

const generated = (id: string) => (id.startsWith("generated:") ? "$generated" : id)
const ORDERS: Partial<Record<TPhase, readonly string[]>> = {
  initial: ["$generated", "a", "nested", "b", "c"],
  "parent-reorder": ["b", "$generated", "c", "a", "nested"],
  "local-reorder": ["c", "a", "nested", "b", "$generated"],
  hidden: ["c", "a", "nested", "$generated"],
  restored: ["c", "a", "nested", "b", "$generated"],
  context: ["c", "a", "nested", "b", "$generated"],
  "duplicate-recovered": ["c", "a", "nested", "b", "$generated"],
  "owner-recovered": ["c", "a", "nested", "b", "$generated"],
  empty: [],
  reinserted: ["$generated", "a", "nested", "b", "c"],
  remounted: ["$generated", "a", "nested", "b", "c"],
  modal: ["$generated", "a", "nested", "b", "c"],
}

export const matches = (phase: TPhase, packet: NativeCollectionCommitData) => {
  if (!packet.attached || !packet.windowId || packet.surfaceId < 1 || packet.sequence < 1) return false
  if (phase === "duplicate") return !packet.complete && packet.error === "invalid-descriptor-identity"
  if (phase === "owner-mismatch") return !packet.complete && packet.error === "metadata-owner-mismatch"
  if (!packet.complete || packet.error) return false
  const actual = nodes(packet)
  if (JSON.stringify(actual.map((node) => generated(node.descriptorId))) !== JSON.stringify(ORDERS[phase])) return false
  const siblingPositions = new Map<string, number>()
  for (const node of actual) {
    const expectedParent = node.descriptorId === "nested" ? "a" : ""
    if (node.parentDescriptorId !== expectedParent || node.index !== (siblingPositions.get(expectedParent) ?? 0))
      return false
    siblingPositions.set(expectedParent, node.index + 1)
    if (phase === "context" && !node.descriptorRevision.endsWith(":second")) return false
  }
  return true
}

export const inspectionRequest = (packet: NativeCollectionCommitData, requestId: string) =>
  JSON.stringify({
    requestId,
    ownerId: packet.ownerId,
    rootId: packet.rootId,
    rootRevision: packet.rootRevision,
    target: packet.target,
    surfaceId: packet.surfaceId,
    windowId: packet.windowId,
    epoch: packet.epoch,
    sequence: packet.sequence,
  })
