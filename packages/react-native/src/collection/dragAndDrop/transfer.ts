import type { TNativeDirectoryDropItem, TNativeDropItem, TNativeFileDropItem, TNativeReadOnlyFile } from "./types"

export type TNativeDropDataDescriptor =
  | Readonly<{ handle: string; kind: "text"; types: readonly string[] }>
  | Readonly<{ handle: string; kind: "file"; type: string; name: string }>
  | Readonly<{ handle: string; kind: "directory"; name: string }>
export type TNativeDropDirectoryPage = Readonly<{
  items: readonly TNativeDropDataDescriptor[]
  cursor: string | null
}>
export type TNativeDropFileBody = Readonly<{
  handle: string
  blob: Blob
  name: string
  lastModified?: number
  uri?: string
}>
// These handles are issued only from an original OS transfer. The platform owns
// grants/copies and native Blob storage; no caller URI or path is accepted here.
export type TNativeDropDataDriver = {
  readText: (handle: string, type: string | null) => Promise<string>
  readFile: (handle: string) => Promise<TNativeDropFileBody>
  readDirectory: (handle: string, cursor: string | null) => Promise<TNativeDropDirectoryPage>
  closeDirectory: (handle: string, cursor: string) => void
  release: (handle: string) => void
}
type TResource = {
  handle: string
  active: boolean
  operations: number
  holders: number
  tokens: Set<object>
  release: () => void
  collected: (token: object) => void
}
const finalizer =
  typeof FinalizationRegistry === "function"
    ? new FinalizationRegistry<{ resource: TResource; token: object }>(({ resource, token }) =>
        resource.collected(token),
      )
    : undefined

export class NativeDropDataOwner {
  private active = true
  private resources = new Map<string, TResource>()
  private cleanupErrors: unknown[] = []

  constructor(private driver: TNativeDropDataDriver) {}

  private current(resource: TResource) {
    if (!this.active || !resource.active) throw new Error("Native drag data: resource has been released")
  }

  private retain(handle: string): TResource {
    if (!this.active || !handle || this.resources.has(handle))
      throw new Error("Native drag data: missing, duplicate or retired transfer handle")
    const resource: TResource = {
      handle,
      active: true,
      operations: 0,
      holders: 0,
      tokens: new Set(),
      collected: (token) => {
        if (!resource.tokens.delete(token)) return
        resource.holders--
        if (resource.active && resource.holders === 0 && resource.operations === 0) {
          try {
            resource.release()
          } catch (error) {
            this.cleanupErrors.push(error)
          }
        }
      },
      release: () => {
        if (!resource.active) return
        resource.active = false
        this.resources.delete(handle)
        for (const token of resource.tokens) finalizer?.unregister(token)
        resource.tokens.clear()
        this.driver.release(handle)
      },
    }
    this.resources.set(handle, resource)
    return resource
  }

  private attach<T extends object>(value: T, resource: TResource): T {
    const token = {}
    resource.holders++
    resource.tokens.add(token)
    finalizer?.register(value, { resource, token }, token)
    return value
  }

  private async using<T>(resource: TResource, work: () => Promise<T>): Promise<T> {
    this.current(resource)
    resource.operations++
    try {
      return await work()
    } finally {
      resource.operations--
      if (resource.active && resource.holders === 0 && resource.operations === 0) resource.release()
    }
  }

  private readText(resource: TResource, type: string | null) {
    return this.using(resource, async () => {
      const text = await this.driver.readText(resource.handle, type)
      this.current(resource)
      return text
    })
  }

