import type { NativeDateSegmentData } from "../../input/specs/CUIDateSegmentNativeComponent"

export type TNativeDateSegmentIdentity = Readonly<{
  ownerId: string
  segmentId: string
  bindingRevision: string
  target: number
}>
export type TNativeDateSegmentFrame = Readonly<{ windowId: string; epoch: number }>
const kinds = new Set(["status", "focus", "blur", "insert", "delete", "marked", "unmark", "selection"])
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0

export const createNativeDateSegmentLease = (identity: TNativeDateSegmentIdentity) => {
  let frame: TNativeDateSegmentFrame | null = null
  let sequence = 0,
    minimumEpoch = 0
  let nativeInstance: string | null = null
  let retired = false
  return {
    accept(data: NativeDateSegmentData) {
      if (
        retired ||
        !kinds.has(data.kind) ||
        !data.nativeInstance ||
        (nativeInstance !== null && data.nativeInstance !== nativeInstance) ||
        data.ownerId !== identity.ownerId ||
        data.segmentId !== identity.segmentId ||
        data.bindingRevision !== identity.bindingRevision ||
        data.target !== identity.target ||
        !integer(data.target) ||
        data.target === 0 ||
        !integer(data.surfaceId) ||
        data.surfaceId === 0 ||
        !integer(data.epoch) ||
        data.epoch < minimumEpoch ||
        !integer(data.sequence) ||
        data.sequence <= sequence ||
        !Number.isFinite(data.timestamp) ||
        data.timestamp < 0 ||
        !integer(data.selectionStart) ||
        !integer(data.selectionEnd) ||
        data.selectionStart > data.document.length ||
        data.selectionEnd > data.document.length ||
        !integer(data.replacementStart) ||
        !integer(data.replacementEnd) ||
        (data.kind !== "selection" && data.replacementStart > data.replacementEnd) ||
        !(
          (data.composingStart === -1 && data.composingEnd === -1) ||
          (integer(data.composingStart) &&
            integer(data.composingEnd) &&
            data.composingStart <= data.composingEnd &&
            data.composingEnd <= data.document.length)
        )
      )
        return false
      if (data.kind === "status") {
        if (frame && data.epoch < frame.epoch) return false
        if (frame && data.windowId !== frame.windowId && data.epoch <= frame.epoch) return false
        nativeInstance = data.nativeInstance
        sequence = data.sequence
        minimumEpoch = Math.max(minimumEpoch, data.epoch)
        frame = data.active && data.windowId ? { windowId: data.windowId, epoch: data.epoch } : null
        return true
      }
      if (!frame || !data.active || data.windowId !== frame.windowId || data.epoch !== frame.epoch) return false
      if ((data.kind === "focus" && !data.focused) || (data.kind === "blur" && data.focused)) return false
      if (["insert", "delete", "marked", "unmark"].includes(data.kind) && !data.focused) return false
      sequence = data.sequence
      return true
    },
    frame: () => frame,
    invalidate() {
      minimumEpoch = Math.max(minimumEpoch, (frame?.epoch ?? minimumEpoch) + 1)
      frame = null
    },
    retire() {
      retired = true
      frame = null
    },
  }
}
