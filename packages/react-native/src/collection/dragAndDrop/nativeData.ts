// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Isolated consumers need this ambient Flow-only SDK script; it has no runtime module to import.
/// <reference path="./nativeBlob.d.ts" />
import SDKBlobManager from "react-native/Libraries/Blob/BlobManager"

import NativeModule from "../../input/specs/NativeCUIDragAndDrop"

import { NativeDropDataOwner } from "./transfer"
import type { TNativeDropDataDescriptor, TNativeDropDataDriver } from "./transfer"
import type { TNativeDropItem } from "./types"

type TNativeBlob = Blob & { close: () => void }
const blobManager = () => {
  // Exact pinned SDK networking Blob adoption; no global/polyfill is installed.
  if (!SDKBlobManager.isAvailable) throw new Error("Native drag data: original SDK Blob module is unavailable")
  return SDKBlobManager
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Native drag data: invalid native record")
  return value as Record<string, unknown>
}
const string = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Native drag data: invalid native string")
  return value
}
type TBody = { blobId: string; weak?: WeakRef<TNativeBlob>; strong?: TNativeBlob }

export class NativeDragDataBinding {
  readonly moduleId: string
  readonly owner: NativeDropDataOwner
  private bodies = new Map<string, TBody>()
  private live = true
  private claims = new Set<string>()

  constructor() {
    const native = NativeModule
    if (!native) throw new Error("Native drag data: native module is not linked")
    this.moduleId = native.getLease()
    if (!this.moduleId) throw new Error("Native drag data: native module lease is unavailable")
    const request = (handle: string, extra: object = {}) => {
      this.current()
      this.handle(handle)
      return JSON.stringify({ moduleId: this.moduleId, handle, ...extra })
    }
    const driver: TNativeDropDataDriver = {
      readText: (handle, type) => native.readText(request(handle, { type })),
      readFile: async (handle) => {
        const result = object(JSON.parse(await native.readFile(request(handle))))
        const bodyHandle = this.handle(result.handle)
        let blob: TNativeBlob | undefined
        try {
          this.current()
          const size = result.size
          if (
            typeof size !== "number" ||
            !Number.isSafeInteger(size) ||
            size < 0 ||
            result.offset !== 0 ||
            (result.lastModified !== undefined &&
              (typeof result.lastModified !== "number" || !Number.isFinite(result.lastModified)))
          )
            throw new Error("Native drag data: invalid original file dimensions or date")
          const blobId = string(result.blobId),
            type = string(result.type),
            name = string(result.name)
          const uri = result.uri === undefined ? undefined : string(result.uri)
          blob = blobManager().createFromOptions({ blobId, offset: 0, size, type })
          if (!native.adoptFile(request(bodyHandle)))
            throw new Error("Native drag data: original file body retired before adoption")
          if (this.bodies.has(bodyHandle)) throw new Error("Native drag data: duplicate original file body")
          this.bodies.set(
            bodyHandle,
            typeof WeakRef === "function" ? { blobId, weak: new WeakRef(blob) } : { blobId, strong: blob },
          )
          return { handle: bodyHandle, blob, name, uri, lastModified: result.lastModified as number | undefined }
        } catch (error) {
          blob?.close()
          native.releaseData(JSON.stringify({ moduleId: this.moduleId, handle: bodyHandle }))
          throw error
        }
      },
      readDirectory: async (handle, cursor) => {
        const result = object(JSON.parse(await native.readDirectory(request(handle, { cursor }))))
        try {
          if (!Array.isArray(result.items) || (result.cursor !== null && typeof result.cursor !== "string"))
            throw new Error("Native drag data: invalid original directory page")
          if (result.cursor !== null) this.handle(result.cursor)
          return { items: result.items.map((value) => this.descriptor(value)), cursor: result.cursor as string | null }
        } catch (error) {
          if (Array.isArray(result.items))
            for (const value of result.items) {
              if (
                value &&
                typeof value === "object" &&
                "handle" in value &&
                typeof value.handle === "string" &&
                value.handle.startsWith(`${this.moduleId}:`)
              )
                native.releaseData(JSON.stringify({ moduleId: this.moduleId, handle: value.handle }))
            }
          if (typeof result.cursor === "string" && result.cursor.startsWith(`${this.moduleId}:`))
            native.closeDirectory(JSON.stringify({ moduleId: this.moduleId, handle, cursor: result.cursor }))
          throw error
        }
      },
      closeDirectory: (handle, cursor) =>
        native.closeDirectory(
          JSON.stringify({ moduleId: this.moduleId, handle: this.handle(handle), cursor: this.handle(cursor) }),
        ),
      release: (handle) => {
        this.handle(handle)
        const body = this.bodies.get(handle)
        this.bodies.delete(handle)
        try {
          if (body) {
            const blob = body.weak?.deref() ?? body.strong
            if (blob) blob.close()
            else blobManager().release(body.blobId)
          }
        } finally {
          native.releaseData(JSON.stringify({ moduleId: this.moduleId, handle }))
        }
      },
    }
    this.owner = new NativeDropDataOwner(driver)
  }

  private current() {
    if (!this.live) throw new Error("Native drag data: module binding has retired")
  }

  private handle(value: unknown) {
    const handle = string(value)
    if (!handle.startsWith(`${this.moduleId}:`)) throw new Error("Native drag data: foreign native resource")
    return handle
  }

  descriptor(value: unknown): TNativeDropDataDescriptor {
    const record = object(value),
      handle = this.handle(record.handle)
    if (record.kind === "text") {
      if (!Array.isArray(record.types) || record.types.some((type) => typeof type !== "string"))
        throw new Error("Native drag data: invalid text representations")
      return { kind: "text", handle, types: record.types as string[] }
    }
    if (record.kind === "file") return { kind: "file", handle, name: string(record.name), type: string(record.type) }
    if (record.kind === "directory") return { kind: "directory", handle, name: string(record.name) }
    throw new Error("Native drag data: unknown original item kind")
  }

  async takeItems(handle: string, current: () => boolean): Promise<TNativeDropItem[]> {
    this.current()
    this.handle(handle)
    if (!NativeModule || this.claims.has(handle)) throw new Error("Native drag data: transfer already claimed")
    this.claims.add(handle)
    const request = JSON.stringify({ moduleId: this.moduleId, handle })
    let items: TNativeDropItem[] = []
    try {
      const records: unknown = JSON.parse(await NativeModule.readItems(request))
      this.current()
      if (!current() || !Array.isArray(records)) throw new Error("Native drag data: original drop owner retired")
      items = this.items(records)
      if (!current() || !NativeModule.adoptItems(request))
        throw new Error("Native drag data: original drop retired before data adoption")
      return items
    } catch (error) {
      for (const item of items) item.release()
      NativeModule.releaseData(request)
      throw error
    } finally {
      this.claims.delete(handle)
    }
  }

  items(records: readonly unknown[]): TNativeDropItem[] {
    this.current()
    const items: TNativeDropItem[] = []
    try {
      for (const record of records) items.push(this.owner.item(this.descriptor(record)))
      return items
    } catch (error) {
      for (const item of items) item.release()
      throw error
    }
  }

  dispose() {
    if (!this.live) return
    this.live = false
    this.owner.dispose()
  }
}