  private readFile(resource: TResource): Promise<TNativeReadOnlyFile> {
    return this.using(resource, async () => {
      const result = await this.driver.readFile(resource.handle)
      // The returned Blob/URI has its own platform lifetime. Releasing the drop
      // item must not invalidate a File already handed to application code.
      if (!this.active || !resource.active) {
        this.driver.release(result.handle)
        this.current(resource)
      }
      const retained = this.retain(result.handle)
      try {
        if (
          !result.blob ||
          !Number.isFinite(result.blob.size) ||
          result.blob.size < 0 ||
          typeof result.blob.type !== "string" ||
          typeof result.blob.slice !== "function" ||
          typeof result.name !== "string" ||
          (result.lastModified !== undefined && !Number.isFinite(result.lastModified)) ||
          (result.uri !== undefined && typeof result.uri !== "string")
        )
          throw new Error("Native drag data: incomplete original native file body")
        const body = result.blob
        const slice = body.slice.bind(body)
        // Retain the real native Blob prototype/data so FileReader, fetch and
        // FormData see the original SDK Blob rather than a structural substitute.
        const metadata: PropertyDescriptorMap = {
          name: { value: result.name, enumerable: true },
          release: { value: retained.release },
          slice: {
            value: (start?: number, end?: number, contentType?: string) => {
              this.current(retained)
              return slice(start, end, contentType)
            },
          },
        }
        if (result.lastModified !== undefined) metadata.lastModified = { value: result.lastModified, enumerable: true }
        if (result.uri !== undefined) metadata.uri = { value: result.uri, enumerable: true }
        Object.defineProperties(body, metadata)
        return this.attach(body as TNativeReadOnlyFile, retained)
      } catch (error) {
        retained.release()
        throw error
      }
    })
  }

  private async *entries(resource: TResource): AsyncIterable<TNativeFileDropItem | TNativeDirectoryDropItem> {
    let cursor: string | null = null
    let pending: readonly TNativeDropDataDescriptor[] = []
    let offset = 0
    try {
      do {
        this.current(resource)
        const page = await this.using(resource, () => this.driver.readDirectory(resource.handle, cursor))
        cursor = page.cursor
        pending = page.items
        offset = 0
        this.current(resource)
        while (offset < pending.length) {
          this.current(resource)
          const descriptor = pending[offset]
          if (descriptor.kind === "text") throw new Error("Native drag data: directory contains a non-file entry")
          // Once yielded, a child retains its own original OS grant/copy even if
          // iteration is cancelled or the parent directory is released.
          const child = this.item(descriptor)
          offset++
          yield child as TNativeFileDropItem | TNativeDirectoryDropItem
        }
        pending = []
      } while (cursor !== null)
    } finally {
      for (; offset < pending.length; offset++) this.driver.release(pending[offset].handle)
      if (cursor !== null) this.driver.closeDirectory(resource.handle, cursor)
    }
  }

  item(descriptor: TNativeDropDataDescriptor): TNativeDropItem {
    const resource = this.retain(descriptor.handle)
    try {
      switch (descriptor.kind) {
        case "text": {
          const available = new Set(descriptor.types)
          const types = new Set(available)
          if (types.size === 0 || [...types].some((type) => typeof type !== "string" || !type))
            throw new Error("Native drag data: missing original text representations")
          return this.attach(
            {
              kind: "text" as const,
              types,
              getText: (type: string) => {
                if (!available.has(type)) return Promise.reject(new Error("Native drag data: unavailable text type"))
                return this.readText(resource, type)
              },
              release: resource.release,
            },
            resource,
          )
        }
        case "file":
          if (typeof descriptor.name !== "string" || typeof descriptor.type !== "string")
            throw new Error("Native drag data: incomplete original file metadata")
          return this.attach(
            Object.freeze({
              kind: "file" as const,
              type: descriptor.type,
              name: descriptor.name,
              getText: () => this.readText(resource, null),
              getFile: () => this.readFile(resource),
              release: resource.release,
            }),
            resource,
          )
        case "directory":
          if (typeof descriptor.name !== "string")
            throw new Error("Native drag data: incomplete original directory metadata")
          return this.attach(
            Object.freeze({
              kind: "directory" as const,
              name: descriptor.name,
              getEntries: () => {
                this.current(resource)
                return this.attach(this.entries(resource), resource)
              },
              release: resource.release,
            }),
            resource,
          )
        default:
          throw new Error("Native drag data: unknown original item kind")
      }
    } catch (error) {
      resource.release()
      throw error
    }
  }

  takeCleanupErrors() {
    const errors = this.cleanupErrors
    this.cleanupErrors = []
    return errors
  }

  dispose() {
    if (!this.active) return
    this.active = false
    let failure: unknown
    for (const resource of [...this.resources.values()]) {
      try {
        resource.release()
      } catch (error) {
        failure ??= error
      }
    }
    if (failure) throw failure
  }
}
