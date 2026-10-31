import type { View } from "react-native"

import type { TNativeBackdropLease } from "./types"

type TFrameOwner = Readonly<{
  lease: TNativeBackdropLease
  target: View
  receiver: View
  targetTag: number
  receiverTag: number
  radius: number
  scopeOwnerId: string
  windowId: string
  epoch: number
}>
type TRendererPort = Readonly<{
  request: (encoded: string) => Promise<string>
  frame: (callback: () => void) => number
  cancel: (handle: number) => void
  failed: (error: Error) => void
}>

export const createNativeBackdropRenderer = (ownerId: string, port: TRendererPort) => {
  let owner: TFrameOwner | null = null
  let revision = 0
  let sequence = 0
  let scheduled: number | undefined
  let busy = false
  let closed = false
  let failure: Error | undefined
  const current = (captured: TFrameOwner, version: number) =>
    !closed && !failure && owner === captured && revision === version && captured.lease.isCurrent()
  const fail = (error: unknown) => {
    if (closed || failure) return
    failure = error instanceof Error ? error : new Error(String(error))
    port.failed(failure)
  }
  const command = async (action: string, fields: Record<string, unknown> = {}) => {
    const response: unknown = JSON.parse(await port.request(JSON.stringify({ ownerId, action, ...fields })))
    if (!response || typeof response !== "object" || !("ownerId" in response) || response.ownerId !== ownerId)
      throw new Error("Native backdrop: invalid renderer response")
    return response as Record<string, unknown>
  }
  const schedule = () => {
    if (!owner || !owner.lease.isCurrent() || busy || scheduled !== undefined || closed || failure) return
    scheduled = port.frame(() => {
      scheduled = undefined
      void draw()
    })
  }
  const draw = async () => {
    const captured = owner
    const version = revision
    if (!captured || busy || !current(captured, version)) return
    busy = true
    const frameId = `${ownerId}:${++sequence}`
    const generation = captured.lease.generation
    try {
      const result = await command("capture", {
        frameId,
        generation,
        target: captured.targetTag,
        receiver: captured.receiverTag,
        radius: captured.radius,
        scopeOwnerId: captured.scopeOwnerId,
        windowId: captured.windowId,
        epoch: captured.epoch,
      })
      if (!current(captured, version)) {
        await command("discard", { frameId, generation })
        return
      }
      if (result.frameId !== frameId || result.generation !== generation)
        throw new Error("Native backdrop: captured frame identity changed")
      if (result.retired === true) {
        owner = null
        revision++
        return
      }
      if (result.superseded === true) return
      if (result.staged !== true) throw new Error("Native backdrop: incomplete captured frame")
      const published = await command("publish", { frameId, generation })
      if (
        current(captured, version) &&
        (published.frameId !== frameId ||
          published.generation !== generation ||
          (published.published !== true && published.superseded !== true))
      )
        throw new Error("Native backdrop: frame publication rejected")
    } catch (error) {
      if (current(captured, version)) fail(error)
    } finally {
      busy = false
      schedule()
    }
  }
  const pause = () => {
    if (closed) return
    revision++
    owner = null
    if (scheduled !== undefined) port.cancel(scheduled)
    scheduled = undefined
    void command("pause").catch(fail)
  }
  return {
    update: (next: TFrameOwner | null) => {
      if (closed || failure) return
      if (!next || !next.lease.isCurrent()) {
        pause()
        return
      }
      revision++
      owner = next
      schedule()
    },
    pause,
    close: () => {
      if (closed) return
      closed = true
      revision++
      owner = null
      if (scheduled !== undefined) port.cancel(scheduled)
      scheduled = undefined
      void command("release").catch(() => {})
    },
  }
}
